"""Offline CLI/psql safety tests; no actual provider credentials or writes."""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlparse

from scripts.reconciliation import __main__ as cli
from scripts.reconciliation import db_readonly as db
from scripts.reconciliation.stripe_readonly import StripeReadOnly


def schema():
    rows = []
    for table, fields in db.FIELDS.items():
        for field in fields.split() + (["data"] if table == "payment" else []):
            kind = "text"
            if field == "amount" or field.endswith("_amount") and not field.startswith("raw_"): kind = "numeric"
            if field.startswith("raw_") or field in ("data", "totals", "plan", "snapshot"): kind = "jsonb"
            if field == "version": kind = "integer"
            rows.append({"table_name": table, "column_name": field, "data_type": kind})
    return rows


def native_fixture(refunded="0"):
    """Synthetic native single-order fixture, including the required raw/link invariants."""
    s = {k: [] for k in db.FIELDS}
    s["payment"] = [dict(id="pay_a", payment_intent="pi_a", payment_collection_id="pc_a", provider_id="pp_card_stripe-connect", currency_code="eur", amount="10", captured_at="present", canceled_at=None, deleted_at=None)]
    s["payment_collection"] = [dict(id="pc_a", currency_code="eur", amount="10", authorized_amount="10", captured_amount="10", refunded_amount=refunded, status="completed", completed_at="present", deleted_at=None)]
    s["order_payment_collection"] = [dict(order_id="order_a", payment_collection_id="pc_a", deleted_at=None)]
    s["cart_payment_collection"] = [dict(cart_id="cart_a", payment_collection_id="pc_a", deleted_at=None)]
    s["order"] = [dict(id="order_a", version=1, currency_code="eur", deleted_at=None)]
    s["capture"] = [dict(id="capt_a", payment_id="pay_a", amount="10", deleted_at=None)]
    s["order_transaction"] = [dict(id="ot_a", order_id="order_a", version=1, currency_code="eur", reference="capture", reference_id="capt_a", amount="10", deleted_at=None)]
    s["split_order_payment"] = [dict(id="split_a", payment_collection_id="pc_a", currency_code="eur", authorized_amount="10", captured_amount="10", refunded_amount=refunded, status="captured" if refunded == "0" else "partially_refunded", deleted_at=None)]
    s["order_order_split_order_payment_split_order_payment"] = [dict(order_id="order_a", split_order_payment_id="split_a", deleted_at=None)]
    net = str(db._money("10") - db._money(refunded))
    totals = dict(paid_total="10", refunded_total=refunded, transaction_total=net, pending_difference=refunded, original_order_total="10", current_order_total="10", credit_line_total="0", accounting_total="10")
    for f in db.SUMMARY_FIELDS: totals["raw_" + f] = dict(value=totals[f], precision=20)
    s["order_summary"] = [dict(id="summary_a", order_id="order_a", version=1, totals=totals, deleted_at=None)]
    if refunded != "0":
        s["refund"] = [dict(id="ref_a", payment_id="pay_a", amount=refunded, deleted_at=None)]
        s["order_transaction"].append(dict(id="ot_r", order_id="order_a", version=1, currency_code="eur", reference="refund", reference_id="op_a", amount=str(-db._money(refunded)), deleted_at=None))
        plan = dict(operation_id="op_a", order_id="order_a", scope_id="pc_a", payment_id="pay_a", currency_code="eur", customerRefund=refunded, sellerReversal="0", payout_id=None, split_order_payment_id="split_a")
        s["refund_settlement"] = [dict(operation_id="op_a", order_id="order_a", scope_id="pc_a", phase="completed", plan=plan, reversal_receipt_id=None)]
        s["commerce_refund_dispatch"] = [dict(refund_id="ref_a", idempotency_key="ref_a", operation_id="op_a", scope_id="pc_a", payment_id="pay_a", provider_id="pp_card_stripe-connect", provider_payment_id="pi_a", currency_code="eur", amount=refunded, state="completed")]
    for table, records in s.items():
        for r in records:
            for f in db.FIELDS[table].split():
                if "raw_" + f in db.FIELDS[table].split(): r["raw_" + f] = dict(value=r[f], precision=20)
    return s


class CLITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.old = self.file("old.json", {"db": list(db.SANDBOXES)[0], "pg": "hs-gate-pg-53332bce", "app": "hs-gate-app-53332bce"})
        self.fixed = self.file("fixed.json", {"db": list(db.SANDBOXES)[1], "pg": "hs-gate-pg-53332bce", "app": "hs-fixed-app-3bea5f66"})

    def tearDown(self): self.temp.cleanup()

    def file(self, name, value):
        p = self.root / name
        p.write_text(json.dumps(value))
        p.chmod(0o600)
        return str(p)

    def invoke(self, args):
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream): code = cli.main(args)
        return code, stream.getvalue()

    def test_schema_before_data_and_readonly_transactions(self):
        calls = []
        snapshot = {k: [] for k in db.FIELDS}
        def runner(command, **kwargs):
            calls.append((command, kwargs["input"]))
            value = schema() if len(calls) == 1 else {"schema": schema(), "snapshot": snapshot}
            return subprocess.CompletedProcess(command, 0, json.dumps(value) + "\n", "")
        scan = db.scan_runtime(self.old, runner=runner)
        self.assertTrue(scan["complete"])
        self.assertEqual(len(calls), 2)
        self.assertNotIn("FROM public.", calls[0][1])
        self.assertIn("information_schema.columns", calls[0][1])
        for command, sql in calls:
            self.assertIn("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", sql)
            self.assertTrue(sql.endswith("ROLLBACK;\n"))
            self.assertNotIn("UPDATE ", sql)
            self.assertNotIn("DELETE ", sql)
            self.assertIn("-X", command)
        self.assertNotIn('r."email"', calls[1][1])
        # Only an optional scalar marker is extracted from whole-row JSON;
        # never serialize whole financial rows (which may contain private data).
        marker = "to_jsonb(r)->>'no_effect_receipt_id'"
        self.assertEqual(calls[1][1].count(marker), 1)
        self.assertNotIn("to_jsonb(r)", calls[1][1].replace(marker, 'optional_scalar'))
        self.assertIn('r."amount"::text', calls[1][1])
        self.assertIn("r.data->>'id'", calls[1][1])

    def test_bad_schema_never_reads_data(self):
        with patch.object(db.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "[]\n", "")) as run:
            with self.assertRaises(db.DBReadBlocked): db.scan_runtime(self.old)
            self.assertEqual(run.call_count, 1)

    def test_schema_changed_blocks(self):
        responses = [subprocess.CompletedProcess([], 0, json.dumps(schema()), ""), subprocess.CompletedProcess([], 0, json.dumps({"schema": [], "snapshot": {}}), "")]
        with patch.object(db.subprocess, "run", side_effect=responses):
            with self.assertRaises(db.DBReadBlocked): db.scan_runtime(self.old)

    def test_production_and_misconfigured_database_no_calls(self):
        for config in ({"db": "production", "pg": "hs-gate-pg-53332bce", "app": "hs-gate-app-53332bce"}, {"db": list(db.SANDBOXES)[0], "pg": "wrong", "app": "hs-gate-app-53332bce"}):
            runtime = self.file("bad.json", config)
            with patch.object(db.subprocess, "run") as run, patch.object(cli.StripeReadOnly, "scan") as http:
                code, text = self.invoke(["ledger", "--runtime", runtime])
                self.assertEqual(code, 3)
                run.assert_not_called(); http.assert_not_called()
                self.assertNotIn("production", text)

    def test_missing_credentials_and_sk_key_no_calls(self):
        key = self.root / "key"
        key.write_text("sk_test_DO_NOT_USE"); key.chmod(0o600)
        for stripe in ({}, {"restricted_key_file": str(key), "livemode": False, "readonly_attested": True, "attestation_reference": "external-review"}):
            config = self.file("config.json", {"runtimes": [self.old, self.fixed], "stripe": stripe})
            with patch.object(db.subprocess, "run") as run, patch.object(cli.StripeReadOnly, "scan") as http:
                code, text = self.invoke(["check", "--config", config])
                self.assertEqual(code, 3)
                run.assert_not_called(); http.assert_not_called()
                self.assertNotIn("sk_test", text)

    def test_permissions_and_production_provider_refused(self):
        config = self.file("config.json", {"stripe": {"restricted_key_file": "unused", "livemode": True}})
        with patch.object(db.subprocess, "run") as run, patch.object(cli.StripeReadOnly, "scan") as http:
            self.assertEqual(self.invoke(["check", "--config", config])[0], 3)
            Path(config).chmod(0o644)
            self.assertEqual(self.invoke(["check", "--config", config])[0], 3)
            run.assert_not_called(); http.assert_not_called()

    def test_mock_get_full_scan_unknown_provider_discrepancy(self):
        charge = {"id": "ch_unknown", "object": "charge", "livemode": False, "currency": "eur", "created": 1, "payment_intent": "pi_unknown", "status": "succeeded", "amount": 100, "amount_captured": 100, "amount_refunded": 0, "paid": True, "captured": True, "customer": "private@example.com", "metadata": {"client_secret": "hidden"}}
        requests = []
        class Response:
            status = 200
            def __init__(self, req): self.req = req
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def geturl(self): return self.req.full_url
            def read(self, bound):
                if urlparse(self.req.full_url).path == "/v1/account":
                    return json.dumps({"id": "acct_fixture", "object": "account", "email": "private@example.com"}).encode()
                rows = [charge] if urlparse(self.req.full_url).path == "/v1/charges" else []
                return json.dumps({"object": "list", "has_more": False, "data": rows}).encode()
        def transport(req, timeout):
            requests.append(req)
            return Response(req)
        reader = StripeReadOnly("rk_test_OFFLINEFIXTURE", livemode=False, readonly_attested=True, attestation_reference="offline-independent-test", transport=transport)
        def scan(runtime): return {"rows": [], "counts": {"payment": 0}, "issues": [], "complete": True, "database": "old" if runtime == self.old else "fixed"}
        with patch.object(cli, "check_config", return_value=(reader, [self.old, self.fixed], "acct_fixture")), patch.object(cli, "scan_runtime", side_effect=scan):
            code, text = self.invoke(["check", "--config", "unused"])
        self.assertEqual(code, 2)
        self.assertIn("provider_only_payment_intent", text)
        self.assertEqual([urlparse(r.full_url).path for r in requests], ["/v1/account", "/v1/charges", "/v1/refunds", "/v1/events"])
        self.assertTrue(all(r.get_method() == "GET" for r in requests))
        self.assertNotIn("private@example.com", text); self.assertNotIn("hidden", text); self.assertNotIn("rk_test", text)

    def test_account_pin_mismatch_stops_before_inventory_and_database_reads(self):
        reader = StripeReadOnly("rk_test_OFFLINEFIXTURE", livemode=False, readonly_attested=True,
                                attestation_reference="offline-independent-test")
        with patch.object(cli, "check_config", return_value=(reader, [self.old, self.fixed], "acct_expected")), \
             patch.object(reader, "read_account", side_effect=cli.StripeReadBlocked("provider_account_mismatch")) as account, \
             patch.object(reader, "scan") as inventory, patch.object(cli, "scan_runtime") as native:
            code, text = self.invoke(["check", "--config", "unused"])
            self.assertEqual(code, 3)
            account.assert_called_once_with(expected_account_id="acct_expected")
            inventory.assert_not_called(); native.assert_not_called()
            self.assertNotIn("acct_expected", text)

    def test_missing_account_pin_blocks_before_http_or_database(self):
        key = self.root / "key"
        key.write_text("rk_test_OFFLINEFIXTURE"); key.chmod(0o600)
        config = self.file("config.json", {"runtimes": [self.old, self.fixed], "stripe": {
            "restricted_key_file": str(key), "livemode": False, "readonly_attested": True,
            "attestation_reference": "offline-independent-test"}})
        with patch.object(db.subprocess, "run") as native, patch.object(cli.StripeReadOnly, "read_account") as account:
            self.assertEqual(self.invoke(["check", "--config", config])[0], 3)
            native.assert_not_called(); account.assert_not_called()

    def test_capture_completion_requires_timestamp_collection_and_transaction(self):
        snapshot = native_fixture()
        rows, _ = db.normalize(snapshot)
        self.assertEqual(rows[0]["captures"][0]["status"], "completed")
        snapshot["payment"][0]["captured_at"] = None
        self.assertEqual(db.normalize(snapshot)[0][0]["captures"][0]["status"], "reserved")
        snapshot["payment"][0]["captured_at"] = "present"
        snapshot["order_transaction"][0]["version"] = 0
        rows, _ = db.normalize(snapshot)
        self.assertEqual(rows[0]["captures"][0]["status"], "reserved")
        self.assertIn("deleted_unbound_or_stale_transaction", rows[0]["quarantine"])
        snapshot["capture"][0]["deleted_at"] = "deleted"
        self.assertIn("deleted_scope_ambiguity", db.normalize(snapshot)[0][0]["quarantine"])

    def test_nullable_unused_collection_raw_pair_only(self):
        self.assertEqual(db._raw_issues(dict(captured_amount=None, raw_captured_amount=None), ["captured_amount"], nullable=True), [])
        self.assertIn("raw_numeric_field_invalid", db._raw_issues(dict(captured_amount="0", raw_captured_amount=None), ["captured_amount"], nullable=True))
        self.assertIn("raw_numeric_field_invalid", db._raw_issues({}, ["paid_total"]))

    def native_report(self, snapshot):
        rows, issues = db.normalize(snapshot)
        return db.ledger_report(dict(rows=rows, issues=issues, counts={k: len(v) for k, v in snapshot.items()}))

    def test_valid_full_native_fixtures_are_clean(self):
        for amount in ("0", "2"):
            self.assertEqual(self.native_report(native_fixture(amount))["status"], "clean")

    def test_split_summary_and_raw_invariants_fail_closed(self):
        cases = [("split_order_payment", "refunded_amount", "2", "split_refund_gross_mismatch"),
                 ("split_order_payment", "captured_amount", "9", "split_capture_gross_mismatch"),
                 ("split_order_payment", "status", "refunded", "split_status_amount_mismatch")]
        for table, field, value, reason in cases:
            s = native_fixture(); s[table][0][field] = value
            report = self.native_report(s)
            self.assertEqual(report["status"], "discrepancy")
            self.assertIn(reason, report["payments"][0]["issues"])
        for field, reason in [("paid_total", "summary_paid_mismatch"), ("refunded_total", "summary_refunded_mismatch"), ("transaction_total", "summary_transaction_mismatch"), ("pending_difference", "summary_pending_formula_mismatch")]:
            s = native_fixture(); s["order_summary"][0]["totals"][field] = "7"
            self.assertIn(reason, self.native_report(s)["payments"][0]["issues"])
        for table in ("payment", "payment_collection", "capture", "order_transaction", "split_order_payment"):
            s = native_fixture(); field = "raw_amount" if "raw_amount" in s[table][0] else "raw_captured_amount"
            s[table][0][field]["value"] = "123"
            self.assertIn("raw_numeric_mismatch", self.native_report(s)["payments"][0]["issues"])
        for value in (None, True, 0.1, "NaN"):
            s = native_fixture(); s["order_summary"][0]["totals"]["paid_total"] = value
            self.assertEqual(self.native_report(s)["status"], "discrepancy")

    def test_missing_duplicate_and_stale_native_links(self):
        for table, reason in [("order_payment_collection", "ambiguous_order_binding"), ("cart_payment_collection", "missing_or_ambiguous_cart_binding"), ("split_order_payment", "missing_or_ambiguous_split_binding"), ("order_order_split_order_payment_split_order_payment", "missing_or_ambiguous_split_binding"), ("order_summary", "missing_or_ambiguous_current_summary")]:
            for duplicate in (False, True):
                s = native_fixture(); s[table] = s[table] * 2 if duplicate else []
                self.assertIn(reason, self.native_report(s)["payments"][0]["issues"])
        s = native_fixture(); s["order_summary"][0]["version"] = 0
        self.assertIn("stale_summary_version", self.native_report(s)["payments"][0]["issues"])

    def test_dispatch_exact_identity_and_operation_binding(self):
        for field in ("scope_id", "payment_id", "provider_id", "provider_payment_id", "currency_code", "refund_id", "idempotency_key", "operation_id"):
            s = native_fixture("2"); s["commerce_refund_dispatch"][0][field] = "wrong"
            rows, issues = db.normalize(s)
            self.assertIn("dispatch_identity_binding_mismatch", issues)
            self.assertEqual(rows[0]["refunds"][0]["status"], "reserved")
        for field in ("order_id", "scope_id", "operation_id", "payment_id", "currency_code", "split_order_payment_id"):
            s = native_fixture("2"); s["refund_settlement"][0]["plan"][field] = "wrong"
            self.assertIn("dispatch_identity_binding_mismatch", db.normalize(s)[1])
        s = native_fixture("2"); s["commerce_refund_dispatch"] *= 2
        self.assertIn("dispatch_identity_binding_mismatch", db.normalize(s)[1])
        s = native_fixture("2"); s["order_transaction"] = s["order_transaction"][:1]
        self.assertEqual(db.normalize(s)[0][0]["refunds"][0]["status"], "reserved")
        s = native_fixture("2"); s["refund_settlement"][0]["phase"] = "refund_started"
        self.assertIn("dispatch_settlement_completion_mismatch", db.normalize(s)[0][0]["quarantine"])

    def test_capture_tail_binding_and_null_pending_not_orphan(self):
        s = native_fixture()
        saved = dict(version=1, cart_id="cart_a", collection_id="pc_a", payment_id="pay_a", intent_id="pi_a", provider_id="pp_card_stripe-connect", currency_code="eur", amount="10", allocations=[dict(order_id="order_a", version=1, split_id="split_a", amount="10", currency_code="eur")])
        s["marketplace_capture_tail"] = [dict(payment_id="pay_a", cart_id="cart_a", capture_id="capt_a", snapshot=saved, accounting_at="present", event_enqueued_at="present", completed_at="present")]
        self.assertEqual(self.native_report(s)["status"], "clean")
        for field in ("cart_id", "collection_id", "payment_id", "intent_id", "provider_id", "currency_code"):
            bad = copy.deepcopy(s); bad["marketplace_capture_tail"][0]["snapshot"][field] = "wrong"
            self.assertIn("capture_tail_identity_binding_mismatch", db.normalize(bad)[0][0]["quarantine"])
        s["marketplace_capture_tail"][0].update(capture_id=None, accounting_at=None, event_enqueued_at=None, completed_at=None)
        self.assertNotIn("orphan_capture_tail", db.normalize(s)[1])
        self.assertIn("unfinished_capture_tail_inventory", db.normalize(s)[1])

    @staticmethod
    def set_money(record, field, value):
        record[field] = value
        record['raw_' + field] = dict(value=value, precision=20)

    def test_d1_accounting_and_summary_contract(self):
        for field, value in [('accounting_total', '9'), ('accounting_total', '-1'),
                             ('original_order_total', '-1'), ('credit_line_total', '-1'),
                             ('current_order_total', '-1')]:
            with self.subTest(field=field, value=value):
                s = native_fixture(); self.set_money(s['order_summary'][0]['totals'], field, value)
                if field == 'current_order_total': self.set_money(s['order_summary'][0]['totals'], 'pending_difference', '-11')
                self.assertEqual(self.native_report(s)['status'], 'discrepancy')
        s = native_fixture(); self.set_money(s['order_summary'][0]['totals'], 'original_order_total', '11')
        self.assertIn('unsupported_order_change_summary', self.native_report(s)['payments'][0]['issues'])
        # Stored pending after a real positive refund is 2, not universally zero.
        self.assertEqual(self.native_report(native_fixture('2'))['status'], 'clean')

    def test_d2_seller_reversal_is_projected_and_blocked(self):
        sql = db._projection_sql('refund_settlement')
        for field in ('sellerReversal', 'payout_id', 'reversal_receipt_id'):
            self.assertIn(field, sql)
        for value in ('1', '-1', {'unsupported': True}, None, True, 0.1):
            with self.subTest(value=value):
                s = native_fixture('2'); s['refund_settlement'][0]['plan'].update(sellerReversal=value, payout_id='payout_a')
                s['refund_settlement'][0]['reversal_receipt_id'] = None
                self.assertEqual(self.native_report(s)['status'], 'discrepancy')
        s = native_fixture('2'); s['refund_settlement'][0]['plan']['sellerReversal'] = '1'
        s['refund_settlement'][0]['reversal_receipt_id'] = 'receipt_a'
        self.assertEqual(self.native_report(s)['status'], 'discrepancy')
        s = native_fixture('2'); del s['refund_settlement'][0]['plan']['sellerReversal']
        self.assertEqual(self.native_report(s)['status'], 'discrepancy')
        for malformed in ([], 'invalid', {'payout_id': []}):
            s = native_fixture('2')
            if isinstance(malformed, dict): s['refund_settlement'][0]['plan'].update(malformed)
            else: s['refund_settlement'][0]['plan'] = malformed
            self.assertEqual(self.native_report(s)['status'], 'discrepancy')
        s = native_fixture('2'); s['refund_settlement'][0]['reversal_receipt_id'] = 'receipt_a'
        self.assertEqual(self.native_report(s)['status'], 'discrepancy')

    def test_d3_zero_capture_with_timestamp_not_clean(self):
        s = native_fixture()
        for table, field in [('capture', 'amount'), ('order_transaction', 'amount'), ('payment_collection', 'captured_amount'), ('split_order_payment', 'captured_amount')]:
            self.set_money(s[table][0], field, '0')
        s['split_order_payment'][0]['status'] = 'pending'
        for field, value in [('paid_total', '0'), ('transaction_total', '0'), ('pending_difference', '10')]:
            self.set_money(s['order_summary'][0]['totals'], field, value)
        self.assertEqual(self.native_report(s)['status'], 'discrepancy')
        self.assertEqual(db.normalize(s)[0][0]['captures'][0]['status'], 'reserved')

    def test_d3_zero_refund_not_clean(self):
        s = native_fixture('2')
        for table, field in [('refund', 'amount'), ('commerce_refund_dispatch', 'amount'), ('payment_collection', 'refunded_amount'), ('split_order_payment', 'refunded_amount')]:
            self.set_money(s[table][0], field, '0')
        self.set_money(s['order_transaction'][1], 'amount', '0')
        s['refund_settlement'][0]['plan']['customerRefund'] = '0'
        s['split_order_payment'][0]['status'] = 'captured'
        for field, value in [('refunded_total', '0'), ('transaction_total', '10'), ('pending_difference', '0')]:
            self.set_money(s['order_summary'][0]['totals'], field, value)
        self.assertEqual(self.native_report(s)['status'], 'discrepancy')
        self.assertEqual(db.normalize(s)[0][0]['refunds'][0]['status'], 'reserved')

    def test_d4_required_identity_null_or_missing_blocked(self):
        for table, field in [('order_transaction', 'id'), ('order_summary', 'id'), ('capture', 'id'), ('payment', 'id'), ('cart_payment_collection', 'cart_id'), ('refund_settlement', 'operation_id')]:
            for missing in (False, True):
                with self.subTest(table=table, missing=missing):
                    s = native_fixture('2')
                    if missing: del s[table][0][field]
                    else: s[table][0][field] = None
                    with self.assertRaisesRegex(db.DBReadBlocked, 'required_native_identity_missing'):
                        db.normalize(s)

    def test_d4_orphan_cartlink_not_clean(self):
        s = native_fixture(); s['cart_payment_collection'].append(dict(cart_id='cart_missing', payment_collection_id='pc_missing', deleted_at=None))
        self.assertIn('orphan_cart_collection_binding', self.native_report(s)['issues'])

    def test_unsupported_completion_and_canceled_shapes(self):
        for table, field, value in [('payment', 'canceled_at', 'present'), ('payment_collection', 'status', 'authorized'), ('payment_collection', 'completed_at', None)]:
            with self.subTest(field=field):
                s = native_fixture(); s[table][0][field] = value
                self.assertIn('unsupported_native_completion_shape', self.native_report(s)['payments'][0]['issues'])

    def test_observed_completion_remains_separate_from_acceptance(self):
        s = native_fixture(); self.set_money(s['split_order_payment'][0], 'refunded_amount', '2')
        rows, _ = db.normalize(s)
        self.assertEqual(rows[0]['captures'][0]['observed_status'], 'completed')
        self.assertEqual(rows[0]['captures'][0]['status'], 'reserved')
        report = self.native_report(s)
        self.assertEqual(report['payments'][0]['amounts']['capture_native_observed_completed'], '10.00')
        self.assertEqual(report['payments'][0]['amounts']['capture_completed'], '0.00')

    def test_no_effect_scope_not_silently_clean(self):
        s = native_fixture(); s['capture'] = []; s['order_transaction'] = []
        s['payment'][0]['captured_at'] = None
        s['payment_collection'][0].update(status='authorized', completed_at=None)
        for table in ('payment_collection', 'split_order_payment'): self.set_money(s[table][0], 'captured_amount', '0')
        s['split_order_payment'][0]['status'] = 'pending'
        for field, value in [('paid_total', '0'), ('transaction_total', '0'), ('pending_difference', '10')]: self.set_money(s['order_summary'][0]['totals'], field, value)
        self.assertIn('unsupported_no_capture_effect', self.native_report(s)['payments'][0]['issues'])

    def test_native_projection_preserves_comparison_positive_and_blocks_reversal(self):
        from scripts.reconciliation.comparison import compare
        from scripts.reconciliation.stripe_readonly import project_event
        charge = dict(id='ch_a', object='charge', livemode=False, currency='eur', created=1,
                      payment_intent='pi_a', status='succeeded', amount=1000,
                      amount_captured=1000, amount_refunded=200, paid=True, captured=True)
        refund = dict(id='re_a', object='refund', livemode=False, currency='eur', created=2,
                      payment_intent='pi_a', charge='ch_a', status='succeeded', amount=200)
        event = project_event(dict(id='evt_a', object='event', livemode=False, created=2,
                                   type='refund.updated', request=dict(id='req_a', idempotency_key='ref_a'),
                                   data=dict(object=refund)), False)
        provider = dict(complete=True, livemode=False, charges=[charge], refunds=[refund], events=[event])
        s = native_fixture('2')
        self.assertTrue(compare(provider, db.normalize(s)[0])['clean'])
        for value in ('1', {'unsupported': True}):
            s = native_fixture('2'); s['refund_settlement'][0]['plan']['sellerReversal'] = value
            self.assertFalse(compare(provider, db.normalize(s)[0])['clean'])
        s = native_fixture('2'); self.set_money(s['order_summary'][0]['totals'], 'accounting_total', '9')
        self.assertFalse(compare(provider, db.normalize(s)[0])['clean'])

    def test_d4_matching_null_identity_never_authorizes(self):
        s = native_fixture(); s['capture'][0]['id'] = None; s['order_transaction'][0]['reference_id'] = None
        with self.assertRaisesRegex(db.DBReadBlocked, 'required_native_identity_missing'): db.normalize(s)
        s = native_fixture(); s['payment'][0]['id'] = None; s['capture'][0]['payment_id'] = None
        with self.assertRaisesRegex(db.DBReadBlocked, 'required_native_identity_missing'): db.normalize(s)
        s = native_fixture('2')
        for table in ('refund_settlement', 'commerce_refund_dispatch'): s[table][0]['operation_id'] = None
        s['refund_settlement'][0]['plan']['operation_id'] = None; s['order_transaction'][1]['reference_id'] = None
        with self.assertRaisesRegex(db.DBReadBlocked, 'required_native_identity_missing'): db.normalize(s)

    def test_no_effect_receipt_marker_never_counts_as_completion(self):
        for phase in ('completed', 'refund_started', 'refund_no_effect'):
            with self.subTest(phase=phase):
                s = native_fixture('2')
                s['refund_settlement'][0].update(phase=phase, no_effect_receipt_id='forged_receipt')
                rows, issues = db.normalize(s)
                self.assertIn('unsupported_no_effect_receipt_marker', issues)
                self.assertIn('unsupported_no_effect_receipt_marker', rows[0]['quarantine'])
                self.assertFalse(db._dispatch_valid(s['commerce_refund_dispatch'][0], s))
                self.assertEqual(db.ledger_report(dict(rows=rows, issues=issues, counts={}))['status'], 'discrepancy')
        # Old schema and explicitly empty marker remain supported.
        for marker in ('missing', None):
            s = native_fixture('2')
            if marker is None: s['refund_settlement'][0]['no_effect_receipt_id'] = None
            rows, issues = db.normalize(s)
            self.assertEqual(db.ledger_report(dict(rows=rows, issues=issues, counts={}))['status'], 'clean')

    def test_optional_marker_projection_is_schema_safe(self):
        expression = db._projection_sql('refund_settlement')
        self.assertIn("to_jsonb(r)->>'no_effect_receipt_id'", expression)
        self.assertNotIn('r.\"no_effect_receipt_id\"', expression)

    def test_missing_external_attestation_never_calls_get_or_docker(self):
        key = self.root / "key"
        key.write_text("rk_test_OFFLINEFIXTURE"); key.chmod(0o600)
        config = self.file("config.json", {"runtimes": [self.old, self.fixed], "stripe": {"restricted_key_file": str(key), "livemode": False}})
        with patch.object(db.subprocess, "run") as run, patch.object(cli.StripeReadOnly, "scan") as http:
            self.assertEqual(self.invoke(["check", "--config", config])[0], 3)
            run.assert_not_called(); http.assert_not_called()

    def test_cli_help_and_safe_output_file(self):
        result = subprocess.run(["python3", "-m", "scripts.reconciliation", "--help"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("ledger", result.stdout); self.assertIn("check", result.stdout)
        output = self.root / "report.json"
        with patch.object(cli, "scan_runtime", return_value={"rows": [], "counts": {}, "issues": [], "complete": True}):
            self.assertEqual(self.invoke(["ledger", "--runtime", self.old, "--output", str(output)])[0], 0)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertEqual(self.invoke(["ledger", "--runtime", self.old, "--output", str(output)])[0], 3)


if __name__ == "__main__": unittest.main()
