#!/usr/bin/env python3
"""Offline regression tests. No containers, imports of product code or network."""
import importlib.util, json, unittest, tempfile, subprocess, os, time
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
spec=importlib.util.spec_from_file_location('runtime',Path(__file__).with_name('runtime.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class Tests(unittest.TestCase):
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
            if q.startswith('BEGIN'):return 'financial full row\nack full row\n'
            if q.startswith('SELECT table_name'):return '\n'.join(['ci_acceptance_sentinel','marketplace_stripe_event_receipt','marketplace_capture_consumer_ack','reconciliation_repair_audit'])
            return '{}'
        h.sql=sql;self.assertEqual(len(h.snapshot()),64)
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

if __name__=='__main__':unittest.main(verbosity=2)
