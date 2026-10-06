"""Detached, schema-first raw native snapshot candidate. READ ONLY, never approval.

The caller supplies an idle, session-affine connection and an explicit allowlisted
source/target. No connection factory, credentials, normalization, provider, DDL,
locks or apply path exists here. Full bounded inventory retains deleted/orphan and
reverse-ownership edges; exact native _query rowsets are acquired separately in
the SAME RR READ ONLY transaction. Missing financial tables/types fail closed;
missing audit installation is recorded, never installed or treated as approval.

All database JSON is requested as prefixed TEXT, avoiding adapter float decoding.
Decimal serialization remains JSON numeric, including nested metadata. Detached
hashes attest bytes only, NOT source authentication, fencing or operator approval.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from decimal import Decimal
import ctypes
import hashlib
import json
import re
from typing import Any

from .db_readonly import SANDBOXES
from .native_repair import (AUDIT_TABLE, SCHEMA_SQL, _query, required_columns,
                            schema_tables)


class SnapshotBlocked(ValueError):
    pass


def exact_json(value: Any) -> str:
    """Deterministic lossless JSON; never coerce Decimal to float or numeric string."""
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise SnapshotBlocked("nonfinite_numeric")
        return str(value)
    if value is None or type(value) in (str, int, bool):
        return json.dumps(value, ensure_ascii=False, allow_nan=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(exact_json(v) for v in value) + "]"
    if isinstance(value, dict) and all(isinstance(k, str) for k in value):
        return "{" + ",".join(exact_json(k) + ":" + exact_json(value[k]) for k in sorted(value)) + "}"
    raise SnapshotBlocked("lossless_json_type_required")


def decode_json(text: str) -> Any:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise SnapshotBlocked("duplicate_json_key")
            result[key] = value
        return result
    def invalid(_):
        raise SnapshotBlocked("nonfinite_numeric")
    try:
        return json.loads(text, parse_float=Decimal, parse_constant=invalid, object_pairs_hook=pairs)
    except (ValueError, TypeError, RecursionError):
        raise SnapshotBlocked("malformed_raw_json") from None


def sha256(value: Any) -> str:
    return hashlib.sha256(exact_json(value).encode("utf-8")).hexdigest()


def identity(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_:\-]{1,255}", value):
        raise SnapshotBlocked("malformed_identity")
    return value


@dataclass(frozen=True)
class Target:
    kind: str
    scope_id: str
    order_id: str
    cart_id: str
    split_order_payment_id: str

    def validate(self):
        if self.kind not in ("capture_success", "refund_success"):
            raise SnapshotBlocked("unsupported_kind:no_effect_schema_query_contract_required")
        for value in (self.scope_id, self.order_id, self.cart_id, self.split_order_payment_id):
            identity(value)

    def as_dict(self):
        return dict(kind=self.kind, scope_id=self.scope_id, order_id=self.order_id,
                    cart_id=self.cart_id, split_order_payment_id=self.split_order_payment_id)


@dataclass(frozen=True)
class Limits:
    inventory_rows_per_table: int = 100000
    scoped_rows_per_table: int = 128
    total_rows: int = 200000
    total_bytes: int = 20000000
    scoped_bytes: int = 2000000

    def validate(self):
        for value, ceiling in ((self.inventory_rows_per_table, 100000),
                               (self.scoped_rows_per_table, 128), (self.total_rows, 200000),
                               (self.total_bytes, 20000000), (self.scoped_bytes, 2000000)):
            if type(value) is not int or not 1 <= value <= ceiling:
                raise SnapshotBlocked("invalid_limits")


ENVIRONMENT_SQL = """SELECT 'raw:' || jsonb_build_object(
 'database',current_database(),'read_only',current_setting('transaction_read_only'),
 'isolation',current_setting('transaction_isolation'),'snapshot',txid_current_snapshot()::text,
 'server_version',current_setting('server_version'),'schema','public',
 'observed_at',transaction_timestamp(),'row_security',current_setting('row_security'),
 'session_user',session_user,'current_user',current_user)::text"""
RELATIONS_SQL = """SELECT 'raw:' || COALESCE(jsonb_agg(jsonb_build_object(
 'table',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'selectable',has_table_privilege(c.oid,'SELECT')) ORDER BY c.relname),'[]'::jsonb)::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY(%s)"""


def _read(cursor, sql, params=()):
    cursor.execute(sql, params)
    row = cursor.fetchone()
    if not row or len(row) != 1 or not isinstance(row[0], str) or not row[0].startswith("raw:"):
        raise SnapshotBlocked("raw_text_transport_required")
    return decode_json(row[0][4:])


def _transaction_status(connection):
    """Read libpq, never an adapter's cached `info.transaction_status`.

    Supported providers: psycopg's native PGconn, psycopg2's libpq method, or
    a ctypes libpq handle. Caller-injected transports remain trusted-process
    boundaries; attribute-only status facades (notably psql) are unsupported.
    """
    pgconn = getattr(connection, "pgconn", None)
    pq = getattr(connection, "pq", None)
    if isinstance(pq, ctypes.CDLL) and isinstance(pgconn, ctypes.c_void_p) and pgconn.value:
        fn = pq.PQtransactionStatus
        fn.argtypes = [ctypes.c_void_p]
        fn.restype = ctypes.c_int
        status = fn(pgconn)
    elif pgconn is not None and type(pgconn).__module__.startswith("psycopg"):
        status = getattr(pgconn, "transaction_status")
    elif type(connection).__module__.startswith("psycopg2"):
        status = connection.get_transaction_status()
    else:
        raise SnapshotBlocked("authoritative_transaction_status_provider_required")
    if type(status) is not int:
        status = int(status)
    if status not in range(5):
        raise SnapshotBlocked("invalid_authoritative_transaction_status")
    return status


@contextmanager
def readonly_transaction(connection):
    """Own exactly one RR READ ONLY transaction; ALWAYS rollback owned work."""
    if getattr(connection, "autocommit", None) is not True:
        raise SnapshotBlocked("idle_autocommit_connection_required")
    if _transaction_status(connection) != 0:
        raise SnapshotBlocked("outer_transaction_forbidden")
    with connection.cursor() as cursor:
        try:
            cursor.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
            cursor.execute("SET LOCAL statement_timeout='20s'")
            cursor.execute("SET LOCAL lock_timeout='3s'")
            cursor.execute("SET LOCAL search_path=pg_catalog,public")
            # RLS must refuse rather than silently hide financial rows.
            cursor.execute("SET LOCAL row_security=off")
            yield cursor
        finally:
            cursor.execute("ROLLBACK")


def validate_schema(schema, relations, tables):
    if not isinstance(schema, dict) or any(not isinstance(schema.get(k), list)
            for k in ("columns", "constraints", "indexes", "triggers")):
        raise SnapshotBlocked("schema_snapshot_required")
    columns = {}
    for row in schema["columns"]:
        if not isinstance(row, dict) or row.get("table_schema") != "public":
            raise SnapshotBlocked("malformed_schema_column")
        key = (row.get("table_name"), row.get("column_name"))
        if key in columns:
            raise SnapshotBlocked("duplicate_schema_column")
        if not all(k in row for k in ("table_name", "column_name", "data_type", "is_nullable")) or row["is_nullable"] not in ("YES", "NO"):
            raise SnapshotBlocked("column_nullability_metadata_required")
        columns[key] = row.get("data_type")
    if not isinstance(relations, list) or any(not isinstance(r, dict) for r in relations):
        raise SnapshotBlocked("relation_catalog_required")
    by_table = {r.get("table"): r for r in relations}
    if len(by_table) != len(relations):
        raise SnapshotBlocked("duplicate_relation")
    required = required_columns()
    missing = []
    for table in tables:
        rel = by_table.get(table)
        if table == AUDIT_TABLE and rel is None:
            missing.append(AUDIT_TABLE)
            continue
        if rel is None:
            raise SnapshotBlocked("missing_financial_table:" + table)
        if rel.get("kind") not in ("r", "p") or rel.get("rls") is not False or rel.get("force_rls") is not False or rel.get("selectable") is not True:
            raise SnapshotBlocked("unrestricted_native_table_required:" + table)
        for field, expected in required[table].items():
            actual = columns.get((table, field))
            if actual != expected and not (expected == "text" and actual == "character varying"):
                raise SnapshotBlocked("required_schema_mismatch:" + table + "." + field)
    return missing


def _rowset_query(table, target=None):
    """Closed internal query API: no caller-supplied SQL predicate."""
    if table not in required_columns() or table == AUDIT_TABLE:
        raise SnapshotBlocked("unsupported_snapshot_table")
    where, params = "TRUE", ()
    if target is not None:
        if not isinstance(target, Target):
            raise SnapshotBlocked("typed_target_required")
        target.validate()
        if table not in schema_tables(target.kind):
            raise SnapshotBlocked("unsupported_target_table")
        where, params = _query(table, target.as_dict(),
                               {"split_order_payment": [{"id": target.split_order_payment_id}]})
    # A materialized bounded rowset and scalar preflight precede the aggregate.
    # The aggregate is in a scalar CASE subquery (not CASE around an aggregate).
    # Oversize data builds no jsonb_agg state and no partial rows are returned.
    sql = ("SELECT 'raw:' || result::text FROM (WITH q AS MATERIALIZED ("
           "SELECT to_jsonb(t) AS j FROM public.\"" + table + "\" t WHERE " + where + " LIMIT %s), "
           "bounds AS MATERIALIZED (SELECT count(*) AS n, "
           "COALESCE(sum(octet_length(j::text)),0) AS b FROM q) "
           "SELECT jsonb_build_object('row_count',n,'byte_count',b,'rows',"
           "CASE WHEN n<=%s AND b<=%s THEN "
           "(SELECT COALESCE(jsonb_agg(j ORDER BY j::text),'[]'::jsonb) FROM q) "
           "ELSE NULL END) AS result FROM bounds) raw_envelope")
    return sql, tuple(params)


def _rows(cursor, table, target, row_limit, byte_limit, columns):
    sql, params = _rowset_query(table, target)
    result = _read(cursor, sql, (*params, row_limit + 1, row_limit, byte_limit))
    if not isinstance(result, dict) or type(result.get("row_count")) is not int or type(result.get("byte_count")) is not int:
        raise SnapshotBlocked("malformed_rowset_envelope")
    if result["row_count"] > row_limit or result["byte_count"] > byte_limit:
        raise SnapshotBlocked("snapshot_bound_exceeded:" + table)
    rows = result.get("rows")
    if not isinstance(rows, list) or len(rows) != result["row_count"] or any(not isinstance(r, dict) for r in rows):
        raise SnapshotBlocked("malformed_rowset")
    for row in rows:
        missing = set(required_columns()[table]) - row.keys()
        if missing:
            raise SnapshotBlocked("missing_required_row_fields:" + table + ":" + ",".join(sorted(missing)))
        for key, value in row.items():
            if (key == "id" or key.endswith("_id") or key == "idempotency_key") and value is not None:
                if not (table == "order" and key == "display_id" and type(value) is int):
                    identity(value)
            # Identity/ownership nulls are evidence, even if they contradict NOT
            # NULL metadata: preserve and classify noneligible, never discard.
            is_identity = key == "id" or key.endswith("_id") or key == "idempotency_key"
            if value is None and columns.get((table, key)) == "NO" and not is_identity:
                raise SnapshotBlocked("null_nonnullable_column:" + table + "." + key)
    return rows, result["byte_count"]


def _target_presence(inventory, target):
    anchors = {}
    for table, key, value in (("payment_collection", "id", target.scope_id),
                              ("order", "id", target.order_id),
                              ("split_order_payment", "id", target.split_order_payment_id),
                              ("cart_payment_collection", "cart_id", target.cart_id)):
        rows = [r for r in inventory[table] if r.get(key) == value]
        active = [r for r in rows if r.get("deleted_at") is None]
        anchors[table] = dict(matches=len(rows), active_matches=len(active),
                             status="present" if len(active) == 1 else "absent" if not rows else "ambiguous_or_deleted")
    edges = (("cart_payment_collection", "cart_id", target.cart_id, "payment_collection_id", target.scope_id),
             ("order_payment_collection", "order_id", target.order_id, "payment_collection_id", target.scope_id),
             ("split_order_payment", "id", target.split_order_payment_id, "payment_collection_id", target.scope_id),
             ("order_order_split_order_payment_split_order_payment", "order_id", target.order_id,
              "split_order_payment_id", target.split_order_payment_id))
    mismatched = []
    for table, key, value, owner, expected in edges:
        rows = [r for r in inventory[table] if r.get(key) == value and r.get("deleted_at") is None]
        if len(rows) != 1 or rows[0].get(owner) != expected:
            mismatched.append(table)
    status = "absent" if any(a["status"] == "absent" for a in anchors.values()) else (
        "mismatched" if mismatched or any(a["status"] != "present" for a in anchors.values()) else "present")
    return dict(status=status, anchors=anchors, mismatched_ownership=mismatched,
                cart_presence_basis="cart_payment_collection_only_no_cart_table_contract")


def _null_identities(inventory, columns):
    return [dict(table=t, row_index=i, field=k, nullable=columns[(t, k)] == "YES",
                 role="optional_reference" if k in ("reference_id", "capture_id", "reversal_receipt_id", "event_id") else "identity_or_ownership",
                 eligible_for_binding=False)
            for t, rows in inventory.items() for i, row in enumerate(rows)
            for k in required_columns()[t] if (k == "id" or k.endswith("_id") or k == "idempotency_key") and row[k] is None]


def acquire(connection, database: str, target: Target, limits: Limits = Limits()) -> dict:
    """Return complete bounded inventory + exact native rowsets, never a gated plan.

    Raw monetary mismatch is PRESERVED rather than repaired, so native amount()
    still refuses it. This candidate intentionally does not call plan_case(): its
    native canonical encoder is not Decimal-aware and binding requires independent
    lossless consumer acceptance. No synthetic provider receipts are constructed.
    """
    if database not in SANDBOXES:
        raise SnapshotBlocked("explicit_sandbox_allowlist_required")
    if not isinstance(target, Target) or not isinstance(limits, Limits):
        raise SnapshotBlocked("typed_target_and_limits_required")
    target.validate()
    limits.validate()
    tables = schema_tables(target.kind)
    with readonly_transaction(connection) as cursor:
        env = _read(cursor, ENVIRONMENT_SQL)
        if not isinstance(env, dict) or env.get("database") != database or env.get("read_only") != "on" or env.get("isolation") != "repeatable read":
            raise SnapshotBlocked("source_transaction_binding_failed")
        schema = _read(cursor, "SELECT 'raw:' || s.schema_snapshot::text FROM (" + SCHEMA_SQL + ") s", (list(tables),) * 4)
        relations = _read(cursor, RELATIONS_SQL, (list(tables),))
        missing = validate_schema(schema, relations, tables)
        inventory, scoped, query_provenance = {}, {}, []
        total_bytes = len(exact_json(schema).encode())
        total_rows = 0
        scoped_bytes = 0
        columns = {(r["table_name"], r["column_name"]): r["is_nullable"] for r in schema["columns"]}
        for table in tables:
            if table == AUDIT_TABLE:
                continue  # audit installation schema is retained, unrelated audits are not data scope
            inventory[table], size = _rows(cursor, table, None, limits.inventory_rows_per_table, limits.total_bytes, columns)
            total_bytes += size
            total_rows += len(inventory[table])
            scoped[table], size = _rows(cursor, table, target, limits.scoped_rows_per_table, limits.scoped_bytes, columns)
            scoped_bytes += size
            total_bytes += size
            total_rows += len(scoped[table])
            inventory_sql, _ = _rowset_query(table)
            native_sql, params = _rowset_query(table, target)
            query_provenance.append(dict(table=table, inventory_sql=inventory_sql,
                                         native_sql=native_sql, native_params=list(params),
                                         inventory_hash=sha256(inventory[table]), native_hash=sha256(scoped[table])))
            if total_rows > limits.total_rows or total_bytes > limits.total_bytes or scoped_bytes > limits.scoped_bytes:
                raise SnapshotBlocked("aggregate_snapshot_bound_exceeded")
        presence = _target_presence(inventory, target)
        nulls = _null_identities(inventory, columns)
        result = dict(format="native-raw-snapshot-candidate-v2", operational=False,
                      eligible_for_binding=False, target_presence=presence, null_identity_findings=nulls,
                      completeness_scope="selected_financial_tables_only_not_existence_or_graphclosure",
                      authority="detached_untrusted_no_provider_fence_or_operator_approval",
                      source=env, target=target.as_dict(), schema=schema, relations=relations,
                      inventory=inventory, snapshot=scoped, provenance=query_provenance,
                      inventory_complete=True, native_rowsets_complete=True,
                      blockers=["independent_source_binding_required", "authenticated_provider_evidence_required",
                                "operator_authorization_required", "writer_fence_required",
                                "schema_and_guard_approval_required", "lossless_native_consumer_binding_required"]
                               + ["missing_installation:" + t for t in missing]
                               + (["target_" + str(presence["status"])] if presence["status"] != "present" else [])
                               + (["null_identity_or_reference_noneligible"] if nulls else []),
                      limits=limits.__dict__, row_count=total_rows)
        result["content_hash"] = sha256(result)
        if len(exact_json(result).encode()) > limits.total_bytes:
            raise SnapshotBlocked("artifact_byte_bound_exceeded")
    return result
