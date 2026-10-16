"""REAL PostgreSQL apply acceptance, ONLY a freshly created disposable database.

Opt in: HS_RECON_APPLY_POSTGRES=1 python3 -m unittest discover -s scripts/tests
        -p test_reconciliation_apply_postgres.py -v
Fixed source/container are intentional. Source reads are REPEATABLE READ READ ONLY
+ ROLLBACK; no source rows are copied, only catalog schema/functions/guards.
No psycopg/libpq Python driver is installed: persistent PostgreSQL17 psql uses its
REAL libpq extended-protocol \\bind (not SQL-literal interpolation). The adapter
executes the native public apply_case facade statement-by-statement in one owned
transaction, with real results/errors/rowcounts. No provider calls/credentials.
All financial fixture writes, audit install/failure injection, commits and locks
occur ONLY in a database created by this run from template0, named hs_recon_it_<uuid>.
"""
import json
import os
from pathlib import Path
import re
import select
import subprocess
import sys
import time
import unittest
import uuid
from contextlib import contextmanager
from dataclasses import replace
from types import SimpleNamespace
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reconciliation.native_repair import (ApplyGates, Statement, SCHEMA_SQL, COMMON_TABLES,
    AUDIT_TABLE, RepairBlocked, apply_case, canonical, digest, generate_sql, lock_key,
    plan_case, schema_tables, _query)
from reconciliation.evidence import ISOLATED_DATABASE_MARKER, isolated_test_database
from test_reconciliation_native import fixture

CONTAINER = "hs-gate-pg-53332bce"
SOURCE = "hobbysalon_e2e_fixed_3bea5f66"
AUDIT_DIR = Path("/home/hermes/audits/hobbysalon-reconciliation-20261005")


class PostgreSQLError(RuntimeError):
    def __init__(self, sqlstate, output):
        self.sqlstate, self.output = sqlstate, output
        super().__init__(sqlstate + ": " + output)


def bind_parameter(value):
    """psql backslash-command string syntax, NOT SQL literal syntax."""
    if value is None:
        # None is unnecessary in generated bundle parameters and intentionally blocked.
        raise ValueError("NULL binding not supported by this test adapter")
    if isinstance(value, (tuple, list)):
        value = "{" + ",".join('"' + str(x).replace('\\', '\\\\').replace('"', '\\"') + '"' for x in value) + "}"
    elif isinstance(value, bool):
        value = "true" if value else "false"
    else:
        value = str(value)
    if "\x00" in value:
        raise ValueError("NUL cannot be bound")
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "'"


class PsqlConnection:
    """Real session-affine adapter; nothing is mocked or invented."""
    autocommit = True
    def __init__(self, database, *, readonly_source=False, admin=False):
        if not (isolated_test_database(database) or (readonly_source and database == SOURCE) or (admin and database == "postgres")):
            raise ValueError("test connection target not authorized")
        self.database, self.readonly_source = database, readonly_source
        # Merge psql stderr/stdout INSIDE the container. docker exec multiplexes
        # separate channels; host-side STDERR=STDOUT can otherwise reorder an old
        # error after the next SQL marker and falsely attach it to that command.
        self.command = ["docker", "exec", "-i", CONTAINER, "sh", "-c",
            'exec psql "$@" 2>&1', "psql", "-X", "-q", "-A", "-t", "-U", "gate", "-d", database, "-v", "ON_ERROR_STOP=0"]
        self.proc = subprocess.Popen(self.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1)
        assert self.proc.stdin is not None and self.proc.stdout is not None
        self.input = self.proc.stdin
        self.output = self.proc.stdout
        self.info = SimpleNamespace(transaction_status=0)
        self.rowcount = 0
        self.rows: list[Any] = []
        self.history: list[dict[str, Any]] = []
        self.after_execute: Callable | None = None
        self._buffer = b""
        self.input.write("\\set VERBOSITY verbose\n")
        self.input.flush()
        self.run("SET client_min_messages=warning")
    def _line(self, deadline):
        while b"\n" not in self._buffer:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("psql response timeout")
            ready, _, _ = select.select([self.output], [], [], remaining)
            if not ready:
                continue
            chunk = os.read(self.output.fileno(), 65536)
            if not chunk:
                raise RuntimeError("psql disconnected")
            self._buffer += chunk
        line, self._buffer = self._buffer.split(b"\n", 1)
        return line.decode()
    def run(self, sql, params=()):
        if self.readonly_source and not (sql.startswith(("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", "SELECT ", "ROLLBACK", "SET "))):
            raise ValueError("existing source only allows explicit readonly SQL")
        pieces = sql.split("%s")
        if len(pieces) != len(params) + 1:
            raise ValueError("bound parameter count mismatch")
        query = "".join(piece + "$" + str(i + 1) for i, piece in enumerate(pieces[:-1])) + pieces[-1]
        if params:
            query += "\n\\bind " + " ".join(bind_parameter(v) for v in params) + "\n\\g\n"
        else:
            query += ";\n"
        marker = "hs_marker_" + uuid.uuid4().hex
        self.input.write(query + "\\echo " + marker + " :ROW_COUNT :ERROR :SQLSTATE\n")
        self.input.flush()
        lines, deadline = [], time.monotonic() + 30
        while True:
            line = self._line(deadline)
            if line.startswith(marker + " "):
                _, rowcount, error, state = line.split()
                break
            lines.append(line)
        self.history.append({"sql": sql, "params": list(params), "rowcount": rowcount,
                             "error": error, "sqlstate": state, "output": lines})
        errors = [line for line in lines if "ERROR:" in line or "FATAL:" in line]
        if error == "true" or errors:
            # Multi-command install scripts must not hide earlier failed DDL behind
            # a successful final COMMIT/ROLLBACK; verbose output preserves SQLSTATE.
            match = re.search(r"(?:ERROR|FATAL):\s+([A-Z0-9]{5}):", "\n".join(errors))
            raise PostgreSQLError(match.group(1) if match else state, "\n".join(lines))
        self.rowcount = int(rowcount) if rowcount.isdigit() else 0
        def decode(line):
            if line == "t":
                return True
            if line == "f":
                return False
            if line.startswith(("{", "[")):
                return json.loads(line)
            return line
        self.rows = [(decode(line),) for line in lines if not line.startswith(("NOTICE:", "WARNING:"))]
        if self.after_execute:
            self.after_execute(sql, params)
        return self.rows
    def execute(self, sql, params=()):
        self.run(sql, params)
    def fetchone(self) -> Any:
        return self.rows.pop(0) if self.rows else None
    @contextmanager
    def cursor(self):
        yield self
    @contextmanager
    def transaction(self):
        if self.info.transaction_status != 0:
            raise RuntimeError("ambient transaction forbidden")
        self.run("BEGIN")
        self.info.transaction_status = 2
        try:
            yield
        except BaseException:
            self.run("ROLLBACK")
            raise
        else:
            self.run("COMMIT")
        finally:
            self.info.transaction_status = 0
    def close(self):
        if self.proc.poll() is None:
            self.input.write("\\q\n")
            self.input.flush()
            self.proc.wait(timeout=10)
        self.input.close()
        self.output.close()


def source_catalog():
    tables = list(COMMON_TABLES) + ["refund_settlement", "commerce_refund_dispatch", "marketplace_capture_tail"]
    con = PsqlConnection(SOURCE, readonly_source=True)
    try:
        con.run("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
        query = """SELECT jsonb_build_object(
          'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum)
            FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=ANY(%s) AND a.attnum>0 AND NOT a.attisdropped),
          'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'type',c.contype,'target',f.relname,'def',pg_get_constraintdef(c.oid))) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid LEFT JOIN pg_class f ON f.oid=c.confrelid WHERE r.relnamespace='public'::regnamespace AND r.relname=ANY(%s)),
          'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)) FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid WHERE r.relnamespace='public'::regnamespace AND r.relname=ANY(%s) AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)),
          'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'def',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(tgfoid))) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid WHERE NOT tgisinternal AND r.relnamespace='public'::regnamespace AND r.relname=ANY(%s)),
          'enums',(SELECT jsonb_agg(jsonb_build_object('name',typname,'values',(SELECT jsonb_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid))) FROM pg_type t WHERE t.typnamespace='public'::regnamespace AND t.typtype='e'),
          'sequences',(SELECT jsonb_agg(sequencename) FROM pg_sequences WHERE schemaname='public' AND sequencename='order_display_id_seq'),
          'environment',jsonb_build_object('database',current_database(),'read_only',current_setting('transaction_read_only'),'version',version()))"""
        con.run(query, (tables, tables, tables, tables))
        result = con.fetchone()[0]
        con.run("ROLLBACK")
        if result["environment"]["read_only"] != "on":
            raise AssertionError("source not readonly")
        return result, con.history
    finally:
        con.close()


def quote_id(value):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError("unsafe catalog identifier")
    return '"' + value + '"'


def install_catalog(con, catalog):
    """Copy EXACT source column types/defaults and applicable constraints/guards."""
    for enum in catalog["enums"] or []:
        # Labels validated before generating DDL; none are user data or secrets.
        if any(not re.fullmatch(r"[a-z_]+", x) for x in enum["values"]):
            raise ValueError("unsupported enum labels")
        con.run("CREATE TYPE " + quote_id(enum["name"]) + " AS ENUM (" + ",".join("'" + v + "'" for v in enum["values"]) + ")")
    for seq in catalog["sequences"] or []:
        con.run("CREATE SEQUENCE " + quote_id(seq))
    tables = sorted({c["table"] for c in catalog["columns"]})
    for table in tables:
        columns = [c for c in catalog["columns"] if c["table"] == table]
        definitions = [quote_id(c["name"]) + " " + c["type"] + (" NOT NULL" if c["notnull"] else "") + (" DEFAULT " + c["default"] if c["default"] is not None else "") for c in columns]
        con.run("CREATE TABLE public." + quote_id(table) + " (" + ",".join(definitions) + ")")
    excluded = []
    for constraint in catalog["constraints"]:
        if constraint["type"] == "f" and constraint["target"] not in tables:
            excluded.append(constraint)
            continue
        con.run("ALTER TABLE public." + quote_id(constraint["table"]) + " ADD CONSTRAINT " + quote_id(constraint["name"]) + " " + constraint["def"])
    for index in catalog["indexes"] or []:
        con.run(index)
    functions = set()
    for trigger in catalog["triggers"]:
        if trigger["function"] not in functions:
            con.run(trigger["function"])
            functions.add(trigger["function"])
        con.run(trigger["def"])
    con.run((Path(__file__).resolve().parents[1] / "reconciliation/audit_schema.sql").read_text())
    return excluded


@unittest.skipUnless(os.environ.get("HS_RECON_APPLY_POSTGRES") == "1", "explicit isolated PostgreSQL apply opt-in required")
class IsolatedPostgreSQLApplyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database = "hs_recon_it_" + uuid.uuid4().hex
        cls.report = {"scope": "isolated_real_postgres_synthetic_provider_evidence_only", "database": cls.database,
                      "provider_http_calls": 0, "driver": "installed psql17/libpq extended protocol bind", "cases": []}
        cls.catalog, cls.source_history = source_catalog()
        cls.admin = PsqlConnection("postgres", admin=True)
        cls.admin.run("CREATE DATABASE " + quote_id(cls.database) + " TEMPLATE template0")
        cls.admin.run("COMMENT ON DATABASE " + quote_id(cls.database) + " IS '" + ISOLATED_DATABASE_MARKER + "'")
        cls.con = PsqlConnection(cls.database)
        cls.other = PsqlConnection(cls.database)
        try:
            cls.report["excluded_external_fk_constraints"] = install_catalog(cls.con, cls.catalog)
        except BaseException:
            cls.tearDownClass()
            raise
        cls.report["source_catalog_hash"] = digest(cls.catalog)
    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "other", None):
            cls.other.close()
        if getattr(cls, "con", None):
            cls.con.close()
        # Drop only the database created by THIS run. No CASCADE/reset on old DBs.
        cls.admin.run("DROP DATABASE " + quote_id(cls.database))
        cls.admin.run("SELECT count(*) FROM pg_database WHERE datname=%s", (cls.database,))
        cls.report["database_removed_count"] = cls.admin.fetchone()[0]
        cls.report["source_history"] = cls.source_history
        cls.report["source_catalog"] = cls.catalog
        cls.report["apply_session_history"] = cls.con.history
        cls.report["other_session_history"] = cls.other.history
        cls.report["admin_history"] = cls.admin.history
        cls.admin.close()
        receipt = AUDIT_DIR / ("native-apply-postgres-" + cls.database + ".json")
        receipt.write_text(json.dumps(cls.report, indent=2, ensure_ascii=False) + "\n")
        os.chmod(receipt, 0o600)
        print("\nREAL_POSTGRES_RECEIPT=" + str(receipt), flush=True)
    def snapshot(self, data):
        snapshot = {}
        proposal = {"scope_id": data["snapshot"]["payment_collection"][0]["id"], "order_id": data["snapshot"]["order"][0]["id"], "cart_id": data["snapshot"]["cart_payment_collection"][0]["cart_id"]}
        for table in data["snapshot"]:
            # Fixture scope rows selected from actual PostgreSQL, all columns.
            where, params = _query(table, proposal, data["snapshot"])
            self.con.run('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\'::jsonb) FROM public.' + quote_id(table) + ' t WHERE ' + where, params)
            snapshot[table] = self.con.fetchone()[0]
        return snapshot
    def seed(self, kind, suffix):
        data = fixture(kind, suffix)
        # Every financial input is explicitly synthetic; no source ledger rows.
        data["snapshot"]["payment"][0]["payment_session_id"] = "session_" + suffix
        if kind == "capture_success":
            # Native event_id is UNIQUE; every independent capture fixture needs
            # its own deterministic synthetic identity, not the shared unit value.
            data["snapshot"]["marketplace_capture_tail"][0]["event_id"] = "marketplace-captured-" + digest(suffix)
        if kind == "refund_success":
            record = data["snapshot"]["refund_settlement"][0]
            record["phase"] = "pending"
            record["plan"].update(customerRefund=2.5, sellerReversal=0, payout_id=None)
        for table in ("cart_payment_collection", "order_payment_collection", "order_order_split_order_payment_split_order_payment"):
            data["snapshot"][table][0]["id"] = "link_" + table + "_" + suffix
        ordered = ["payment_collection", "payment", "capture", "refund", "order", "order_summary", "order_transaction", "split_order_payment", "cart_payment_collection", "order_payment_collection", "order_order_split_order_payment_split_order_payment", "refund_settlement", "commerce_refund_dispatch", "marketplace_capture_tail"]
        for table in ordered:
            for row in data["snapshot"].get(table, []):
                self.con.run("INSERT INTO public." + quote_id(table) + " (" + ",".join(quote_id(k) for k in row) + ") SELECT " + ",".join("x." + quote_id(k) for k in row) + " FROM jsonb_populate_record(NULL::public." + quote_id(table) + ",%s::jsonb) x", (canonical(row),))
        if kind == "refund_success":
            self.con.run("UPDATE public.refund_settlement SET phase='refund_started' WHERE operation_id=%s", ("op_" + suffix,))
        data["snapshot"] = self.snapshot(data)
        return data
    def gates(self, case):
        tables = list(schema_tables(case.kind))
        self.con.run(SCHEMA_SQL, (tables, tables, tables, tables))
        schema = self.con.fetchone()[0]
        contracts = {t["table"] + "." + t["name"]: digest(t["function"]) for t in schema["triggers"]}
        # Test-only approval of copied actual definitions, NOT operator authorization.
        return ApplyGates(True, "isolated-test", "test-only-authorization", True, "disposable-no-app-writers",
            self.database, case.plan_hash, canonical(schema), "copied-source-and-staged-audit-test-only", canonical(contracts), True)
    def assert_no_locks(self):
        self.con.run("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")
        self.assertEqual(self.con.fetchone()[0], "0")
        self.assertEqual(self.con.info.transaction_status, 0)
    def test_01_refund_success_actual_audit_and_duplicate_replay(self):
        data = self.seed("refund_success", "r1")
        case = plan_case(data)
        g = self.gates(case)
        observed = []
        proposal = json.loads(case.proposal_json)
        def exclusion(sql, params):
            if sql == "SELECT pg_try_advisory_xact_lock(%s::bigint)" and params[0] == lock_key("refund-settlement", proposal["scope_id"]):
                for namespace, identity in (("commerce-cart", proposal["cart_id"]), ("refund-settlement", proposal["scope_id"])):
                    self.other.run("SELECT pg_try_advisory_lock(%s::bigint)", (lock_key(namespace, identity),))
                    result = self.other.fetchone()[0]
                    observed.append((namespace, result))
                    self.assertIs(result, False)
        self.con.after_execute = exclusion
        try:
            result = apply_case(self.con, case, g)
        finally:
            self.con.after_execute = None
        self.assertTrue(result["committed"])
        self.assertEqual(observed, [("commerce-cart", False), ("refund-settlement", False)])
        after = self.snapshot(data)
        self.assertEqual(after["commerce_refund_dispatch"][0]["state"], "completed")
        self.assertEqual(after["refund_settlement"][0]["phase"], "completed")
        self.assertEqual(after["split_order_payment"][0]["status"], "partially_refunded")
        self.assertEqual(after["payment_collection"][0]["refunded_amount"], 2.5)
        totals = after["order_summary"][0]["totals"]
        self.assertEqual((totals["paid_total"], totals["refunded_total"], totals["transaction_total"], totals["pending_difference"]), (10, 2.5, 7.5, 2.5))
        self.assertEqual(totals["raw_credit_line_total"], {"value": "0", "precision": 20})
        self.con.run("SELECT to_jsonb(a) FROM public.reconciliation_repair_audit a WHERE id=%s", ("recon_" + case.plan_hash,))
        audit = self.con.fetchone()[0]
        self.assertEqual(audit["before_snapshot"], data["snapshot"])
        self.assertEqual(audit["after_snapshot"], after)
        self.assertNotEqual(audit["before_snapshot"], audit["after_snapshot"])
        self.assertEqual(audit["evidence"]["provider"], data["evidence"])
        with self.assertRaisesRegex(RepairBlocked, "audit_duplicate_replay_refusal"):
            apply_case(self.con, case, g)
        # Fresh snapshot/plan hash cannot replay the same account/effect either.
        fresh = {**data, "snapshot": after}
        fresh_case = plan_case(fresh)
        with self.assertRaisesRegex(RepairBlocked, "audit_duplicate_replay_refusal"):
            apply_case(self.con, fresh_case, self.gates(fresh_case))
        self.assertEqual(self.snapshot(data), after)
        self.assert_no_locks()
        self.report["cases"].append({"test": "refund-success-and-replay", "result": result, "plan_hash": case.plan_hash,
                                     "audit": audit, "concurrent_writer_exclusion": observed, "advisory_locks_after": 0})
    def test_02_capture_bookkeeping_real_transaction_not_fake_ack(self):
        data = self.seed("capture_success", "c1")
        case = plan_case(data)
        result = apply_case(self.con, case, self.gates(case))
        after = self.snapshot(data)
        tail = after["marketplace_capture_tail"][0]
        self.assertIsNotNone(tail["accounting_at"])
        self.assertEqual(tail["capture_id"], "cap_c1")
        self.assertIsNone(tail["event_enqueued_at"])
        self.assertIsNone(tail["completed_at"])
        self.assertIsNotNone(after["payment"][0]["captured_at"])
        self.assertEqual(after["order_summary"][0]["totals"]["transaction_total"], 10)
        self.con.run("SELECT to_jsonb(a) FROM public.reconciliation_repair_audit a WHERE id=%s", ("recon_" + case.plan_hash,))
        audit = self.con.fetchone()[0]
        self.assertEqual(audit["before_snapshot"], data["snapshot"])
        self.assertEqual(audit["after_snapshot"], after)
        self.assertIs(audit["evidence"]["fully_closed"], False)
        self.assert_no_locks()
        self.report["cases"].append({"test": "capture-bookkeeping-only", "result": result, "audit": audit, "advisory_locks_after": 0})
    def test_03_audit_failure_rolls_back_every_financial_row(self):
        data = self.seed("refund_success", "auditfail")
        self.con.run("CREATE FUNCTION public.hs_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated injected audit failure'; END $$")
        self.con.run("CREATE TRIGGER hs_test_audit_failure BEFORE INSERT ON public.reconciliation_repair_audit FOR EACH ROW EXECUTE FUNCTION public.hs_test_audit_failure()")
        case = plan_case(data)
        start = len(self.con.history)
        try:
            with self.assertRaises(PostgreSQLError) as caught:
                apply_case(self.con, case, self.gates(case))
            self.assertEqual(caught.exception.sqlstate, "P0001")
            self.assertIn("isolated injected audit failure", caught.exception.output)
            writes = self.con.history[start:]
            self.assertTrue(any(h["sql"].startswith("INSERT INTO public.order_transaction") and h["error"] == "false" for h in writes))
            self.assertTrue(any(h["sql"].startswith("INSERT INTO public.reconciliation_repair_audit") and h["sqlstate"] == "P0001" for h in writes))
            self.assertEqual(self.snapshot(data), data["snapshot"])
            self.con.run("SELECT count(*) FROM public.reconciliation_repair_audit WHERE case_id=%s", (case.case_id,))
            self.assertEqual(self.con.fetchone()[0], "0")
            self.assert_no_locks()
            self.report["cases"].append({"test": "real-audit-failure-rollback", "sqlstate": "P0001", "actual_before_after_equal": True, "audit_rows": 0, "advisory_locks_after": 0})
        finally:
            self.con.run("DROP TRIGGER hs_test_audit_failure ON public.reconciliation_repair_audit")
            self.con.run("DROP FUNCTION public.hs_test_audit_failure()")
    def test_04_real_cart_and_scope_lock_exclusion_release(self):
        for namespace, field in (("commerce-cart", "cart_id"), ("refund-settlement", "scope_id")):
            data = self.seed("refund_success", "cartlock" if field == "cart_id" else "scopelock")
            case = plan_case(data)
            g = self.gates(case)
            key = lock_key(namespace, json.loads(case.proposal_json)[field])
            self.other.run("SELECT pg_try_advisory_lock(%s::bigint)", (key,))
            self.assertIs(self.other.fetchone()[0], True)
            try:
                with self.assertRaisesRegex(RepairBlocked, "assertion_failed:" + ("cart_lock" if field == "cart_id" else "scope_lock")):
                    apply_case(self.con, case, g)
                self.assertEqual(self.snapshot(data), data["snapshot"])
                self.con.run("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()")
                self.assertEqual(self.con.fetchone()[0], "0")
            finally:
                self.other.run("SELECT pg_advisory_unlock(%s::bigint)", (key,))
                self.assertIs(self.other.fetchone()[0], True)
            self.assert_no_locks()
            self.report["cases"].append({"test": "writer-held-" + namespace, "refused": True, "unchanged": True, "advisory_locks_after": 0})
    def test_05_real_audit_update_delete_truncate_guards(self):
        for sql in ("UPDATE public.reconciliation_repair_audit SET actor='forged'",
                    "DELETE FROM public.reconciliation_repair_audit", "TRUNCATE public.reconciliation_repair_audit"):
            with self.assertRaises(PostgreSQLError) as caught:
                self.con.run(sql)
            self.assertEqual(caught.exception.sqlstate, "P0001")
        self.con.run("SELECT count(*) FROM public.reconciliation_repair_audit")
        self.assertEqual(self.con.fetchone()[0], "2")
        self.assert_no_locks()
        self.report["cases"].append({"test": "immutable-audit-three-guards", "sqlstates": ["P0001"] * 3, "audit_rows_unchanged": 2})
    def test_06_database_marker_gate_is_checked_before_locks_or_mutations(self):
        data = self.seed("capture_success", "marker")
        case = plan_case(data)
        g = self.gates(case)
        self.admin.run("COMMENT ON DATABASE " + quote_id(self.database) + " IS 'unapproved'")
        start = len(self.con.history)
        try:
            with self.assertRaisesRegex(RepairBlocked, "isolated_test_database_marker"):
                apply_case(self.con, case, g)
            actual = self.con.history[start:]
            self.assertFalse(any(h["sql"].startswith(("INSERT", "UPDATE")) for h in actual))
            self.assertFalse(any("pg_try_advisory" in h["sql"] for h in actual))
            self.assertEqual(self.snapshot(data), data["snapshot"])
            with self.assertRaises(PostgreSQLError) as install_error:
                self.con.run((Path(__file__).resolve().parents[1] / "reconciliation/audit_schema.sql").read_text())
            self.assertEqual(install_error.exception.sqlstate, "P0001")
            self.assertIn("audit candidate installation is isolated-test-only", install_error.exception.output)
            self.assert_no_locks()
            self.report["cases"].append({"test": "unapproved-db-marker-refused", "mutations": 0, "lock_acquisitions": 0, "audit_install_refused_sqlstate": "P0001"})
        finally:
            self.admin.run("COMMENT ON DATABASE " + quote_id(self.database) + " IS '" + ISOLATED_DATABASE_MARKER + "'")

    def test_07_real_disabled_guard_and_live_schema_change_fail_closed(self):
        data = self.seed("capture_success", "schema")
        case = plan_case(data)
        g = self.gates(case)
        self.con.run("ALTER TABLE public.marketplace_capture_tail DISABLE TRIGGER marketplace_capture_tail_immutable")
        try:
            with self.assertRaisesRegex(RepairBlocked, "approved_live_schema"):
                apply_case(self.con, case, g)
            with self.assertRaisesRegex(RepairBlocked, "installed_guards"):
                generate_sql(case, self.gates(case))
            self.assertEqual(self.snapshot(data), data["snapshot"])
            self.assert_no_locks()
            self.report["cases"].append({"test": "disabled-actual-guard-refused", "mutations": 0, "advisory_locks_after": 0})
        finally:
            self.con.run("ALTER TABLE public.marketplace_capture_tail ENABLE TRIGGER marketplace_capture_tail_immutable")
    def test_09_cart_reverse_extra_edge_before_and_after_mutation(self):
        for stage in ("before", "after"):
            data = self.seed("refund_success", "reverse" + stage)
            case = plan_case(data)
            g = self.gates(case)
            cart = data["snapshot"]["cart_payment_collection"][0]["cart_id"]
            extra_scope = "col_extra_" + stage
            extra_collection = {**data["snapshot"]["payment_collection"][0], "id": extra_scope}
            self.con.run("INSERT INTO public.payment_collection SELECT x.* FROM jsonb_populate_record(NULL::public.payment_collection,%s::jsonb) x", (canonical(extra_collection),))
            def extra_edge():
                self.con.run("INSERT INTO public.cart_payment_collection (id,cart_id,payment_collection_id) VALUES (%s,%s,%s)", ("edge_extra_" + stage, cart, extra_scope))
            if stage == "before":
                extra_edge()
                observed = self.snapshot(data)
                self.assertEqual(len(observed["cart_payment_collection"]), 2)
                with self.assertRaises(RepairBlocked):
                    plan_case({**data, "snapshot": observed})
            reached = []
            def inject(sql, params):
                if stage == "after" and sql.startswith("UPDATE public.payment_collection"):
                    self.con.after_execute = None
                    saved_rows, saved_count = self.con.rows, self.con.rowcount
                    extra_edge()
                    self.con.rows, self.con.rowcount = saved_rows, saved_count
                    reached.append(True)
            self.con.after_execute = inject
            start = len(self.con.history)
            try:
                expected = "snapshot_cart_payment_collection" if stage == "before" else "actual_unchanged_cart_payment_collection_postcondition"
                with self.assertRaisesRegex(RepairBlocked, expected):
                    apply_case(self.con, case, g)
            finally:
                self.con.after_execute = None
            history = self.con.history[start:]
            self.assertEqual(reached, [] if stage == "before" else [True])
            if stage == "before":
                self.assertFalse(any(h["sql"].startswith(("INSERT", "UPDATE")) for h in history))
            else:
                self.assertTrue(any(h["sql"].startswith("INSERT INTO public.order_transaction") for h in history))
                self.assertEqual(self.snapshot(data), data["snapshot"])
            self.con.run("SELECT count(*) FROM public.reconciliation_repair_audit WHERE case_id=%s", (case.case_id,))
            self.assertEqual(self.con.fetchone()[0], "0")
            self.assert_no_locks()
            self.report["cases"].append({"test": "cart-reverse-edge-" + stage, "assertion": expected, "reached_after_injection": reached, "audit_rows": 0})

    def test_08_real_extended_protocol_parameters_are_not_sql(self):
        tricky = "a'b\\c\n" + "'; DROP TABLE reconciliation_repair_audit; --"
        self.con.run("SELECT %s::text", (tricky,))
        # The actual output includes a newline; verify exact text by JSON encoding.
        self.con.run("SELECT jsonb_build_array(%s::text)", (tricky,))
        self.assertEqual(self.con.fetchone()[0], [tricky])
        self.con.run("SELECT jsonb_build_array(%s::text[])", (["a'b", "back\\slash", "comma,value"],))
        self.assertEqual(self.con.fetchone()[0], [["a'b", "back\\slash", "comma,value"]])
        self.con.run("SELECT count(*) FROM public.reconciliation_repair_audit")
        self.assertEqual(self.con.fetchone()[0], "2")
        self.report["cases"].append({"test": "real-libpq-parameter-escaping", "sql_interpolation": False, "audit_rows_unchanged": 2})


def acceptance_main():
    """Strict operational candidate gate: opt-ins required; skips NEVER pass.

    python3 scripts/tests/test_reconciliation_apply_postgres.py --acceptance
    requires HS_RECON_APPLY_POSTGRES=1 and HS_RECON_READONLY_PSQL_JSON.
    This gate proves isolated candidate acceptance, NOT provider/repair GO.
    """
    import hashlib
    if os.environ.get("HS_RECON_APPLY_POSTGRES") != "1" or not os.environ.get("HS_RECON_READONLY_PSQL_JSON"):
        print("ACCEPTANCE_BLOCKED: explicit isolated APPLY and readonly SELECT opt-ins both required", file=sys.stderr)
        return 2
    import test_reconciliation_native
    import test_reconciliation_evidence
    loader = unittest.TestLoader()
    suite = unittest.TestSuite([
        loader.loadTestsFromModule(test_reconciliation_native),
        loader.loadTestsFromModule(test_reconciliation_evidence),
        loader.loadTestsFromTestCase(IsolatedPostgreSQLApplyTests),
    ])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    root = Path(__file__).resolve().parents[1]
    paths = [root / "reconciliation" / name for name in ("native_repair.py", "evidence.py", "audit_schema.sql")]
    paths += [root / "tests" / name for name in ("test_reconciliation_native.py", "test_reconciliation_evidence.py", "test_reconciliation_apply_postgres.py")]
    passed = result.wasSuccessful() and not result.skipped and result.testsRun > 0
    summary = {"scope": "isolated_candidate_not_provider_or_repair_go", "accepted": passed,
               "tests_run": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
               "skipped": len(result.skipped), "provider_http_calls": 0,
               "sha256": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}}
    receipt = AUDIT_DIR / "continue-native-acceptance-gate.json"
    receipt.write_text(json.dumps(summary, indent=2) + "\n")
    os.chmod(receipt, 0o600)
    print("STRICT_ACCEPTANCE_RECEIPT=" + str(receipt), flush=True)
    return 0 if passed else 1


if __name__ == "__main__":
    if "--acceptance" in sys.argv:
        raise SystemExit(acceptance_main())
    unittest.main()
