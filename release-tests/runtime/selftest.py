#!/usr/bin/env python3
"""Offline regression tests. Loopback-only Node smoke; no containers, product imports or external network."""
import importlib.util, json, unittest, tempfile, subprocess, os, time
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
spec=importlib.util.spec_from_file_location('runtime',Path(__file__).with_name('runtime.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class Tests(unittest.TestCase):
    def test_app_loopback_command_shared_by_candidate_previous_and_negative(self):
        self.assertEqual(r.APP_COMMAND,['/app/node_modules/@medusajs/cli/dist/index.js','start','--types=false','--host','127.0.0.1','--port','9000'])
        with tempfile.TemporaryDirectory() as tmp:
            h=r.Harness.__new__(r.Harness);h.secret_dir=Path(tmp);h.app='fixture-app'
            h.net='fixture-network';h.volumes=['fixture-pgdata','fixture-static'];calls=[]
            h.sandbox=lambda *args,**kwargs:calls.append((args,kwargs))
            h.docker=lambda *args,**kwargs:self.fail('No Docker call allowed')
            for image in ['sha256:'+'a'*64,r.PREVIOUS_ID]:
                h.inspect=lambda name,image=image:{'Image':image,'HostConfig':{
                    'PortBindings':{},'NetworkMode':h.net,'ReadonlyRootfs':True,
                    'RestartPolicy':{'Name':'no'},'Tmpfs':{'/tmp':{},r.TYPES:{}}},
                    'Config':{'User':'1001:1001','Healthcheck':{'Test':['CMD','native-health']}},
                    'State':{'StartedAt':'2026-10-07T00:00:00Z'}}
                h.app_start(image,Path(tmp)/'runtime.env',verify_types=False)
                args,kwargs=calls[-1]
                self.assertEqual(args[:2],(h.app,image));self.assertIs(args[3],r.APP_COMMAND)
                self.assertTrue(kwargs['detach']);self.assertNotIn('--publish',kwargs['extra'])
            self.assertEqual(len(calls),2)
        import inspect
        self.assertIn('self.app_start(image,',inspect.getsource(r.Harness.phase))
        self.assertIn('self.app_start(self.a.candidate,env,verify_types=False)',inspect.getsource(r.Harness.negative))

    def test_real_node_listener_red_wildcard_green_loopback_egress_unchanged(self):
        import hashlib
        guard=Path(__file__).with_name('egress-deny.cjs')
        self.assertEqual(hashlib.sha256(guard.read_bytes()).hexdigest(),'960b3202ab94c98fe0400658588b92541a54362ed4f01a0b02d1552886f207f8')
        script=r'''const assert=require('node:assert/strict'),net=require('node:net'),tls=require('node:tls'),dns=require('node:dns'),http=require('node:http'),https=require('node:https');
const host=process.argv[1],denials=[];
const server=http.createServer((req,res)=>{assert.equal(req.url,'/health');res.writeHead(200);res.end('OK')});
server.on('error',e=>{console.error(e.stack);process.exitCode=1});
server.listen({host,port:0},async()=>{
  try {
    assert.equal(server.address().address,'127.0.0.1');
    const denied=(name,fn,message='CI_EGRESS_DENIED')=>{assert.throws(fn,e=>e.message===message);denials.push(name)};
    denied('outbound-wildcard',()=>net.connect({host:'0.0.0.0',port:9}));
    denied('outbound-wildcard-positional',()=>net.createConnection(9,'0.0.0.0'));
    denied('socket-wildcard',()=>new net.Socket().connect({host:'0.0.0.0',port:9}));
    denied('tls-wildcard',()=>tls.connect({host:'0.0.0.0',port:9}));
    denied('outbound-external',()=>net.connect({host:'203.0.113.1',port:9}));
    for(const [name,mod] of [['http',http],['https',https]])for(const key of ['get','request'])
      denied(name+'-'+key,()=>mod[key](name+'://example.invalid/'));
    for(const key of ['lookup','resolve','resolve4','resolve6']){
      denied('dns-'+key,()=>dns[key]('example.invalid',()=>assert.fail('External DNS callback')));
      await assert.rejects(dns.promises[key]('example.invalid'),e=>e.message==='CI_EGRESS_DENIED');denials.push('dns-promises-'+key);
    }
    denied('dns-wildcard',()=>dns.lookup('0.0.0.0',()=>assert.fail('Wildcard DNS callback')));
    denied('unix-options',()=>net.connect({path:'/tmp/ci-listener-smoke-denied.sock'}),'CI_UNIX_SOCKET_DENIED');
    denied('unix-positional',()=>net.connect('/tmp/ci-listener-smoke-denied.sock'),'CI_UNIX_SOCKET_DENIED');
    if(globalThis.fetch)denied('fetch-external',()=>fetch('http://example.invalid/'));
    const status=await new Promise((resolve,reject)=>{
      const request=http.get({host:'127.0.0.1',port:server.address().port,path:'/health'},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});
      request.on('error',reject);request.setTimeout(4000,()=>request.destroy(new Error('Loopback health timeout')));
    });assert.equal(status,200);
    console.log(JSON.stringify({status:'GREEN',listener:server.address().address,ephemeral_port:true,health_status:status,egress_denials:denials,scope:'real Node listener and guarded loopback HTTP only; no image or release acceptance'}));
  }catch(e){console.error(e.stack);process.exitCode=1}finally{server.close()}
});'''
        def probe(host):
            return subprocess.run(['node','--require',str(guard),'-e',script,host],
                env={'PATH':os.environ.get('PATH','/usr/bin:/bin')},capture_output=True,text=True,timeout=10)
        red=probe('0.0.0.0')
        self.assertNotEqual(red.returncode,0);self.assertEqual(red.stdout,'')
        self.assertIn('CI_EGRESS_DENIED',red.stderr);self.assertIn('lookup',red.stderr);self.assertIn('node:net',red.stderr)
        green=probe(r.APP_COMMAND[r.APP_COMMAND.index('--host')+1])
        self.assertEqual(green.returncode,0,green.stderr);self.assertEqual(green.stderr,'')
        receipt=json.loads(green.stdout);self.assertEqual(receipt['status'],'GREEN')
        self.assertEqual(receipt['listener'],'127.0.0.1');self.assertEqual(receipt['health_status'],200)
        print(json.dumps({'node_listener_red':{'host':'0.0.0.0','exit_code':red.returncode,'stderr':red.stderr},'node_listener_green':receipt}))

    def readiness_adapter(self,probes,queries):
        h=r.Harness.__new__(r.Harness);h.pg='fixture-pg';h.values=['unused','password-canary'];calls=[]
        probes=iter(probes);queries=iter(queries)
        def proc(*args,**kw):
            calls.append((args,kw))
            if 'pg_isready' in args:
                self.assertEqual(args[args.index('-h')+1],'127.0.0.1')
                self.assertEqual(args[args.index('-d')+1],'acceptance')
                rc,out=next(probes)
            else:
                self.assertEqual(args[:3],('docker','exec','-i'))
                self.assertIn('-h 127.0.0.1',args[-1]);self.assertIn('-d acceptance',args[-1])
                self.assertIn('export PGPASSWORD="$password"',args[-1])
                self.assertEqual(kw['input'],'password-canary\nSELECT 1;\n')
                rc,out=next(queries)
            self.assertNotIn('password-canary',' '.join(args))
            return subprocess.CompletedProcess(args,rc,out,'')
        h.proc=proc
        return h,calls
    def test_pg_temporary_unix_ready_never_accepted(self):
        # Even misleading accepting-connections text cannot override TCP failure.
        h,calls=self.readiness_adapter([(2,'/var/run/postgresql:5432 - accepting connections\n')]*30,[])
        with patch.object(r.time,'sleep') as sleep:
            with self.assertRaisesRegex(RuntimeError,'^EMPTY_PG_NOT_READY$'):h.wait_pg_ready()
        self.assertEqual(len(calls),30);self.assertEqual(sleep.call_count,30)
        self.assertTrue(all('pg_isready' in args for args,kw in calls))
    def test_pg_final_tcp_requires_successful_authenticated_select(self):
        h,calls=self.readiness_adapter([(2,'no response'),(0,'accepting connections'),(0,'accepting connections'),(0,'accepting connections')],[(1,'1\n'),(0,'0\n'),(0,'1\n')])
        with patch.object(r.time,'sleep') as sleep:h.wait_pg_ready()
        self.assertEqual(sleep.call_count,3);self.assertEqual(len(calls),7)
        self.assertEqual(sum('pg_isready' not in args for args,kw in calls),3)
    def test_pg_tcp_without_database_query_cannot_pass(self):
        for query in [(1,''),(0,''),(0,'0\n')]:
            with self.subTest(query=query):
                h,calls=self.readiness_adapter([(0,'accepting connections')]*30,[query]*30)
                with patch.object(r.time,'sleep'):
                    with self.assertRaisesRegex(RuntimeError,'^EMPTY_PG_NOT_READY$'):h.wait_pg_ready()
    def test_pg_probe_timeout_fails_closed(self):
        h,calls=self.readiness_adapter([],[])
        h.proc=lambda *args,**kw:(_ for _ in ()).throw(subprocess.TimeoutExpired(args,5))
        with self.assertRaises(subprocess.TimeoutExpired):h.wait_pg_ready()
    def cleanup_adapter(self,tmp):
        h=r.Harness.__new__(r.Harness);h.pg='fixture-pg';h.redis='fixture-redis';h.pg_started=True
        h.containers=[h.pg,h.redis];h.created_volumes=[];h.network_created=False;h.firewall=[];h.prefix='fixture'
        h.values=[];h.evidence={'status':'PASS'};h.a=SimpleNamespace(out=Path(tmp))
        h.secret_dir=Path(tmp)/'secrets';h.secret_dir.mkdir()
        removed=[];h.remove_container=removed.append;h.docker=lambda *args,**kw:''
        return h,removed
    def test_cleanup_existing_fixed_roles_only_including_no_roles(self):
        for existing in [set(),{'app'},{'migrator'},{'app','migrator'},{'unrelated'}]:
            with self.subTest(existing=existing),tempfile.TemporaryDirectory() as tmp:
                h,removed=self.cleanup_adapter(tmp);roles={name:True for name in existing};queries=[]
                def sql(q):
                    queries.append(q)
                    if q.startswith('SELECT format('):
                        self.assertIn("format('ALTER ROLE %I NOLOGIN PASSWORD NULL;',rolname)",q)
                        self.assertIn("FROM pg_roles WHERE rolname IN ('app','migrator') ORDER BY rolname\n\\gexec",q)
                        self.assertIn("usename IN ('app','migrator') AND pid<>pg_backend_pid()",q)
                        self.assertNotIn('ALTER ROLE app',q);self.assertNotIn('ALTER ROLE migrator',q)
                        for name in set(roles)&{'app','migrator'}:roles[name]=False
                        return ''
                    self.assertIn("FROM pg_authid WHERE rolname IN ('app','migrator') AND (rolcanlogin OR rolpassword IS NOT NULL)",q)
                    return str(sum(roles[name] for name in set(roles)&{'app','migrator'}))
                h.sql=sql;h.cleanup()
                self.assertEqual(len(queries),2);self.assertTrue(h.evidence['db_credentials_revoked']);self.assertTrue(h.evidence['cleanup'])
                self.assertEqual(h.evidence['cleanup_errors'],[]);self.assertEqual(set(removed),{h.pg,h.redis})
                self.assertFalse(h.secret_dir.exists());self.assertTrue((Path(tmp)/'runtime.json').exists())
                if 'unrelated' in roles:self.assertTrue(roles['unrelated'])
    def test_cleanup_revocation_query_failure_or_unverified_state_fails_closed(self):
        for failing_call,result in [(1,'0'),(2,'0'),(None,'1'),(None,''),(None,'unexpected')]:
            with self.subTest(failing_call=failing_call,result=result),tempfile.TemporaryDirectory() as tmp:
                h,removed=self.cleanup_adapter(tmp);queries=[]
                def sql(q):
                    queries.append(q)
                    if len(queries)==failing_call:raise RuntimeError('QUERY_FAILED')
                    return result
                h.sql=sql;h.cleanup()
                self.assertFalse(h.evidence.get('db_credentials_revoked',False));self.assertFalse(h.evidence['cleanup'])
                self.assertEqual(h.evidence['status'],'FAIL');self.assertIn('revocation_unverified',h.evidence['cleanup_errors'])
                self.assertEqual(set(removed),{h.pg,h.redis});self.assertFalse(h.secret_dir.exists())
    def test_index_field_codes_public_allowlist_no_private_values(self):
        codes=['INDEX_DIAG_INDEX_ROW_MISSING','INDEX_DIAG_INDEX_CAPTURE_UNAVAILABLE','INDEX_DIAG_INDEX_FIELDS_MATCH','INDEX_DIAG_SQL_QUERY_ERROR']
        codes += ['INDEX_DIAG_INDEX_'+field+'_MISMATCH' for field in ['TABLE','METHOD','VALID','READY','UNIQUE','KEY_COUNT','ATTRIBUTE_COUNT','PREDICATE','EXPRESSION','KEY']]
        for code in codes:
            self.assertIn(code,r.DIAGNOSTIC_CODES)
            self.assertEqual(r.diagnostic_codes(json.dumps({'marker':'CI_RUNTIME_DIAGNOSTIC','code':code})),[code])
            self.assertEqual(r.diagnostic_codes(json.dumps({'marker':'CI_RUNTIME_DIAGNOSTIC','code':code,'key':'private_canary'})),[])
        self.assertEqual(r.diagnostic_codes(json.dumps({'marker':'CI_RUNTIME_DIAGNOSTIC','code':'INDEX_DIAG_INDEX_private_canary_MISMATCH'})),[])
    def test_private_stdout_stderr_and_safe_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            h=r.Harness.__new__(r.Harness);h.private_dir=Path(tmp);h.evidence={}
            h.proc=lambda *a,**k:subprocess.CompletedProcess(a,1,'stdout-root-cause secret-canary','stderr-root-cause secret-canary')
            with self.assertRaisesRegex(RuntimeError,'^COMMAND_FAILED$'):h.run('unused')
            f=next(Path(tmp).iterdir());self.assertEqual(f.stat().st_mode & 0o777,0o600)
            record=json.loads(f.read_text());self.assertIn('stdout-root-cause',record['stdout']);self.assertIn('stderr-root-cause',record['stderr'])
            self.assertEqual(r.diagnostic_codes('secret-canary\n'+json.dumps({'marker':'CI_RUNTIME_DIAGNOSTIC','code':'secret-canary'})),[])
            self.assertEqual(r.diagnostic_codes(json.dumps({'marker':'CI_RUNTIME_DIAGNOSTIC','code':'INDEX_DIAG_PLAN_UNSUPPORTED'})),['INDEX_DIAG_PLAN_UNSUPPORTED'])
    def test_timeout_keeps_both_streams(self):
        with tempfile.TemporaryDirectory() as tmp:
            h=r.Harness.__new__(r.Harness);h.private_dir=Path(tmp)
            h.proc=lambda *a,**k:(_ for _ in ()).throw(subprocess.TimeoutExpired(a,1,output=b'out',stderr=b'err'))
            with self.assertRaisesRegex(RuntimeError,'^COMMAND_TIMEOUT$'):h.run('unused')
            record=json.loads(next(Path(tmp).iterdir()).read_text());self.assertEqual((record['stdout'],record['stderr']),('out','err'))
    def test_private_container_capture_refuses_foreign_owner(self):
        h=r.Harness.__new__(r.Harness);h.containers=['owned','foreign'];h.prefix='owner';h.deadline=time.monotonic()+60;records=[];calls=[]
        def proc(*args,**kw):
            calls.append(args)
            if args[1]=='logs':return subprocess.CompletedProcess(args,0,'owned stdout','owned stderr')
            return subprocess.CompletedProcess(args,0,json.dumps([{'Config':{'Labels':{r.LABEL:'owner' if args[-1]=='owned' else 'other'}},'State':{'ExitCode':1}}]),'')
        h.proc=proc;h.private_record=lambda kind,data:records.append((kind,data));h.capture_owned_failure()
        self.assertTrue(any(k=='owned-state' for k,v in records));self.assertTrue(any(k=='owned-logs' for k,v in records))
        self.assertTrue(any(k=='ownership-refused' for k,v in records));self.assertNotIn(('docker','logs','--timestamps','foreign'),calls)
    def test_local_identity_fail_closed(self):
        r.validate_images('sha256:'+'a'*64,r.PREVIOUS_ID)
        for candidate,previous in [('tag:latest',r.PREVIOUS_ID),(r.PREVIOUS_ID,r.PREVIOUS_ID),('sha256:'+'a'*64,'sha256:'+'e'*64)]:
            with self.assertRaises(RuntimeError): r.validate_images(candidate,previous)
    def test_nanosecond_order(self):
        self.assertLess(r.stamp('2026-10-07T00:00:00.000000001Z'),r.stamp('2026-10-07T00:00:00.000000002Z'))
    def test_marker_old_cannot_pass_restart(self):
        row={'marker':'CI_INDEX_INIT_COMPLETE','kind':'native','pid':1,'at':'2026-10-07T00:00:01.001Z'}
        old='2026-10-07T00:00:01.002Z '+json.dumps(row)
        self.assertEqual(len(r.init_markers(old,'2026-10-07T00:00:00Z')),1)
        with self.assertRaises(RuntimeError): r.init_markers(old,'2026-10-07T00:00:02Z')
    def test_narrow_types(self):
        h=r.Harness.__new__(r.Harness);h.net='owned';seen=[]
        h.owned_run=lambda name,image,args,cmd: seen.extend(args)
        h.sandbox('name','sha256:'+'a'*64,Path('/unused'),['unused'])
        tmpfs=[seen[i+1] for i,x in enumerate(seen) if x=='--tmpfs']
        self.assertEqual(len(tmpfs),2)
        self.assertTrue(any(x.startswith(r.TYPES+':') and 'uid=1001,gid=1001' in x for x in tmpfs))
        self.assertNotIn('--publish',seen);self.assertNotIn('--privileged',seen)
    def test_top_level_restart_and_changed_started_fail(self):
        h=r.Harness.__new__(r.Harness);h.app='unused';h.a=SimpleNamespace(candidate='candidate',previous='previous')
        for obj in [{'Image':'candidate','RestartCount':1,'State':{'Running':True,'StartedAt':'2026-10-07T00:00:00Z'}},{'Image':'candidate','RestartCount':0,'State':{'Running':True,'StartedAt':'2026-10-07T00:00:01Z'}}]:
            h.inspect=lambda _:obj
            with self.assertRaisesRegex(RuntimeError,'NATIVE_STATE_CHANGED'):h.healthy('test','2026-10-07T00:00:00Z','readonly')
    def test_snapshot_all_rows_no_named_narrow_query(self):
        h=r.Harness.__new__(r.Harness);h.evidence={};queries=[]
        def sql(q):
            queries.append(q)
            if q.startswith('BEGIN'):return 'marketplace_stripe_event_receipt\tfinancial full row\nmarketplace_capture_consumer_ack\tack full row\n'
            if q.startswith('SELECT table_name'):return '\n'.join(['ci_acceptance_sentinel','marketplace_stripe_event_receipt','marketplace_capture_consumer_ack','reconciliation_repair_audit'])
            return '{}'
        h.sql=sql;self.assertEqual(len(h.snapshot()['all_public_tables_sha256']),64)
        self.assertIn('REPEATABLE READ READ ONLY',queries[0]);self.assertIn('SELECT * FROM %I.%I',queries[0]);self.assertIn('\\gexec',queries[0])
    def test_ownership_refuses_removal(self):
        h=r.Harness.__new__(r.Harness);h.prefix='own'
        h.docker=lambda *a:'otherid'
        h.inspect=lambda n:{'Config':{'Labels':{r.LABEL:'someone-else'}}}
        with self.assertRaisesRegex(RuntimeError,'OWNERSHIP_MISMATCH'):h.remove_container('name')
    def test_native_failure_probe_cannot_pass(self):
        h=r.Harness.__new__(r.Harness);h.app='unused';h.a=SimpleNamespace(candidate='candidate',previous='previous')
        h.inspect=lambda _:{'Image':'candidate','RestartCount':0,'State':{'Running':True,'StartedAt':'2026-10-07T00:00:00Z','Health':{'Status':'healthy','Log':[{'Start':'2026-10-07T00:00:01Z','End':'2026-10-07T00:00:02Z','ExitCode':1}]}}}
        marker={'marker':'CI_INDEX_INIT_COMPLETE','kind':'readonly','pid':1,'at':'2026-10-07T00:00:00.500Z'}
        logs='2026-10-07T00:00:00.600Z '+json.dumps(marker)+'\n2026-10-07T00:00:00.700Z '+json.dumps({'message':'Server is ready on port: 9000'})
        h.capture_logs=lambda _:(logs,{})
        with self.assertRaisesRegex(RuntimeError,'PROBE_FAILED'):h.healthy('test','2026-10-07T00:00:00Z','readonly')
    def test_guard_precedes_docker(self):
        h=r.Harness.__new__(r.Harness)
        with patch.dict(r.os.environ,{},clear=True),patch.object(r.subprocess,'run',side_effect=AssertionError('MUST_NOT_LAUNCH')):
            with self.assertRaisesRegex(RuntimeError,'ONLY_GITHUB_HOSTED'):h.execute()

class AuditTests(unittest.TestCase):
    """Mocks exercise assertion logic only; never physical PostgreSQL evidence."""
    def good_receipt(self):
        return {'status':'PASS','duplicate':True,'atomic_rollback':True,'audit':{
            'version':1,'status':'PASS','synthetic_storage_only':True,
            'assertions':dict.fromkeys(r.AUDIT_ASSERTIONS,True),
            'negative_cases':dict(r.AUDIT_NEGATIVE_COUNTS),'committed_rows':3,
            'schema_sha256':'a'*64,'rows_sha256':'b'*64,
            'owner_truncate_guard':'pending-harness','migration_down':'not-executed'}}
    def test_audit_explicit_receipt_required(self):
        old={'status':'PASS','duplicate':True,'atomic_rollback':True}
        with self.assertRaisesRegex(RuntimeError,'AUDIT_RECEIPT_REQUIRED'):
            r.audit_receipt(json.dumps(old))
        good=self.good_receipt();self.assertEqual(r.audit_receipt(json.dumps(good)),good['audit'])
    def test_audit_degraded_receipts_fail_closed(self):
        import copy
        good=self.good_receipt()
        for label in r.AUDIT_ASSERTIONS:
            for bad in [False,1,None,'PASS']:
                row=copy.deepcopy(good);row['audit']['assertions'][label]=bad
                with self.subTest(label=label,bad=bad),self.assertRaises(RuntimeError):r.audit_receipt(json.dumps(row))
        for label in r.AUDIT_NEGATIVE_COUNTS:
            row=copy.deepcopy(good);row['audit']['negative_cases'][label]=0
            with self.subTest(count=label),self.assertRaises(RuntimeError):r.audit_receipt(json.dumps(row))
        for field,bad in [('status','FAIL'),('version',True),('synthetic_storage_only',False),('committed_rows',0),('schema_sha256','bad'),('rows_sha256','bad'),('owner_truncate_guard','PASS')]:
            row=copy.deepcopy(good);row['audit'][field]=bad
            with self.subTest(field=field),self.assertRaises(RuntimeError):r.audit_receipt(json.dumps(row))
        for raw in ['', 'not json', '[]', json.dumps(good)+'\n'+json.dumps(good)]:
            with self.assertRaises(RuntimeError):r.audit_receipt(raw)
    def test_audit_catalog_assertion_controls_offline_node(self):
        # The JS builds this explicitly mocked catalog; no driver/DB is loaded.
        js=r'''const f=require(process.argv[1]),a=require('node:assert/strict');
// Independent agreed native contract: never derive this baseline from fixture exports.
const columns=[['id','text'],['plan_hash','text'],['case_id','text'],['actor','text'],['evidence','jsonb'],['before_snapshot','jsonb'],['after_snapshot','jsonb'],['created_at','timestamp with time zone']];
const checks=[
 "CHECK (plan_hash ~ '^[a-f0-9]{64}$')",
 'CHECK (length(case_id) >= 1 AND length(case_id) <= 255)',
 'CHECK (length(actor) >= 1 AND length(actor) <= 255)',
 "CHECK (jsonb_typeof(evidence) = 'object')",
 "CHECK (jsonb_typeof(before_snapshot) = 'object')",
 "CHECK (jsonb_typeof(after_snapshot) = 'object')",
 "CHECK (id = 'recon_' || plan_hash)",
 "CHECK ((evidence->'provider'->>'account_id' ~ '^acct_[A-Za-z0-9]{1,200}$' AND evidence->'provider'->>'provider_effect_id' ~ '^(ch|re)_[A-Za-z0-9]{1,200}$') IS TRUE)"
];
const assertContract=fixture=>{
 a.deepEqual(fixture.AUDIT_COLUMNS,columns);
 a.deepEqual(fixture.AUDIT_CHECKS,checks);
};
assertContract(f);
const c={columns:columns.map(([name,type])=>({name,type,not_null:true})),
 constraints:[{name:'pk',kind:'p',columns:['id'],validated:true,definition:'PRIMARY KEY (id)'},
 ...checks.map((definition,i)=>({name:'check_'+i,kind:'c',validated:true,definition}))],
 indexes:[{name:'reconciliation_repair_audit_effect_once',unique:true,valid:true,ready:true,key_count:2,attribute_count:2,predicate:null,keys:["((evidence -> 'provider'::text) ->> 'account_id'::text)","((evidence -> 'provider'::text) ->> 'provider_effect_id'::text)"]}],
 triggers:[{name:'reconciliation_repair_audit_immutable',type:27,enabled:'A',when:null,function_schema:'public',function_name:'reconciliation_repair_audit_immutable'},
 {name:'reconciliation_repair_audit_no_truncate',type:34,enabled:'A',when:null,function_schema:'public',function_name:'reconciliation_repair_audit_immutable'}],
 functions:[{name:'reconciliation_repair_audit_immutable',schema:'public',security_definer:false,result:'trigger',language:'plpgsql',definition:"CREATE OR REPLACE FUNCTION public.reconciliation_repair_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN RAISE EXCEPTION 'reconciliation audit is immutable: update/delete/truncate forbidden'; END $function$"}]};
f.validateAuditCatalog(c);
// REALattempt9 wire shape: retain exact string rejection, never parse PG array text.
const raw=structuredClone(c);raw.constraints[0].columns='{id}';
a.throws(()=>f.validateAuditCatalog(raw),error=>{
 a.equal(error.code,'ERR_ASSERTION');a.equal(error.actual,'{id}');a.deepEqual(error.expected,['id']);return true;
});
console.log('RAW_PK_WIRE_REJECTED: actual={id}; expected=[id]');
const jsonWire=structuredClone(c);
jsonWire.constraints[0].columns=JSON.parse('["id"]');
jsonWire.indexes[0].keys=JSON.parse(JSON.stringify(c.indexes[0].keys));
a.strictEqual(f.validateAuditCatalog(jsonWire),jsonWire);
for(const bad of [['other'],[1],['id','other'],[],null,{},'["id"]']){
 const x=structuredClone(jsonWire);x.constraints[0].columns=bad;
 a.throws(()=>f.validateAuditCatalog(x),{code:'ERR_ASSERTION'});
}
for(const bad of [["evidence->'provider'->>'wrong'",c.indexes[0].keys[1]],[],null,{},JSON.stringify(c.indexes[0].keys)]){
 const x=structuredClone(jsonWire);x.indexes[0].keys=bad;
 a.throws(()=>f.validateAuditCatalog(x));
}
const wrongColumnType=structuredClone(jsonWire);wrongColumnType.columns[0].type='name';
a.throws(()=>f.validateAuditCatalog(wrongColumnType),{code:'ERR_ASSERTION'});
console.log('JSON_WIRE_ACCEPTED; WRONG_ARRAY_NAMES_TYPES_REJECTED');
const mutate=[x=>x.columns.pop(),x=>x.columns[0].not_null=false,x=>x.constraints.shift(),x=>x.constraints.pop(),x=>x.constraints[1].validated=false,x=>x.constraints[1].definition='CHECK(true)',x=>x.constraints.at(-1).definition=x.constraints.at(-1).definition.replace('IS TRUE',''),x=>x.indexes[0].unique=false,x=>x.indexes[0].valid=false,x=>x.indexes[0].ready=false,x=>x.indexes[0].predicate='true',x=>x.indexes[0].keys.reverse(),x=>x.triggers.pop(),x=>x.triggers[0].enabled='O',x=>x.triggers[0].type=19,x=>x.triggers[0].when='true',x=>x.triggers[0].function_schema='other',x=>x.functions[0].security_definer=true,x=>x.functions[0].definition='RETURN NULL',x=>x.functions[0].definition=x.functions[0].definition.replace('BEGIN','BEGIN IF false THEN').replace('END $','END IF; END $')];
for(const change of mutate){const x=structuredClone(c);change(x);a.throws(()=>f.validateAuditCatalog(x));}
// Catalog drift must fail against the pinned contract, including regex bounds.
for(const [from,to] of [['^acct_','^acctx_'],['^(ch|re)_','^(ch|pi)_'],['{1,200}','{1,201}']]){
 const x=structuredClone(c);
 x.constraints.at(-1).definition=x.constraints.at(-1).definition.replace(from,to);
 a.throws(()=>f.validateAuditCatalog(x),{code:'ERR_ASSERTION'});
}
const wrongActor=structuredClone(c);wrongActor.columns[3].name='principal';
a.throws(()=>f.validateAuditCatalog(wrongActor),{code:'ERR_ASSERTION'});
// Reproduce the review's source-contract mutations in the same realm, in memory.
// Both independent export checks and validation of the unchanged baseline reject them.
const fs=require('node:fs'),Module=require('node:module');
const filename=require.resolve(process.argv[1]),source=fs.readFileSync(filename,'utf8');
for(const [label,from,to] of [
 ['account','^acct_[A-Za-z0-9]{1,200}$','^acctx_[A-Za-z0-9]{1,200}$'],
 ['effect','^(ch|re)_[A-Za-z0-9]{1,200}$','^(ch|pi)_[A-Za-z0-9]{1,200}$'],
 ['actor',"['actor','text']","['principal','text']"]
]){
 a.equal(source.split(from).length,2,'mutation must replace exactly one contract literal: '+label);
 const variant=new Module(filename,module);variant.filename=filename;variant.paths=module.paths;
 variant._compile(source.replace(from,to),filename);
 a.throws(()=>assertContract(variant.exports),{code:'ERR_ASSERTION'},label+' exports must fail the independent contract');
 a.throws(()=>variant.exports.validateAuditCatalog(structuredClone(c)),{code:'ERR_ASSERTION'},label+' validator must reject the independent native baseline');
}
console.log('INDEPENDENT_CONTRACT_MUTATIONS_REJECTED: account,effect,actor');
a.equal(f.pgFailure({code:'42501',message:f.IMMUTABLE_MESSAGE},'P0001',f.IMMUTABLE_MESSAGE),false);
a.equal(f.pgFailure({code:'P0001',message:'permission denied'},'P0001',f.IMMUTABLE_MESSAGE),false);
a.equal(f.pgFailure({originalError:{code:'P0001',message:'query - '+f.IMMUTABLE_MESSAGE}},'P0001',f.IMMUTABLE_MESSAGE),true);
a.equal(f.pgFailure({code:'23505',constraint:'wrong'},'23505',null,'pk'),false);
// Expose only in this in-memory test module; production fixture exports stay unchanged.
const offline=new Module(filename,module);offline.filename=filename;offline.paths=module.paths;
offline._compile(source+'\nmodule.exports.offlineCatalog=catalog;',filename);
(async()=>{
 const seen=[];
 const observed=await offline.exports.offlineCatalog(async sql=>{
  seen.push(sql);
  if(sql.includes('FROM pg_attribute a WHERE'))return structuredClone(c.columns);
  if(sql.includes('FROM pg_constraint c')){
   a.match(sql,/to_json\(ARRAY\(SELECT a\.attname .*ORDER BY k\.ord\)\) AS columns/);
   const rows=structuredClone(c.constraints);
   for(const row of rows)row.columns=JSON.parse(row.kind==='p'?'["id"]':'[]');
   return rows;
  }
  if(sql.includes('FROM pg_index i')){
   a.match(sql,/to_json\(ARRAY\(SELECT pg_get_indexdef\(i\.indexrelid,n,true\) FROM generate_series\(1,i\.indnkeyatts\) n\)\) AS keys/);
   const rows=structuredClone(c.indexes);
   for(const row of rows)row.keys=JSON.parse(JSON.stringify(row.keys));
   return rows;
  }
  if(sql.includes('FROM pg_trigger t'))return structuredClone(c.triggers);
  if(sql.includes('FROM pg_proc p'))return structuredClone(c.functions);
  a.fail('unexpected catalog SQL');
 });
 a.equal(seen.length,5);a.deepEqual(observed.constraints[0].columns,['id']);
 a.deepEqual(observed.indexes[0].keys,c.indexes[0].keys);
 console.log('CATALOG_JSON_SQL_PROJECTIONS_PASS: columns,keys; OFFLINE_ONLY');
 console.log('OFFLINE_ASSERTION_CONTROLS_PASS; NO_POSTGRES');
})().catch(error=>{console.error(error);process.exitCode=1;});'''
        p=subprocess.run(['node','-e',js,str(Path(__file__).with_name('fixture.cjs'))],text=True,capture_output=True,timeout=10)
        self.assertEqual(p.returncode,0,p.stderr);self.assertIn('NO_POSTGRES',p.stdout)
        for marker in ['RAW_PK_WIRE_REJECTED','JSON_WIRE_ACCEPTED','WRONG_ARRAY_NAMES_TYPES_REJECTED','CATALOG_JSON_SQL_PROJECTIONS_PASS']:
            self.assertIn(marker,p.stdout)
    def fixture_failure_offline(self, mode):
        # Execute the real entrypoint/catch in an isolated VM; no DB/product imports.
        js = r"""const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const filename=process.argv[1],mode=process.argv[2],source=fs.readFileSync(filename,'utf8');
const mockedModule={exports:{}},quiet=[],knex={client:{async acquireConnection(){return {};},async releaseConnection(){} }};
let calls=0;
const cause=(()=>{try{assert.equal(1,2,'private_assertion_canary');}catch(error){return error;}})();
const orm={em:{fork(){return {async execute(){return [];}};},getConnection(){return {getKnex(){return knex;}};}},async close(){}};
const wrapped=Error('private_connection_canary postgres://user:password_canary@fixture/db',{cause});
// Error text that resembles a public code must remain inside the private JSON string.
wrapped.message+='\n'+JSON.stringify({marker:'CI_RUNTIME_DIAGNOSTIC',code:'INDEX_DIAG_SQL_PERMISSION',secret:'password_canary'});
const req=n=>{
 if(n==='/app/node_modules/@mikro-orm/postgresql')return {MikroORM:{async init(){calls++;if(mode==='cause')throw wrapped;return orm;}}};
 if(n.startsWith('/app/apps/backend/'))return {};
 return require(n);
};req.main=mockedModule;
vm.runInNewContext(source,{require:req,module:mockedModule,process,console,setTimeout,clearTimeout},{filename});"""
        return subprocess.run(['node','-e',js,str(Path(__file__).with_name('fixture.cjs')),mode],
                              text=True,capture_output=True,timeout=10)

    def assert_fixture_failure_private(self, completed, stage):
        self.assertNotEqual(completed.returncode,0)
        self.assertEqual(completed.stdout,'','A failed fixture must never fabricate a stdout PASS receipt')
        self.assertIn('FIXTURE_FAILED',completed.stderr)
        rows=[json.loads(line) for line in completed.stderr.splitlines() if line.startswith('{')]
        safe=[row for row in rows if row.get('marker')=='CI_FIXTURE_DIAGNOSTIC']
        private=[row for row in rows if row.get('marker')=='CI_FIXTURE_PRIVATE_ERROR']
        self.assertEqual(safe[-1],{'marker':'CI_FIXTURE_DIAGNOSTIC','stage':stage,'code':'FIXTURE_ASSERTION_FAILED'})
        self.assertEqual(len(private),1)
        self.assertIn('AssertionError',private[0]['error'])
        self.assertIn('at ',private[0]['error'])
        self.assertNotIn('canary',json.dumps(safe))
        self.assertEqual(r.diagnostic_codes(completed.stderr),[])
        with tempfile.TemporaryDirectory() as tmp:
            h=r.Harness.__new__(r.Harness);h.private_dir=Path(tmp);h.evidence={}
            h.proc=lambda *args,**kw:completed
            import contextlib,io
            console=io.StringIO()
            with contextlib.redirect_stdout(console),self.assertRaisesRegex(RuntimeError,'^COMMAND_FAILED$'):
                h.run('offline-fixture')
            self.assertEqual(console.getvalue(),'')
            record_path=next(Path(tmp).iterdir())
            self.assertEqual(record_path.stat().st_mode & 0o777,0o600)
            record=json.loads(record_path.read_text())
            self.assertEqual(record['stdout'],'')
            self.assertEqual(record['stderr'],completed.stderr)
        return private[0]['error']

    def test_audit_fixture_connection_and_scope_source_controls(self):
        text=Path(__file__).with_name('fixture.cjs').read_text()
        for fragment in ['observerConnection','acquireConnection()', '.connection(observerConnection)', 'useContext: false', 'pg_backend_pid()', 'auditRollbackBarrierReached', 'SET LOCAL statement_timeout', 'idle_in_transaction_session_timeout', 'validateAuditCatalog', 'UPDATE public.reconciliation_repair_audit SET actor=actor', 'DELETE FROM public.reconciliation_repair_audit', 'runtime_truncate_privilege_denied']:
            self.assertIn(fragment,text)
        for mode,stage in [('assertion','FIXTURE_ROLE_DENIALS'),('cause','FIXTURE_PRIMARY_CONNECT')]:
            with self.subTest(mode=mode):
                raw=self.assert_fixture_failure_private(self.fixture_failure_offline(mode),stage)
                if mode=='cause':
                    self.assertIn('[cause]',raw)
                    self.assertIn('private_connection_canary',raw)
                    self.assertIn('private_assertion_canary',raw)
                    self.assertIn('password_canary',raw) # Original private details, never console/projector.
        stages=__import__('re').findall(r"checkpoint\('([^']+)'\)",text)
        self.assertTrue(stages)
        self.assertTrue(all(__import__('re').fullmatch(r'FIXTURE_[A-Z_]+',stage) for stage in stages))
        self.assertEqual(text.count('checkpoint('),len(stages)+1,'No dynamic stage callers')
        self.assertNotRegex(text,r'CREATE\s+TABLE\s+(?:public\.)?reconciliation_repair_audit')
        self.assertNotIn('GRANT ',text)
        runtime=Path(__file__).with_name('runtime.py').read_text()
        self.assertLess(runtime.index('self.owner_audit_controls()'),runtime.index("self.evidence['diagnostic_stage']='RUNTIME_BASELINE'"))
        self.assertIn('self.evidence[\'audit_native\']',runtime)
    def test_audit_existing_health_phases_and_role_restrictions_preserved(self):
        import inspect
        healthy=inspect.getsource(r.Harness.healthy);execute=inspect.getsource(r.Harness.execute)
        phase=inspect.getsource(r.Harness.phase);snapshot=inspect.getsource(r.Harness.snapshot)
        self.assertIn('time.monotonic()-good>=300',healthy)
        self.assertIn("'native_continuous_healthy_seconds':300",healthy)
        self.assertIn("[(self.a.candidate,'candidate'),(self.a.previous,'previous'),(self.a.candidate,'candidate-restored')]",execute)
        self.assertIn("self.healthy(name+'-restart'",phase)
        self.assertIn("self.negative(baseline,schema)",execute)
        self.assertIn('EVERY public base table',snapshot);self.assertIn('SELECT * FROM %I.%I',snapshot)
        self.assertIn('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO app',execute)
        self.assertIn('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,app',execute)
        self.assertIn('ALTER ROLE migrator NOLOGIN PASSWORD NULL',execute)
        self.assertNotRegex(execute,r'GRANT[^;]*TRUNCATE')
    def owner_adapter(self,outputs=None,changed=False):
        h=r.Harness.__new__(r.Harness);h.evidence={};queries=[];snapshots=iter(['before','changed' if changed else 'before'])
        h.snapshot=lambda:next(snapshots);h.schema=lambda:'schema'
        def sql(q,user='postgres'):
            queries.append((q,user));return 'AUDIT_OWNER_CONTROLS_P0001' if outputs is None else outputs
        h.sql=sql;return h,queries
    def test_audit_owner_control_transaction_is_bounded_and_nondestructive(self):
        h,queries=self.owner_adapter();receipt=h.owner_audit_controls()
        self.assertEqual(receipt['owner_truncate_guard'],'PASS');self.assertEqual(receipt['migration_down'],'not-executed')
        self.assertTrue(receipt['populated_down_guard_sql']);self.assertEqual(len(queries),1)
        q,user=queries[0];self.assertEqual(user,'postgres')
        for fragment in ['BEGIN;', 'SET LOCAL ROLE migrator', "lock_timeout = '2s'", "statement_timeout = '5s'", "idle_in_transaction_session_timeout = '10s'", 'TRUNCATE TABLE public.reconciliation_repair_audit', "SQLSTATE 'P0001'", 'GET STACKED DIAGNOSTICS', 'ACCESS EXCLUSIVE MODE', 'ROLLBACK;', 'AUDIT_OWNER_CONTROLS_P0001']:
            self.assertIn(fragment,q)
        self.assertNotRegex(q,r'(?i)\b(?:DROP|GRANT|DISABLE)\b')
    def test_audit_owner_degraded_controls_cannot_pass(self):
        for output,changed in [('',False),('PASS',False),('AUDIT_OWNER_CONTROLS_P0001',True)]:
            h,_=self.owner_adapter(output,changed)
            with self.subTest(output=output,changed=changed),self.assertRaises(RuntimeError):h.owner_audit_controls()
        h,_=self.owner_adapter();h.sql=lambda *a,**k:(_ for _ in ()).throw(RuntimeError('SQL_FAILED'))
        with self.assertRaisesRegex(RuntimeError,'SQL_FAILED'):h.owner_audit_controls()

class PreservationTests(unittest.TestCase):
    """Bounded offline controls only; no hosted run, image build or fixture changes."""
    def baseline(self):
        return {'all_public_tables_sha256':'a'*64,'table_sha256':{
            'marketplace_capture_consumer_ack':'b'*64,'reconciliation_repair_audit':'c'*64}}
    def adapter(self,tmp,snapshot=None,schema=None,static=None):
        h=r.Harness.__new__(r.Harness);h.private_dir=Path(tmp);calls=[]
        h.evidence={'status':'FAIL','phases':[],'diagnostic_phase':'offline-control'}
        def capture(name,value):
            calls.append(name)
            if isinstance(value,Exception):raise value
            return value
        h.snapshot=lambda:capture('snapshot',self.baseline() if snapshot is None else snapshot)
        h.schema=lambda:capture('schema','d'*64 if schema is None else schema)
        h.static_hash=lambda:capture('static','e'*64 if static is None else static)
        return h,calls
    def comparison(self,tmp):
        paths=list(Path(tmp).glob('preservation-comparison-*.json'))
        self.assertEqual(len(paths),1)
        self.assertEqual(paths[0].stat().st_mode & 0o777,0o600)
        return json.loads(paths[0].read_text())
    def check_changed(self,component):
        import copy
        with tempfile.TemporaryDirectory() as tmp:
            changed=copy.deepcopy(self.baseline())
            changed['all_public_tables_sha256']='f'*64
            changed['table_sha256']['marketplace_capture_consumer_ack']='f'*64
            kwargs={component:changed if component=='snapshot' else 'f'*64}
            h,calls=self.adapter(tmp,**kwargs)
            with self.assertRaisesRegex(RuntimeError,'^FINANCIAL_ACK_SCHEMA_STATIC_CHANGED$'):
                h.preservation(self.baseline(),'d'*64,'e'*64)
            self.assertEqual(calls,['snapshot','schema','static'])
            record=self.comparison(tmp);self.assertFalse(record['strict_preserved'])
            key={'snapshot':'snapshot','schema':'schema_sha256','static':'static_sha256'}[component]
            self.assertEqual(record['matches'],{k:k!=key for k in ('snapshot','schema_sha256','static_sha256')})
            self.assertEqual(record['post'][key],kwargs[component]);self.assertEqual(h.evidence['status'],'FAIL')
            self.assertEqual(h.evidence['phases'],[])
            return record
    def test_preservation_rowhash_change_fails_strict(self):
        record=self.check_changed('snapshot')
        self.assertIn({'kind':'table-rowhash-changed','table':'marketplace_capture_consumer_ack',
            'before_sha256':'b'*64,'post_sha256':'f'*64},record['differences'])
    def test_preservation_schema_change_fails_strict(self):
        record=self.check_changed('schema');self.assertEqual(record['differences'][0]['kind'],'schema-changed')
    def test_preservation_static_change_fails_strict(self):
        record=self.check_changed('static');self.assertEqual(record['differences'][0]['kind'],'static-changed')
    def test_preservation_unchanged_passes_check_without_granting_acceptance(self):
        with tempfile.TemporaryDirectory() as tmp:
            h,calls=self.adapter(tmp);self.assertIsNone(h.preservation(self.baseline(),'d'*64,'e'*64))
            record=self.comparison(tmp);self.assertTrue(record['strict_preserved'])
            self.assertEqual(record['before'],record['post']);self.assertEqual(record['differences'],[])
            self.assertEqual(calls,['snapshot','schema','static']);self.assertEqual(h.evidence['status'],'FAIL')
            self.assertEqual(h.evidence['phases'],[])
    def test_preservation_combined_changes_attributed_including_added_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            changed={'all_public_tables_sha256':'f'*64,'table_sha256':{
                'marketplace_capture_consumer_ack':'f'*64,'ci_new_table':'a'*64}}
            h,calls=self.adapter(tmp,changed,'f'*64,'f'*64)
            with self.assertRaisesRegex(RuntimeError,'^FINANCIAL_ACK_SCHEMA_STATIC_CHANGED$'):
                h.preservation(self.baseline(),'d'*64,'e'*64)
            record=self.comparison(tmp);self.assertEqual(calls,['snapshot','schema','static'])
            self.assertFalse(any(record['matches'].values()))
            table_diffs={x['table']:x for x in record['differences'] if 'table' in x}
            self.assertEqual(table_diffs['ci_new_table']['kind'],'table-added')
            self.assertIsNone(table_diffs['ci_new_table']['before_sha256'])
            self.assertEqual(table_diffs['reconciliation_repair_audit']['kind'],'table-removed')
            self.assertIsNone(table_diffs['reconciliation_repair_audit']['post_sha256'])
            self.assertEqual(table_diffs['marketplace_capture_consumer_ack']['before_sha256'],'b'*64)
            self.assertEqual({x['kind'] for x in record['differences']},{'table-added','table-removed',
                'table-rowhash-changed','all-public-rows-changed','schema-changed','static-changed'})
    def test_preservation_capture_errors_do_not_shortcircuit_or_leak(self):
        import contextlib,io
        for component,key in [('snapshot','snapshot'),('schema','schema_sha256'),('static','static_sha256')]:
            with self.subTest(component=component),tempfile.TemporaryDirectory() as tmp:
                h,calls=self.adapter(tmp,**{component:RuntimeError('private-error-canary')});console=io.StringIO()
                with contextlib.redirect_stdout(console),contextlib.redirect_stderr(console):
                    with self.assertRaisesRegex(RuntimeError,'^FINANCIAL_ACK_SCHEMA_STATIC_CHANGED$'):
                        h.preservation(self.baseline(),'d'*64,'e'*64)
                self.assertEqual(console.getvalue(),'');self.assertEqual(calls,['snapshot','schema','static'])
                record=self.comparison(tmp);self.assertEqual(record['capture_errors'],{key:'RuntimeError'})
                self.assertFalse(record['strict_preserved']);self.assertNotIn('private-error-canary',json.dumps(record))
    def test_snapshot_hash_only_attribution_empty_tables_and_original_binding(self):
        import hashlib
        h=r.Harness.__new__(r.Harness);h.evidence={}
        tables=['ci_acceptance_sentinel','marketplace_stripe_event_receipt','marketplace_capture_consumer_ack','reconciliation_repair_audit']
        rows='marketplace_capture_consumer_ack\t{"private-row-canary":1}\n'
        h.sql=lambda q:rows if q.startswith('BEGIN') else '\n'.join(tables) if q.startswith('SELECT table_name') else '{}'
        snapshot=h.snapshot()
        self.assertEqual(snapshot['all_public_tables_sha256'],hashlib.sha256(rows.encode()).hexdigest())
        self.assertEqual(set(snapshot['table_sha256']),set(tables))
        self.assertEqual(snapshot['table_sha256']['marketplace_capture_consumer_ack'],hashlib.sha256(b'{"private-row-canary":1}\n').hexdigest())
        self.assertEqual(snapshot['table_sha256']['reconciliation_repair_audit'],hashlib.sha256(b'').hexdigest())
        self.assertNotIn('private-row-canary',json.dumps(snapshot))
        self.assertTrue(all(__import__('re').fullmatch('[a-f0-9]{64}',x) for x in snapshot['table_sha256'].values()))
    def test_healthy_receipts_private_before_strict_failure_in_boot_and_restart(self):
        import copy
        for failing_phase in ['boot','restart']:
            with self.subTest(failing_phase=failing_phase),tempfile.TemporaryDirectory() as tmp:
                h,calls=self.adapter(tmp);baseline=self.baseline();changed=copy.deepcopy(baseline)
                changed['table_sha256']['marketplace_capture_consumer_ack']='f'*64
                snapshots=iter([changed] if failing_phase=='boot' else [baseline,changed]);h.snapshot=lambda:next(snapshots)
                h.a=SimpleNamespace(candidate='candidate',previous='previous');h.app='offline';h.previous_starts=set()
                h.app_start=lambda *args:'2026-10-07T00:00:00Z';h.envfile=lambda *args:Path(tmp)/'unused.env'
                h.healthy=lambda *args:{'started_at':args[1],'native_continuous_healthy_seconds':300,
                    'native_probes':[args[0]+'-private-probe-canary']}
                h.docker=lambda *args:None;h.inspect=lambda *args:{'State':{'StartedAt':'2026-10-07T00:10:00Z'}}
                h.capture_logs=lambda *args:('',{})
                with self.assertRaisesRegex(RuntimeError,'^FINANCIAL_ACK_SCHEMA_STATIC_CHANGED$'):
                    h.phase('candidate','offline',baseline,'d'*64)
                healthy_paths=list(Path(tmp).glob('healthy-before-preservation-*.json'))
                self.assertEqual(len(healthy_paths),1 if failing_phase=='boot' else 2)
                for path in healthy_paths:
                    self.assertEqual(path.stat().st_mode & 0o777,0o600)
                    record=json.loads(path.read_text());self.assertEqual(record['acceptance'],'pending-strict-preservation')
                    self.assertEqual(record['receipt']['native_continuous_healthy_seconds'],300)
                self.assertEqual(len(h.evidence['phases']),0 if failing_phase=='boot' else 1)
                self.assertEqual(h.evidence['status'],'FAIL')
                failed_name='offline' if failing_phase=='boot' else 'offline-restart'
                self.assertNotIn(failed_name+'-private-probe-canary',json.dumps(h.evidence))
    def test_private_diagnostics_owned_sibling_and_no_hosted_guard_bypass(self):
        import shutil
        with tempfile.TemporaryDirectory() as tmp:
            h=r.Harness(SimpleNamespace(out=Path(tmp)/'public-runtime-output'))
            try:
                self.assertEqual(h.private_dir.parent,Path(tmp)/'runtime-diagnosis')
                self.assertTrue(h.private_dir.name.startswith(h.prefix+'-'))
                self.assertEqual(h.private_dir.stat().st_mode & 0o777,0o700)
                h.private_record('preservation-baseline',{'snapshot':self.baseline(),'schema_sha256':'d'*64,'static_sha256':'e'*64})
                self.assertEqual(list(h.a.out.iterdir()),[])
                with patch.dict(r.os.environ,{},clear=True),patch.object(r.subprocess,'run',side_effect=AssertionError('MUST_NOT_LAUNCH')):
                    with self.assertRaisesRegex(RuntimeError,'^ONLY_GITHUB_HOSTED_RUNNER$'):h.execute()
                self.assertEqual(h.evidence['status'],'FAIL');self.assertEqual(h.evidence['phases'],[])
            finally:shutil.rmtree(h.secret_dir)
    def test_baseline_record_once_before_phases_and_strict_public_append_order(self):
        import inspect
        execute=inspect.getsource(r.Harness.execute);phase=inspect.getsource(r.Harness.phase)
        self.assertEqual(execute.count("self.private_record('preservation-baseline'"),1)
        baseline_at=execute.index("self.private_record('preservation-baseline'")
        self.assertLess(execute.index('baseline,schema=self.firstboot()'),baseline_at)
        self.assertLess(baseline_at,execute.index('for image,phase in'))
        self.assertIn('self.static_baseline',execute[baseline_at:execute.index('for image,phase in')])
        self.assertEqual(phase.count("self.private_record('healthy-before-preservation'"),2)
        for block in phase.split("self.private_record('healthy-before-preservation'")[1:]:
            self.assertLess(block.index('self.preservation('),block.index("self.evidence['phases'].append(receipt)"))

class FirstbootTests(unittest.TestCase):
    """TESTONLY doubles and mutation controls; never a runtime/image PASS."""
    TABLES=('cat_saleschannel','currency','fulfillment_provider','index_data','index_metadata',
        'index_sync','notification_provider','payment_provider','price_preference','region_country',
        'sales_channel','store','store_currency','tax_provider')
    IMAGE='sha256:f98bfc5e71f0d9457d0b15e81226c7675982dfb1cd759f3ca69c2441932ba0a5'
    def state(self,populated=False):
        import hashlib
        empty=hashlib.sha256(b'').hexdigest()
        protected=['ci_acceptance_sentinel','marketplace_stripe_event_receipt',
            'marketplace_capture_consumer_ack','reconciliation_repair_audit']
        names=list(self.TABLES)+protected+['fixture_protected_%03d'%i for i in range(223)]
        counts=dict.fromkeys(names,0);hashes=dict.fromkeys(names,empty)
        for name in ['ci_acceptance_sentinel','reconciliation_repair_audit']:
            counts[name]=3;hashes[name]='a'*64
        if populated:
            for name in self.TABLES:counts[name]=1;hashes[name]='b'*64
        return {'snapshot':{'all_public_tables_sha256':('c' if populated else 'd')*64,
            'table_sha256':hashes},'table_counts':counts,'schema_sha256':'e'*64,'static_sha256':'f'*64}
    def test_firstboot_exact_bounded_contract(self):
        self.assertEqual(set(r.FIRSTBOOT_TABLES),set(self.TABLES));self.assertEqual(r.FIRSTBOOT_IMAGE,self.IMAGE)
        result=r.firstboot_contract(self.state(),self.state(True))
        self.assertEqual(len(result['protected_tables']),227);self.assertEqual(set(result['allowed_changes']),set(self.TABLES))
        self.assertEqual(result['ack_fixture'],'empty-no-populated-preservation-claim')
        self.assertEqual(r.firstboot_contract(self.state(),self.state())['allowed_changes'],[])
    def test_firstboot_every_protected_table_empty_or_populated_mutation_rejected(self):
        import copy
        before=self.state();protected=set(before['table_counts'])-set(self.TABLES)
        for table in protected:
            with self.subTest(table=table):
                post=copy.deepcopy(self.state(True));post['table_counts'][table]+=1
                post['snapshot']['table_sha256'][table]='1'*64
                with self.assertRaisesRegex(RuntimeError,'FIRSTBOOT'):r.firstboot_contract(before,post)
    def test_firstboot_nonempty_bootstrap_forbidden_even_if_unchanged(self):
        import copy
        for table in self.TABLES:
            with self.subTest(table=table):
                before=self.state();before['table_counts'][table]=1;before['snapshot']['table_sha256'][table]='1'*64
                for post in [copy.deepcopy(before),self.state(True)]:
                    with self.assertRaisesRegex(RuntimeError,'FIRSTBOOT'):r.firstboot_contract(before,post)
    def test_firstboot_inventory_schema_static_and_malformed_state_rejected(self):
        import copy
        mutations=[lambda x:x['snapshot']['table_sha256'].pop('currency'),
            lambda x:x['snapshot']['table_sha256'].update(extra='1'*64),
            lambda x:x.update(schema_sha256='1'*64),lambda x:x.update(static_sha256='1'*64),
            lambda x:x['table_counts'].update(currency=-1),lambda x:x['table_counts'].update(currency=True),
            lambda x:x['table_counts'].pop('currency'),lambda x:x['snapshot']['table_sha256'].update(currency='bad'),
            lambda x:x['table_counts'].update(currency=0)]
        for mutation in mutations:
            post=copy.deepcopy(self.state(True));mutation(post)
            with self.subTest(mutation=mutation),self.assertRaisesRegex(RuntimeError,'FIRSTBOOT'):
                r.firstboot_contract(self.state(),post)
    def adapter(self,tmp,fail=None):
        import copy
        h=r.Harness.__new__(r.Harness);h.private_dir=Path(tmp);h.secret_dir=Path(tmp)
        h.a=SimpleNamespace(candidate=self.IMAGE,previous=r.PREVIOUS_ID,out=Path(tmp));h.app='double-app'
        h.evidence={'status':'FAIL','phases':[]};h.previous_starts=set();events=[];started='2026-10-07T00:00:00Z'
        snapshots=[self.state(),self.state(True),self.state(True)];index=[0];running=[False]
        if fail=='protected':snapshots[1]['snapshot']['table_sha256']['marketplace_capture_consumer_ack']='1'*64;snapshots[1]['table_counts']['marketplace_capture_consumer_ack']=1
        if fail=='stop-change':snapshots[2]['snapshot']['table_sha256']['currency']='2'*64
        def snapshot():
            events.append('snapshot');state=copy.deepcopy(snapshots[min(index[0],2)]);index[0]+=1
            h.evidence['snapshot_tables']=state['table_counts'];return state['snapshot']
        h.snapshot=snapshot;h.schema=lambda:'e'*64;h.static_hash=lambda offline=False:'f'*64
        h.envfile=lambda *args:Path(tmp)/'unused.env'
        def start(image,env):events.append('start');running[0]=True;return started
        h.app_start=start
        marker={'marker':'CI_INDEX_INIT_COMPLETE','kind':'readonly','pid':1,'at':started}
        probes=[{'Start':'2026-10-07T00:00:01Z','End':'2026-10-07T00:00:02Z','ExitCode':0},
            {'Start':'2026-10-07T00:05:01Z','End':'2026-10-07T00:05:02Z','ExitCode':0}]
        def healthy(*args):
            events.append('healthy')
            if fail=='probe':raise RuntimeError('firstboot:NATIVE_PROBE_FAILED')
            receipt={'started_at':started,'native_continuous_healthy_seconds':300,
                'initialization_markers':[marker],'native_probes':copy.deepcopy(probes),
                'logs':{'file':'firstboot.complete.log','sha256':'a'*64,'complete':True}}
            if fail=='receipt':receipt['native_probes']=[]
            return receipt
        h.healthy=healthy
        def docker(*args):
            events.append(args[0])
            if args[0]=='stop':running[0]=False
            return ''
        h.docker=docker;h.inspect=lambda *args:{'Image':self.IMAGE,'RestartCount':0,
            'State':{'Running':running[0] or fail=='still-running','StartedAt':started}}
        h.capture_logs=lambda *args:('error: stop failure' if fail=='logs' else '',
            {'file':'firstboot.complete.log','sha256':'a'*64,'complete':True})
        h.remove_container=lambda *args:events.append('remove-verified')
        return h,events
    def test_firstboot_receipt_separate_stopped_confirmed_before_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            h,events=self.adapter(tmp);baseline,schema=h.firstboot()
            self.assertEqual(events,['snapshot','start','healthy','snapshot','stop','snapshot','remove-verified'])
            self.assertEqual(h.evidence['phases'],[]);self.assertEqual(h.evidence['status'],'FAIL')
            self.assertEqual(h.evidence['firstboot']['status'],'PASS');self.assertTrue(h.evidence['firstboot']['stable_confirmed'])
            self.assertEqual(baseline,self.state(True)['snapshot']);self.assertEqual(schema,'e'*64)
            records=[json.loads(x.read_text()) for x in Path(tmp).glob('firstboot-receipt-*.json')]
            self.assertEqual(len(records),1);self.assertEqual(records[0]['image'],self.IMAGE)
            self.assertEqual(records[0]['health']['native_continuous_healthy_seconds'],300)
            self.assertEqual(records[0]['before']['table_counts']['marketplace_capture_consumer_ack'],0)
            self.assertNotIn('table_counts',h.evidence['firstboot']);self.assertNotIn('native_probes',h.evidence['firstboot'])
            self.assertTrue(all((x.stat().st_mode & 0o777)==0o600 for x in Path(tmp).glob('*.json')))
    def test_firstboot_failures_never_select_baseline_or_accept_phase(self):
        for fail in ['protected','stop-change','probe','receipt','logs','still-running']:
            with self.subTest(fail=fail),tempfile.TemporaryDirectory() as tmp:
                h,events=self.adapter(tmp,fail)
                with self.assertRaises(RuntimeError):h.firstboot()
                self.assertEqual(h.evidence['firstboot']['status'],'FAIL');self.assertEqual(h.evidence['phases'],[])
                self.assertFalse(hasattr(h,'static_baseline'));self.assertNotIn('remove-verified',events)
    def test_firstboot_wrong_image_and_capture_failure_fail_before_start(self):
        with tempfile.TemporaryDirectory() as tmp:
            h,events=self.adapter(tmp);h.a.candidate='sha256:'+'1'*64
            with self.assertRaisesRegex(RuntimeError,'FIRSTBOOT'):h.firstboot()
            self.assertNotIn('start',events)
        with tempfile.TemporaryDirectory() as tmp:
            h,events=self.adapter(tmp);h.schema=lambda:(_ for _ in ()).throw(RuntimeError('private-capture-cause'))
            with self.assertRaisesRegex(RuntimeError,'FIRSTBOOT'):h.firstboot()
            self.assertNotIn('start',events)
            self.assertTrue(any('private-capture-cause' in x.read_text() for x in Path(tmp).glob('*.json')))
    def test_stable_preservation_never_applies_provisioning_allowance(self):
        with tempfile.TemporaryDirectory() as tmp:
            h,events=self.adapter(tmp);before=self.state();after=self.state(True)
            h.snapshot=lambda:after['snapshot']
            with self.assertRaisesRegex(RuntimeError,'^FINANCIAL_ACK_SCHEMA_STATIC_CHANGED$'):
                h.preservation(before['snapshot'],'e'*64,'f'*64)
    def test_firstboot_real_health_probe_control_and_floors_unchanged(self):
        import inspect
        healthy=inspect.getsource(r.Harness.healthy)
        self.assertIn('time.monotonic()-good>=300',healthy);self.assertIn('290*10**9',healthy)
        Tests('test_native_failure_probe_cannot_pass').test_native_failure_probe_cannot_pass()
    def test_firstboot_receipt_mutations_and_outer_ceiling_not_floors(self):
        import copy,inspect
        self.assertEqual(r.RUNTIME_DEADLINE_SECONDS,2100+390)
        self.assertEqual(r.RUNTIME_ALARM_SECONDS,2070+390)
        self.assertGreater(r.RUNTIME_ALARM_SECONDS,7*300)
        self.assertIn('signal.alarm(RUNTIME_ALARM_SECONDS)',inspect.getsource(r.main))
        with tempfile.TemporaryDirectory() as tmp:
            h,_=self.adapter(tmp);health=h.healthy('firstboot','2026-10-07T00:00:00Z','readonly')
        mutations=[lambda x:x.update(native_continuous_healthy_seconds=299),
            lambda x:x.update(initialization_markers=[]),lambda x:x['initialization_markers'][0].update(pid=2),
            lambda x:x['initialization_markers'][0].update(kind='native'),
            lambda x:x['native_probes'][0].update(ExitCode=1),lambda x:x['native_probes'][0].update(ExitCode=False),
            lambda x:x['native_probes'][1].update(Start='2026-10-07T00:00:01Z',End='2026-10-07T00:00:02Z'),
            lambda x:x['logs'].update(complete=False),lambda x:x['logs'].update(sha256='bad'),
            lambda x:x.update(started_at='2026-10-07T00:00:01Z')]
        for mutation in mutations:
            bad=copy.deepcopy(health);mutation(bad)
            with self.subTest(mutation=mutation),self.assertRaisesRegex(RuntimeError,'FIRSTBOOT_HEALTH_RECEIPT_REQUIRED'):
                r.firstboot_health_receipt(bad,'2026-10-07T00:00:00Z')
    def test_public_projection_fixed_codes_only_and_private_receipt_digest(self):
        import importlib.util,hashlib
        projector_spec=importlib.util.spec_from_file_location('public_evidence',Path(__file__).parent.parent/'public-evidence.py')
        assert projector_spec is not None and projector_spec.loader is not None
        projector=importlib.util.module_from_spec(projector_spec);projector_spec.loader.exec_module(projector)
        with tempfile.TemporaryDirectory() as tmp:
            h,_=self.adapter(tmp);h.firstboot()
            receipt=json.loads(next(Path(tmp).glob('firstboot-receipt-*.json')).read_text())
            expected=hashlib.sha256(json.dumps(receipt,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            self.assertEqual(h.evidence['firstboot']['receipt_sha256'],expected)
            projected=projector.project(h.evidence,'runtime','success','RUNTIME_HARNESS')
            self.assertEqual(projected['phases'],[]);self.assertEqual(projected['status'],'FAIL')
            self.assertEqual(projected['diagnostic_codes'],['FIRSTBOOT_REQUIRED','FIRSTBOOT_PROTECTED_PASS','FIRSTBOOT_STABLE_CONFIRMED'])
            self.assertNotIn('firstboot',projected);self.assertNotIn('marketplace',json.dumps(projected))
    def test_execute_exact_sequence_reachable_with_doubles_not_runtime_pass(self):
        import copy
        with tempfile.TemporaryDirectory() as tmp:
            h,events=self.adapter(tmp);h.prefix='double';h.pg='double-pg';h.redis='double-redis';h.net='double-net'
            h.volumes=['double-pgdata','double-static'];h.created_volumes=[];h.firewall=[];h.containers=[]
            h.values=['a'*64]*8;h.network_created=False;h.pg_started=False
            manifest={'image':r.PREVIOUS_ID,'image_id':r.PREVIOUS_ID,'source_hash':r.PREVIOUS_SOURCE,
                'gzip_sha256':r.PREVIOUS_ARCHIVE,'gzip_bytes':273965027,'config_sha256_verified':True,
                'ordered_layer_sha256_verified':True,'source_receipt_verified':True,'diff_ids':['sha256:'+'1'*64]*11}
            h.a.previous_manifest=Path(tmp)/'previous.json';h.a.previous_manifest.write_text(json.dumps(manifest))
            h.run=lambda *args,**kw:'';h.wait_pg_ready=lambda:None
            def sql(q,user='postgres'):
                if q.startswith('SELECT count(*) FROM information_schema'):return '0'
                if q.startswith('SELECT EXISTS'):return 'f'
                if q.startswith('SELECT has_function_privilege'):return 't'
                return ''
            h.sql=sql;h.owned_run=lambda name,image,args,command,**kw:'a'*64 if name.endswith('-source') else ''
            good=AuditTests().good_receipt();h.sandbox=lambda name,*args,**kw:json.dumps(good) if name.endswith('-fixture') else ''
            h.owner_audit_controls=lambda:{'owner_truncate_guard':'PASS','owner_rows_schema_unchanged':True,'status':'PASS'}
            def envfile(name,role):
                f=Path(tmp)/name;f.write_text('DOUBLE=only\n');return f
            h.envfile=envfile;running=[False];number=[0];current=[''];image=['']
            def app_start(im,env,verify_types=True):
                image[0]=im;number[0]+=1;current[0]='2026-10-07T%02d:00:00Z'%number[0];running[0]=env.name!='negative.env'
                if env.name=='negative.env':
                    events.append('negative');self.assertEqual(len(h.evidence['phases']),6)
                    self.assertFalse(verify_types)
                events.append('app:'+im);return current[0]
            h.app_start=app_start
            def docker(*args,**kw):
                if args[:2]==('image','inspect'):return json.dumps([{'Id':args[2],'RootFS':{'Layers':manifest['diff_ids']}}])
                if args[:2]==('network','inspect'):return json.dumps([{'Internal':True,'EnableIPv6':False,'Id':'1234567890123456'}])
                if args[0]=='restart':number[0]+=1;current[0]='2026-10-07T%02d:00:00Z'%number[0];events.append('restart')
                if args[0]=='stop':running[0]=False;events.append('stop')
                return '0' if args[0]=='exec' else ''
            h.docker=docker;h.inspect=lambda *args:{'Image':image[0],'RestartCount':0,
                'State':{'Running':running[0],'StartedAt':current[0],'ExitCode':1,'OOMKilled':False,'FinishedAt':current[0]}}
            h.capture_logs=lambda name:('password authentication failed' if name=='startup-negative' else '',
                {'file':name+'.complete.log','sha256':'a'*64,'complete':True})
            def healthy(name,started,kind):
                if name!='firstboot':
                    self.assertEqual(h.evidence['firstboot']['status'],'PASS');self.assertIn('baseline-recorded',events)
                events.append('health:'+name)
                base=r.stamp(started)//10**9
                def ts(sec):return r.datetime.datetime.fromtimestamp(sec,r.datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
                return {'started_at':started,'native_continuous_healthy_seconds':300,
                    'initialization_markers':[{'marker':'CI_INDEX_INIT_COMPLETE','kind':kind,'pid':1,'at':started}],
                    'native_probes':[{'Start':ts(base+1),'End':ts(base+2),'ExitCode':0},
                        {'Start':ts(base+301),'End':ts(base+302),'ExitCode':0}],
                    'logs':{'file':name+'.complete.log','sha256':'a'*64,'complete':True}}
            h.healthy=healthy
            actual_record=h.private_record
            def record(kind,data):
                if kind=='preservation-baseline':events.append('baseline-recorded')
                actual_record(kind,data)
            h.private_record=record
            # Run actual execute/firstboot/phase/negative methods, substituting
            # ONLY external I/O/health. No container/DB/provider/image acceptance.
            with patch.dict(r.os.environ,{'GITHUB_ACTIONS':'true','RUNNER_ENVIRONMENT':'github-hosted'}):h.execute()
            self.assertEqual([x for x in events if x.startswith('health:')],['health:firstboot','health:candidate',
                'health:candidate-restart','health:previous','health:previous-restart','health:candidate-restored','health:candidate-restored-restart'])
            self.assertEqual([x['phase'] for x in h.evidence['phases']],['candidate','candidate-restart','previous','previous-restart','candidate-restored','candidate-restored-restart'])
            self.assertEqual(events.count('baseline-recorded'),1)
            self.assertEqual(h.evidence['startup_negative']['status'],'PASS')
            self.assertTrue(h.evidence['startup_negative']['cleanup_verified'])
            self.assertEqual(events[-2:],['snapshot','remove-verified'])
            self.assertEqual(h.evidence['status'],'PASS') # Double branch only; NOT runtime acceptance.
            print('TESTONLY_EXACT_EXECUTE_SEQUENCE_REACHABLE: actual execute/firstboot/phase/negative; firstboot -> stopped-confirmed -> baseline -> six strict phases -> credential-negative; IO/health doubles ONLY; NO_RUNTIME_PASS')

if __name__=='__main__':unittest.main(verbosity=2)
