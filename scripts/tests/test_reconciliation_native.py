"""Offline protocol tests plus opt-in real PostgreSQL read-only SELECT regression.

Run real regression against an EXISTING sandbox schema (no migrations/writes):
HS_RECON_READONLY_PSQL_JSON='["docker","exec","-i","CONTAINER","psql","-U","USER","-d","SANDBOX"]'
python3 -m unittest discover -s scripts/tests -p test_reconciliation_native.py -v
Optional HS_RECON_SQL_RECEIPT writes the exact SQL/stdout to an audit receipt.
Synthetic approvals are used ONLY to generate SQL, never to authorize an apply.
"""
import copy
import hashlib
import json
import os
import subprocess
import sys
import unittest
from contextlib import contextmanager
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reconciliation.evidence import offline_fixture_evidence
from reconciliation.stripe_readonly import key_hash
from reconciliation.native_repair import (ApplyGates, AUDIT_COLUMNS, CasePlan, RepairBlocked,
    SCHEMA_SQL, amount, build_plan, canonical, execute_transaction, generate_sql,
    lock_key, plan_case, schema_tables, required_columns, digest, ORDER_COLLECTION_LINK, ORDER_SPLIT_LINK)


def raw(value):
    return {"value": str(value), "precision": 20}


def financial(id, value, **extra):
    return {"id": id, "amount": str(value), "raw_amount": raw(value), "deleted_at": None, **extra}


def fixture(kind="refund_success", suffix="a"):
    pid, col, oid, cart, split = [x + suffix for x in ("pay_", "col_", "order_", "cart_", "split_")]
    is_capture = kind == "capture_success"
    cap = financial("cap_" + suffix, "10", payment_id=pid)
    refund = financial("ref_" + suffix, "2.50", payment_id=pid)
    payment = financial(pid, "10", payment_collection_id=col, provider_id="pp_card_stripe-connect", data={"id": "pi_" + suffix}, currency_code="eur", captured_at=None if is_capture else "2026-01-01", canceled_at=None)
    pc = financial(col, "10", currency_code="eur", status="authorized" if is_capture else "completed", completed_at=None)
    sp = {"id": split, "payment_collection_id": col, "deleted_at": None, "currency_code": "eur", "status": "pending" if is_capture else "captured"}
    for obj in (pc, sp):
        for f, v in (("authorized_amount", "10"), ("captured_amount", "0" if is_capture else "10"), ("refunded_amount", "0")):
            obj[f], obj["raw_" + f] = v, raw(v)
    totals = {}
    for f, v in (("current_order_total", "10"), ("original_order_total", "10"), ("accounting_total", "10"), ("credit_line_total", "0"), ("paid_total", "0" if is_capture else "10"), ("refunded_total", "0"), ("transaction_total", "0" if is_capture else "10"), ("pending_difference", "10" if is_capture else "0")):
        totals[f], totals["raw_" + f] = v, raw(v)
    snapshot = {"payment": [payment], "payment_collection": [pc], "capture": [cap], "refund": [] if is_capture else [refund],
        "order": [{"id": oid, "version": 1, "currency_code": "eur", "deleted_at": None}],
        "order_summary": [{"id": "sum_" + suffix, "order_id": oid, "version": 1, "totals": totals, "deleted_at": None}],
        "order_transaction": [] if is_capture else [financial("tx_" + suffix, "10", order_id=oid, version=1, currency_code="eur", reference="capture", reference_id=cap["id"])],
        "split_order_payment": [sp], "cart_payment_collection": [{"cart_id": cart, "payment_collection_id": col, "deleted_at": None}],
        ORDER_COLLECTION_LINK: [{"order_id": oid, "payment_collection_id": col, "deleted_at": None}],
        ORDER_SPLIT_LINK: [{"order_id": oid, "split_order_payment_id": split, "deleted_at": None}]}
    if is_capture:
        ts = {"version": 1, "payment_id": pid, "cart_id": cart, "collection_id": col, "intent_id": "pi_" + suffix, "provider_id": payment["provider_id"], "currency_code": "eur", "amount": "10", "allocations": [{"order_id": oid, "version": 1, "split_id": split, "currency_code": "eur", "amount": "10"}]}
        snapshot["marketplace_capture_tail"] = [{"payment_id": pid, "cart_id": cart, "snapshot": ts, "capture_id": None, "event_id": "marketplace-captured-" + "a" * 64, "accounting_at": None, "event_enqueued_at": None, "completed_at": None}]
    else:
        plan = {"operation_id": "op_" + suffix, "order_id": oid, "scope_id": col, "payment_id": pid, "split_order_payment_id": split, "currency_code": "eur", "customerRefund": "2.50", "sellerReversal": "0"}
        snapshot["refund_settlement"] = [{"operation_id": "op_" + suffix, "order_id": oid, "scope_id": col, "fingerprint": "fixed", "plan": plan, "phase": "refund_started", "reversal_receipt_id": None}]
        snapshot["commerce_refund_dispatch"] = [{"refund_id": refund["id"], "idempotency_key": refund["id"], "operation_id": "op_" + suffix, "scope_id": col, "payment_id": pid, "provider_id": payment["provider_id"], "provider_payment_id": "pi_" + suffix, "currency_code": "eur", "amount": "2.50", "state": "started"}]
    key = ("cap_" if is_capture else "ref_") + suffix
    evidence = offline_fixture_evidence({"livemode": False, "currency": "eur", "status": "succeeded",
        "amount_minor": 1000 if is_capture else 250, "payment_intent": "pi_" + suffix,
        "idempotency_key": key, "idempotency_key_hash": key_hash(key),
        "operation_id": key if is_capture else "op_" + suffix,
        "kind": kind, "object": "charge" if is_capture else "refund",
        "account_id": "acct_TestOnly", "expected_account_id": "acct_TestOnly",
        "identity_metadata": {"cart_id": cart, "payment_id": pid, "collection_id": col, "order_id": oid, "run_id": "test_" + suffix},
        "provider_effect_id": ("ch_" if is_capture else "re_") + suffix})
    # Use the bridge's actual scoped issuance adapter, with synthetic projections.
    pi = {"id": "pi_" + suffix, "status": "succeeded", "livemode": False,
          "currency": "eur", "amount": 1000, "metadata": evidence["identity_metadata"]}
    charge = {"id": "ch_" + suffix, "object": "charge", "payment_intent": pi["id"],
              "status": "succeeded", "livemode": False, "currency": "eur", "paid": True,
              "captured": True, "amount": 1000, "amount_captured": 1000,
              "amount_refunded": 0 if is_capture else 250}
    provider_refunds = [] if is_capture else [{"id": "re_" + suffix, "object": "refund",
        "payment_intent": pi["id"], "charge": charge["id"], "status": "succeeded",
        "livemode": False, "currency": "eur", "amount": 250}]
    if kind != "refund_no_effect":
        evidence = offline_fixture_evidence(evidence, payment_intent=pi,
            inventory={"complete": True, "livemode": False, "charges": [charge], "refunds": provider_refunds})
    return {"case_id": "case_" + suffix, "kind": kind, "snapshot": snapshot, "evidence": evidence}


def gates(case):
    tables = schema_tables(case.kind)
    # Explicit SYNTHETIC schema/guard approval, not a claim of installed DDL.
    schema = {"columns": [{"table_name": t, "column_name": c, "data_type": typ, "is_nullable": "NO"} for t in tables for c, typ in required_columns()[t].items()],
        "constraints": [{"table": "reconciliation_repair_audit", "definition": "PRIMARY KEY (id)"}], "triggers": [],
        "indexes": [{"tablename": "order_transaction", "indexname": "marketplace_order_capture_once", "indexdef": "CREATE UNIQUE INDEX marketplace_order_capture_once ON public.order_transaction USING btree (order_id, reference_id) WHERE reference = 'capture' AND reference_id IS NOT NULL"}, {"tablename": "capture", "indexname": "marketplace_payment_full_capture_once", "indexdef": "CREATE UNIQUE INDEX marketplace_payment_full_capture_once ON public.capture USING btree (payment_id)"}]}
    contracts = {}
    for table, name, function, events in (("refund_settlement", "refund_settlement_guard_trigger", "refund_settlement_guard", "INSERT OR UPDATE OR DELETE"), ("commerce_refund_dispatch", "commerce_refund_dispatch_guard_trigger", "commerce_refund_dispatch_guard", "INSERT OR UPDATE OR DELETE"), ("marketplace_capture_tail", "marketplace_capture_tail_immutable", "marketplace_capture_tail_immutable", "UPDATE OR DELETE"), ("reconciliation_repair_audit", "reconciliation_repair_audit_immutable", "reconciliation_repair_audit_immutable", "UPDATE OR DELETE"), ("reconciliation_repair_audit", "reconciliation_repair_audit_no_truncate", "reconciliation_repair_audit_immutable", "TRUNCATE")):
        body = "SYNTHETIC fixture guard " + function + ": RAISE EXCEPTION 'blocked';"
        schema["triggers"].append({"table": table, "name": name, "enabled": "O", "function": body, "definition": f"CREATE TRIGGER {name} BEFORE {events} ON public.{table} FOR EACH {'STATEMENT' if events == 'TRUNCATE' else 'ROW'} EXECUTE FUNCTION public.{function}()"})
        contracts[table + "." + name] = digest(body)
    return ApplyGates(True, "operator", "authorization-ticket", True, "fence-ticket", "hs_recon_it_" + "0" * 32, case.plan_hash, canonical(schema), "schema-approval", canonical(contracts), isolated_test_only=True)


class FakeConnection:
    """Tests execution/rollback protocol, not PostgreSQL SQL semantics."""
    autocommit = True
    def __init__(self, statements, fail_label=None, bad_rowcount=None):
        self.statements = statements
        self.fail_label, self.bad_rowcount = fail_label, bad_rowcount
        self.seen, self.commits, self.rollbacks = [], 0, 0
        self.rowcount = 1
    @contextmanager
    def transaction(self):
        try:
            yield
        except Exception:
            self.rollbacks += 1
            raise
        else:
            self.commits += 1
    @contextmanager
    def cursor(self):
        yield self
    def execute(self, sql, params):
        statement = self.statements[len(self.seen)]
        assert statement.sql == sql and statement.params == params
        self.seen.append(statement)
        self.rowcount = 0 if statement.label == self.bad_rowcount else 1
    def fetchone(self):
        statement = self.seen[-1]
        return (False,) if statement.label == self.fail_label else ((True,) if statement.expect == "true" else ("row",))


class NativeRepairTests(unittest.TestCase):
    def test_exact_five_case_plan(self):
        batch = build_plan([fixture(suffix="a"), fixture(suffix="b"), fixture("capture_success", "c"), fixture("refund_no_effect", "d"), fixture("refund_no_effect", "e")])
        self.assertEqual([p.status for p in batch.cases], ["ready"] * 3 + ["blocked"] * 2)
        self.assertEqual(len(batch.plan_hash), 64)

    def test_wrong_bound_and_overlapping_cases(self):
        with self.assertRaisesRegex(RepairBlocked, "exactly_five"):
            build_plan([])
        with self.assertRaises(RepairBlocked):
            build_plan([fixture()] * 5)

    def test_immutable_and_detached(self):
        f = fixture()
        p = plan_case(f)
        before = p.snapshot_json
        f["snapshot"]["refund"][0]["amount"] = "999"
        self.assertEqual(p.snapshot_json, before)
        with self.assertRaises(FrozenInstanceError):
            p.status = "applied"

    def test_no_effect_always_blocked(self):
        p = plan_case(fixture("refund_no_effect"))
        self.assertIn("missing_no_effect_terminal", p.blocker)
        with self.assertRaisesRegex(RepairBlocked, "missing_no_effect"):
            generate_sql(p, gates(p))

    def test_refund_sign_and_pending_delta(self):
        p = json.loads(plan_case(fixture()).proposal_json)
        self.assertEqual(p["signed_amount"], "-2.5")
        self.assertEqual(p["summary_updates"]["transaction_total"], "7.5")
        self.assertEqual(p["summary_updates"]["pending_difference"], "2.5")
        self.assertEqual(p["collection_captured"], "10")
        self.assertEqual(p["collection_refunded"], "2.50")
        self.assertEqual(p["summary_updates"]["raw_pending_difference"]["precision"], 20)

    def test_existing_duplicate_validated_not_overwritten(self):
        f = fixture()
        tx = financial("existing", "-2.50", order_id="order_a", version=1, currency_code="eur", reference="refund", reference_id="ref_a")
        f["snapshot"]["order_transaction"].append(tx)
        t = f["snapshot"]["order_summary"][0]["totals"]
        for k, v in (("refunded_total", "2.50"), ("transaction_total", "7.50"), ("pending_difference", "2.50")):
            t[k], t["raw_" + k] = v, raw(v)
        p = plan_case(f)
        self.assertFalse(json.loads(p.proposal_json)["insert_transaction"])
        self.assertNotIn("native_transaction", [s.label for s in generate_sql(p, gates(p))])
        tx["amount"], tx["raw_amount"] = "-3", raw("-3")
        with self.assertRaisesRegex(RepairBlocked, "duplicate_identity_or_amount"):
            plan_case(f)

    def test_duplicate_soft_deleted_or_multiple_rows_rejected(self):
        f = fixture()
        f["snapshot"]["capture"].append(copy.deepcopy(f["snapshot"]["capture"][0]))
        with self.assertRaises(RepairBlocked):
            plan_case(f)
        f = fixture()
        f["snapshot"]["refund"][0]["deleted_at"] = "yesterday"
        with self.assertRaises(RepairBlocked):
            plan_case(f)

    def test_mismatch_and_unverified_evidence_rejected(self):
        for key, bad in (("authentication", {}), ("livemode", True), ("status", "pending"), ("amount_minor", 251), ("currency", "usd"), ("payment_intent", "wrong")):
            f = fixture()
            f["evidence"][key] = bad
            with self.subTest(key=key), self.assertRaises(RepairBlocked):
                plan_case(f)
        f = fixture()
        f["snapshot"]["refund"][0]["raw_amount"]["value"] = "99"
        with self.assertRaisesRegex(RepairBlocked, "raw_numeric"):
            plan_case(f)

    def test_seller_reversal_missing_and_summary_corruption_rejected(self):
        f = fixture()
        f["snapshot"]["refund_settlement"][0]["plan"]["sellerReversal"] = "1"
        with self.assertRaises(RepairBlocked):
            plan_case(f)
        f = fixture()
        f["snapshot"]["order_summary"].append(copy.deepcopy(f["snapshot"]["order_summary"][0]))
        with self.assertRaises(RepairBlocked):
            plan_case(f)

    def test_all_apply_gates_fail_closed(self):
        p = plan_case(fixture())
        good = gates(p)
        for bad in (ApplyGates(), replace(good, sandbox=False), replace(good, writers_fenced=False), replace(good, expected_plan_hash="wrong"), replace(good, authorized_actor=""), replace(good, schema_snapshot_json="{}"), replace(good, schema_approval_reference="")):
            with self.subTest(gate=bad), self.assertRaises(RepairBlocked):
                generate_sql(p, bad)
        with self.assertRaisesRegex(RepairBlocked, "integrity"):
            generate_sql(replace(p, proposal_json="{}"), good)

    def test_sql_lock_order_atomic_audit_and_binding(self):
        p = plan_case(fixture())
        statements = generate_sql(p, gates(p))
        labels = [s.label for s in statements]
        self.assertLess(labels.index("cart_lock"), labels.index("scope_lock"))
        self.assertEqual(labels[-1], "atomic_actual_after_audit")
        transitions = [s for s in statements if s.label == "legal_settlement_forward_transition"]
        self.assertEqual([s.params[0] for s in transitions], ["refund_completed", "completed"])
        self.assertTrue(all(s.sql.count("%s") == len(s.params) for s in statements))
        self.assertTrue(all("DISABLE TRIGGER" not in s.sql and "DELETE FROM" not in s.sql and "CREATE TABLE" not in s.sql for s in statements))
        split = next(s for s in statements if s.label == "split_accounting")
        self.assertEqual(split.params[-2], "partially_refunded")
        audit = statements[-1]
        self.assertIn("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY", audit.sql)

    def test_capture_bookkeeping_not_fake_completion(self):
        p = plan_case(fixture("capture_success"))
        proposal = json.loads(p.proposal_json)
        self.assertFalse(proposal["fully_closed"])
        self.assertIn("redis_ack", proposal["remaining_protocol"])
        mutations = [s.sql for s in generate_sql(p, gates(p)) if s.sql.startswith("UPDATE")]
        tail = next(s for s in mutations if "marketplace_capture_tail" in s)
        self.assertNotIn("event_enqueued_at", tail)
        self.assertNotIn("completed_at", tail)
        self.assertIn("accounting_at", tail)

    def test_capture_allocation_changed_fails_closed(self):
        f = fixture("capture_success")
        f["snapshot"]["marketplace_capture_tail"][0]["snapshot"]["allocations"][0]["amount"] = "9"
        with self.assertRaisesRegex(RepairBlocked, "allocation"):
            plan_case(f)

    def test_adapter_success_and_rollbacks(self):
        p = plan_case(fixture())
        statements = generate_sql(p, gates(p))
        conn = FakeConnection(statements)
        result = execute_transaction(conn, statements)
        self.assertTrue(result["committed"])
        self.assertEqual((conn.commits, conn.rollbacks), (1, 0))
        for label in ("cart_lock", "approved_live_schema", "snapshot_refund"):
            conn = FakeConnection(statements, fail_label=label)
            with self.assertRaises(RepairBlocked):
                execute_transaction(conn, statements)
            self.assertEqual((conn.commits, conn.rollbacks), (0, 1))
        conn = FakeConnection(statements, bad_rowcount="atomic_actual_after_audit")
        with self.assertRaisesRegex(RepairBlocked, "rowcount_failed"):
            execute_transaction(conn, statements)
        self.assertEqual((conn.commits, conn.rollbacks), (0, 1))

    def test_no_outer_transaction_or_partial_bundle(self):
        p = plan_case(fixture())
        statements = generate_sql(p, gates(p))
        conn = FakeConnection(statements)
        conn.autocommit = False
        with self.assertRaises(RepairBlocked):
            execute_transaction(conn, statements)
        conn.autocommit = True
        with self.assertRaises(RepairBlocked):
            execute_transaction(conn, statements[:-1])

    def test_guard_missing_rejected(self):
        p = plan_case(fixture())
        g = gates(p)
        s = json.loads(g.schema_snapshot_json)
        s["triggers"] = []
        with self.assertRaisesRegex(RepairBlocked, "installed_guards"):
            generate_sql(p, replace(g, schema_snapshot_json=canonical(s)))

    def test_snapshot_bounds_and_json_numeric_decode(self):
        f = fixture()
        f["snapshot"]["refund"] = f["snapshot"]["refund"] * 129
        with self.assertRaisesRegex(RepairBlocked, "bounded_snapshot"):
            plan_case(f)
        f = fixture()
        f["snapshot"]["refund"][0]["amount"] = 2.5
        f["snapshot"]["refund_settlement"][0]["plan"]["customerRefund"] = 2.5
        self.assertEqual(plan_case(f).status, "ready")

    def test_partial_gated_bundle_and_postcondition_failure(self):
        p = plan_case(fixture())
        statements = generate_sql(p, gates(p))
        reduced = tuple(s for s in statements if s.label != "snapshot_refund")
        with self.assertRaisesRegex(RepairBlocked, "complete_gated"):
            execute_transaction(FakeConnection(reduced), reduced)
        conn = FakeConnection(statements, fail_label="actual_transaction_postcondition")
        with self.assertRaises(RepairBlocked):
            execute_transaction(conn, statements)
        self.assertEqual((conn.commits, conn.rollbacks), (0, 1))

    def test_review_native_links_required_and_reverse_conflicts(self):
        for table, field in (("order_payment_collection", "payment_collection_id"), ("order_order_split_order_payment_split_order_payment", "split_order_payment_id")):
            for kind in ("refund_success", "capture_success"):
                f = fixture(kind)
                f["snapshot"][table] = []
                with self.subTest(table=table, kind=kind), self.assertRaises(RepairBlocked):
                    plan_case(f)
                f = fixture(kind)
                f["snapshot"][table] = [{"order_id": "wrong", field: "wrong", "deleted_at": None}]
                with self.assertRaises(RepairBlocked):
                    plan_case(f)

    def test_review_existing_capture_identity_and_amount(self):
        for field, value in (("reference_id", "unrelated_capture"), ("version", 2), ("amount", "100")):
            f = fixture()
            tx = f["snapshot"]["order_transaction"][0]
            tx[field] = value
            if field == "amount":
                tx["raw_amount"] = raw(value)
                totals = f["snapshot"]["order_summary"][0]["totals"]
                for key in ("paid_total", "transaction_total"):
                    totals[key], totals["raw_" + key] = value, raw(value)
            with self.subTest(field=field), self.assertRaises(RepairBlocked):
                plan_case(f)

    def test_review_null_and_malformed_intent(self):
        for value in (None, "", " ", {}, [], 12):
            f = fixture("capture_success")
            f["evidence"]["payment_intent"] = value
            f["snapshot"]["payment"][0]["data"]["id"] = value
            f["snapshot"]["marketplace_capture_tail"][0]["snapshot"]["intent_id"] = value
            with self.subTest(value=value), self.assertRaises(RepairBlocked):
                plan_case(f)

    def test_review_executor_rejects_subset_and_altered_sql(self):
        p = plan_case(fixture())
        statements = generate_sql(p, gates(p))
        removed = {"native_transaction", "summary_delta_preserving_other_totals", "actual_transaction_postcondition", "actual_summary_collection_postcondition", "legal_settlement_forward_transition", "legal_dispatch_transition"}
        subset = tuple(s for s in statements if s.label not in removed)
        altered = tuple(replace(s, sql="SELECT TRUE", params=(), expect="none") if s.label.startswith("snapshot_") or s.label == "approved_live_schema" else s for s in statements)
        for bundle in (subset, altered):
            conn = FakeConnection(bundle)
            with self.assertRaises(RepairBlocked):
                execute_transaction(conn, bundle)
            self.assertEqual(conn.commits, 0)
            self.assertEqual(conn.seen, [])

    def test_review_schema_wrong_guard_table_and_missing_audit_contract(self):
        p = plan_case(fixture())
        good = gates(p)
        for mutation in ("table", "constraints", "audit_type"):
            schema = json.loads(good.schema_snapshot_json)
            if mutation == "table":
                for trigger in schema["triggers"]:
                    trigger["table"] = "unrelated_table"
            elif mutation == "constraints":
                schema["constraints"] = []
            else:
                for column in schema["columns"]:
                    if column["table_name"] == "reconciliation_repair_audit":
                        column["data_type"] = "boolean"
            with self.subTest(mutation=mutation), self.assertRaises(RepairBlocked):
                generate_sql(p, replace(good, schema_snapshot_json=canonical(schema)))

    def test_review_all_final_invariants_are_mandatory_assertions(self):
        for kind in ("refund_success", "capture_success"):
            p = plan_case(fixture(kind))
            statements = generate_sql(p, gates(p))
            labels = {s.label for s in statements}
            expected = {"actual_split_postcondition", "actual_payment_postcondition", "actual_native_links_postcondition", "actual_all_transactions_postcondition"}
            expected |= {"actual_settlement_postcondition", "actual_dispatch_postcondition"} if kind == "refund_success" else {"actual_capture_tail_postcondition"}
            self.assertTrue(expected <= labels, expected - labels)
            for label in expected | {"actual_summary_collection_postcondition", "actual_summary_postcondition", "actual_collection_postcondition"}:
                conn = FakeConnection(statements, fail_label=label)
                with self.subTest(kind=kind, label=label), self.assertRaises(RepairBlocked):
                    execute_transaction(conn, statements)
                self.assertEqual((conn.commits, conn.rollbacks), (0, 1))

    def test_review_link_sets_lock_forward_and_reverse_including_deleted(self):
        p = plan_case(fixture())
        statements = generate_sql(p, gates(p))
        for table, field in ((ORDER_COLLECTION_LINK, "payment_collection_id"), (ORDER_SPLIT_LINK, "split_order_payment_id")):
            statement = next(s for s in statements if s.label == "snapshot_" + table)
            self.assertIn("order_id=%s OR " + field + "=%s", statement.sql)
            self.assertIn("FOR UPDATE", statement.sql)
            self.assertNotIn("deleted_at IS NULL", statement.sql)
            for deleted in (None, "yesterday"):
                f = fixture()
                row = copy.deepcopy(f["snapshot"][table][0])
                row["order_id"], row["deleted_at"] = "other", deleted
                f["snapshot"][table].append(row)
                with self.assertRaises(RepairBlocked):
                    plan_case(f)

    def test_review_forged_bundle_and_mutable_parameters(self):
        p = plan_case(fixture())
        bundle = generate_sql(p, gates(p))
        rows = json.loads(bundle.serialized)
        rows[0]["sql"] = "SELECT TRUE"
        forged = replace(bundle, serialized=canonical(rows))
        with self.assertRaises(RepairBlocked):
            execute_transaction(FakeConnection(forged), forged)
        rows = next(s for s in bundle if s.label == "approved_live_schema").params
        rows[1].append("unrelated_table")
        self.assertEqual(bundle, generate_sql(p, gates(p)))

    def test_review_schema_contract_each_capture_index_dimension(self):
        p = plan_case(fixture("capture_success"))
        good = gates(p)
        for mutation in ("table", "unique", "keys", "predicate", "guard_body", "column", "audit_trigger", "nullable"):
            schema = json.loads(good.schema_snapshot_json)
            index = schema["indexes"][0]
            if mutation == "table":
                index["tablename"] = "wrong"
            elif mutation == "unique":
                index["indexdef"] = index["indexdef"].replace("UNIQUE", "")
            elif mutation == "keys":
                index["indexdef"] = index["indexdef"].replace("order_id, reference_id", "reference_id")
            elif mutation == "predicate":
                index["indexdef"] += " AND deleted_at IS NULL"
            elif mutation == "guard_body":
                schema["triggers"][2]["function"] = "RETURN NEW;"
            elif mutation == "column":
                schema["columns"] = [c for c in schema["columns"] if not (c["table_name"] == ORDER_SPLIT_LINK and c["column_name"] == "deleted_at")]
            elif mutation == "audit_trigger":
                schema["triggers"] = [t for t in schema["triggers"] if t["name"] != "reconciliation_repair_audit_no_truncate"]
            else:
                next(c for c in schema["columns"] if c["table_name"] == "reconciliation_repair_audit")["is_nullable"] = "YES"
            with self.subTest(mutation=mutation), self.assertRaises(RepairBlocked):
                generate_sql(p, replace(good, schema_snapshot_json=canonical(schema)))
        with self.assertRaises(RepairBlocked):
            generate_sql(p, replace(good, guard_contract_json=""))

    def test_review_malformed_evidence_and_missing_intent_fail_closed(self):
        for evidence in (None, [], "bad", {}):
            f = fixture()
            f["evidence"] = evidence
            with self.assertRaises(RepairBlocked):
                plan_case(f)
        f = fixture()
        del f["evidence"]["payment_intent"]
        with self.assertRaises(RepairBlocked):
            plan_case(f)

    def test_review_all_assertions_and_audit_fail_before_commit(self):
        for kind in ("refund_success", "capture_success"):
            p = plan_case(fixture(kind))
            bundle = generate_sql(p, gates(p))
            self.assertTrue(all(s.sql.count("%s") == len(s.params) for s in bundle))
            for statement in bundle:
                if statement.expect == "true":
                    conn = FakeConnection(bundle, fail_label=statement.label)
                    with self.subTest(kind=kind, label=statement.label), self.assertRaises(RepairBlocked):
                        execute_transaction(conn, bundle)
                    self.assertEqual((conn.commits, conn.rollbacks), (0, 1))
            for label in ("atomic_audit_insert", "atomic_actual_after_audit"):
                conn = FakeConnection(bundle, bad_rowcount=label)
                with self.assertRaises(RepairBlocked):
                    execute_transaction(conn, bundle)
                self.assertEqual((conn.commits, conn.rollbacks), (0, 1))

    def test_review_refund_requires_complete_native_capture_basis(self):
        f = fixture()
        f["snapshot"]["order_transaction"] = []
        totals = f["snapshot"]["order_summary"][0]["totals"]
        for field in ("paid_total", "transaction_total"):
            totals[field], totals["raw_" + field] = "0", raw("0")
        with self.assertRaisesRegex(RepairBlocked, "native_transaction_basis"):
            plan_case(f)

    def test_scoped_receipt_binds_coherent_native_full_capture_basis(self):
        f = fixture()
        # Every native full-capture/summary/raw value agrees at 9, while the
        # authenticated scoped reader fixture still proves provider capture 10.
        for row in f['snapshot']['payment'] + f['snapshot']['payment_collection'] + f['snapshot']['capture']:
            row['amount'], row['raw_amount'] = '9', raw('9')
        for row in f['snapshot']['payment_collection'] + f['snapshot']['split_order_payment']:
            for field in ('authorized_amount', 'captured_amount'):
                row[field], row['raw_' + field] = '9', raw('9')
        tx = f['snapshot']['order_transaction'][0]
        tx['amount'], tx['raw_amount'] = '9', raw('9')
        totals = f['snapshot']['order_summary'][0]['totals']
        for field in ('current_order_total', 'original_order_total', 'accounting_total', 'paid_total', 'transaction_total'):
            totals[field], totals['raw_' + field] = '9', raw('9')
        with self.assertRaisesRegex(RepairBlocked, 'scoped_provider_native_gross_totals_mismatch'):
            plan_case(f)

    def test_scoped_fixture_provider_basis_and_refund_gross_must_match_native(self):
        for provider_minor, refund_minor in ((900, 250), (1000, 200)):
            with self.subTest(provider_minor=provider_minor, refund_minor=refund_minor):
                f = fixture()
                evidence = f['evidence']
                pi = copy.deepcopy(evidence['scoped_inventory']['payment_intent'])
                charge = copy.deepcopy(evidence['scoped_inventory']['charges'][0])
                refund = copy.deepcopy(evidence['scoped_inventory']['refunds'][0])
                pi['amount'] = provider_minor
                charge.update(amount=provider_minor, amount_captured=provider_minor, amount_refunded=refund_minor)
                refund['amount'] = refund_minor
                payload = {k: v for k, v in evidence.items() if k not in ('authentication', 'scoped_inventory', 'scoped_inventory_hash')}
                payload['amount_minor'] = refund_minor
                f['evidence'] = offline_fixture_evidence(payload, payment_intent=pi,
                    inventory=dict(complete=True, livemode=False, charges=[charge], refunds=[refund]))
                with self.assertRaisesRegex(RepairBlocked, 'scoped_provider_native_gross_totals_mismatch'):
                    plan_case(f)

    def test_f3_summary_contract_and_authorization_fail_closed(self):
        for kind in ("refund_success", "capture_success"):
            for field in ("pending_difference", "current_order_total", "original_order_total", "accounting_total", "credit_line_total"):
                f = fixture(kind)
                totals = f["snapshot"]["order_summary"][0]["totals"]
                totals[field], totals["raw_" + field] = "999", raw("999")
                with self.subTest(kind=kind, field=field), self.assertRaises(RepairBlocked):
                    plan_case(f)
            f = fixture(kind)
            pc = f["snapshot"]["payment_collection"][0]
            pc["authorized_amount"], pc["raw_authorized_amount"] = "9", raw("9")
            with self.assertRaises(RepairBlocked):
                plan_case(f)
        # Old 13/13 order with 10 authorization is not a supported canonical binding.
        f = fixture()
        totals = f["snapshot"]["order_summary"][0]["totals"]
        for field, val in (("current_order_total", "13"), ("original_order_total", "13"), ("accounting_total", "13"), ("pending_difference", "3")):
            totals[field], totals["raw_" + field] = val, raw(val)
        with self.assertRaises(RepairBlocked):
            plan_case(f)

    def test_f3_required_exact_raw_summary_wrapper(self):
        for field in fixture()["snapshot"]["order_summary"][0]["totals"]:
            f = fixture()
            del f["snapshot"]["order_summary"][0]["totals"][field]
            with self.subTest(field=field), self.assertRaises(RepairBlocked):
                plan_case(f)
        for wrapper in ({"value": "0", "precision": 20, "extra": True}, {"value": "0", "precision": 0}, {"value": 0, "precision": 20}):
            f = fixture()
            f["snapshot"]["order_summary"][0]["totals"]["raw_pending_difference"] = wrapper
            with self.subTest(wrapper=wrapper), self.assertRaises(RepairBlocked):
                plan_case(f)

    def test_no_effect_receipt_marker_blocks_success_relabel(self):
        for phase in ("refund_started", "completed", "refund_no_effect"):
            f = fixture()
            f["snapshot"]["refund_settlement"][0].update(phase=phase, no_effect_receipt_id="receipt_forbidden")
            with self.subTest(phase=phase), self.assertRaises(RepairBlocked):
                plan_case(f)

    def test_f4_cart_reverse_scope_all_stages(self):
        p = plan_case(fixture())
        bundle = generate_sql(p, gates(p))
        for label in ("snapshot_cart_payment_collection", "actual_unchanged_cart_payment_collection_postcondition", "atomic_audit_insert", "atomic_actual_after_audit"):
            st = next(s for s in bundle if s.label == label)
            self.assertIn("cart_id=%s OR payment_collection_id=%s", st.sql)
        self.assertIn("FOR UPDATE", next(s for s in bundle if s.label == "snapshot_cart_payment_collection").sql)
        for deleted in (None, "yesterday"):
            f = fixture()
            f["snapshot"]["cart_payment_collection"].append({"cart_id": "cart_a", "payment_collection_id": "other", "deleted_at": deleted})
            with self.assertRaises(RepairBlocked):
                plan_case(f)

    def test_lock_key_signed_big_endian(self):
        expected = int.from_bytes(hashlib.sha256(b"hobbysalon:commerce-cart:v1:synthetic").digest()[:8], "big", signed=True)
        self.assertEqual(lock_key("commerce-cart", "synthetic"), expected)
        self.assertNotEqual(lock_key("commerce-cart", "synthetic"), lock_key("refund-settlement", "synthetic"))


def psql_literal(value):
    """Exact test-only binding; never interpolate parameters as executable SQL."""
    if isinstance(value, str):
        if "\x00" in value:
            raise ValueError("NUL cannot be represented in PostgreSQL text")
        return "E'" + value.replace("\\", "\\\\").replace("'", "''") + "'"
    if isinstance(value, (list, tuple)):
        if not all(isinstance(item, str) for item in value):
            raise TypeError("only text-array parameters supported")
        return "ARRAY[" + ",".join(psql_literal(item) for item in value) + "]::text[]"
    if type(value) is int:
        return str(value)
    if value is None:
        return "NULL"
    raise TypeError("unsupported regression parameter type")


def bind_readonly_select(statement):
    if not statement.sql.startswith("SELECT ") or statement.expect != "true" or ";" in statement.sql:
        raise ValueError("regression accepts only single mandatory assertion SELECTs")
    pieces = statement.sql.split("%s")
    if len(pieces) != len(statement.params) + 1:
        raise ValueError("parameter count mismatch")
    return "".join(piece + psql_literal(value) for piece, value in zip(pieces, statement.params)) + pieces[-1]


class PostgreSQLReadOnlyTests(unittest.TestCase):
    def test_literal_binding_is_exact_and_rejects_mutations(self):
        self.assertEqual(psql_literal("a'b\\c\n"), "E'a''b\\\\c\n'")
        self.assertEqual(psql_literal(["a'b", "back\\slash"]), "ARRAY[E'a''b',E'back\\\\slash']::text[]")
        case = plan_case(fixture())
        bundle = generate_sql(case, gates(case))
        with self.assertRaises(ValueError):
            bind_readonly_select(next(s for s in bundle if s.sql.startswith("UPDATE")))
        with self.assertRaises(ValueError):
            psql_literal("\x00")

    @unittest.skipUnless(os.environ.get("HS_RECON_READONLY_PSQL_JSON"),
                         "real PostgreSQL requires explicit existing sandbox psql command")
    def test_every_generated_final_assertion_select_runs_in_postgres_read_only(self):
        command = json.loads(os.environ["HS_RECON_READONLY_PSQL_JSON"])
        self.assertIsInstance(command, list)
        self.assertTrue(command and all(isinstance(arg, str) for arg in command))
        statements = []
        expected_after_rows = {"actual_collection_postcondition", "actual_summary_postcondition",
                               "actual_split_postcondition", "actual_payment_postcondition"}
        for kind in ("refund_success", "capture_success"):
            case = plan_case(fixture(kind))
            bundle = generate_sql(case, gates(case))
            expected = expected_after_rows | ({"actual_settlement_postcondition", "actual_dispatch_postcondition"}
                       if kind == "refund_success" else {"actual_capture_tail_postcondition"})
            # Collect ALL mandatory final Boolean SELECTs, not a hand-picked SQL approximation.
            selected = [s for s in bundle if s.label.startswith("actual_")]
            self.assertTrue(expected <= {s.label for s in selected})
            self.assertTrue(all(s.expect == "true" for s in selected))
            statements.extend((kind, s) for s in selected)
        script = ["BEGIN READ ONLY;", "SET LOCAL statement_timeout='15s';",
                  "SELECT 'environment|' || current_database() || '|read_only=' || current_setting('transaction_read_only') || '|' || version();"]
        markers = []
        for index, (kind, statement) in enumerate(statements):
            marker = f"assertion|{index}|{kind}|{statement.label}|"
            markers.append(marker)
            bound = bind_readonly_select(statement)
            # FALSE is expected for nonmatching untouched fixture IDs; NULL is never accepted.
            script.append("SELECT " + psql_literal(marker) + " || COALESCE(assertion::text,'NULL') FROM (" + bound + ") AS checked(assertion);")
        script += ["SELECT 'transaction_read_only|' || current_setting('transaction_read_only');", "ROLLBACK;"]
        sql = "\n".join(script) + "\n"
        result = subprocess.run(command + ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
                                input=sql, text=True, capture_output=True, timeout=60)
        receipt = os.environ.get("HS_RECON_SQL_RECEIPT")
        if receipt:
            Path(receipt).write_text("# Native final SELECT regression — READ ONLY, no apply acceptance\n\n"
                + f"Assertions generated/executed: {len(statements)}\npsql exit: {result.returncode}\n\n"
                + "## stdout\n```text\n" + result.stdout + "```\n\n## stderr\n```text\n"
                + result.stderr + "```\n\n## Exact submitted SQL\n```sql\n" + sql + "```\n", encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        lines = result.stdout.splitlines()
        self.assertTrue(any("|read_only=on|PostgreSQL " in line for line in lines), result.stdout)
        self.assertIn("transaction_read_only|on", lines)
        self.assertIn("ROLLBACK", lines)
        for marker in markers:
            hits = [line for line in lines if line.startswith(marker)]
            self.assertEqual(len(hits), 1, marker + result.stdout)
            self.assertIn(hits[0][len(marker):], ("true", "false"), hits[0])
        negative = bind_readonly_select(next(s for _, s in statements if s.label == "actual_collection_postcondition"))
        negative = negative.replace(",FALSE)),FALSE) FROM", "),FALSE)),FALSE) FROM", 1)
        bad_sql = "\\set VERBOSITY verbose\nBEGIN READ ONLY;\n" + negative + ";\nROLLBACK;\n"
        rejected = subprocess.run(command + ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
                                  input=bad_sql, text=True, capture_output=True, timeout=60)
        if receipt:
            with Path(receipt).open("a", encoding="utf-8") as output:
                output.write("\n## Negative control: original malformed COALESCE nesting\n"
                    + f"psql exit: {rejected.returncode}\n```text\n" + rejected.stdout + rejected.stderr
                    + "```\n```sql\n" + bad_sql + "```\n")
        self.assertNotEqual(rejected.returncode, 0, "real parser accepted malformed negative control")
        self.assertIn("42601", rejected.stderr)  # PostgreSQL syntax_error, not an unrelated failure.


if __name__ == "__main__":
    unittest.main()
