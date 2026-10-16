"""Offline exact planner/bind regressions. Fake GREEN is NOT PostgreSQL acceptance."""
import copy
from dataclasses import replace
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from reconciliation import native_repair as native
from reconciliation.raw_snapshot import decode_json as raw_decode, exact_json as raw_encode
from test_reconciliation_native import FakeConnection, fixture, gates

PROBE = Decimal("19.990000000000000001234567890123456789")
PROBE_NEXT = Decimal("19.990000000000000001234567890123456788")
NESTED = {"nested": [{"exact": PROBE, "tiny": Decimal("1E-40"),
                       "big": 9007199254740993, "flag": True}], "text": "café"}


def numeric_fixture(kind):
    data = fixture(kind)
    def convert(value):
        if isinstance(value, dict):
            for key in list(value):
                if "raw_" + key in value:
                    value[key] = Decimal(value[key]).quantize(Decimal("0.01"))
                convert(value[key])
        elif isinstance(value, list):
            for item in value:
                convert(item)
    convert(data["snapshot"])
    for rows in data["snapshot"].values():
        for row in rows:
            row["binding_probe"] = copy.deepcopy(NESTED)
    totals = data["snapshot"]["order_summary"][0]["totals"]
    totals["unrelated_metadata"] = copy.deepcopy(NESTED)
    if kind == "capture_success":
        snapshot = data["snapshot"]["marketplace_capture_tail"][0]["snapshot"]
        snapshot["amount"] = Decimal(snapshot["amount"])
        snapshot["metadata"] = copy.deepcopy(NESTED)
        snapshot["allocations"][0]["amount"] = Decimal("10")
        snapshot["allocations"][0]["metadata"] = copy.deepcopy(NESTED)
    else:
        plan = data["snapshot"]["refund_settlement"][0]["plan"]
        plan.update(customerRefund=Decimal("2.50"), sellerReversal=Decimal("0"),
                    metadata=copy.deepcopy(NESTED))
        data["snapshot"]["commerce_refund_dispatch"][0]["amount"] = Decimal("2.50")
    # Simulate the real raw prefixed TEXT contract without touching any raw artifact.
    data["snapshot"] = raw_decode(raw_encode(data["snapshot"]))
    return data


class ExactBindingTests(unittest.TestCase):
    def test_canonical_decimal_is_numeric_lossless_and_compatible_with_raw(self):
        text = native.canonical(NESTED)
        self.assertEqual(text, raw_encode(NESTED))
        decoded = json.loads(text, parse_float=Decimal)
        self.assertEqual(decoded, NESTED)
        self.assertIsInstance(decoded["nested"][0]["exact"], Decimal)
        self.assertIn('"exact":19.990000000000000001234567890123456789', text)
        self.assertEqual(native.digest(NESTED), hashlib.sha256(text.encode()).hexdigest())
        altered = copy.deepcopy(NESTED)
        altered["nested"][0]["exact"] = PROBE_NEXT
        self.assertNotEqual(native.digest(NESTED), native.digest(altered))

    def test_exact_parser_rejects_duplicates_at_every_depth(self):
        for text in ('{"a":1,"a":2}', '{"nested":[{"a":1,"a":2}]}'):
            with self.subTest(text=text), self.assertRaises(native.RepairBlocked):
                native.decode_json(text)

    def test_exact_parser_rejects_nonfinite_and_malformed(self):
        for text in ('NaN', 'Infinity', '-Infinity', '{"a":NaN}', '{', '', None,
                     '1e9999999999999999999999999999999999999999'):
            with self.subTest(text=text), self.assertRaises(native.RepairBlocked):
                native.decode_json(text)
        self.assertEqual(native.decode_json('{"a":1e-1000,"b":9007199254740993}'),
                         {"a": Decimal("1e-1000"), "b": 9007199254740993})

    def test_canonical_rejects_nonfinite_and_unsupported_values(self):
        for value in (Decimal("NaN"), Decimal("Infinity"), float("nan"), float("inf"),
                      {1: "nonstring key"}, {"x": object()}):
            with self.subTest(type=type(value).__name__), self.assertRaises(native.RepairBlocked):
                native.canonical(value)

    def test_case_as_dict_detaches_decimal_snapshot_evidence_and_proposal(self):
        text = raw_encode(NESTED)
        case = native.CasePlan("test", "capture_success", "ready", None, text, text, text, "hash")
        first = case.as_dict()
        for field in ("snapshot", "evidence", "proposal"):
            self.assertEqual(first[field], NESTED)
            self.assertIsInstance(first[field]["nested"][0]["exact"], Decimal)
            first[field]["nested"][0]["exact"] = Decimal("0")
        self.assertEqual(case.as_dict()["snapshot"], NESTED)

    def test_statement_bundle_decimal_params_are_exact_and_detached(self):
        case = native.plan_case(fixture())
        serialized = raw_encode([{"sql": "SELECT %s", "params": [PROBE, NESTED],
                                  "expect": "none", "label": "probe"}])
        bundle = native.StatementBundle(case, gates(case), serialized)
        self.assertEqual(len(bundle), 1)
        self.assertIsInstance(bundle[0].params[0], Decimal)
        self.assertEqual(bundle[0].params[0], PROBE)
        bundle[0].params[1]["nested"].clear()
        self.assertEqual(bundle[0].params[1], NESTED)

    def test_positive_capture_and_refund_raw_to_planner_to_sql_audit_binding(self):
        for kind in ("capture_success", "refund_success"):
            with self.subTest(kind=kind):
                data = numeric_fixture(kind)
                before = copy.deepcopy(data["snapshot"])
                case = native.plan_case(data)
                self.assertEqual(case.status, "ready")
                self.assertEqual(case.as_dict()["snapshot"], before)
                self.assertIsInstance(case.as_dict()["snapshot"]["payment"][0]["amount"], Decimal)
                self.assertEqual(case.snapshot_json, raw_encode(before))
                data["snapshot"]["payment"][0]["binding_probe"]["nested"].clear()
                self.assertEqual(case.as_dict()["snapshot"], before)
                gate = gates(case)
                schema = raw_decode(gate.schema_snapshot_json)
                schema["columns"][0]["binding_probe"] = copy.deepcopy(NESTED)
                gate = replace(gate, schema_snapshot_json=raw_encode(schema))
                bundle = native.generate_sql(case, gate)
                self.assertEqual(bundle, native.generate_sql(case, gate))
                bound = {st.label: st for st in bundle}
                for st in bundle:
                    matches = list(re.finditer(r"%s", st.sql))
                    self.assertEqual(len(matches), len(st.params))
                    for index, match in enumerate(matches):
                        if st.sql[match.end():].startswith("::jsonb"):
                            self.assertIsInstance(st.params[index], str)
                            raw_decode(st.params[index])
                for table, rows in before.items():
                    self.assertEqual(raw_decode(bound["snapshot_" + table].params[0]), rows)
                self.assertEqual(raw_decode(bound["approved_live_schema"].params[0]), schema)
                self.assertIn(format(PROBE, "f"), bound["actual_summary_postcondition"].params[4])
                for label in ("atomic_audit_insert", "atomic_actual_after_audit"):
                    st = bound[label]
                    self.assertEqual(raw_decode(st.params[5]), before)
                    self.assertEqual(raw_decode(st.params[4])["provider"], data["evidence"])
                    self.assertIn("jsonb_build_object(", st.sql)
                    for table in before:
                        self.assertIn('FROM public."' + table + '" t WHERE ', st.sql)
                    self.assertNotIn("proposal", st.sql)
                proposal = raw_decode(case.proposal_json)
                self.assertEqual(proposal["signed_amount"], "10" if kind == "capture_success" else "-2.5")
                self.assertEqual(proposal["summary_updates"]["transaction_total"], "10" if kind == "capture_success" else "7.5")
                conn = FakeConnection(bundle)
                self.assertTrue(native.execute_transaction(conn, bundle)["committed"])
                self.assertEqual((conn.commits, conn.rollbacks), (1, 0))
                for label in ("actual_summary_postcondition", "atomic_actual_after_audit"):
                    conn = (FakeConnection(bundle, bad_rowcount=label) if label == "atomic_actual_after_audit"
                            else FakeConnection(bundle, fail_label=label))
                    with self.assertRaises(native.RepairBlocked):
                        native.execute_transaction(conn, bundle)
                    self.assertEqual((conn.commits, conn.rollbacks), (0, 1))

    def test_negative_precision_drift_native_money_and_runtime_json_amounts(self):
        for kind in ("capture_success", "refund_success"):
            data = numeric_fixture(kind)
            native_table = "capture" if kind == "capture_success" else "refund"
            row = data["snapshot"][native_table][0]
            row["amount"] = Decimal("10.0000000000000000001" if kind == "capture_success" else "2.5000000000000000001")
            with self.subTest(kind=kind), self.assertRaisesRegex(native.RepairBlocked, "raw_numeric_mismatch"):
                native.plan_case(data)
            data = numeric_fixture(kind)
            if kind == "capture_success":
                data["snapshot"]["marketplace_capture_tail"][0]["snapshot"]["amount"] = Decimal("10.0000000000000000001")
            else:
                data["snapshot"]["refund_settlement"][0]["plan"]["customerRefund"] = Decimal("2.5000000000000000001")
            with self.assertRaises(native.RepairBlocked):
                native.plan_case(data)

    def test_nested_precision_drift_is_distinct_and_forgery_rejected_before_execution(self):
        data = numeric_fixture("refund_success")
        case = native.plan_case(data)
        data["snapshot"]["payment"][0]["binding_probe"]["nested"][0]["exact"] = PROBE_NEXT
        changed = native.plan_case(data)
        self.assertNotEqual(case.plan_hash, changed.plan_hash)
        forged = replace(case, snapshot_json=changed.snapshot_json)
        with self.assertRaisesRegex(native.RepairBlocked, "integrity"):
            native.generate_sql(forged, gates(case))
        bundle = native.generate_sql(case, gates(case))
        forged_bundle = replace(bundle, serialized=bundle.serialized.replace(str(PROBE), str(PROBE_NEXT), 1))
        conn = FakeConnection(forged_bundle)
        with self.assertRaisesRegex(native.RepairBlocked, "integrity"):
            native.execute_transaction(conn, forged_bundle)
        self.assertEqual(conn.seen, [])

    def test_duplicate_json_in_plan_and_gates_is_rejected(self):
        case = native.plan_case(fixture())
        gate = gates(case)
        for field in ("snapshot_json", "evidence_json"):
            text = getattr(case, field)
            key = next(iter(json.loads(text)))
            duplicate = '{' + json.dumps(key) + ':null,' + text[1:]
            with self.subTest(field=field), self.assertRaises(native.RepairBlocked):
                native.generate_sql(replace(case, **{field: duplicate}), gate)
        for field in ("schema_snapshot_json", "guard_contract_json"):
            text = getattr(gate, field)
            key = next(iter(json.loads(text)))
            duplicate = '{' + json.dumps(key) + ':null,' + text[1:]
            with self.subTest(field=field), self.assertRaises(native.RepairBlocked):
                native.generate_sql(case, replace(gate, **{field: duplicate}))

    def test_bool_money_and_malformed_raw_wrappers_fail_closed(self):
        for value in (True, False, None):
            with self.subTest(value=value), self.assertRaises(native.RepairBlocked):
                native.amount({"amount": value, "raw_amount": {"value": "1", "precision": 20}})
        for wrapper in ({"value": "10", "precision": True}, {"value": "10", "precision": 0},
                        {"value": "10", "precision": 101}, {"value": Decimal("10"), "precision": 20},
                        {"value": "10", "precision": 20, "extra": 1},
                        {"value": "1_0", "precision": 20}, {"value": " 10 ", "precision": 20}):
            with self.subTest(wrapper=wrapper), self.assertRaises(native.RepairBlocked):
                native.amount({"amount": Decimal("10"), "raw_amount": wrapper})
        for kind in ("capture_success", "refund_success"):
            data = numeric_fixture(kind)
            if kind == "capture_success":
                data["snapshot"]["marketplace_capture_tail"][0]["snapshot"]["amount"] = True
            else:
                data["snapshot"]["refund_settlement"][0]["plan"]["customerRefund"] = True
            with self.assertRaises(native.RepairBlocked):
                native.plan_case(data)

    def test_decimal_five_case_plan_stays_exact_and_no_effect_stays_blocked(self):
        inputs = [numeric_fixture("refund_success"), numeric_fixture("refund_success"),
                  numeric_fixture("capture_success"), fixture("refund_no_effect", "d"),
                  fixture("refund_no_effect", "e")]
        # Reuse independently bound fixture identities, never rewrite authenticated receipts.
        for index, (kind, suffix) in enumerate((("refund_success", "b"), ("capture_success", "c")), 1):
            scoped = fixture(kind, suffix)
            scoped["snapshot"]["payment"][0]["binding_probe"] = copy.deepcopy(NESTED)
            inputs[index] = scoped
        batch = native.build_plan(inputs)
        self.assertEqual([case.status for case in batch.cases], ["ready"] * 3 + ["blocked"] * 2)
        self.assertEqual(batch.plan_hash, native.digest([case.as_dict() for case in batch.cases]))
        for case in batch.cases[:3]:
            self.assertEqual(case.as_dict()["snapshot"]["payment"][0]["binding_probe"], NESTED)
        for case in batch.cases[3:]:
            with self.assertRaisesRegex(native.RepairBlocked, "missing_no_effect_terminal"):
                native.generate_sql(case, gates(case))

    def test_decimal_snapshot_never_unlocks_operational_evidence(self):
        case = native.plan_case(numeric_fixture("refund_success"))
        for gate in (replace(gates(case), isolated_test_only=False),
                     replace(gates(case), database="existing_financial_sandbox")):
            with self.assertRaises(native.RepairBlocked):
                native.generate_sql(case, gate)

    def test_existing_transactions_require_complete_row_equality_without_system_exclusions(self):
        case = native.plan_case(numeric_fixture("refund_success"))
        statement = next(st for st in native.generate_sql(case, gates(case))
                         if st.label == "actual_all_transactions_postcondition")
        self.assertIn("to_jsonb(t)", statement.sql)
        self.assertNotIn(" - ", statement.sql)
        self.assertEqual(raw_decode(statement.params[0]), case.as_dict()["snapshot"]["order_transaction"])

    def test_new_transaction_has_separate_full_explicit_default_contract(self):
        case = native.plan_case(numeric_fixture("capture_success"))
        gate = gates(case)
        schema = raw_decode(gate.schema_snapshot_json)
        for field in ("created_at", "updated_at"):
            schema["columns"].append({"table_name": "order_transaction", "column_name": field,
                                      "data_type": "timestamp with time zone", "is_nullable": "NO",
                                      "column_default": "now()"})
        schema["columns"].append({"table_name": "order_transaction", "column_name": "claim_id",
                                  "data_type": "text", "is_nullable": "YES", "column_default": None})
        gate = replace(gate, schema_snapshot_json=raw_encode(schema))
        bundle = native.generate_sql(case, gate)
        statement = next(st for st in bundle if st.label == "actual_new_transaction_postcondition")
        self.assertIn("to_jsonb(t)", statement.sql)
        self.assertNotIn(" - ", statement.sql)
        expected = raw_decode(statement.params[0])
        self.assertIsInstance(expected["amount"], int)
        self.assertIsNone(expected["claim_id"])
        self.assertIn("'created_at',now()", statement.sql)
        self.assertIn("'updated_at',now()", statement.sql)
        schema["columns"][-1]["column_default"] = "'unapproved'::text"
        with self.assertRaisesRegex(native.RepairBlocked, "unsupported_new_transaction_default"):
            native.generate_sql(case, replace(gate, schema_snapshot_json=raw_encode(schema)))

    def test_receipt_integer_string_contract_is_preserved_and_never_resealed(self):
        data = fixture("refund_success")
        def pinned(value):
            if isinstance(value, dict):
                for child in value.values():
                    pinned(child)
            elif isinstance(value, list):
                for child in value:
                    pinned(child)
            else:
                self.assertIn(type(value), (int, str, bool, type(None)))
        pinned(data["evidence"])
        case = native.plan_case(data)
        self.assertEqual(native.decode_json(case.evidence_json), data["evidence"])
        data["evidence"]["unsealed_decimal"] = PROBE
        with self.assertRaisesRegex(native.RepairBlocked, "authenticated_reader_evidence_required"):
            native.plan_case(data)

    def test_all_native_json_read_sites_use_exact_decoder(self):
        # Static regression supplements actual fixtures, including less-used bundle length/batch sites.
        source = Path(native.__file__).read_text()
        self.assertNotIn("json.loads(", source)
        self.assertNotIn("json.dumps(", source)


if __name__ == "__main__":
    unittest.main()
