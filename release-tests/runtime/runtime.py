#!/usr/bin/env python3
"""Hosted-only disposable runtime gate. Import and --help never invoke Docker.
Parent builds candidate and verifies/loads saved previous artifact. No registry path.
"""
import argparse, datetime, hashlib, json, os, re, secrets, shutil, signal, subprocess, tempfile, time, traceback
from pathlib import Path
PG='postgres@sha256:aa90e97ee862e558111d34cfb8b2c4bec768c2b039fb791341686928560263b3'
REDIS='redis@sha256:ca0acbb137c1dc3339c8b147a58fd6f42775d4599327b50e7b116c23de501af2'
PREVIOUS_ID='sha256:b593554ed71091d152a73b15995818e7460e69ea41f98c16b022af52a6e521ca'
PREVIOUS_SOURCE='b538938f0fb21f06a44fea9272e3822eddd795c7ca372c4c8c42f0d4abc7a368'
PREVIOUS_ARCHIVE='9f3439e95cf28f8c1e456dfa6ec27dfa63d28afe7d80b46cf156d861ea5f6c36'
IMAGE_ID=re.compile(r'^sha256:[a-f0-9]{64}$')
TYPES='/app/apps/backend/.medusa/server/.medusa/types'
STATIC='/app/apps/backend/static'
LABEL='ci.release.runtime.owner'
ROOT=Path(__file__).resolve().parent
APP_COMMAND=['/app/node_modules/@medusajs/cli/dist/index.js','start','--types=false','--host','0.0.0.0','--port','9000']
ERRORS=re.compile(r'CI_INDEX_INIT_FAILED|INDEX_STARTUP_(?:NOT_READY|QUERY_FAILED|TIMEOUT)|\b(?:EROFS|ENOENT|EACCES|UnhandledPromiseRejection|uncaughtException)\b|Error starting server|permission denied|password authentication failed|"level"\s*:\s*"error"|\berror:',re.I)
DIAGNOSTIC_CODES={'INDEX_DIAG_ENTRY','INDEX_DIAG_CONFIG_IMPORTED','INDEX_DIAG_CATALOG_IMPORTED','INDEX_DIAG_SCHEMA_COMPLETE','INDEX_DIAG_PG_CONNECT_BEGIN','INDEX_DIAG_PG_CONNECT_COMPLETE','INDEX_DIAG_CATALOG_BEGIN','INDEX_DIAG_CATALOG_COMPLETE','INDEX_DIAG_OK','INDEX_DIAG_UNKNOWN_ERROR','INDEX_DIAG_MODULE_NOT_FOUND','INDEX_DIAG_EACCES','INDEX_DIAG_ENOENT','INDEX_DIAG_EROFS','INDEX_DIAG_EGRESS_DENIED','INDEX_DIAG_UNIX_SOCKET_DENIED','INDEX_DIAG_PLAN_UNSUPPORTED','INDEX_DIAG_SCHEMA_MISMATCH','INDEX_DIAG_PARTITION_INVALID','INDEX_DIAG_INDEX_INVALID','INDEX_DIAG_FUNCTION_INVALID','INDEX_DIAG_ROLE_MISMATCH','INDEX_DIAG_SQL_PERMISSION','INDEX_DIAG_SQL_AUTH','INDEX_DIAG_SQL_SYNTAX','INDEX_DIAG_SQL_UNDEFINED_TABLE'}
DIAGNOSTIC_CODES.update({
    'INDEX_DIAG_INDEX_ROW_MISSING','INDEX_DIAG_INDEX_CAPTURE_UNAVAILABLE','INDEX_DIAG_INDEX_FIELDS_MATCH',
    'INDEX_DIAG_INDEX_TABLE_MISMATCH','INDEX_DIAG_INDEX_METHOD_MISMATCH','INDEX_DIAG_INDEX_VALID_MISMATCH',
    'INDEX_DIAG_INDEX_READY_MISMATCH','INDEX_DIAG_INDEX_UNIQUE_MISMATCH','INDEX_DIAG_INDEX_KEY_COUNT_MISMATCH',
    'INDEX_DIAG_INDEX_ATTRIBUTE_COUNT_MISMATCH','INDEX_DIAG_INDEX_PREDICATE_MISMATCH',
    'INDEX_DIAG_INDEX_EXPRESSION_MISMATCH','INDEX_DIAG_INDEX_KEY_MISMATCH','INDEX_DIAG_SQL_QUERY_ERROR',
})

def diagnostic_codes(text):
    result=[]
    for line in text.splitlines():
        try: row=json.loads(line)
        except (ValueError,TypeError): continue
        if isinstance(row,dict) and set(row)=={'marker','code'} and row.get('marker')=='CI_RUNTIME_DIAGNOSTIC' and isinstance(row.get('code'),str) and row['code'] in DIAGNOSTIC_CODES:
            result.append(row['code'])
    return result

AUDIT_ASSERTIONS=('native_catalog','distinct_observer_pid','before_commit_invisible',
    'after_commit_visible','exact_eight_fields','rollback_barrier','rollback_invisible',
    'composite_boundaries','native_constraints','schema_unchanged_after_failures',
    'update_delete_immutable','runtime_ddl_replication_denied','runtime_truncate_privilege_denied')
AUDIT_NEGATIVE_COUNTS={'uniqueness':2,'not_null':8,'plan_hash':3,'id_hash':1,
    'lengths':4,'json_objects':9,'provider':15,'row_guards':3,'role_denials':5}

def audit_receipt(raw):
    # A successful process exit or old webhook-only PASS is not audit evidence.
    try:
        row=json.loads(raw)
        audit=row['audit']; assertions=audit['assertions']; counts=audit['negative_cases']
        if row['status']!='PASS' or row['duplicate'] is not True or row['atomic_rollback'] is not True:
            raise ValueError('fixture')
        if type(audit['version']) is not int or audit['version']!=1 or audit['status']!='PASS' or audit['synthetic_storage_only'] is not True:
            raise ValueError('version')
        if set(assertions)!=set(AUDIT_ASSERTIONS) or any(assertions[x] is not True for x in AUDIT_ASSERTIONS):
            raise ValueError('assertions')
        if counts!=AUDIT_NEGATIVE_COUNTS or any(type(x) is not int for x in counts.values()):
            raise ValueError('counts')
        if type(audit['committed_rows']) is not int or audit['committed_rows']!=3:
            raise ValueError('rows')
        if any(not isinstance(audit[x],str) or not re.fullmatch('[a-f0-9]{64}',audit[x]) for x in ['schema_sha256','rows_sha256']):
            raise ValueError('hashes')
        if audit['owner_truncate_guard']!='pending-harness' or audit['migration_down']!='not-executed':
            raise ValueError('owner')
        return audit
    except (ValueError,KeyError,TypeError,AttributeError) as e:
        raise RuntimeError('AUDIT_RECEIPT_REQUIRED') from e

def stamp(value):
    # Docker RFC3339 has nanoseconds: preserve ordering as integer nanoseconds.
    m=re.fullmatch(r'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z',value or '')
    if not m: raise RuntimeError('INVALID_DOCKER_TIMESTAMP')
    seconds=int(datetime.datetime.fromisoformat(m[1]+'+00:00').timestamp())
    return seconds*10**9+int((m[2] or '').ljust(9,'0'))

def validate_images(candidate,previous):
    if not IMAGE_ID.fullmatch(candidate) or not IMAGE_ID.fullmatch(previous) or candidate==previous or previous!=PREVIOUS_ID:
        raise RuntimeError('EXACT_DISTINCT_LOCAL_CONFIG_IDS_REQUIRED')

def init_markers(logs,started):
    markers=[]
    for line in logs.splitlines():
        parts=line.split(' ',1)
        if len(parts)!=2: continue
        try: row=json.loads(parts[1])
        except (ValueError,TypeError): continue
        if row.get('marker')=='CI_INDEX_INIT_COMPLETE':
            if stamp(parts[0])<stamp(started): continue
            if stamp(row['at'])<stamp(started) or not isinstance(row.get('pid'),int):
                raise RuntimeError('STALE_INITIALIZATION_MARKER')
            markers.append(row)
    if not markers: raise RuntimeError('ACTUAL_INDEX_INIT_MARKER_REQUIRED')
    return markers

class Harness:
    def __init__(self,a):
        self.a=a; self.prefix='ci-four-'+secrets.token_hex(5); self.deadline=time.monotonic()+2100
        self.net=self.prefix; self.pg=self.prefix+'-pg'; self.redis=self.prefix+'-redis'; self.app=self.prefix+'-app'
        self.firewall=[]; self.volumes=[self.prefix+'-pgdata',self.prefix+'-static']; self.containers=[]
        self.network_created=False; self.created_volumes=[]; self.pg_started=False; self.previous_starts=set()
        self.secret_dir=Path(tempfile.mkdtemp(prefix=self.prefix,dir='/dev/shm')); self.secret_dir.chmod(0o700)
        self.values=[secrets.token_hex(32) for _ in range(8)]
        self.evidence={'status':'FAIL','scope':'isolated native runtime/restart/rollback and physical DB fixtures; NOT provider/full checkout/production acceptance','phases':[],'cleanup':False,'diagnostic_stage':'RUNTIME_GUARD'}
        self.a.out.mkdir(parents=True,exist_ok=True)
        # Sibling of --out, never in the workflow's public artifact allowlist.
        base=self.a.out.parent/'runtime-diagnosis';base.mkdir(mode=0o700,exist_ok=True);base.chmod(0o700)
        self.private_dir=Path(tempfile.mkdtemp(prefix=self.prefix+'-',dir=base));self.private_dir.chmod(0o700)
    def private_record(self,kind,data):
        fd=os.open(self.private_dir/(kind+'-'+secrets.token_hex(8)+'.json'),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f: json.dump(data,f,indent=2)
    def capture_owned_failure(self):
        # Raw state/logs contain env/credentials: private only, before any removal.
        original=self.deadline;self.deadline=time.monotonic()+30
        try:
            for name in dict.fromkeys(self.containers):
                if time.monotonic()>=self.deadline: break
                try:
                    p=self.proc('docker','inspect',name,timeout=5)
                    if p.returncode: continue
                    obj=json.loads(p.stdout)[0]
                    if obj.get('Config',{}).get('Labels',{}).get(LABEL)!=self.prefix:
                        self.private_record('ownership-refused',{'code':'CONTAINER_OWNERSHIP_MISMATCH'});continue
                    self.private_record('owned-state',{'container':name,'inspect':obj})
                    p=self.proc('docker','logs','--timestamps',name,timeout=5)
                    self.private_record('owned-logs',{'container':name,'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
                except Exception:
                    self.private_record('capture-failure',{'code':'PRIVATE_CAPTURE_FAILED'})
        finally: self.deadline=original
    def proc(self,*args,input=None,timeout=60):
        left=self.deadline-time.monotonic()
        if left<=0: raise RuntimeError('RUNTIME_DEADLINE_2100S')
        return subprocess.run(args,input=input,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=min(timeout,left))
    def run(self,*args,input=None,timeout=60,check=True):
        try: p=self.proc(*args,input=input,timeout=timeout)
        except subprocess.TimeoutExpired as e:
            def text(v): return v.decode('utf8','replace') if isinstance(v,bytes) else (v or '')
            self.private_record('command-timeout',{'argv':args,'stdout':text(e.stdout),'stderr':text(e.stderr),'code':'COMMAND_TIMEOUT'})
            raise RuntimeError('COMMAND_TIMEOUT') from e
        if p.returncode:
            self.private_record('command-failure',{'argv':args,'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
        codes=diagnostic_codes(p.stdout)+diagnostic_codes(p.stderr)
        if codes:
            self.evidence.setdefault('diagnostic_codes',[]).extend(codes)
            for code in codes: print(json.dumps({'marker':'CI_RUNTIME_DIAGNOSTIC','code':code}),flush=True)
        if check and p.returncode: raise RuntimeError('COMMAND_FAILED')
        return p.stdout+p.stderr if args[:2]==('docker','logs') else p.stdout
    def docker(self,*args,**kw): return self.run('docker',*args,**kw)
    def scrub(self,text):
        for value in self.values: text=text.replace(value,'[REDACTED]')
        return re.sub(r'(postgres(?:ql)?://)[^\s@]+@',r'\1[REDACTED]@',text)
    def sql(self,q,user='postgres'):
        return self.docker('exec','-i',self.pg,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','acceptance',input=q)
    def wait_pg_ready(self):
        # The image's temporary initdb server accepts Unix sockets only. Require
        # the final TCP server AND an authenticated query in the target database.
        # Password travels only on exec stdin, never in argv or a shell literal.
        command='IFS= read -r password; export PGPASSWORD="$password"; exec psql -X -qAt -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d acceptance'
        for _ in range(30):
            probe=self.proc('docker','exec',self.pg,'pg_isready','-h','127.0.0.1','-p','5432','-U','postgres','-d','acceptance','-t','1',timeout=5)
            if probe.returncode==0:
                query=self.proc('docker','exec','-i',self.pg,'sh','-c',command,input=self.values[1]+'\nSELECT 1;\n',timeout=5)
                if query.returncode==0 and query.stdout.strip()=='1': return
            time.sleep(1)
        raise RuntimeError('EMPTY_PG_NOT_READY')
    def revoke_db_credentials(self):
        # Read existing fixed fixture roles, then execute only quoted ALTERs for
        # those rows. Early failures before CREATE ROLE are valid cleanup cases.
        self.sql(r"""SELECT format('ALTER ROLE %I NOLOGIN PASSWORD NULL;',rolname)
FROM pg_roles WHERE rolname IN ('app','migrator') ORDER BY rolname
\gexec
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename IN ('app','migrator') AND pid<>pg_backend_pid();""")
        if self.sql("SELECT count(*) FROM pg_authid WHERE rolname IN ('app','migrator') AND (rolcanlogin OR rolpassword IS NOT NULL);").strip()!='0': raise RuntimeError('revocation')
        self.evidence['db_credentials_revoked']=True
    def inspect(self,name): return json.loads(self.docker('inspect',name))[0]
    def envfile(self,name,role):
        p=self.secret_dir/name
        env={'NODE_ENV':'production','APP_ENV':'production','CI':'true','DATABASE_URL':f'postgresql://{role}:{self.values[0 if role=="app" else 1]}@pg:5432/acceptance?sslmode=disable','DATABASE_SCHEMA':'public','DATABASE_SSL':'false','REDIS_URL':f'redis://:{self.values[2]}@redis:6379','JWT_SECRET':self.values[3],'COOKIE_SECRET':self.values[4],'STRIPE_SECRET_API_KEY':'sk_test_'+self.values[5],'STRIPE_WEBHOOK_SECRET':'whsec_'+self.values[6],'STRIPE_PAYMENT_WEBHOOK_SECRET':'whsec_'+self.values[6],'RESEND_API_KEY':'re_integration_fixture_placeholder','RESEND_FROM_EMAIL':'fixture@example.invalid','COMMERCE_PAYMENTS_ENABLED':'false','COMMERCE_PAYOUTS_ENABLED':'false','DISABLE_ALGOLIA':'true','ENABLE_ALGOLIA':'false','MEDUSA_TELEMETRY_DISABLED':'true','NODE_OPTIONS':'--require=/ci/egress-deny.cjs --require=/ci/init-observer.cjs','XDG_CONFIG_HOME':'/tmp/config','BACKEND_URL':'http://app:9000','PORT':'9000'}
        for key in ['STORE_CORS','ADMIN_CORS','VENDOR_CORS','AUTH_CORS']: env[key]='http://localhost:9000'
        p.write_text(''.join(f'{k}={v}\n' for k,v in env.items())); p.chmod(0o600)
        return p
    def owned_run(self,name,image,args,command,timeout=180):
        self.containers.append(name)
        return self.docker('run','--name',name,'--label',f'{LABEL}={self.prefix}',*args,image,*command,timeout=timeout)
    def sandbox(self,name,image,env,command,extra=(),detach=False):
        args=['--network',self.net,'--read-only','--user','1001:1001','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','3g','--memory-swap','3g','--log-driver','json-file','--cpus','2','--pids-limit','256','--restart','no','--tmpfs','/tmp:rw,nosuid,nodev,size=256m,uid=1001,gid=1001','--tmpfs',TYPES+':rw,nosuid,nodev,noexec,size=64m,uid=1001,gid=1001','--env-file',str(env),'--entrypoint','node']
        # No log rotation: complete container lifetime logs are captured each phase.
        for namefile in ['egress-deny.cjs','fixture.cjs','init-observer.cjs','index-diagnostics.cjs']:
            args+=['--mount',f'type=bind,src={ROOT/namefile},dst=/ci/{namefile},readonly']
        args+=list(extra)
        if detach: args+=['-d']
        return self.owned_run(name,image,args,command)
    def app_start(self,image,env,verify_types=True):
        dotenv=self.secret_dir/'dotenv-placeholder';dotenv.write_text('# Disposable fixture; container env only.\n');dotenv.chmod(0o644)
        self.sandbox(self.app,image,env,APP_COMMAND,extra=['--network-alias','app','--workdir','/app/apps/backend/.medusa/server','--mount',f'type=volume,src={self.volumes[1]},dst={STATIC}','--mount',f'type=bind,src={dotenv},dst=/app/apps/backend/.medusa/server/.env.production,readonly'],detach=True)
        c=self.inspect(self.app); hc=c['HostConfig']
        if c['Image']!=image or hc.get('PortBindings') or hc['NetworkMode']!=self.net or not hc['ReadonlyRootfs'] or hc['RestartPolicy']['Name']!='no': raise RuntimeError('SANDBOX_CONFIG_MISMATCH')
        if c['Config'].get('User')!='1001:1001' or not c['Config'].get('Healthcheck',{}).get('Test'): raise RuntimeError('NATIVE_HEALTHCHECK_REQUIRED')
        if set(hc.get('Tmpfs',{}))!={'/tmp',TYPES}: raise RuntimeError('ONLY_EXACT_TYPES_TMPFS_ALLOWED')
        if verify_types: self.docker('exec',self.app,'node','-e',f"const f=require('fs'),s=f.statSync({json.dumps(TYPES)});if(s.uid!==1001||s.gid!==1001)process.exit(1)")
        return c['State']['StartedAt']
    def capture_logs(self,phase):
        logs=self.docker('logs','--timestamps',self.app)
        file=phase+'.complete.log'; data=self.scrub(logs)
        (self.a.out/file).write_text(data)
        return logs,{'file':file,'sha256':hashlib.sha256(data.encode()).hexdigest(),'complete':True}
    def snapshot(self):
        # One physical repeatable-read snapshot of EVERY public base table, all rows
        # and columns, ordered as canonical JSON. Covers financial/ACK/audit/link data.
        q="""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT format('SELECT %L || E''\\t'' || row_to_json(t)::text FROM (SELECT * FROM %I.%I) t ORDER BY row_to_json(t)::text COLLATE "C";',table_name,table_schema,table_name)
FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name
\\gexec
COMMIT;"""
        data=self.sql(q)
        tables=self.sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;").splitlines()
        required={'ci_acceptance_sentinel','marketplace_stripe_event_receipt','marketplace_capture_consumer_ack','reconciliation_repair_audit'}
        if not required.issubset(tables): raise RuntimeError('NATIVE_FINANCIAL_ACK_SCHEMA_MISSING')
        counts=json.loads(self.sql("SELECT json_object_agg(name,n) FROM (SELECT table_name AS name,(xpath('/row/n/text()',query_to_xml(format('SELECT count(*) AS n FROM public.%I',table_name),false,true,'')))[1]::text::bigint AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') t;").strip())
        self.evidence['snapshot_tables']=counts
        return hashlib.sha256(data.encode()).hexdigest()
    def schema(self):
        raw=self.docker('exec',self.pg,'pg_dump','-U','postgres','-d','acceptance','--schema-only','--no-owner','--no-privileges')
        stable='\n'.join(line for line in raw.splitlines() if not line.startswith(('\\restrict ', '\\unrestrict ')))
        return hashlib.sha256(stable.encode()).hexdigest()
    def owner_audit_controls(self):
        # Disposable DB only, after app fixture and before baseline. No privileges
        # widened, no native down/DDL executed, no alternate audit installation.
        before=self.snapshot();schema=self.schema()
        result=self.sql("""BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL ROLE migrator;
DO $test$
DECLARE message text; truncate_rejected boolean := false; down_rejected boolean := false;
BEGIN
  IF current_user <> 'migrator' OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='reconciliation_repair_audit'
      AND pg_get_userbyid(c.relowner)=current_user
  ) THEN RAISE EXCEPTION 'AUDIT_OWNER_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reconciliation_repair_audit) THEN
    RAISE EXCEPTION 'AUDIT_POPULATED_FIXTURE_REQUIRED';
  END IF;
  BEGIN
    TRUNCATE TABLE public.reconciliation_repair_audit;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF message <> 'reconciliation audit is immutable: update/delete/truncate forbidden' THEN
      RAISE EXCEPTION 'AUDIT_TRUNCATE_WRONG_ERROR';
    END IF;
    truncate_rejected := true;
  END;
  IF NOT truncate_rejected THEN RAISE EXCEPTION 'AUDIT_TRUNCATE_GUARD_MISSING'; END IF;
  -- Test only the inspected native down's population guard SQL, not its DDL,
  -- migration runner, bookkeeping or empty-down removal. Always parent ROLLBACK.
  LOCK TABLE public.reconciliation_repair_audit IN ACCESS EXCLUSIVE MODE;
  BEGIN
    EXECUTE $guard$DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM public.reconciliation_repair_audit) THEN
        RAISE EXCEPTION 'refusing rollback with durable reconciliation audit evidence';
      END IF;
    END $$;$guard$;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF message <> 'refusing rollback with durable reconciliation audit evidence' THEN
      RAISE EXCEPTION 'AUDIT_DOWN_GUARD_WRONG_ERROR';
    END IF;
    down_rejected := true;
  END;
  IF NOT down_rejected THEN RAISE EXCEPTION 'AUDIT_DOWN_GUARD_MISSING'; END IF;
END $test$;
SELECT 'AUDIT_OWNER_CONTROLS_P0001';
ROLLBACK;""",user='postgres').strip()
        if result!='AUDIT_OWNER_CONTROLS_P0001': raise RuntimeError('AUDIT_OWNER_RECEIPT_REQUIRED')
        if self.snapshot()!=before or self.schema()!=schema: raise RuntimeError('AUDIT_OWNER_ROWS_OR_SCHEMA_CHANGED')
        return {'status':'PASS','owner_truncate_guard':'PASS','owner_truncate_sqlstate':'P0001',
            'owner_rows_schema_unchanged':True,'populated_down_guard_sql':True,
            'migration_down':'not-executed','empty_down_removal':'untested'}
    def static_hash(self,offline=False):
        command="const f=require('fs'),p=require('path'),h=require('crypto').createHash('sha256');function walk(d){for(const n of f.readdirSync(d).sort()){const a=p.join(d,n),s=f.lstatSync(a);h.update(a+':'+s.mode+':'+s.uid+':'+s.gid+'\\n');if(s.isDirectory())walk(a);else if(s.isFile())h.update(f.readFileSync(a));else throw Error('STATIC_SPECIAL_FILE')}}walk('/app/apps/backend/static');process.stdout.write(h.digest('hex'))"
        if offline:
            return self.owned_run(self.prefix+'-negative-static',self.a.candidate,['--network','none','--read-only','--user','1001:1001','--cap-drop','ALL','--entrypoint','node','--mount',f'type=volume,src={self.volumes[1]},dst={STATIC},readonly'],['-e',command]).strip()
        return self.docker('exec',self.app,'node','-e',command).strip()
    def healthy(self,phase,started,expected_kind):
        start=time.monotonic(); good=None; probes={}; markers=[]
        while time.monotonic()-start<390:
            c=self.inspect(self.app); state=c['State']
            if not state.get('Running') or c.get('RestartCount',0)!=0 or state['StartedAt']!=started or c['Image'] not in [self.a.candidate,self.a.previous]: raise RuntimeError(phase+':NATIVE_STATE_CHANGED')
            health=state.get('Health',{}); status=health.get('Status')
            if status=='unhealthy': raise RuntimeError(phase+':NATIVE_UNHEALTHY')
            logs,receipt=self.capture_logs(phase)
            if ERRORS.search(logs): raise RuntimeError(phase+':STARTUP_OR_WORKER_LOG_ERROR')
            try: markers=init_markers(logs,started)
            except RuntimeError as e:
                if str(e)!='ACTUAL_INDEX_INIT_MARKER_REQUIRED': raise
                markers=[]
            server_ready=False
            for line in logs.splitlines():
                parts=line.split(' ',1)
                if len(parts)!=2: continue
                try: row=json.loads(parts[1])
                except ValueError: continue
                if row.get('message')=='Server is ready on port: 9000' and stamp(parts[0])>=stamp(started): server_ready=True
            ready=server_ready and any(m.get('kind')==expected_kind for m in markers)
            ready_at=max((stamp(m['at']) for m in markers),default=stamp(started))
            for probe in health.get('Log',[]):
                ps,pe=stamp(probe['Start']),stamp(probe['End'])
                if ps<stamp(started): continue  # Restart retains old inspect health logs.
                if pe<ps: raise RuntimeError(phase+':NATIVE_PROBE_CLOCK_ERROR')
                if ready and ps>=ready_at:
                    if probe['ExitCode']!=0: raise RuntimeError(phase+':NATIVE_PROBE_FAILED')
                    probes[probe['Start']]=probe
            if status=='healthy' and ready and probes:
                if good is None: good=time.monotonic()
                if time.monotonic()-good>=300:
                    if len(probes)<2 or (max(stamp(p['End']) for p in probes.values())-min(stamp(p['Start']) for p in probes.values()))<290*10**9: raise RuntimeError('PROBE_CHRONOLOGY_TOO_SHORT')
                    return {'started_at':started,'native_continuous_healthy_seconds':300,'initialization_markers':markers,'native_probes':list(probes.values()),'logs':receipt}
            elif good is not None: raise RuntimeError(phase+':HEALTH_REGRESSION')
            time.sleep(1)
        raise RuntimeError(phase+':NATIVE_HEALTH_300S_NOT_REACHED')
    def preservation(self,baseline,schema,static):
        if self.snapshot()!=baseline or self.schema()!=schema or self.static_hash()!=static: raise RuntimeError('FINANCIAL_ACK_SCHEMA_STATIC_CHANGED')
    def phase(self,image,name,baseline,schema):
        self.evidence.update(diagnostic_stage='RUNTIME_PHASE',diagnostic_phase=name)
        started=self.app_start(image,self.envfile('runtime.env','app'))
        if started in self.previous_starts: raise RuntimeError('NEW_STARTED_AT_REQUIRED')
        self.previous_starts.add(started)
        static=self.static_hash()
        if getattr(self,'static_baseline',static)!=static: raise RuntimeError('STATIC_CHANGED_BETWEEN_IMAGES')
        self.static_baseline=static
        kind='native' if image==self.a.previous else 'readonly'
        receipt=self.healthy(name,started,kind);self.preservation(baseline,schema,static)
        receipt.update(phase=name,image=image,all_public_tables_sha256=baseline,schema_sha256=schema,static_sha256=static)
        self.evidence['phases'].append(receipt)
        logs,receipt['logs']=self.capture_logs(name)
        if ERRORS.search(logs): raise RuntimeError('PRE_RESTART_LOG_ERROR')
        self.docker('restart','-t','8',self.app)
        restarted=self.inspect(self.app)['State']['StartedAt']
        if stamp(restarted)<=stamp(started) or restarted in self.previous_starts: raise RuntimeError('FRESH_RESTART_REQUIRED')
        self.previous_starts.add(restarted)
        self.evidence['diagnostic_phase']=name+'-restart'
        receipt=self.healthy(name+'-restart',restarted,kind);self.preservation(baseline,schema,static)
        receipt.update(phase=name+'-restart',image=image,all_public_tables_sha256=baseline,schema_sha256=schema,static_sha256=static)
        self.evidence['phases'].append(receipt)
        self.docker('stop','-t','8',self.app)
        logs,receipt['logs']=self.capture_logs(name+'-restart')
        if ERRORS.search(logs): raise RuntimeError('COMPLETE_PHASE_LOG_ERROR')
        self.docker('rm',self.app)
    def negative(self,baseline,schema):
        self.evidence.update(diagnostic_stage='RUNTIME_STARTUP_NEGATIVE',diagnostic_phase='startup-negative')
        # Only credential differs, same DB/image/native command after successful boot.
        env=self.envfile('negative.env','app')
        env.write_text(env.read_text().replace(self.values[0],self.values[7]))
        receipt={'status':'FAIL','injection':'invalid DB password only','actual_app_exit_verified':False,'cleanup_verified':False}
        self.evidence['startup_negative']=receipt
        try:
            started=self.app_start(self.a.candidate,env,verify_types=False)
            for _ in range(90):
                c=self.inspect(self.app)
                if not c['State']['Running']: break
                time.sleep(1)
            else: raise RuntimeError('NEGATIVE_ACTUAL_APP_DID_NOT_EXIT')
            state=c['State'];logs,logreceipt=self.capture_logs('startup-negative')
            if state['ExitCode']==0 or state.get('OOMKilled') or not re.search('password authentication failed',logs,re.I): raise RuntimeError('NEGATIVE_WRONG_FAILURE')
            if c['RestartCount']!=0 or state['StartedAt']!=started: raise RuntimeError('NEGATIVE_UNEXPECTED_RESTART')
            receipt.update(actual_app_exit_verified=True,actual_app_exit_code=state['ExitCode'],started_at=started,finished_at=state['FinishedAt'],logs=logreceipt)
            if self.snapshot()!=baseline or self.schema()!=schema or self.static_hash(offline=True)!=self.static_baseline: raise RuntimeError('NEGATIVE_DATA_SCHEMA_STATIC_CHANGED')
            receipt['status']='PASS'
        finally:
            try: _,receipt['logs']=self.capture_logs('startup-negative')
            except Exception: receipt['log_capture_failed']=True;receipt['status']='FAIL'
            self.remove_container(self.app)
            receipt['cleanup_verified']=True
    def execute(self):
        if os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('RUNNER_ENVIRONMENT')!='github-hosted': raise RuntimeError('ONLY_GITHUB_HOSTED_RUNNER')
        validate_images(self.a.candidate,self.a.previous)
        self.evidence['diagnostic_stage']='RUNTIME_PREVIOUS_RECEIPT'
        manifest=json.loads(self.a.previous_manifest.read_text())
        if any(manifest.get(k)!=v for k,v in {'image':PREVIOUS_ID,'image_id':PREVIOUS_ID,'source_hash':PREVIOUS_SOURCE,'gzip_sha256':PREVIOUS_ARCHIVE,'gzip_bytes':273965027}.items()) or not all(manifest.get(k) is True for k in ['config_sha256_verified','ordered_layer_sha256_verified','source_receipt_verified']): raise RuntimeError('PREVIOUS_SAVED_ARTIFACT_RECEIPT_REQUIRED')
        layers=manifest.get('diff_ids')
        if not isinstance(layers,list) or len(layers)!=11 or not all(IMAGE_ID.fullmatch(x) for x in layers): raise RuntimeError('PREVIOUS_LAYER_RECEIPT_INVALID')
        for image in [self.a.candidate,self.a.previous]:
            self.evidence['diagnostic_stage']='RUNTIME_IMAGE_PINS'
            c=json.loads(self.docker('image','inspect',image))[0]
            if c['Id']!=image: raise RuntimeError('LOCAL_CONFIG_ID_MISMATCH')
            if image==self.a.previous and c['RootFS']['Layers']!=layers: raise RuntimeError('PREVIOUS_ORDERED_LAYERS_MISMATCH')
        self.evidence['diagnostic_stage']='RUNTIME_FIXTURE_PULL'
        for image in [PG,REDIS]: self.docker('pull',image,timeout=90)
        self.evidence['diagnostic_stage']='RUNTIME_ISOLATION'
        self.docker('network','create','--internal','--label',f'{LABEL}={self.prefix}',self.net);self.network_created=True
        net=json.loads(self.docker('network','inspect',self.net))[0]
        if not net['Internal'] or net.get('EnableIPv6'): raise RuntimeError('INTERNAL_IPV4_NETWORK_REQUIRED')
        bridge='br-'+net['Id'][:12]
        for rule in [['INPUT','-i',bridge,'-m','comment','--comment',self.prefix,'-j','DROP'],['DOCKER-USER','-i',bridge,'!','-o',bridge,'-m','comment','--comment',self.prefix,'-j','DROP']]:
            self.run('sudo','-n','iptables','-I',rule[0],'1',*rule[1:]);self.firewall.append(rule)
            self.run('sudo','-n','iptables','-C',rule[0],*rule[1:])
        for v in self.volumes: self.docker('volume','create','--label',f'{LABEL}={self.prefix}',v);self.created_volumes.append(v)
        self.evidence['diagnostic_stage']='RUNTIME_FIXTURE_START'
        pg_env=self.secret_dir/'pg.env';pg_env.write_text('POSTGRES_DB=acceptance\nPOSTGRES_PASSWORD='+self.values[1]+'\n');pg_env.chmod(0o600)
        self.owned_run(self.pg,PG,['-d','--network',self.net,'--network-alias','pg','--memory','1500m','--cpus','1','--pids-limit','128','--env-file',str(pg_env),'--mount',f'type=volume,src={self.volumes[0]},dst=/var/lib/postgresql/data'],[]);self.pg_started=True
        redis_conf=self.secret_dir/'redis.conf';redis_conf.write_text('bind 0.0.0.0\nprotected-mode yes\nrequirepass '+self.values[2]+'\nsave ""\nappendonly no\n');redis_conf.chmod(0o644)
        self.owned_run(self.redis,REDIS,['-d','--network',self.net,'--network-alias','redis','--memory','256m','--cpus','0.5','--pids-limit','64','--mount',f'type=bind,src={redis_conf},dst=/ci-redis.conf,readonly'],['redis-server','/ci-redis.conf'])
        self.evidence['diagnostic_stage']='RUNTIME_EMPTY_FIXTURES'
        self.wait_pg_ready()
        if self.sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';").strip()!='0': raise RuntimeError('DATABASE_NOT_EMPTY')
        if self.docker('exec','-i',self.redis,'sh','-c','IFS= read -r auth; export REDISCLI_AUTH="$auth"; redis-cli DBSIZE',input=self.values[2]+'\n').strip()!='0': raise RuntimeError('REDIS_NOT_EMPTY')
        self.evidence.update(empty_pg=True,empty_redis=True)
        self.sql(f"REVOKE ALL ON DATABASE acceptance FROM PUBLIC; REVOKE ALL ON SCHEMA public FROM PUBLIC; CREATE ROLE migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '{self.values[1]}'; CREATE ROLE app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '{self.values[0]}'; GRANT CONNECT ON DATABASE acceptance TO app,migrator; ALTER SCHEMA public OWNER TO migrator; GRANT USAGE ON SCHEMA public TO app;")
        migrator=self.envfile('migrator.env','migrator')
        baked=self.owned_run(self.prefix+'-source',self.a.candidate,['--network','none','--read-only','--user','1001:1001','--cap-drop','ALL','--entrypoint','node'],['-e',"process.stdout.write(require('fs').readFileSync('/release/source.sha256','utf8').trim())"])
        if not re.fullmatch('[a-f0-9]{64}',baked): raise RuntimeError('BAKED_SOURCE_HASH_INVALID')
        with migrator.open('a') as f: f.write('RELEASE_MIGRATION_APPROVED=yes\nRELEASE_MIGRATION_SOURCE_SHA256='+baked+'\nRELEASE_MIGRATE_LINKS=safe\nRELEASE_MIGRATE_SCRIPTS=skip\n')
        self.evidence['diagnostic_stage']='RUNTIME_MIGRATIONS'
        self.sandbox(self.prefix+'-migration',self.a.candidate,migrator,['/app/deploy/release/migrate-native.cjs'])
        runtime=self.envfile('runtime.env','app')
        self.sql('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO app;')
        indexenv=self.secret_dir/'index.env';indexenv.write_text(runtime.read_text()+f'RELEASE_INDEX_BOOTSTRAP_APPROVED=yes\nINDEX_MIGRATOR_ROLE=migrator\nMIGRATOR_DATABASE_URL=postgresql://migrator:{self.values[1]}@pg:5432/acceptance?sslmode=disable\n');indexenv.chmod(0o600)
        self.evidence['diagnostic_stage']='RUNTIME_INDEX_BOOTSTRAP'
        self.sandbox(self.prefix+'-index',self.a.candidate,indexenv,['/ci/index-diagnostics.cjs','/app/apps/backend/.medusa/server/medusa-config.js'])
        self.sql('CREATE TABLE ci_acceptance_sentinel(id text PRIMARY KEY,payload jsonb NOT NULL);',user='migrator')
        self.sql('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO app; REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,app; GRANT EXECUTE ON FUNCTION public.count_estimate(text) TO app; ALTER ROLE migrator NOLOGIN PASSWORD NULL;')
        self.evidence['diagnostic_stage']='RUNTIME_ROLE_RESTRICTIONS'
        audit=self.sql("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) OR has_database_privilege('app','acceptance','CREATE') OR has_database_privilege('app','acceptance','TEMP') OR has_schema_privilege('app','public','CREATE') OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='app')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND has_function_privilege('app',p.oid,'EXECUTE') AND (p.oid<>'public.count_estimate(text)'::regprocedure OR p.prosecdef));").strip()
        if audit!='f' or self.sql("SELECT has_function_privilege('app','public.count_estimate(text)','EXECUTE');").strip()!='t': raise RuntimeError('RUNTIME_ROLE_OR_FUNCTION_PRIVILEGES_INVALID')
        self.evidence['runtime_role_restricted']=True
        self.evidence['diagnostic_stage']='RUNTIME_PHYSICAL_FIXTURE'
        raw_fixture=self.sandbox(self.prefix+'-fixture',self.a.candidate,runtime,['/ci/fixture.cjs']).strip()
        self.evidence['physical_pg_fixture_receipt']=raw_fixture
        self.evidence['audit_native']=audit_receipt(raw_fixture)
        self.evidence['audit_native']['status']='PENDING_OWNER_CONTROLS'
        self.evidence['diagnostic_stage']='RUNTIME_AUDIT_OWNER_CONTROLS'
        self.evidence['audit_native'].update(self.owner_audit_controls())
        self.owned_run(self.prefix+'-static-init',self.a.candidate,['--network','none','--read-only','--user','0:0','--cap-drop','ALL','--cap-add','CHOWN','--entrypoint','node','--mount',f'type=volume,src={self.volumes[1]},dst=/fixture'],['-e',"const f=require('fs');f.writeFileSync('/fixture/ci-sentinel','ci-fixture-no-loss');f.chownSync('/fixture',1001,1001);f.chownSync('/fixture/ci-sentinel',1001,1001)"])
        self.evidence['diagnostic_stage']='RUNTIME_BASELINE'
        baseline=self.snapshot();schema=self.schema()
        for image,phase in [(self.a.candidate,'candidate'),(self.a.previous,'previous'),(self.a.candidate,'candidate-restored')]: self.phase(image,phase,baseline,schema)
        self.negative(baseline,schema)
        if self.evidence['audit_native'].get('owner_truncate_guard')!='PASS' or self.evidence['audit_native'].get('owner_rows_schema_unchanged') is not True:
            raise RuntimeError('AUDIT_OWNER_RECEIPT_REQUIRED')
        self.evidence['status']='PASS'
        self.evidence['diagnostic_stage']='COMPLETE'
    def remove_container(self,c):
        ids=self.docker('ps','-aq','--filter','name=^/'+c+'$').strip()
        if ids:
            obj=self.inspect(c)
            if obj['Config'].get('Labels',{}).get(LABEL)!=self.prefix: raise RuntimeError('CONTAINER_OWNERSHIP_MISMATCH')
            self.docker('rm','-f',c)
        if self.docker('ps','-aq','--filter','name=^/'+c+'$').strip(): raise RuntimeError('CONTAINER_REMOVAL_UNVERIFIED')
    def cleanup(self):
        errors=[]
        for c in set(self.containers)-{self.pg,self.redis}:
            try: self.remove_container(c)
            except Exception: errors.append('app_container_remove')
        if self.pg_started:
            try:
                self.revoke_db_credentials()
            except Exception: errors.append('revocation_unverified')
        for c in set(self.containers):
            try: self.remove_container(c)
            except Exception: errors.append('container_remove')
        for v in self.created_volumes:
            try:
                obj=json.loads(self.docker('volume','inspect',v))[0]
                if obj.get('Labels',{}).get(LABEL)!=self.prefix: raise RuntimeError('volume_owner')
                self.docker('volume','rm',v)
                if self.docker('volume','ls','-q','--filter','name=^'+v+'$').strip(): raise RuntimeError('volume_exists')
            except Exception: errors.append('volume_remove')
        if self.network_created:
            try:
                obj=json.loads(self.docker('network','inspect',self.net))[0]
                if obj.get('Labels',{}).get(LABEL)!=self.prefix: raise RuntimeError('network_owner')
                self.docker('network','rm',self.net)
                if self.docker('network','ls','-q','--filter','name=^'+self.net+'$').strip(): raise RuntimeError('network_exists')
            except Exception: errors.append('network_remove')
        for rule in self.firewall:
            try:
                self.run('sudo','-n','iptables','-D',rule[0],*rule[1:])
                p=self.proc('sudo','-n','iptables','-C',rule[0],*rule[1:])
                if p.returncode!=1: raise RuntimeError('firewall_removal_unverified')
            except Exception: errors.append('firewall_remove')
        try:
            if self.docker('ps','-aq','--filter',f'label={LABEL}={self.prefix}').strip() or self.docker('volume','ls','-q','--filter',f'label={LABEL}={self.prefix}').strip() or self.docker('network','ls','-q','--filter',f'label={LABEL}={self.prefix}').strip(): errors.append('owned_resources_remain')
        except Exception: errors.append('owned_resources_unverified')
        try:
            for chain in {rule[0] for rule in self.firewall}:
                if self.prefix in self.run('sudo','-n','iptables','-S',chain): errors.append('firewall_rules_remain')
        except Exception: errors.append('firewall_inventory_unverified')
        try: shutil.rmtree(self.secret_dir)
        except Exception: errors.append('secret_tmpfs_remove')
        self.evidence.update(ephemeral_tmpfs_removed=not self.secret_dir.exists(),external_provider_keys_created=False,cleanup=not errors,cleanup_errors=errors)
        if errors:
            self.evidence['status']='FAIL'
            self.evidence['diagnostic_stage']='RUNTIME_CLEANUP'
        (self.a.out/'runtime.json').write_text(self.scrub(json.dumps(self.evidence,indent=2))+'\n')

def main():
    p=argparse.ArgumentParser();p.add_argument('--candidate',required=True,help='already locally built exact config sha256 ID');p.add_argument('--previous',default=PREVIOUS_ID);p.add_argument('--previous-manifest',type=Path,required=True,help='parent-verified saved artifact acquisition manifest');p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    h=Harness(a)
    def expired(*_): raise RuntimeError('RUNTIME_DEADLINE_2100S')
    signal.signal(signal.SIGALRM,expired);signal.alarm(2070)
    try: h.execute()
    except Exception as e:
        h.evidence['failure_stage']=h.evidence.get('diagnostic_stage')
        h.private_record('harness-exception',{'exception':traceback.format_exc()})
        h.evidence['error']='RUNTIME_FAILURE'
        h.capture_owned_failure()
        try: _,h.evidence['failure_log']=h.capture_logs('failure')
        except Exception: pass
    finally:
        signal.alarm(0);h.deadline=time.monotonic()+120;h.cleanup()
    print(json.dumps({'status':h.evidence['status'],'phases':len(h.evidence['phases']),'cleanup':h.evidence['cleanup']}))
    return 0 if h.evidence['status']=='PASS' else 1
if __name__=='__main__': raise SystemExit(main())
