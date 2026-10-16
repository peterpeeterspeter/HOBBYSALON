from dataclasses import replace
from pathlib import Path
import sys
import unittest
import importlib.util
import subprocess
import json
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.reconciliation.no_effect_candidate import inspect_isolated_snapshot


class CandidateTests(unittest.TestCase):
    def fixture(self):
        return {'refund_settlement': [{'operation_id': 'op', 'phase': 'refund_started',
                'plan': {'customerRefund': 3.21, 'sellerReversal': 0, 'payout_id': None}}],
                'refund': [], 'commerce_refund_dispatch': []}

    def test_positive_detached_immutable_nonsuccess(self):
        source = self.fixture(); c = inspect_isolated_snapshot('op', source)
        source['refund_settlement'][0]['plan']['sellerReversal'] = 8
        self.assertEqual(c.snapshot()['refund_settlement'][0]['plan']['sellerReversal'], 0)
        self.assertTrue(c.validate_integrity()); self.assertFalse(c.runtime_success)
        self.assertEqual(c.financial_obligation, 'unchanged_unresolved')
        with self.assertRaises(Exception): c.operation_id = 'other'

    def test_snapshot_tamper(self):
        c = inspect_isolated_snapshot('op', self.fixture())
        with self.assertRaises(ValueError): replace(c, snapshot_json='{}').validate_integrity()

    def test_identity(self):
        with self.assertRaises(ValueError): inspect_isolated_snapshot('other', self.fixture())

    def test_native_reservations_dispatch_terminal_and_reversal(self):
        for key in ('refund', 'commerce_refund_dispatch'):
            source = self.fixture(); source[key] = [{'id': 'extra'}]
            with self.assertRaises(ValueError): inspect_isolated_snapshot('op', source)
        for phase in ('completed', 'refund_no_effect', 'pending'):
            source = self.fixture(); source['refund_settlement'][0]['phase'] = phase
            with self.assertRaises(ValueError): inspect_isolated_snapshot('op', source)
        source = self.fixture(); source['refund_settlement'][0]['plan']['sellerReversal'] = 1
        with self.assertRaises(ValueError): inspect_isolated_snapshot('op', source)

    def test_no_public_apply_cli_or_boolean_authority(self):
        import scripts.reconciliation.no_effect_candidate as module
        self.assertFalse(hasattr(module, 'apply')); self.assertFalse(hasattr(module, 'main'))
        with self.assertRaises(TypeError): inspect_isolated_snapshot('op', self.fixture(), verified=True)

    def test_detached_required_amount_and_reversal_receipt(self):
        for value in (None, 0, -1, 'NaN', 'Infinity', 'bad'):
            source = self.fixture(); source['refund_settlement'][0]['plan']['customerRefund'] = value
            with self.subTest(value=value), self.assertRaises(ValueError): inspect_isolated_snapshot('op', source)
        source = self.fixture(); source['refund_settlement'][0]['reversal_receipt_id'] = 'receipt'
        with self.assertRaises(ValueError): inspect_isolated_snapshot('op', source)


class RunnerTests(unittest.TestCase):
    def setUp(self):
        file = Path(__file__).with_name('run-no-effect-candidate-postgres.py')
        spec = importlib.util.spec_from_file_location('ne_runner', file)
        assert spec is not None and spec.loader is not None
        self.runner = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.runner)

    def exercise(self, failure):
        calls = []
        def fake(args, **kwargs):
            calls.append(args)
            if args[:2] == ['docker', 'inspect']:
                if failure == 'inspect': return subprocess.CompletedProcess(args, 1, 'inspect failed')
                return subprocess.CompletedProcess(args, 0, json.dumps([{
                    'Image': self.runner.PG, 'HostConfig': {'NetworkMode': 'none', 'ReadonlyRootfs': True, 'Tmpfs': {'/tmp': 'rw'}},
                    'State': {'Running': True}}]))
            if args[:2] == ['docker', 'run'] and '--test' in args and failure == 'timeout':
                raise subprocess.TimeoutExpired(args, 100)
            if args[:3] == ['docker', 'rm', '-f'] and failure == 'cleanup':
                return subprocess.CompletedProcess(args, 1, 'cleanup failed')
            return subprocess.CompletedProcess(args, 0, '')
        with patch.object(self.runner, 'run', side_effect=fake), patch.object(self.runner.tempfile, 'mkdtemp', return_value='/fixture/socket'), patch.object(self.runner.os, 'chmod'), patch.object(self.runner.shutil, 'rmtree'), patch.object(self.runner.Path, 'exists', return_value=False):
            rc = self.runner.main()
        self.assertEqual(rc, 1)
        return calls

    def test_failed_inspect_blocks_test_launch(self):
        calls = self.exercise('inspect')
        self.assertFalse(any('--test' in x for x in calls))

    def test_timeout_cleans_named_node_and_postgres(self):
        calls = self.exercise('timeout')
        cleanup = [x[-1] for x in calls if x[:3] == ['docker', 'rm', '-f']]
        self.assertEqual(len(cleanup), 2); self.assertEqual(cleanup[0], cleanup[1] + '-node')

    def test_cleanup_failure_overrides_green_test(self):
        self.exercise('cleanup')

    def test_inspect_rejects_unsafe_structure(self):
        valid = {'Image': self.runner.PG, 'HostConfig': {'NetworkMode': 'none', 'ReadonlyRootfs': True, 'Tmpfs': {'/tmp': 'rw'}}, 'State': {'Running': True}}
        import copy
        for field, value in [('Image', 'wrong'), ('NetworkMode', 'bridge'), ('ReadonlyRootfs', False), ('Tmpfs', {}), ('Running', False)]:
            data = copy.deepcopy(valid)
            target = data if field == 'Image' else data['State'] if field == 'Running' else data['HostConfig']
            target[field] = value
            with self.subTest(field=field), patch.object(self.runner, 'run', return_value=subprocess.CompletedProcess([], 0, json.dumps([data]))), self.assertRaises(RuntimeError):
                self.runner.inspect_isolation('fixture')
