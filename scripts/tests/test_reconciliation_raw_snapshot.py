"""Read-only raw acquisition unit + opt-in real existing-source PostgreSQL tests.

HS_RECON_RAW_POSTGRES=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=scripts:scripts/tests
python3 -m unittest discover -s scripts/tests -p test_reconciliation_raw_snapshot.py -v

Uses an actual libpq handle via a local ephemeral Docker TCP relay. The original
psql adapter is tested only for fail-closed refusal; no installer/admin calls.
All real SQL uses RR READ ONLY and ROLLBACK. Raw artifacts are private, detached,
and never exported; summary reports only counts/hashes, never customer fields.
"""
from contextlib import contextmanager
from dataclasses import replace
from decimal import Decimal
import hashlib
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ctypes
import socket
import subprocess
import threading
from unittest.mock import patch
from reconciliation import raw_snapshot as raw_module
from reconciliation.raw_snapshot import (SnapshotBlocked, Target, Limits, acquire,
    decode_json, exact_json, sha256, readonly_transaction, _rowset_query, _read, _rows,
    _transaction_status, ENVIRONMENT_SQL, RELATIONS_SQL)
from reconciliation.native_repair import (required_columns, schema_tables, AUDIT_TABLE,
    SCHEMA_SQL, _query, amount)

DATABASE = "hobbysalon_e2e_fixed_3bea5f66"
TARGET = Target("capture_success", "pc_1", "order_1", "cart_1", "split_1")
AUDIT = Path("/home/hermes/audits/hobbysalon-reconciliation-20261005/continue2")


def schema_fixture(kind="capture_success"):
    return dict(columns=[dict(table_schema="public", table_name=t, column_name=k,
                             data_type=v, is_nullable="YES")
                         for t in schema_tables(kind) if t != AUDIT_TABLE
                         for k, v in required_columns()[t].items()],
                constraints=[], indexes=[], triggers=[])


def row_fixture(table):
    row = {}
    for key, typ in required_columns()[table].items():
        if key in ("capture_id", "reversal_receipt_id", "event_id"):
            row[key] = None
        elif key == "id" or key.endswith("_id"):
            row[key] = key + "_1"
        elif typ == "numeric":
            row[key] = Decimal("19.990000000000000001")
        elif key.startswith("raw_"):
            row[key] = {"value": "19.990000000000000001", "precision": 20}
        else:
            row[key] = None
    return row


class FakeConnection:
    autocommit = True
    def __init__(self):
        self.info = SimpleNamespace(transaction_status=0)
        self.history = []
        self.schema: dict = schema_fixture()
        self.relations = [dict(table=t, kind="r", rls=False, force_rls=False, selectable=True)
                          for t in schema_tables(TARGET.kind) if t != AUDIT_TABLE]
        self.inventory = {t: [] for t in schema_tables(TARGET.kind) if t != AUDIT_TABLE}
        self.scoped = {t: [] for t in self.inventory}
        self.fail: str | None = None
        self.envelope: dict | None = None
        self.environment = dict(database=DATABASE, read_only="on", isolation="repeatable read")
    @contextmanager
    def cursor(self):
        yield self
    def execute(self, sql, params=()):
        self.history.append((sql, params))
        if self.fail and self.fail in sql:
            raise RuntimeError("realistic SQL error")
        if sql == ENVIRONMENT_SQL:
            data = self.environment
        elif SCHEMA_SQL in sql:
            data = self.schema
        elif sql == RELATIONS_SQL:
            data = self.relations
        elif "SELECT to_jsonb(t) AS j" in sql:
            table = sql.split('FROM public."')[1].split('"')[0]
            inventory = "WHERE TRUE " in sql
            rows = (self.inventory if inventory else self.scoped)[table]
            rows = rows[:params[-3]]
            size = sum(len(exact_json(r).encode()) for r in rows)
            data = self.envelope or dict(row_count=len(rows), byte_count=size,
                                       rows=rows if len(rows) <= params[-2] and size <= params[-1] else None)
        else:
            return
        self.row = ("raw:" + exact_json(data),)
    def fetchone(self):
        return self.row


class LibpqReadonlyConnection:
    """Real local libpq via a one-session Docker/stdin TCP relay; no installation.

    The existing psql adapter has no PGconn and is deliberately NOT reused.
    Relay only connects to the existing isolated server's trusted loopback port.
    """
    autocommit = True
    def __init__(self, database, *, readonly_source=False):
        from test_reconciliation_apply_postgres import SOURCE, CONTAINER
        if database != SOURCE or not readonly_source:
            raise ValueError("only existing read-only source authorized")
        self.pq = ctypes.CDLL(os.environ.get("HS_RECON_LIBPQ", "/snap/gnome-46-2404/164/usr/lib/x86_64-linux-gnu/libpq.so.5.16"))
        signatures = {
            "PQconnectdb": (ctypes.c_void_p, [ctypes.c_char_p]),
            "PQstatus": (ctypes.c_int, [ctypes.c_void_p]),
            "PQerrorMessage": (ctypes.c_char_p, [ctypes.c_void_p]),
            "PQexecParams": (ctypes.c_void_p, [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_char_p), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]),
            "PQresultStatus": (ctypes.c_int, [ctypes.c_void_p]),
            "PQntuples": (ctypes.c_int, [ctypes.c_void_p]),
            "PQnfields": (ctypes.c_int, [ctypes.c_void_p]),
            "PQgetvalue": (ctypes.c_char_p, [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]),
            "PQgetisnull": (ctypes.c_int, [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]),
            "PQresultErrorField": (ctypes.c_char_p, [ctypes.c_void_p, ctypes.c_int]),
            "PQclear": (None, [ctypes.c_void_p]), "PQfinish": (None, [ctypes.c_void_p])}
        for name, (restype, argtypes) in signatures.items():
            fn = getattr(self.pq, name); fn.restype = restype; fn.argtypes = argtypes
        self.listener = socket.socket(); self.listener.bind(("127.0.0.1", 0)); self.listener.listen(1)
        self.history = []; self.rows = []
        self.proc = None
        def relay():
            peer, _ = self.listener.accept()
            self.peer = peer
            self.proc = subprocess.Popen(["docker", "exec", "-i", CONTAINER, "nc", "127.0.0.1", "5432"],
                                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            def outbound():
                try:
                    while True:
                        data = peer.recv(65536)
                        if not data: break
                        self.proc.stdin.write(data); self.proc.stdin.flush()
                finally:
                    self.proc.stdin.close()
            thread = threading.Thread(target=outbound, daemon=True); thread.start()
            try:
                while True:
                    data = os.read(self.proc.stdout.fileno(), 65536)
                    if not data: break
                    peer.sendall(data)
            finally:
                peer.close()
        self.thread = threading.Thread(target=relay, daemon=True); self.thread.start()
        port = self.listener.getsockname()[1]
        self.pgconn = ctypes.c_void_p(self.pq.PQconnectdb(
            f"host=127.0.0.1 port={port} user=gate dbname={database} connect_timeout=10 options='-c default_transaction_read_only=on'".encode()))
        if self.pq.PQstatus(self.pgconn) != 0:
            self.close(); raise RuntimeError("real libpq connection failed")
    @contextmanager
    def cursor(self): yield self
    def execute(self, sql, params=()):
        if not sql.startswith(("SELECT ", "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", "SET LOCAL ", "ROLLBACK")):
            raise ValueError("only explicit read-only SQL authorized")
        parts = sql.split("%s")
        if len(parts) != len(params) + 1: raise ValueError("parameter count")
        query = "".join(p + f"${i+1}" for i,p in enumerate(parts[:-1])) + parts[-1]
        encoded = [None if p is None else ("{" + ",".join(p) + "}" if isinstance(p, (list,tuple)) else str(p)).encode() for p in params]
        values = (ctypes.c_char_p * len(encoded))(*encoded)
        result = self.pq.PQexecParams(self.pgconn, query.encode(), len(encoded), None, values, None, None, 0)
        try:
            state = self.pq.PQresultErrorField(result, ord("C"))
            status = self.pq.PQresultStatus(result)
            count = self.pq.PQntuples(result)
            self.history.append(dict(sql=sql, params=list(params), rowcount=str(count), sqlstate=state.decode() if state else "00000"))
            if status not in (1, 2): raise RuntimeError("PostgreSQL SQLSTATE " + (state.decode() if state else "unknown"))
            self.rows = [tuple(None if self.pq.PQgetisnull(result,i,j) else self.pq.PQgetvalue(result,i,j).decode()
                         for j in range(self.pq.PQnfields(result))) for i in range(count)]
        finally: self.pq.PQclear(result)
    def fetchone(self): return self.rows.pop(0) if self.rows else None
    def close(self):
        if getattr(self, "pgconn", None): self.pq.PQfinish(self.pgconn); self.pgconn = None
        if self.proc:
            try: self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired: self.proc.terminate(); self.proc.wait(timeout=5)
            self.proc.stdout.close()
        self.listener.close(); self.thread.join(timeout=5)


class RawSnapshotTests(unittest.TestCase):
    def setUp(self):
        # Unit fixture only; the real provider test class never patches status.
        mock = patch.object(raw_module, "_transaction_status", side_effect=lambda c: int(c.info.transaction_status) if c.info else (_ for _ in ()).throw(SnapshotBlocked("unsupported")))
        mock.start(); self.addCleanup(mock.stop)
    def test_schema_first_rollback_nonoperational(self):
        con = FakeConnection()
        result = acquire(con, DATABASE, TARGET)
        self.assertFalse(result["operational"])
        self.assertIn("missing_installation:" + AUDIT_TABLE, result["blockers"])
        sqls = [s for s, _ in con.history]
        self.assertEqual(sqls[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
        self.assertEqual(sqls[-1], "ROLLBACK")
        self.assertLess(next(i for i,s in enumerate(sqls) if SCHEMA_SQL in s),
                        next(i for i,s in enumerate(sqls) if "SELECT to_jsonb(t) AS j" in s))
        self.assertTrue(all(s.startswith(("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", "SELECT ", "SET LOCAL ", "ROLLBACK")) for s in sqls))
        content = result.pop("content_hash")
        self.assertEqual(content, sha256(result))
    def test_all_exact_native_predicates(self):
        con = FakeConnection()
        result = acquire(con, DATABASE, TARGET)
        for entry in result["provenance"]:
            where, params = _query(entry["table"], TARGET.as_dict(), {"split_order_payment":[{"id":TARGET.split_order_payment_id}]})
            self.assertEqual(entry["native_sql"], _rowset_query(entry["table"], TARGET)[0])
            self.assertEqual(entry["native_params"], list(params))
            self.assertIn((entry["native_sql"], (*params, 129, 128, 2000000)), con.history)
    def test_malicious_target_before_sql(self):
        for value in ("x'; DROP TABLE payment;--", "x\nSELECT 1", "", "x\\g", None, 7, "x"*256):
            con = FakeConnection()
            with self.assertRaises(SnapshotBlocked):
                acquire(con, DATABASE, replace(TARGET, scope_id=value))
            self.assertEqual(con.history, [])
    def test_malicious_database_before_sql(self):
        con = FakeConnection()
        with self.assertRaises(SnapshotBlocked):
            acquire(con, DATABASE + ";DROP TABLE payment", TARGET)
        self.assertEqual(con.history, [])
    def test_outer_transaction_untouched(self):
        for status in (1, 2, 3):
            con = FakeConnection(); con.info.transaction_status = status
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
            self.assertEqual(con.history, [])
    def test_missing_status_or_non_autocommit(self):
        for field, value in (("info", None), ("autocommit", False)):
            con = FakeConnection(); setattr(con, field, value)
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
            self.assertEqual(con.history, [])
    def test_wrong_source_and_transaction(self):
        for field, value in (("database", "postgres"), ("read_only", "off"), ("isolation", "read committed")):
            con = FakeConnection(); con.environment[field] = value
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
            self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_schema_type_and_duplicate(self):
        for mode in ("type", "duplicate", "shape"):
            con = FakeConnection()
            if mode == "type": con.schema["columns"][0]["data_type"] = "integer"
            elif mode == "duplicate": con.schema["columns"].append(con.schema["columns"][0])
            else: con.schema["columns"] = None
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
            self.assertFalse(any("SELECT to_jsonb(t)" in s for s,_ in con.history))
            self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_missing_table(self):
        con = FakeConnection(); con.relations = [r for r in con.relations if r["table"] != "refund"]
        with self.assertRaisesRegex(SnapshotBlocked, "missing_financial_table:refund"):
            acquire(con, DATABASE, TARGET)
        self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_rls_and_views_rejected(self):
        for key, value in (("kind", "v"), ("rls", True), ("force_rls", True), ("selectable", False)):
            con = FakeConnection(); con.relations[0][key] = value
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
    def test_deleted_orphan_reverse_edges_preserved(self):
        con = FakeConnection()
        orphan = row_fixture("refund"); orphan.update(id="refund_orphan", payment_id="payment_absent", deleted_at="2026-01-01")
        reverse = row_fixture("order_payment_collection"); reverse.update(order_id="order_other", payment_collection_id="pc_1")
        con.inventory["refund"] = [orphan]
        con.inventory["order_payment_collection"] = [reverse]
        con.scoped["order_payment_collection"] = [reverse]
        result = acquire(con, DATABASE, TARGET)
        self.assertEqual(result["inventory"]["refund"], [orphan])
        self.assertEqual(result["snapshot"]["order_payment_collection"], [reverse])
    def test_native_integer_display_identity_preserved(self):
        con = FakeConnection(); row = row_fixture("order"); row["display_id"] = 7
        con.inventory["order"] = [row]
        self.assertEqual(acquire(con, DATABASE, TARGET)["inventory"]["order"][0]["display_id"], 7)
    def test_row_overflow_no_partial_artifact(self):
        con = FakeConnection(); con.inventory["payment"] = [row_fixture("payment")]*2
        with self.assertRaisesRegex(SnapshotBlocked, "snapshot_bound_exceeded:payment"):
            acquire(con, DATABASE, TARGET, Limits(inventory_rows_per_table=1))
        self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_byte_overflow_no_partial_artifact(self):
        con = FakeConnection(); row = row_fixture("payment"); row["metadata"] = {"full":"€"*1000001}
        con.scoped["payment"] = [row]
        with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
        self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_aggregate_and_artifact_overflow(self):
        for limits in (Limits(total_rows=1), Limits(total_bytes=100)):
            con = FakeConnection(); con.inventory["payment"] = [row_fixture("payment")]; con.scoped["payment"] = [row_fixture("payment")]
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET, limits)
            self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_bad_row_identity_and_envelope(self):
        for field, value in (("id", "bad\n"), ("payment_collection_id", "bad\n")):
            con = FakeConnection(); row = row_fixture("payment"); row[field] = value; con.inventory["payment"] = [row]
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
        con = FakeConnection(); con.envelope = dict(row_count=1, byte_count=0, rows=[])
        with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET)
    def test_decimal_roundtrip_parity_and_mismatch_preserved(self):
        con = FakeConnection(); row = row_fixture("payment")
        row["data"] = {"nested": [Decimal("0.123456789012345678901"), {"untouched":"metadata"}]}
        con.inventory["payment"] = [row]; con.scoped["payment"] = [row]
        result = decode_json(exact_json(acquire(con, DATABASE, TARGET)))
        raw = result["snapshot"]["payment"][0]
        self.assertIsInstance(raw["amount"], Decimal)
        self.assertEqual(amount(raw), Decimal("19.990000000000000001"))
        self.assertEqual(raw["data"], row["data"])
        row["raw_amount"]["value"] = "18.00"
        result = acquire(con, DATABASE, TARGET)
        self.assertEqual(result["snapshot"]["payment"][0]["raw_amount"]["value"], "18.00")
    def test_json_malformed_and_float_refusal(self):
        for text in ('{"a":1,"a":2}', '{', '{"a":NaN}'):
            with self.assertRaises(SnapshotBlocked): decode_json(text)
        with self.assertRaises(SnapshotBlocked): exact_json(1.1)
        with self.assertRaises(SnapshotBlocked): exact_json(Decimal("NaN"))
    def test_sql_error_rolls_back(self):
        con = FakeConnection(); con.fail = "SELECT to_jsonb(t)"
        with self.assertRaisesRegex(RuntimeError, "realistic SQL error"): acquire(con, DATABASE, TARGET)
        self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_begin_error_also_rolls_back(self):
        con = FakeConnection(); con.fail = "BEGIN"
        with self.assertRaises(RuntimeError): acquire(con, DATABASE, TARGET)
        self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_invalid_limits(self):
        for limits in (Limits(inventory_rows_per_table=0), Limits(total_bytes=True), Limits(scoped_rows_per_table=129)):
            con = FakeConnection()
            with self.assertRaises(SnapshotBlocked): acquire(con, DATABASE, TARGET, limits)
            self.assertEqual(con.history, [])


    def test_no_effect_denied_before_sql(self):
        con = FakeConnection()
        with self.assertRaisesRegex(SnapshotBlocked, "no_effect_schema_query_contract_required"):
            acquire(con, DATABASE, replace(TARGET, kind="refund_no_effect"))
        self.assertEqual(con.history, [])
    def test_all_required_fields_missing_rejected(self):
        for key in required_columns()["payment"]:
            con = FakeConnection(); row = row_fixture("payment"); del row[key]
            con.inventory["payment"] = [row]
            with self.assertRaisesRegex(SnapshotBlocked, "missing_required_row_fields:payment"):
                acquire(con, DATABASE, TARGET)
            self.assertEqual(con.history[-1][0], "ROLLBACK")
    def test_nullable_reference_and_ownership_preserved_noneligible(self):
        con = FakeConnection()
        for table, key in (("order_transaction", "reference_id"), ("payment", "payment_collection_id")):
            row = row_fixture(table); row[key] = None; con.inventory[table] = [row]
        result = acquire(con, DATABASE, TARGET)
        self.assertIsNone(result["inventory"]["order_transaction"][0]["reference_id"])
        self.assertIsNone(result["inventory"]["payment"][0]["payment_collection_id"])
        self.assertFalse(result["eligible_for_binding"])
        self.assertTrue(all(not f["eligible_for_binding"] for f in result["null_identity_findings"]))
        con.schema["columns"][3]["is_nullable"] = "NO"
        con.inventory["payment"][0][con.schema["columns"][3]["column_name"]] = None
        with self.assertRaisesRegex(SnapshotBlocked, "null_nonnullable_column"):
            acquire(con, DATABASE, TARGET)
    def test_absent_mismatched_and_present_target(self):
        con = FakeConnection()
        result = acquire(con, DATABASE, TARGET)
        self.assertEqual(result["target_presence"]["status"], "absent")
        self.assertFalse(result["eligible_for_binding"])
        updates = {"payment_collection": dict(id=TARGET.scope_id), "order": dict(id=TARGET.order_id),
            "split_order_payment": dict(id=TARGET.split_order_payment_id, payment_collection_id=TARGET.scope_id),
            "cart_payment_collection": dict(cart_id=TARGET.cart_id, payment_collection_id=TARGET.scope_id),
            "order_payment_collection": dict(order_id=TARGET.order_id, payment_collection_id=TARGET.scope_id),
            "order_order_split_order_payment_split_order_payment": dict(order_id=TARGET.order_id, split_order_payment_id=TARGET.split_order_payment_id)}
        for t,u in updates.items():
            row = row_fixture(t); row.update(u); con.inventory[t] = [row]
        self.assertEqual(acquire(con,DATABASE,TARGET)["target_presence"]["status"], "present")
        con.inventory["split_order_payment"][0]["payment_collection_id"] = "wrong_parent"
        result = acquire(con,DATABASE,TARGET)
        self.assertEqual(result["target_presence"]["status"], "mismatched")
        self.assertFalse(result["eligible_for_binding"])
    def test_predicate_api_closed_and_materialized_preflight(self):
        self.assertFalse(hasattr(raw_module,"rowset_query"))
        with self.assertRaisesRegex(SnapshotBlocked,"typed_target_required"):
            _rowset_query("payment", "TRUE; SELECT 1")
        sql, _ = _rowset_query("payment")
        self.assertIn("bounds AS MATERIALIZED",sql)
        self.assertIn("THEN (SELECT COALESCE(jsonb_agg",sql)


@unittest.skipUnless(os.environ.get("HS_RECON_RAW_POSTGRES") == "1", "explicit read-only PostgreSQL opt-in required")
class RawSnapshotRealPostgresTests(unittest.TestCase):
    def test_real_nested_and_ambient_preserve_outer_rr_readonly(self):
        from test_reconciliation_apply_postgres import SOURCE, PsqlConnection
        stale = PsqlConnection(SOURCE, readonly_source=True)
        try:
            stale.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
            before = _read(stale, ENVIRONMENT_SQL); count = len(stale.history)
            self.assertEqual(stale.info.transaction_status, 0)
            with self.assertRaisesRegex(SnapshotBlocked,"authoritative_transaction_status_provider_required"):
                acquire(stale, SOURCE, TARGET)
            self.assertEqual(len(stale.history),count)
            after = _read(stale, ENVIRONMENT_SQL)
            self.assertEqual((before["snapshot"],before["isolation"],before["read_only"]),
                             (after["snapshot"],after["isolation"],after["read_only"]))
            self.assertEqual((after["isolation"],after["read_only"]),("repeatable read","on"))
            stale.execute("ROLLBACK")
        finally: stale.close()
        con = LibpqReadonlyConnection(SOURCE, readonly_source=True)
        try:
            for nested in (False, True):
                with readonly_transaction(con) as cur:
                    before = _read(cur,ENVIRONMENT_SQL); count = len(con.history)
                    self.assertEqual(_transaction_status(con),2)
                    with self.assertRaisesRegex(SnapshotBlocked,"outer_transaction_forbidden"):
                        if nested:
                            with readonly_transaction(con): self.fail("nested transaction entered")
                        else: acquire(con,SOURCE,TARGET)
                    self.assertEqual(len(con.history),count)
                    after = _read(cur,ENVIRONMENT_SQL)
                    self.assertEqual((before["snapshot"],before["isolation"],before["read_only"]),
                                     (after["snapshot"],after["isolation"],after["read_only"]))
                    self.assertEqual((after["isolation"],after["read_only"]),("repeatable read","on"))
                    self.assertEqual(_transaction_status(con),2)
                self.assertEqual(_transaction_status(con),0)
            print("REAL_AMBIENT_NESTED rejected; outer snapshot/isolation/read_only preserved; stale psql refused")
        finally: con.close()

    def test_real_schema_nullable_and_missing_field(self):
        from test_reconciliation_apply_postgres import SOURCE
        con = LibpqReadonlyConnection(SOURCE, readonly_source=True)
        try:
            with readonly_transaction(con) as cur:
                schema = _read(cur,"SELECT 'raw:' || s.schema_snapshot::text FROM ("+SCHEMA_SQL+") s",(list(schema_tables(TARGET.kind)),)*4)
                columns = {(r["table_name"],r["column_name"]): r["is_nullable"] for r in schema["columns"]}
                self.assertEqual(columns[("order_transaction","reference_id")],"YES")
                # Actual native composite type, synthetic SELECT-only row: no INSERT/DDL.
                for table,key in (("order_transaction","reference_id"),("payment","payment_collection_id")):
                    row = row_fixture(table)
                    for r in schema["columns"]:
                        if r["table_name"] == table and r["is_nullable"] == "NO" and row.get(r["column_name"]) is None:
                            typ = r["data_type"]
                            row[r["column_name"]] = (1 if typ in ("integer","bigint","numeric") else
                                False if typ == "boolean" else {} if typ == "jsonb" else
                                "2026-01-01T00:00:00Z" if typ == "timestamp with time zone" else "fixture")
                    row[key] = None
                    class TypedFixtureCursor:
                        def execute(self,sql,params):
                            sql = sql.replace('FROM public."'+table+'" t',
                                'FROM jsonb_populate_record(NULL::public."'+table+'",%s::jsonb) t')
                            con.execute(sql,(exact_json(row),*params))
                        def fetchone(self): return con.fetchone()
                    rows,_ = _rows(TypedFixtureCursor(),table,None,128,2000000,columns)
                    self.assertIsNone(rows[0][key])
                    findings = raw_module._null_identities({table:rows},columns)
                    self.assertTrue(any(f["field"] == key and not f["eligible_for_binding"] for f in findings))
                class MissingFieldCursor:
                    def execute(self,sql,params):
                        con.execute(sql.replace("SELECT to_jsonb(t) AS j","SELECT to_jsonb(t) - 'amount' AS j"),params)
                    def fetchone(self): return con.fetchone()
                with self.assertRaisesRegex(SnapshotBlocked,"missing_required_row_fields:payment"):
                    _rows(MissingFieldCursor(),"payment",None,100000,20000000,columns)
                print("REAL_NULLABILITY reference_id=YES; ownership_nullable="+columns[("payment","payment_collection_id")]+"; native typed null preserved/refused by metadata; real row missing amount rejected")
        finally: con.close()

    def test_existing_source_exact_queries_readonly_rollback(self):
        from test_reconciliation_apply_postgres import SOURCE
        con = LibpqReadonlyConnection(SOURCE, readonly_source=True)
        try:
            # Discover required schema BEFORE constructing anchor SELECT.
            with readonly_transaction(con) as cur:
                schema = _read(cur, "SELECT 'raw:' || s.schema_snapshot::text FROM ("+SCHEMA_SQL+") s", (list(schema_tables(TARGET.kind)),)*4)
                columns = {(r["table_name"], r["column_name"]) for r in schema["columns"]}
                needed = {("payment_collection","id"),("order_payment_collection","order_id"),
                          ("order_payment_collection","payment_collection_id"),("cart_payment_collection","cart_id"),
                          ("cart_payment_collection","payment_collection_id"),("split_order_payment","id"),
                          ("split_order_payment","payment_collection_id")}
                self.assertTrue(needed <= columns)
                anchor = _read(cur, """SELECT 'raw:' || jsonb_build_object('scope_id',p.id,
                  'order_id',(SELECT order_id FROM public.order_payment_collection WHERE payment_collection_id=p.id ORDER BY order_id LIMIT 1),
                  'cart_id',(SELECT cart_id FROM public.cart_payment_collection WHERE payment_collection_id=p.id ORDER BY cart_id LIMIT 1),
                  'split_order_payment_id',(SELECT id FROM public.split_order_payment WHERE payment_collection_id=p.id ORDER BY id LIMIT 1))::text
                  FROM public.payment_collection p ORDER BY p.id LIMIT 1""")
            # Missing ownership is kept as absent candidate anchors, not inferred approval.
            target = Target("capture_success", anchor["scope_id"], anchor["order_id"] or "absent_order",
                            anchor["cart_id"] or "absent_cart", anchor["split_order_payment_id"] or "absent_split")
            result = acquire(con, SOURCE, target)
            refund_result = acquire(con, SOURCE, replace(target, kind="refund_success"))
            absent = acquire(con, SOURCE, Target("capture_success","absent_scope","absent_order","absent_cart","absent_split"))
            self.assertEqual(absent["target_presence"]["status"],"absent")
            self.assertFalse(absent["eligible_for_binding"])
            self.assertTrue(absent["inventory_complete"])
            self.assertEqual(sum(len(v) for v in absent["snapshot"].values()),0)
            self.assertFalse(result["eligible_for_binding"])
            self.assertFalse(refund_result["eligible_for_binding"])
            self.assertFalse(result["operational"])
            self.assertFalse(refund_result["operational"])
            self.assertTrue(result["inventory_complete"])
            self.assertIn("missing_installation:"+AUDIT_TABLE, result["blockers"])
            self.assertEqual(con.history[-1]["sql"], "ROLLBACK")
            self.assertFalse(any(r["sql"].startswith(("INSERT", "UPDATE", "DELETE", "CREATE", "COMMIT")) for r in con.history))
            # Exact SQL error attributed to failing SELECT; real session rollback.
            with self.assertRaises(Exception):
                with readonly_transaction(con) as cur:
                    cur.execute("SELECT 1/0")
            self.assertEqual(con.history[-1]["sql"], "ROLLBACK")
            self.assertTrue(any(r["sqlstate"] == "22012" for r in con.history))
            AUDIT.mkdir(parents=True, exist_ok=True)
            artifact = exact_json(dict(capture=result, refund=refund_result)).encode()
            # Repeated acceptance never overwrites historical raw evidence.
            import uuid
            suffix = "." + uuid.uuid4().hex
            path = AUDIT / ("RAW-SNAPSHOT.candidate" + suffix + ".json")
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as stream: stream.write(artifact)
            summary = dict(mode="real_existing_sandbox_readonly_detached_nonoperational",
                capture_inventory_counts={k:len(v) for k,v in result["inventory"].items()},
                capture_scoped_counts={k:len(v) for k,v in result["snapshot"].items()},
                refund_inventory_counts={k:len(v) for k,v in refund_result["inventory"].items()},
                refund_scoped_counts={k:len(v) for k,v in refund_result["snapshot"].items()},
                artifact=str(path), artifact_bytes=len(artifact), artifact_sha256=hashlib.sha256(artifact).hexdigest(),
                statements=len(con.history), rollbacks=sum(r["sql"]=="ROLLBACK" for r in con.history),
                schema_columns=len(result["schema"]["columns"]), provider_calls=0,
                operational=False, eligible_for_binding=False, target_status=result["target_presence"]["status"],
                absent_target_status=absent["target_presence"]["status"], source_writes=0,
                sqlstate_error_rollback="22012", audit_installation_missing=True)
            summary_path = AUDIT / ("RAW-SNAPSHOT.acceptance" + suffix + ".json")
            with open(summary_path, "x", encoding="utf-8") as stream: stream.write(exact_json(summary)+"\n")
            print("REAL_READONLY_ACCEPTANCE " + exact_json(summary))
        finally:
            con.close()


    def test_real_decimal_text_transport_and_bound_overflow(self):
        from test_reconciliation_apply_postgres import SOURCE
        con = LibpqReadonlyConnection(SOURCE, readonly_source=True)
        try:
            with readonly_transaction(con) as cur:
                value = _read(cur, "SELECT 'raw:' || jsonb_build_object('amount',19.990000000000000001::numeric,'raw_amount',jsonb_build_object('value','19.990000000000000001','precision',20),'nested',jsonb_build_object('value',0.123456789012345678901::numeric))::text")
                self.assertIsInstance(value["amount"], Decimal)
                self.assertEqual(amount(value), Decimal("19.990000000000000001"))
                self.assertEqual(decode_json(exact_json(value)), value)
                self.assertEqual(value["nested"]["value"], Decimal("0.123456789012345678901"))
            with self.assertRaisesRegex(SnapshotBlocked, "snapshot_bound_exceeded"):
                acquire(con, SOURCE, TARGET, Limits(inventory_rows_per_table=1))
            self.assertEqual(con.history[-1]["sql"], "ROLLBACK")
            self.assertTrue(any("THEN (SELECT COALESCE(jsonb_agg(j" in r["sql"] and r["rowcount"] == "1" for r in con.history))
        finally:
            con.close()


if __name__ == "__main__": unittest.main()
