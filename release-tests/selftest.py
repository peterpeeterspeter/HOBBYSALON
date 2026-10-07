#!/usr/bin/env python3
"""Offline prep regression controls; never build, launch, access tokens, or accept a release."""
import ast
import array
import contextlib
import fcntl

import importlib.util
import io
import json
import os
import re
import select
import subprocess
import sys
import threading
import time
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import yaml

ROOT = Path(__file__).resolve().parent

def stdout_transport_script():
    # Execute the actual production writer, not a copy, without dependency/DB boot.
    source = (ROOT / 'database/acceptance.cjs').read_text()
    transport = source.split('// BEGIN PG STDOUT RECORD TRANSPORT\n', 1)[1].split('// END PG STDOUT RECORD TRANSPORT', 1)[0]
    return ('const fs = require("node:fs"), assert = require("node:assert/strict");\n'
            'const {STAGES, errorCode} = require(' + json.dumps(str(ROOT / 'database/dependency-identity.cjs')) + ');\n'
            'const diagnosticRole = "main"; let diagnosticStage = "PG_RUNTIME_METADATA", diagnosticSequence = 0;\n'
            + transport)

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

v = load('candidate_controls', ROOT / 'verify-candidate.py')
p = load('projection_controls', ROOT / 'public-evidence.py')
g = load('postgres_controls', ROOT / 'database/run-postgres.py')
r = load('runtime_controls', ROOT / 'runtime/runtime.py')
# BaseLoader preserves GitHub's YAML 1.2 `on` key rather than treating it as bool.
w = yaml.load((ROOT.parent / '.github/workflows/release-tests.yml').read_text(), Loader=yaml.BaseLoader)

class Tests(unittest.TestCase):
    def test_postgres_stdout_real_pipe_backpressure_order_and_metadata(self):
        # Deliberately exceed both 64 KiB and 128 KiB; all nested metadata survives.
        metadata = {
            'node': 'transport-only-not-PG-evidence',
            'dependency_identities': {'fixture': {'entry': '/fixture/entry', 'bytes': 'é漢🙂' * 32768}},
            'identity_edges': [{'anchor': '/fixture/native', 'resolved': '/fixture/entry'}],
            'helper_identity_edges': [{'source': '/fixture/helper', 'package': 'fixture'}],
            'native_migrations': [{'name': 'fixture-migration', 'sha256': 'a' * 64}],
            'source_hashes': {'fixture.ts': 'b' * 64},
            'tail': {'retained': True, 'nested': [None, False, 0, 'last-byte']},
        }
        script = stdout_transport_script() + '''
const realWrite = fs.writeSync;
let partialWrites = 0, backpressure = 0;
fs.writeSync = function(fd, buffer, offset, length) {
  try {
    const n = realWrite.apply(fs, arguments);
    if (fd === 1 && n < length) partialWrites++;
    return n;
  } catch (e) {
    if (fd === 1 && ['EAGAIN', 'EWOULDBLOCK'].includes(e.code)) backpressure++;
    throw e;
  }
};
realWrite(2, 'READY\\n');
emit('RUNTIME_METADATA', JSON.parse(fs.readFileSync(0, 'utf8')));
checkpoint('PG_TEST_EXECUTION');
diagnosticFailure(Object.assign(new Error('transport regression'), {code:'ERR_ASSERTION'}));
emit('TRANSPORT_END', {retained:true});
realWrite(2, JSON.stringify({partialWrites, backpressure}) + '\\n');
'''
        read_fd, write_fd = os.pipe()
        child = None
        chunks = []
        reader_errors = []
        reader = None
        try:
            capacity = fcntl.fcntl(write_fd, fcntl.F_SETPIPE_SZ, 4096)
            os.set_blocking(write_fd, False)
            child = subprocess.Popen(['node', '-e', script], stdin=subprocess.PIPE,
                                     stdout=write_fd, stderr=subprocess.PIPE)
            assert child.stdin is not None and child.stderr is not None
            os.close(write_fd); write_fd = None
            child.stdin.write(json.dumps(metadata, ensure_ascii=False).encode())
            child.stdin.close()
            self.assertTrue(select.select([child.stderr], [], [], 5)[0], 'child readiness timeout')
            self.assertEqual(child.stderr.readline(), b'READY\n')
            deadline = time.monotonic() + 5
            pending = array.array('i', [0])
            while time.monotonic() < deadline:
                fcntl.ioctl(read_fd, 0x541B, pending, True)  # Linux FIONREAD
                if pending[0] == capacity:
                    break
                time.sleep(.001)
            self.assertEqual(pending[0], capacity, 'real nonblocking pipe must fill')
            # Wait for the child to hit EAGAIN while the actual pipe stays full.
            time.sleep(.025)
            def drain():
                try:
                    while True:
                        chunk = os.read(read_fd, 1024)
                        if not chunk:
                            return
                        chunks.append(chunk)
                        time.sleep(.0005)
                except Exception as error:
                    reader_errors.append(error)
            reader = threading.Thread(target=drain, daemon=True)
            reader.start()
            self.assertEqual(child.wait(timeout=15), 0)
            reader.join(timeout=5)
            self.assertFalse(reader.is_alive(), 'pipe must reach EOF')
            self.assertFalse(reader_errors)
            stats = json.loads(child.stderr.read())
            self.assertGreater(stats['partialWrites'], 0, 'must exercise real short writes')
            self.assertGreater(stats['backpressure'], 0, 'must exercise real EAGAIN')
            output = b''.join(chunks)
            first_record = output.split(b'\n', 1)[0]
            self.assertGreaterEqual(len(first_record), 128 * 1024)
            self.assertEqual(output[-1:], b'\n')
            text = output.decode('utf8')
            records = [(line.partition(' ')[0], json.loads(line.partition(' ')[2]))
                       for line in text.splitlines()]
            self.assertEqual([tag for tag, _ in records],
                             ['RUNTIME_METADATA', 'PG_CHECKPOINT', 'PG_NODE_DIAGNOSTIC', 'TRANSPORT_END'])
            self.assertEqual(g.tagged(text, 'RUNTIME_METADATA'), [metadata])
            self.assertEqual(records[1][1], {'stage':'PG_TEST_EXECUTION', 'role':'main', 'sequence':1})
            self.assertEqual(records[2][1], {'stage':'PG_TEST_EXECUTION', 'role':'main', 'code':'ERR_ASSERTION'})
            self.assertEqual(records[3][1], {'retained':True})
            self.assertEqual(len(g.node_diagnostics(text)['failures']), 1)
            print(json.dumps({'transport_regression':'passed', 'metadata_record_bytes':len(first_record),
                              'pipe_capacity':capacity, **stats, 'metadata_retained':True}))
        finally:
            if child is not None:
                if child.poll() is None:
                    child.kill(); child.wait(timeout=5)
                if reader is not None:
                    reader.join(timeout=5)
                if child.stdin is not None:
                    child.stdin.close()
                if child.stderr is not None:
                    child.stderr.close()
            os.close(read_fd)
            if write_fd is not None:
                os.close(write_fd)

    def test_postgres_stdout_transport_fails_closed(self):
        for failure in ('EPIPE', 'ZERO', 'EAGAIN', 'EWOULDBLOCK', 'EINTR'):
            with self.subTest(failure=failure):
                script = stdout_transport_script() + '\nconst failure = ' + json.dumps(failure) + ''';
let calls = 0, clock = 0n;
process.hrtime.bigint = () => { const now = clock; clock += 31_000_000_000n; return now; };
fs.writeSync = () => {
  calls++;
  if (failure === 'ZERO') return 0;
  throw Object.assign(new Error('injected transport failure'), {code:failure});
};
let first;
try { emit('RUNTIME_METADATA', {retained:'never accepted'}); } catch (e) { first = e; }
assert(first);
assert.equal(first.code, failure === 'ZERO' ? 'EIO' : failure === 'EPIPE' ? 'EPIPE' : 'ETIMEDOUT');
diagnosticFailure(first);
assert.throws(() => checkpoint('PG_NODE_COMPLETE'), e => e === first);
assert.throws(() => emit('ACK_PG_RESULT', {passed:17}), e => e === first);
assert.equal(calls, 1);
assert.equal(process.exitCode, 1);
'''
                done = subprocess.run(['node', '-e', script], capture_output=True, timeout=5)
                self.assertEqual(done.returncode, 1, done.stderr.decode())
                self.assertEqual(done.stdout, b'')
                self.assertEqual(done.stderr, b'')

        # A real reader disconnect must also fail closed, not just injected errors.
        read_fd, write_fd = os.pipe()
        os.close(read_fd)
        try:
            script = stdout_transport_script() + '''
let first;
try { emit('RUNTIME_METADATA', {retained:'broken pipe'}); } catch (e) { first = e; }
assert(first);
assert.equal(first.code, 'EPIPE');
diagnosticFailure(first);
assert.throws(() => emit('ACK_PG_RESULT', {passed:17}), e => e === first);
assert.equal(process.exitCode, 1);
'''
            done = subprocess.run(['node', '-e', script], stdout=write_fd,
                                  stderr=subprocess.PIPE, timeout=5)
            self.assertEqual(done.returncode, 1, done.stderr.decode())
            self.assertEqual(done.stderr, b'')
        finally:
            os.close(write_fd)

    def test_source_build_pins(self):
        self.assertEqual(v.RUN, 37622607612)
        self.assertEqual(v.COMMIT, '59efa5f84902380c30e7c0a25a890c57c925e98e')
        self.assertIn(v.COMMIT, (ROOT.parent / '.github/workflows/release-tests.yml').read_text())
        self.assertIn(str(v.RUN), (ROOT / 'SCOPE.md').read_text())
        self.assertIn(v.COMMIT, (ROOT / 'SCOPE.md').read_text())
        for job in w['jobs'].values():
            downloads = [s for s in job['steps'] if 'download-artifact@' in s.get('uses', '')]
            self.assertEqual(len(downloads), 1)
            self.assertEqual(downloads[0]['with']['run-id'], str(v.RUN))
            self.assertEqual(downloads[0]['uses'], 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093')
            self.assertEqual(downloads[0]['with']['artifact-ids'], '${{ steps.binding.outputs.artifact_id }}')
            self.assertEqual(downloads[0]['with']['merge-multiple'], 'true')
            self.assertNotIn('name', downloads[0]['with'])
            self.assertEqual(downloads[0]['with']['repository'], v.REPO)
            self.assertEqual(downloads[0]['with']['github-token'], '${{ github.token }}')
            binding = next(s for s in job['steps'] if s.get('id')=='binding')
            self.assertEqual(binding['run'], 'python3 release-tests/verify-candidate.py --binding-only')
            self.assertLess(job['steps'].index(binding), job['steps'].index(downloads[0]))

    def test_push_paths_and_guards(self):
        self.assertEqual(set(w['on']), {'push'})
        self.assertEqual(w['on']['push']['branches'], ['ops/release-validation-20261007'])
        self.assertEqual(w['on']['push']['paths'], ['release-tests/**', '.github/workflows/release-tests.yml'])
        for job in w['jobs'].values():
            guard = job['if']
            for expected in ["github.repository == 'peterpeeterspeter/HOBBYSALON'", "github.event_name == 'push'", "github.ref == 'refs/heads/ops/release-validation-20261007'", 'github.event.created == false', 'github.event.deleted == false', 'github.event.forced == false', 'github.run_attempt == 1']:
                self.assertIn(expected, guard)
        self.assertNotIn('needs', w['jobs']['runtime'])
        self.assertIn('!cancelled()', w['jobs']['runtime']['if'])
        self.assertEqual(w['jobs']['runtime']['timeout-minutes'], '60')
        self.assertEqual(w['jobs']['postgres']['timeout-minutes'], '50')
        runtime_steps = {s.get('id'): s for s in w['jobs']['runtime']['steps']}
        contract = 'release-tests/runtime/bridge-contract.bound.json'
        acquisition = runtime_steps['acquisition']['run']
        runtime_command = runtime_steps['runtime']['run']
        previous_command = runtime_steps['previous']['run']
        # Publication must fail closed if the separate bound contract is absent.
        expected = contract
        self.assertIn('--contract ' + expected, acquisition)
        self.assertIn('--source-export release-tests/runtime/bridge-source-export', acquisition)
        self.assertIn('--bridge-contract ' + expected, runtime_command)
        self.assertIn('open("' + expected + '")', previous_command)
        self.assertEqual((ROOT.parent / '.github/workflows/release-tests.yml').read_text().count(expected), 3)
        self.assertIn('--previous "$BRIDGE_ID"', runtime_command)
        self.assertNotIn('release-tests/runtime/bridge-contract.json', acquisition + runtime_command + previous_command)
        bridge = load('published_bridge_controls', ROOT / 'runtime/bridge-contract.py')
        pins = bridge.load(ROOT / 'runtime/bridge-contract.bound.json')
        self.assertEqual(pins['run_id'], 37671453633)
        self.assertEqual(pins['artifact_id'], 11504828273)
        self.assertEqual(pins['image'], 'sha256:afb6397899ff3a85d82a9598dbe8803ad0e192afa60a1f51bd12089b0392d09c')
        with self.assertRaisesRegex(bridge.Blocked, 'PENDING'):
            bridge.validate(bridge.SPEC)

    def valid_artifacts(self):
        # The binding constants were independently observed from the completed build;
        # the response here is an offline API fixture, never fabricated production evidence.
        return {'total_count':1, 'artifacts':[{'id':v.ARTIFACT_ID, 'name':v.ARTIFACT_NAME, 'expired':False, 'digest':v.ARTIFACT_DIGEST, 'size_in_bytes':v.ARTIFACT_SIZE, 'workflow_run':{'id':v.RUN, 'head_sha':v.COMMIT, 'head_branch':'ops/release-validation-20261007'}}]}

    def binding(self, data, artifacts=None, expected_calls=2):
        artifacts = self.valid_artifacts() if artifacts is None else artifacts
        responses = [io.BytesIO(json.dumps(d).encode()) for d in (data, artifacts)]
        token = 'offline-fixture-token'
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)/'output'
            with patch.dict(v.os.environ, {'GH_TOKEN': token, 'GITHUB_OUTPUT':str(output)}, clear=True), patch.object(v.urllib.request, 'urlopen', side_effect=responses) as request, contextlib.redirect_stdout(io.StringIO()) as stdout:
                try:
                    result = v.binding()
                    self.assertEqual(output.read_text(), 'artifact_id='+str(result['id'])+'\n')
                finally:
                    if request.call_count==expected_calls and not stdout.getvalue():
                        self.assertFalse(output.exists(), 'failed binding must not emit a downloadable artifact ID')
                    self.assertNotIn('GH_TOKEN', v.os.environ)
                    self.assertNotIn(token, stdout.getvalue())
                    self.assertEqual(request.call_count, expected_calls)
                    urls = [call.args[0].full_url for call in request.call_args_list]
                    endpoint = f'https://api.github.com/repos/{v.REPO}/actions/runs/{v.RUN}'
                    self.assertEqual(urls, [endpoint, endpoint+'/artifacts?per_page=100'][:expected_calls])
                    for call in request.call_args_list:
                        self.assertEqual(call.kwargs, {'timeout':30})

    def valid_binding(self):
        return {'id': v.RUN, 'head_sha': v.COMMIT, 'status': 'completed', 'conclusion': 'success', 'run_attempt': 1, 'event': 'push', 'head_branch': 'ops/release-validation-20261007', 'repository': {'full_name': v.REPO}, 'path': '.github/workflows/backend-ack-build.yml'}

    def test_binding_push_success_control(self):
        self.binding(self.valid_binding())

    def test_binding_refuses_in_progress_or_wrong_identity(self):
        for key, value in [('id', 37589026194), ('id', 37591870825), ('head_sha', '596466b55549e6140254ac7b81fc94edb6f9af47'), ('head_sha', '0'*40), ('status', 'in_progress'), ('status', 'queued'), ('conclusion', 'failure'), ('conclusion', None), ('conclusion', 'cancelled'), ('run_attempt', 2), ('event', 'workflow_dispatch'), ('head_branch', 'main'), ('repository', {'full_name': 'wrong/repo'}), ('path', '.github/workflows/release-tests.yml')]:
            data = self.valid_binding(); data[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, 'EXACT_SUCCESSFUL_BUILD_REQUIRED'):
                self.binding(data, expected_calls=1)

    def test_artifact_metadata_mismatches(self):
        changes = [('name','wrong-name'), ('id',0), ('id',True), ('expired',True), ('expired',None), ('digest',None), ('digest','sha256:'+'g'*64), ('digest','a'*64), ('size_in_bytes',0), ('size_in_bytes',-1), ('size_in_bytes',True), ('size_in_bytes','4096'), ('workflow_run',{'id':37591870825,'head_sha':v.COMMIT,'head_branch':'ops/release-validation-20261007'}), ('workflow_run',{'id':v.RUN,'head_sha':'596466b55549e6140254ac7b81fc94edb6f9af47','head_branch':'ops/release-validation-20261007'}), ('workflow_run',{'id':v.RUN,'head_sha':v.COMMIT,'head_branch':'main'}), ('workflow_run',None)]
        for key, value in changes:
            data = self.valid_artifacts(); data['artifacts'][0][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(RuntimeError):
                self.binding(self.valid_binding(), data)
        for key in ['id','name','expired','digest','size_in_bytes','workflow_run']:
            data = self.valid_artifacts(); del data['artifacts'][0][key]
            with self.subTest(missing=key), self.assertRaises(RuntimeError):
                self.binding(self.valid_binding(), data)
        data = self.valid_artifacts()
        duplicate = {'total_count':2, 'artifacts':data['artifacts']*2}
        for bad in [{}, {'total_count':0,'artifacts':[]}, duplicate, {'total_count':101,'artifacts':data['artifacts']}, {'total_count':True,'artifacts':data['artifacts']}, {'total_count':1,'artifacts':[None]}, {'total_count':101,'artifacts':data['artifacts']*101}]:
            with self.subTest(list=bad), self.assertRaises(RuntimeError):
                self.binding(self.valid_binding(), bad)

    def test_pinned_artifact_metadata_refuses_well_formed_substitution(self):
        for key,value in [('id',v.ARTIFACT_ID+1),('digest','sha256:'+'0'*64),('size_in_bytes',v.ARTIFACT_SIZE+1)]:
            data=self.valid_artifacts();data['artifacts'][0][key]=value
            with self.subTest(key=key),self.assertRaisesRegex(RuntimeError,'PINNED_ARTIFACT_METADATA_REQUIRED'):
                self.binding(self.valid_binding(),data)

    def test_candidate_main_hosted_guard_fails_closed(self):
        for env in [{}, {'GITHUB_ACTIONS':'true','RUNNER_ENVIRONMENT':'self-hosted'}, {'GITHUB_ACTIONS':'false','RUNNER_ENVIRONMENT':'github-hosted'}]:
            done = subprocess.run([sys.executable, '-B', str(ROOT/'verify-candidate.py'), '--binding-only'], env=env, capture_output=True, text=True, timeout=5)
            self.assertEqual(done.returncode, 2)
            self.assertEqual(done.stdout, '')
            self.assertEqual(done.stderr, 'FAIL: exact candidate verification refused; diagnostics withheld\n')

    def test_binding_api_size_bound_and_missing_token(self):
        for oversized_artifacts in [False, True]:
            replies = [io.BytesIO(b' '*(1024*1024+1))]
            if oversized_artifacts:
                replies.insert(0, io.BytesIO(json.dumps(self.valid_binding()).encode()))
            with patch.dict(v.os.environ, {'GH_TOKEN':'offline-fixture-token'}, clear=True), patch.object(v.urllib.request, 'urlopen', side_effect=replies), self.assertRaisesRegex(RuntimeError, 'API_BOUND'):
                v.binding()
        with patch.dict(v.os.environ, {}, clear=True), patch.object(v.urllib.request, 'urlopen') as request, self.assertRaisesRegex(RuntimeError, 'SCOPED_READ_TOKEN_REQUIRED'):
            v.binding()
        request.assert_not_called()

    def test_postgres_manifest_config_separation(self):
        self.assertEqual(g.POSTGRES, 'sha256:87e04d274d186c7331d0e13c7c90c8b9f63b0d7ae94476c98a229a94d62c9745')
        self.assertEqual(g.image_id(g.POSTGRES), g.POSTGRES)
        fixture = next(s['run'] for s in w['jobs']['postgres']['steps'] if s.get('id') == 'fixture')
        self.assertIn('docker pull --platform linux/amd64 postgres@sha256:129fbfd388241accda7b15e38ada14b11c70698e01e5c8072265b0eaa03af010', fixture)
        self.assertIn('= '+g.POSTGRES, fixture)
        self.assertIn('= linux/amd64', fixture)
        self.assertNotIn('97ff59', fixture)

    def test_runtime_fixture_refs_unchanged(self):
        self.assertEqual(r.PG, 'postgres@sha256:aa90e97ee862e558111d34cfb8b2c4bec768c2b039fb791341686928560263b3')
        self.assertEqual(r.REDIS, 'redis@sha256:ca0acbb137c1dc3339c8b147a58fd6f42775d4599327b50e7b116c23de501af2')

    def test_projection_fixed_diagnostics_no_sensitive_fields(self):
        marker = 'PRIVATE-FIXTURE-STRING-DO-NOT-PUBLISH'
        data = {'status': 'FAIL', 'diagnostic_stage': 'RUNTIME_INDEX_BOOTSTRAP', 'diagnostic_phase': 'candidate', 'error': marker, 'logs': marker, 'env': marker, 'rows': marker, 'cleanup_errors': [marker], 'phases': [{'phase': 'candidate', 'logs': marker, 'image': 'sha256:'+'a'*64, 'native_continuous_healthy_seconds': 300}]}
        out = p.project(data, 'runtime', 'failure', 'RUNTIME_HARNESS')
        self.assertEqual(out['harness_stage'], 'RUNTIME_INDEX_BOOTSTRAP')
        self.assertEqual(out['diagnostic_stage'], 'RUNTIME_HARNESS')
        self.assertNotIn(marker, json.dumps(out))
        data.update(diagnostic_stage=marker, diagnostic_phase=marker)
        out = p.project(data, 'runtime', 'failure', marker)
        self.assertEqual(out['diagnostic_stage'], 'UNKNOWN')
        self.assertNotIn(marker, json.dumps(out))

    def test_projection_child_diagnostics_are_fixed_codes_only(self):
        marker = 'PRIVATE-FIXTURE-STRING-DO-NOT-PUBLISH'
        out = p.project({'diagnostic_codes':['INDEX_DIAG_CONFIG_IMPORTED',marker,None,{}]}, 'runtime', 'failure')
        self.assertEqual(out['diagnostic_codes'], ['INDEX_DIAG_CONFIG_IMPORTED'])
        data = {'node_diagnostic_stage':'PG_DEPENDENCY_IDENTITIES','node_diagnostics':{'failures':[{'code':'MODULE_NOT_FOUND','error':marker},{'code':marker},None]}}
        out = p.project(data, 'postgres', 'failure')
        self.assertEqual(out['node_diagnostic_stage'], 'PG_DEPENDENCY_IDENTITIES')
        self.assertEqual(out['node_failure_codes'], ['MODULE_NOT_FOUND'])
        self.assertEqual(out['planned_tests'],17)
        self.assertNotIn(marker, json.dumps(out))
        data['failed_cases']=[{'name':g.EXPECTED[0],'status':'failed','code':'ERR_ASSERTION','operator':'strictEqual','stack':{'file':'acceptance.cjs','line':99},'error':marker},{'name':marker,'status':'failed'},None]
        out=p.project(data,'postgres','failure')
        self.assertEqual(out['failed_cases'],[{'name':g.EXPECTED[0],'status':'failed','classification':'ASSERTION','code':'ERR_ASSERTION','operator':'strictEqual','stack':{'file':'acceptance.cjs','line':99}}])
        self.assertNotIn(marker,json.dumps(out))

    def test_projection_missing_report_is_not_run(self):
        out = p.project({}, 'postgres', 'failure', 'BUILD_BINDING')
        self.assertEqual(out['status'], 'NOT_RUN')
        self.assertEqual(out['diagnostic_stage'], 'BUILD_BINDING')
        self.assertFalse(out['cleanup_verified'])

    def test_projection_cleanup_fails_closed(self):
        for cleanup in [[], ['invalid'], [None], [True], [{'removed_and_verified': True}, 'invalid'], {'absent': True}]:
            self.assertFalse(p.project({'cleanup': cleanup}, 'postgres', 'failure')['cleanup_verified'])
        self.assertTrue(p.project({'cleanup': [{'removed_and_verified': True}, {'absent': True}]}, 'postgres', 'success')['cleanup_verified'])

    def test_projection_no_acceptance_claim(self):
        for kind in ['postgres', 'runtime']:
            out = p.project({'status': 'PASS'}, kind, 'success', 'COMPLETE')
            for key in ['deployment', 'provider_acceptance', 'full_native_commerce_acceptance']:
                self.assertIs(out[key], False)

    def test_diagnostic_codes_and_upload_allowlist(self):
        for job in w['jobs'].values():
            projection = next(s for s in job['steps'] if 'public-evidence.py' in s.get('run', ''))
            codes = set(re.findall(r"'([A-Z_]+)'", projection['env']['DIAGNOSTIC_STAGE']))
            self.assertTrue(codes <= p.WORKFLOW_STAGES)
            self.assertEqual(projection['if'], 'always()')
            uploads = [s for s in job['steps'] if 'upload-artifact@' in s.get('uses', '')]
            self.assertEqual(len(uploads),2)
            upload = next(s for s in uploads if s['with']['name'].startswith('scoped-'))
            self.assertEqual(upload['with']['path'].splitlines(), ['${{ runner.temp }}/scoped-tests/public/summary.json', '${{ runner.temp }}/scoped-tests/public/SCOPE.md'])
            encrypted=next(s for s in uploads if s['with']['name'].startswith('encrypted-'))
            self.assertRegex(encrypted['with']['path'],r'^\$\{\{ runner.temp \}\}/scoped-tests/encrypted-(postgres|runtime)\.cms$')
            self.assertEqual(encrypted['with']['retention-days'],'1')
            self.assertNotIn('secrets.', json.dumps(job))

    def test_python_and_workflow_shell_syntax(self):
        for path in ROOT.rglob('*.py'):
            ast.parse(path.read_text(), filename=str(path))
        for job in w['jobs'].values():
            for step in job['steps']:
                if 'run' in step:
                    subprocess.run(['bash', '-n'], input=step['run'], text=True, check=True, capture_output=True)

if __name__ == '__main__':
    unittest.main(verbosity=2)
