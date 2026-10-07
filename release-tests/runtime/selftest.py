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

if __name__=='__main__':unittest.main(verbosity=2)
