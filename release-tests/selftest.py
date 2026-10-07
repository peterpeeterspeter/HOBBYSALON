#!/usr/bin/env python3
"""Offline prep regression controls; never build, launch, access tokens, or accept a release."""
import ast
import contextlib

import importlib.util
import io
import json
import re
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch
import yaml

ROOT = Path(__file__).resolve().parent

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
    def test_source_build_pins(self):
        self.assertEqual(v.RUN, 37591870825)
        self.assertEqual(v.COMMIT, '596466b55549e6140254ac7b81fc94edb6f9af47')
        for job in w['jobs'].values():
            downloads = [s for s in job['steps'] if 'download-artifact@' in s.get('uses', '')]
            self.assertEqual(len(downloads), 1)
            self.assertEqual(downloads[0]['with']['run-id'], str(v.RUN))

    def test_push_paths_and_guards(self):
        self.assertEqual(set(w['on']), {'push'})
        self.assertEqual(w['on']['push']['branches'], ['ops/release-validation-20261007'])
        self.assertEqual(w['on']['push']['paths'], ['release-tests/**', '.github/workflows/release-tests.yml'])
        for job in w['jobs'].values():
            guard = job['if']
            for expected in ["github.event_name == 'push'", "github.ref == 'refs/heads/ops/release-validation-20261007'", 'github.event.created == false', 'github.event.deleted == false', 'github.event.forced == false', 'github.run_attempt == 1']:
                self.assertIn(expected, guard)
        self.assertNotIn('needs', w['jobs']['runtime'])
        self.assertIn('!cancelled()', w['jobs']['runtime']['if'])

    def binding(self, data):
        response = io.BytesIO(json.dumps(data).encode())
        with patch.dict(v.os.environ, {'GH_TOKEN': 'offline-test-placeholder'}, clear=True), patch.object(v.urllib.request, 'urlopen', return_value=response), contextlib.redirect_stdout(io.StringIO()):
            v.binding()
            self.assertNotIn('GH_TOKEN', v.os.environ)

    def valid_binding(self):
        return {'id': v.RUN, 'head_sha': v.COMMIT, 'status': 'completed', 'conclusion': 'success', 'run_attempt': 1, 'event': 'push', 'head_branch': 'ops/release-validation-20261007', 'repository': {'full_name': v.REPO}, 'path': '.github/workflows/backend-ack-build.yml'}

    def test_binding_push_success_control(self):
        self.binding(self.valid_binding())

    def test_binding_refuses_in_progress_or_wrong_identity(self):
        for key, value in [('id', 37589026194), ('head_sha', '0'*40), ('status', 'in_progress'), ('conclusion', 'failure'), ('run_attempt', 2), ('event', 'workflow_dispatch'), ('head_branch', 'main'), ('repository', {'full_name': 'wrong/repo'}), ('path', '.github/workflows/release-tests.yml')]:
            data = self.valid_binding(); data[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, 'EXACT_SUCCESSFUL_BUILD_REQUIRED'):
                self.binding(data)

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
            upload = next(s for s in job['steps'] if 'upload-artifact@' in s.get('uses', ''))
            self.assertEqual(upload['with']['path'].splitlines(), ['${{ runner.temp }}/scoped-tests/public/summary.json', '${{ runner.temp }}/scoped-tests/public/SCOPE.md'])
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
