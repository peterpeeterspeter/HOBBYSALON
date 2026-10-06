"""F1 real PostgreSQL metadata acceptance; never writes an existing database.

Opt-in: HS_RECON_APPLY_POSTGRES=1 python3 -B -m unittest discover
        -s scripts/tests -p test_reconciliation_transaction_metadata.py -v
Reuses READONLY official catalog/psql helpers; owns NEW marked database + cleanup.
Integer|string authenticated fixture receipts are unchanged; Decimal is native JSON.
"""
import copy
import os
from pathlib import Path
from typing import Any
import sys
import unittest
import uuid

sys.path[:0] = [str(Path(__file__).resolve().parents[1]), str(Path(__file__).resolve().parent)]
from reconciliation import native_repair as native
from reconciliation.evidence import ISOLATED_DATABASE_MARKER
import test_reconciliation_apply_postgres as pg
from test_reconciliation_apply_postgres import (PsqlConnection, source_catalog,
    install_catalog, quote_id)
from test_reconciliation_exact_binding import NESTED, PROBE, PROBE_NEXT

AUDIT = Path('/home/hermes/audits/hobbysalon-reconciliation-20261005/toward-go')


class ExactConnection(PsqlConnection):
    """Same real libpq adapter; decode actual JSON outputs without float rounding."""
    def run(self, sql, params=()):
        super().run(sql, params)
        self.rows = [(native.decode_json(line) if line.startswith(('{', '[')) else
                      True if line == 't' else False if line == 'f' else line,)
                     for line in self.history[-1]['output']
                     if not line.startswith(('NOTICE:', 'WARNING:'))]
        return self.rows


@unittest.skipUnless(os.environ.get('HS_RECON_APPLY_POSTGRES') == '1',
                     'explicit isolated PostgreSQL apply opt-in required')
class TransactionMetadataPostgreSQLTests(unittest.TestCase):
    con: Any
    other: Any
    admin: Any
    snapshot = pg.IsolatedPostgreSQLApplyTests.snapshot
    seed = pg.IsolatedPostgreSQLApplyTests.seed
    gates = pg.IsolatedPostgreSQLApplyTests.gates
    assert_no_locks = pg.IsolatedPostgreSQLApplyTests.assert_no_locks

    @classmethod
    def setUpClass(cls):
        cls.database = 'hs_recon_it_' + uuid.uuid4().hex
        cls.report = {'scope': 'F1_isolated_actual_PostgreSQL_metadata_only',
                      'database': cls.database, 'provider_calls': 0, 'cases': []}
        cls.created = False
        cls.con = cls.other = cls.admin = None
        cls.catalog, cls.source_history = source_catalog()
        try:
            cls.admin = PsqlConnection('postgres', admin=True)
            cls.admin.run('CREATE DATABASE ' + quote_id(cls.database) + ' TEMPLATE template0')
            cls.created = True
            cls.admin.run('COMMENT ON DATABASE ' + quote_id(cls.database) + " IS '" + ISOLATED_DATABASE_MARKER + "'")
            cls.con = ExactConnection(cls.database)
            cls.other = ExactConnection(cls.database)
            cls.report['excluded_external_fks'] = install_catalog(cls.con, cls.catalog)
            # Nullable extension deliberately tests preservation of unknown JSONB metadata.
            cls.con.run('ALTER TABLE public.order_transaction ADD COLUMN binding_probe jsonb')
        except BaseException:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        errors = []
        try:
            for connection in (cls.other, cls.con):
                if connection:
                    try:
                        connection.close()
                    except BaseException as exc:
                        errors.append(str(exc))
            if cls.created:
                cls.admin.run('DROP DATABASE ' + quote_id(cls.database))
                cls.created = False
                cls.admin.run('SELECT count(*) FROM pg_database WHERE datname=%s', (cls.database,))
                cls.report['database_remaining_count'] = cls.admin.fetchone()[0]
                if cls.report['database_remaining_count'] != '0':
                    errors.append('disposable database not removed')
        finally:
            cls.report.update(source_history=cls.source_history,
                              source_catalog_hash=native.digest(cls.catalog),
                              session_history=cls.con.history if cls.con else [],
                              other_session_history=cls.other.history if cls.other else [],
                              admin_history=cls.admin.history if cls.admin else [],
                              cleanup_errors=errors)
            if cls.admin:
                cls.admin.close()
            AUDIT.mkdir(parents=True, exist_ok=True)
            receipt = AUDIT / ('metadata-postgres-' + cls.database + '.json')
            receipt.write_text(native.canonical(cls.report) + '\n')
            os.chmod(receipt, 0o600)
            print('\nMETADATA_POSTGRES_RECEIPT=' + str(receipt), flush=True)
        if errors:
            raise AssertionError('; '.join(errors))

    def prepared(self, kind, suffix, existing_target=False):
        suffix = suffix.replace('_', '')
        data = self.seed(kind, suffix)
        oid = data['snapshot']['order'][0]['id']
        if existing_target:
            reference = 'capture' if kind == 'capture_success' else 'refund'
            native_id = data['snapshot'][reference][0]['id']
            signed = '10' if reference == 'capture' else '-2.50'
            self.con.run("INSERT INTO public.order_transaction (id,order_id,version,amount,raw_amount,currency_code,reference,reference_id) VALUES (%s,%s,1,%s::numeric,%s::jsonb,'eur',%s,%s)",
                         ('existing_' + suffix, oid, signed, native.canonical({'value': signed, 'precision': 20}), reference, native_id))
            totals = copy.deepcopy(data['snapshot']['order_summary'][0]['totals'])
            values = {'paid_total': '10', 'refunded_total': '0' if reference == 'capture' else '2.50',
                      'transaction_total': '10' if reference == 'capture' else '7.50',
                      'pending_difference': '0' if reference == 'capture' else '2.50'}
            for field, value in values.items():
                totals[field] = native.decimal(value)
                totals['raw_' + field]['value'] = value
            self.con.run('UPDATE public.order_summary SET totals=%s::jsonb WHERE order_id=%s', (native.canonical(totals), oid))
        self.con.run("UPDATE public.order_transaction SET binding_probe=%s::jsonb,return_id='unrelated-return',claim_id='unrelated-claim',exchange_id='unrelated-exchange',created_at='2026-01-01T01:02:03Z',updated_at='2026-01-02T01:02:03Z' WHERE order_id=%s", (native.canonical(NESTED), oid))
        data['snapshot'] = self.snapshot(data)
        return data

    def assert_audit_and_metadata(self, data, case):
        after = self.snapshot(data)
        old = {row['id']: row for row in data['snapshot']['order_transaction']}
        for row in after['order_transaction']:
            if row['id'] in old:
                self.assertEqual(row, old[row['id']])
                self.assertEqual(row['binding_probe'], NESTED)
                self.assertEqual(row['binding_probe']['nested'][0]['exact'], PROBE)
                self.assertNotEqual(row['binding_probe']['nested'][0]['exact'], PROBE_NEXT)
        self.con.run('SELECT to_jsonb(a) FROM public.reconciliation_repair_audit a WHERE id=%s', ('recon_' + case.plan_hash,))
        audit = self.con.fetchone()[0]
        self.assertEqual(audit['before_snapshot'], data['snapshot'])
        self.assertEqual(audit['after_snapshot'], after)
        self.assertEqual(native.decode_json(native.canonical(audit['after_snapshot'])), after)
        self.assert_no_locks()
        self.report['cases'].append({'case': case.case_id, 'committed': True,
                                     'existing_complete_row_equality': True,
                                     'exact_Decimal_actual_and_audit': True})
        return after

    def assert_reacquire_locks(self, case):
        self.assert_no_locks()
        proposal = native.decode_json(case.proposal_json)
        for namespace, identity in (('commerce-cart', proposal['cart_id']),
                                    ('refund-settlement', proposal['scope_id'])):
            key = native.lock_key(namespace, identity)
            self.other.run('SELECT pg_try_advisory_lock(%s::bigint)', (key,))
            self.assertIs(self.other.fetchone()[0], True)
            self.other.run('SELECT pg_advisory_unlock(%s::bigint)', (key,))
            self.assertIs(self.other.fetchone()[0], True)
        self.assert_no_locks()

    def test_01_positive_refund_existing_basis_and_separate_new_defaults(self):
        data = self.prepared('refund_success', 'meta_positive_new')
        case = native.plan_case(data)
        self.assertTrue(native.apply_case(self.con, case, self.gates(case))['committed'])
        after = self.assert_audit_and_metadata(data, case)
        new = next(row for row in after['order_transaction'] if row['reference'] == 'refund')
        for field in ('return_id', 'claim_id', 'exchange_id', 'binding_probe', 'deleted_at'):
            self.assertIsNone(new[field])
        self.assertEqual(new['created_at'], new['updated_at'])
        self.assertEqual(new['amount'], native.decimal('-2.50'))

    def test_02_positive_existing_capture_and_refund_targets_no_insert(self):
        for kind in ('capture_success', 'refund_success'):
            with self.subTest(kind=kind):
                data = self.prepared(kind, 'meta_existing_' + kind, True)
                case = native.plan_case(data)
                self.assertFalse(native.decode_json(case.proposal_json)['insert_transaction'])
                self.assertTrue(native.apply_case(self.con, case, self.gates(case))['committed'])
                self.assert_audit_and_metadata(data, case)

    def test_03_negative_actual_trigger_metadata_system_and_optional_fields(self):
        mutations = {'binding_probe': "binding_probe=jsonb_set(binding_probe,'{nested,0,exact}','19.990000000000000001234567890123456788'::jsonb)",
                     'updated_at': "updated_at=updated_at+interval '1 second'",
                     'return_id': "return_id='mutated-return'"}
        for kind in ('capture_success', 'refund_success'):
            for field, assignment in mutations.items():
                with self.subTest(kind=kind, field=field):
                    suffix = 'meta_negative_' + kind + '_' + field
                    data = self.prepared(kind, suffix, True)
                    oid = data['snapshot']['order'][0]['id']
                    self.con.run("CREATE FUNCTION public.metadata_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.order_transaction SET " + assignment + " WHERE order_id=TG_ARGV[0]; RETURN NEW; END $$")
                    self.con.run("CREATE TRIGGER metadata_mutation AFTER UPDATE ON public.payment_collection FOR EACH ROW EXECUTE FUNCTION public.metadata_mutation('" + oid + "')")
                    try:
                        case = native.plan_case(data)
                        start = len(self.con.history)
                        with self.assertRaisesRegex(native.RepairBlocked, 'assertion_failed:actual_all_transactions_postcondition'):
                            native.apply_case(self.con, case, self.gates(case))
                        self.assertEqual(self.snapshot(data), data['snapshot'])
                        self.con.run('SELECT count(*) FROM public.reconciliation_repair_audit WHERE id=%s', ('recon_' + case.plan_hash,))
                        self.assertEqual(self.con.fetchone()[0], '0')
                        self.assert_reacquire_locks(case)
                        self.assertTrue(any(h['sql'] == 'ROLLBACK' for h in self.con.history[start:]))
                        self.report['cases'].append({'kind': kind, 'mutated_field': field,
                            'rollback_all_rows': True, 'zero_case_audit': True, 'released_locks': True})
                    finally:
                        self.con.run('DROP TRIGGER metadata_mutation ON public.payment_collection')
                        self.con.run('DROP FUNCTION public.metadata_mutation()')
    def test_04_negative_new_transaction_defaults_are_not_ignored(self):
        for field, assignment in (('binding_probe', "NEW.binding_probe='{}'::jsonb"),
                                  ('created_at', "NEW.created_at=NEW.created_at+interval '1 second'")):
            with self.subTest(field=field):
                data = self.prepared('refund_success', 'newdefault' + field)
                self.con.run('CREATE FUNCTION public.new_metadata_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ' + assignment + '; RETURN NEW; END $$')
                self.con.run('CREATE TRIGGER new_metadata_mutation BEFORE INSERT ON public.order_transaction FOR EACH ROW EXECUTE FUNCTION public.new_metadata_mutation()')
                try:
                    case = native.plan_case(data)
                    with self.assertRaisesRegex(native.RepairBlocked, 'assertion_failed:actual_new_transaction_postcondition'):
                        native.apply_case(self.con, case, self.gates(case))
                    self.assertEqual(self.snapshot(data), data['snapshot'])
                    self.con.run('SELECT count(*) FROM public.reconciliation_repair_audit WHERE id=%s', ('recon_' + case.plan_hash,))
                    self.assertEqual(self.con.fetchone()[0], '0')
                    self.assert_reacquire_locks(case)
                    self.report['cases'].append({'new_mutated_field': field, 'rollback_all_rows': True,
                                                 'zero_case_audit': True, 'released_locks': True})
                finally:
                    self.con.run('DROP TRIGGER new_metadata_mutation ON public.order_transaction')
                    self.con.run('DROP FUNCTION public.new_metadata_mutation()')


if __name__ == '__main__':
    unittest.main()
