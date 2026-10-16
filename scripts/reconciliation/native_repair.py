"""Offline, bounded reconciliation; no SDK, provider calls, migration or implicit apply.

Public API: plan_case(mapping), build_plan(five_mappings), generate_sql(case, gates),
execute_transaction(connection, immutable_bundle), apply_case(connection, case, gates).
Raw execution is internal; the public adapter rederives and exactly compares the bundle.
psycopg3-style connection must be idle and autocommit=True. The adapter owns ONE
transaction and checks every assertion / rowcount; never run just the mutation subset.
Tests include a real full apply transaction against a NEW disposable PostgreSQL
database only. Synthetic evidence never unlocks an existing financial sandbox.

Snapshots are JSON produced from to_jsonb(row), including deleted rows. Schema
snapshot must come from SCHEMA_SQL with the listed tables, independently approved.
Audit table must already exist with typed NOT NULL AUDIT_COLUMNS, PRIMARY KEY(id),
BEFORE UPDATE/DELETE row and BEFORE TRUNCATE statement guards. Guard function hashes
must be separately independently approved in guard_contract_json (table.trigger ->
digest(exact pg_get_functiondef string)); constructor creation is not user acceptance.
This contract intentionally blocks the currently absent audit installation; no auto-DDL.
The two physical order-link names are supplied by native discovery; all forward/reverse
rows (including deleted rows) must be selected, schema-validated and locked.
No-effect terminal protocol is NOT installed/supported here: always fail closed.
Capture bookkeeping deliberately leaves the Redis enqueue/completion markers alone.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from decimal import Decimal, InvalidOperation, localcontext
import hashlib
import re
from typing import Any, Mapping, Sequence

from .exact_json import (ExactJSONBlocked, encode_json,
                         decode_json as _decode_json)

from .evidence import (EvidenceBlocked, authenticate_evidence, isolated_test_database,
                       ISOLATED_DATABASE_MARKER)
from .stripe_readonly import identifier as provider_identifier, StripeReadBlocked


class RepairBlocked(ValueError):
    pass


def canonical(value: Any) -> str:
    try:
        return encode_json(value)
    except ExactJSONBlocked as exc:
        raise RepairBlocked(str(exc)) from None


def decode_json(text: str) -> Any:
    """Every native JSON read is exact and rejects duplicate/nonfinite tokens."""
    try:
        return _decode_json(text)
    except ExactJSONBlocked as exc:
        raise RepairBlocked(str(exc)) from None


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def lock_key(namespace: str, identity: str) -> int:
    if namespace not in ("commerce-cart", "refund-settlement"):
        raise RepairBlocked("invalid_lock_namespace")
    return int.from_bytes(hashlib.sha256(f"hobbysalon:{namespace}:v1:{identity}".encode()).digest()[:8], "big", signed=True)


def decimal(value: Any) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise RepairBlocked("exact_decimal_required")
    if not isinstance(value, (Decimal, str, int, float)):
        raise RepairBlocked("invalid_amount")
    # Raw value strings must be JSON-number syntax, not Decimal's permissive
    # whitespace/underscore spellings. Native JSON numerics decode as Decimal;
    # legacy finite float inputs retain their already-established JSON token only.
    if isinstance(value, str) and not re.fullmatch(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?", value):
        raise RepairBlocked("invalid_amount")
    try:
        result = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise RepairBlocked("invalid_amount") from None
    if not result.is_finite() or len(result.as_tuple().digits) > 40 or abs(result.adjusted()) > 40:
        raise RepairBlocked("invalid_amount")
    return result


def amount(row: Mapping[str, Any], field: str = "amount") -> Decimal:
    raw = row.get("raw_" + field)
    if not isinstance(raw, dict) or set(raw) != {"value", "precision"} or not isinstance(raw.get("value"), str) or type(raw.get("precision")) is not int or not 1 <= raw["precision"] <= 100:
        raise RepairBlocked("missing_raw_amount")
    result = decimal(raw.get("value"))
    if decimal(row.get(field)) != result:
        raise RepairBlocked("raw_numeric_mismatch")
    return result


def identifier(value: Any) -> str:
    if not isinstance(value, str) or not value or len(value) > 255 or value.strip() != value or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise RepairBlocked("invalid_identity")
    return value


@dataclass(frozen=True)
class CasePlan:
    case_id: str
    kind: str
    status: str
    blocker: str | None
    snapshot_json: str
    evidence_json: str
    proposal_json: str
    plan_hash: str

    def as_dict(self) -> dict:
        return {"case_id": self.case_id, "kind": self.kind, "status": self.status,
                "blocker": self.blocker, "snapshot": decode_json(self.snapshot_json),
                "evidence": decode_json(self.evidence_json), "proposal": decode_json(self.proposal_json),
                "plan_hash": self.plan_hash}


@dataclass(frozen=True)
class ReconciliationPlan:
    cases: tuple[CasePlan, ...]
    plan_hash: str

    def as_dict(self) -> dict:
        return {"plan_hash": self.plan_hash, "mode": "immutable_dry_run", "cases": [c.as_dict() for c in self.cases]}


@dataclass(frozen=True)
class ApplyGates:
    sandbox: bool = False
    authorized_actor: str = ""
    authorization_reference: str = ""
    writers_fenced: bool = False
    writer_fence_reference: str = ""
    database: str = ""
    expected_plan_hash: str = ""
    schema_snapshot_json: str = ""
    schema_approval_reference: str = ""
    guard_contract_json: str = ""  # independently approved exact function hashes; never inferred from a constructor
    isolated_test_only: bool = False  # ONLY hs_recon_it_<uuid> with DB-level marker; never financial sandboxes


@dataclass(frozen=True)
class Statement:
    sql: str
    params: tuple[Any, ...] = ()
    expect: str = "none"  # true / one / none
    label: str = ""


def replace_statement_label(statement: Statement, label: str) -> Statement:
    return replace(statement, label=label)


@dataclass(frozen=True)
class StatementBundle(Sequence[Statement]):
    """Detached immutable serialization; public execution always rederives it."""
    case: CasePlan
    gates: ApplyGates
    serialized: str

    def __len__(self):
        return len(decode_json(self.serialized))

    def __getitem__(self, index):
        rows = tuple(Statement(r["sql"], tuple(r["params"]), r["expect"], r["label"]) for r in decode_json(self.serialized))
        return rows[index]


# All identifiers are hardcoded, never SQL interpolated from caller input.
AUDIT_TABLE = "reconciliation_repair_audit"
AUDIT_COLUMNS = {"id", "plan_hash", "case_id", "actor", "evidence", "before_snapshot", "after_snapshot", "created_at"}
ORDER_COLLECTION_LINK = "order_payment_collection"
ORDER_SPLIT_LINK = "order_order_split_order_payment_split_order_payment"
COMMON_TABLES = ("payment", "payment_collection", "capture", "refund", "order", "order_summary", "order_transaction", "split_order_payment", "cart_payment_collection", ORDER_COLLECTION_LINK, ORDER_SPLIT_LINK)


def required_columns() -> dict[str, dict[str, str]]:
    text, num, raw_type, stamp = "text", "numeric", "jsonb", "timestamp with time zone"
    result = {
        "payment": dict(id=text, payment_collection_id=text, provider_id=text, data=raw_type, currency_code=text, captured_at=stamp, canceled_at=stamp),
        "payment_collection": dict(id=text, currency_code=text, status=text, completed_at=stamp),
        "capture": dict(id=text, payment_id=text), "refund": dict(id=text, payment_id=text),
        "order": dict(id=text, version="integer", currency_code=text),
        "order_summary": dict(id=text, order_id=text, version="integer", totals=raw_type),
        "order_transaction": dict(id=text, order_id=text, version="integer", currency_code=text, reference=text, reference_id=text),
        "split_order_payment": dict(id=text, payment_collection_id=text, currency_code=text, status=text),
        "cart_payment_collection": dict(cart_id=text, payment_collection_id=text),
        ORDER_COLLECTION_LINK: dict(order_id=text, payment_collection_id=text),
        ORDER_SPLIT_LINK: dict(order_id=text, split_order_payment_id=text),
        "refund_settlement": dict(operation_id=text, order_id=text, scope_id=text, plan=raw_type, phase=text, reversal_receipt_id=text),
        "commerce_refund_dispatch": dict(refund_id=text, idempotency_key=text, operation_id=text, scope_id=text, payment_id=text, provider_id=text, provider_payment_id=text, currency_code=text, amount=num, state=text),
        "marketplace_capture_tail": dict(payment_id=text, cart_id=text, capture_id=text, snapshot=raw_type, event_id=text, accounting_at=stamp, event_enqueued_at=stamp, completed_at=stamp),
        AUDIT_TABLE: {**{c: text for c in ("id", "plan_hash", "case_id", "actor")}, **{c: raw_type for c in ("evidence", "before_snapshot", "after_snapshot")}, "created_at": stamp},
    }
    for table in COMMON_TABLES:
        result[table]["deleted_at"] = stamp
    for table in ("payment", "payment_collection", "capture", "refund", "order_transaction"):
        result[table].update(amount=num, raw_amount=raw_type)
    for table in ("payment_collection", "split_order_payment"):
        for field in ("authorized_amount", "captured_amount", "refunded_amount"):
            result[table].update({field: num, "raw_" + field: raw_type})
    for table in ("payment", "payment_collection", "order_summary", "split_order_payment", "refund_settlement", "commerce_refund_dispatch", "marketplace_capture_tail"):
        result[table]["updated_at"] = stamp
    return result
SCHEMA_SQL = """SELECT jsonb_build_object(
 'columns', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.ordinal_position)
   FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=ANY(%s)), '[]'::jsonb),
 'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY r.relname,c.conname)
   FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname=ANY(%s)), '[]'::jsonb),
 'indexes', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.tablename,i.indexname) FROM pg_indexes i WHERE i.schemaname='public' AND i.tablename=ANY(%s)), '[]'::jsonb),
 'triggers', COALESCE((SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) ORDER BY r.relname,t.tgname)
   FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE NOT t.tgisinternal AND n.nspname='public' AND r.relname=ANY(%s)), '[]'::jsonb)
) AS schema_snapshot"""


def schema_tables(kind: str) -> tuple[str, ...]:
    return COMMON_TABLES + (("refund_settlement", "commerce_refund_dispatch") if kind == "refund_success" else ("marketplace_capture_tail",)) + (AUDIT_TABLE,)


def _one(snapshot: dict, table: str) -> dict:
    rows = snapshot.get(table)
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict) or rows[0].get("deleted_at") is not None:
        raise RepairBlocked("expected_one_active_" + table)
    return rows[0]


def _totals(snapshot: dict, order_id: str, version: int) -> tuple[Decimal, Decimal, Decimal]:
    paid = refunded = Decimal(0)
    for t in snapshot["order_transaction"]:
        if t.get("deleted_at") is None and t["order_id"] == order_id and t["version"] == version:
            a = amount(t)
            paid += max(a, 0)
            refunded += max(-a, 0)
    return paid, refunded, paid - refunded


def plan_case(data: Mapping[str, Any]) -> CasePlan:
    """Input: case_id, kind, snapshot (table -> complete bounded row list), evidence.

    Evidence must be an in-process authenticated receipt from evidence.read_evidence.
    External JSON/verified=True grants no authority. Test-only sealed fixtures may
    be planned, but generation/apply require a disposable isolated DB + marker.
    """
    with localcontext() as ctx:
        ctx.prec = 100
        return _plan_case(data)


def _plan_case(data: Mapping[str, Any]) -> CasePlan:
    case_id = identifier(data["case_id"])
    kind = data["kind"]
    encoded_snapshot = canonical(data.get("snapshot", {}))
    if len(encoded_snapshot) > 2_000_000:
        raise RepairBlocked("bounded_snapshot_size_exceeded")
    snapshot = decode_json(encoded_snapshot)  # deep detach
    if not isinstance(snapshot, dict) or any(not isinstance(rows, list) or len(rows) > 128 or any(not isinstance(row, dict) for row in rows) for rows in snapshot.values()):
        raise RepairBlocked("bounded_snapshot_rows_exceeded")
    evidence = decode_json(canonical(data.get("evidence", {})))
    if not isinstance(evidence, dict):
        raise RepairBlocked("evidence_object_required")
    if kind not in ("refund_success", "capture_success", "refund_no_effect"):
        raise RepairBlocked("unsupported_case_kind")
    if kind == "refund_no_effect":
        return _case(case_id, kind, "blocked", "missing_no_effect_terminal_migration_and_runtime_reader_protocol", snapshot, evidence, {})
    if evidence.get("livemode") is not False or evidence.get("currency") != "eur" or evidence.get("status") != "succeeded":
        raise RepairBlocked("verified_sandbox_success_evidence_required")
    try:
        provider_identifier(evidence.get("provider_effect_id"), "ch" if kind == "capture_success" else "re")
        intent = provider_identifier(evidence.get("payment_intent"), "pi")
        provider_identifier(evidence.get("account_id"), "acct")
    except StripeReadBlocked:
        raise RepairBlocked("invalid_kind_bound_provider_identity") from None
    if evidence.get("account_id") != evidence.get("expected_account_id") or evidence.get("kind") != kind or evidence.get("object") != ("charge" if kind == "capture_success" else "refund"):
        raise RepairBlocked("provider_account_kind_object_binding_required")
    try:
        authenticate_evidence(evidence, allow_test_only=True)
    except EvidenceBlocked as exc:
        raise RepairBlocked(str(exc)) from None
    minor = evidence.get("amount_minor")
    if type(minor) is not int or not 0 < minor <= 9007199254740991:
        raise RepairBlocked("positive_minor_amount_required")
    effect = Decimal(minor) / 100
    p, pc, order, summary, split, link = [_one(snapshot, t) for t in ("payment", "payment_collection", "order", "order_summary", "split_order_payment", "cart_payment_collection")]
    for t in COMMON_TABLES:
        if not isinstance(snapshot.get(t), list):
            raise RepairBlocked("missing_snapshot_" + t)
    for row in (p, pc, order, summary, split):
        identifier(row["id"])
    if p.get("canceled_at") or p["payment_collection_id"] != pc["id"] or split["payment_collection_id"] != pc["id"] or link["payment_collection_id"] != pc["id"]:
        raise RepairBlocked("payment_scope_binding_mismatch")
    identifier(link["cart_id"])
    metadata = evidence.get("identity_metadata")
    expected_metadata = {"cart_id": link["cart_id"], "payment_id": p["id"],
                         "collection_id": pc["id"], "order_id": order["id"]}
    if not isinstance(metadata, dict) or set(metadata) != {*expected_metadata, "run_id"} or any(metadata.get(k) != v for k, v in expected_metadata.items()) or not isinstance(metadata.get("run_id"), str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", metadata["run_id"]):
        raise RepairBlocked("provider_native_identity_metadata_mismatch")
    for table, field, expected in ((ORDER_COLLECTION_LINK, "payment_collection_id", pc["id"]), (ORDER_SPLIT_LINK, "split_order_payment_id", split["id"])):
        edge = _one(snapshot, table)
        if edge.get("order_id") != order["id"] or edge.get(field) != expected:
            raise RepairBlocked("native_order_link_binding_mismatch")
    if not isinstance(p.get("data"), dict):
        raise RepairBlocked("provider_payment_binding_mismatch")
    if p.get("provider_id") != "pp_card_stripe-connect" or p.get("data", {}).get("id") != evidence.get("payment_intent"):
        raise RepairBlocked("provider_payment_binding_mismatch")
    if any(r.get("currency_code") != "eur" for r in (p, pc, order, split)):
        raise RepairBlocked("currency_mismatch")
    version = order.get("version")
    if type(version) is not int or version < 1 or summary["order_id"] != order["id"] or summary["version"] != version:
        raise RepairBlocked("order_version_mismatch")
    for t in snapshot["order_transaction"]:
        if t["order_id"] != order["id"] or t.get("currency_code") != "eur":
            raise RepairBlocked("transaction_scope_mismatch")
        amount(t)
    captures = snapshot["capture"]
    refunds = snapshot["refund"]
    for row in captures + refunds:
        identifier(row.get("id"))
        if row["payment_id"] != p["id"] or row.get("deleted_at") is not None or amount(row) <= 0:
            raise RepairBlocked("native_reservation_mismatch")
    if len(captures) != 1 or amount(captures[0]) != amount(p) or amount(pc) != amount(p):
        raise RepairBlocked("only_single_full_capture_supported")
    scope = evidence.get("scoped_inventory")
    if scope is not None:
        refund_total = sum((amount(r) for r in refunds), Decimal(0))
        if (Decimal(scope["amount_minor"]) / 100 != amount(p)
                or Decimal(scope["captured_minor"]) / 100 != amount(captures[0])
                or Decimal(scope["refunded_minor"]) / 100 != refund_total):
            raise RepairBlocked("scoped_provider_native_gross_totals_mismatch")
    native_by_key = {(ref, row["id"]): row for ref, rows in (("capture", captures), ("refund", refunds)) for row in rows}
    if len(native_by_key) != len(captures) + len(refunds):
        raise RepairBlocked("duplicate_native_identity")
    seen_keys, seen_ids = set(), set()
    for tx in snapshot["order_transaction"]:
        identifier(tx.get("reference"))
        identifier(tx.get("reference_id"))
        key = (tx.get("reference"), tx.get("reference_id"))
        native_row = native_by_key.get(key)
        identifier(tx.get("id"))
        if native_row is None or key in seen_keys or tx["id"] in seen_ids or tx.get("deleted_at") is not None or type(tx.get("version")) is not int or tx["version"] != version or amount(tx) != amount(native_row) * (1 if key[0] == "capture" else -1):
            raise RepairBlocked("duplicate_identity_or_amount_mismatch")
        seen_keys.add(key)
        seen_ids.add(tx["id"])
    if sum((amount(r) for r in refunds), Decimal(0)) > amount(captures[0]):
        raise RepairBlocked("refund_exceeds_capture")
    if any(amount(row, "authorized_amount") != amount(p) for row in (pc, split)):
        raise RepairBlocked("only_single_allocation_supported")
    for row in (pc, split):
        for f in ("authorized_amount", "captured_amount", "refunded_amount"):
            amount(row, f)
    native = captures[0] if kind == "capture_success" else _one(snapshot, "refund")
    if amount(native) != effect:
        raise RepairBlocked("provider_native_amount_mismatch")
    if evidence.get("idempotency_key") != native["id"] or evidence.get("idempotency_key_hash") != hashlib.sha256(native["id"].encode()).hexdigest():
        raise RepairBlocked("provider_native_idempotency_binding_required")
    expected_operation = native["id"] if kind == "capture_success" else _one(snapshot, "refund_settlement")["operation_id"]
    if evidence.get("operation_id") != expected_operation:
        raise RepairBlocked("provider_native_operation_binding_required")
    reference = "capture" if kind == "capture_success" else "refund"
    required_basis = set(native_by_key) - {(reference, native["id"])}
    if required_basis - seen_keys:
        raise RepairBlocked("incomplete_native_transaction_basis")
    signed = effect if reference == "capture" else -effect
    existing = [t for t in snapshot["order_transaction"] if t.get("reference") == reference and t.get("reference_id") == native["id"]]
    if len(existing) > 1 or any(t.get("deleted_at") is not None or t["version"] != version or amount(t) != signed for t in existing):
        raise RepairBlocked("duplicate_identity_or_amount_mismatch")
    totals = summary["totals"]
    if not isinstance(totals, dict):
        raise RepairBlocked("summary_totals_object_required")
    paid, refunded, net = _totals(snapshot, order["id"], version)
    # Installed Medusa 2.11.3 OrderChangeProcessing.updateSummary: pending =
    # current_order_total - transaction_total. Only unchanged orders without
    # credit lines are supported: original=current=accounting=full authorization.
    # Positive pending is legitimate before capture and after a refund.
    current = amount(totals, "current_order_total")
    original = amount(totals, "original_order_total")
    accounting = amount(totals, "accounting_total")
    credit = amount(totals, "credit_line_total")
    if credit != 0 or version != 1 or not (current == original == accounting == amount(p)) or current <= 0:
        raise RepairBlocked("order_change_or_credit_line_accounting_unsupported")
    for f, expected in (("paid_total", paid), ("refunded_total", refunded), ("transaction_total", net)):
        if amount(totals, f) != expected:
            raise RepairBlocked("preexisting_summary_mismatch")
    pending = amount(totals, "pending_difference")
    if pending != current - net or not (0 <= refunded <= paid <= current) or not (0 <= net <= current):
        raise RepairBlocked("preexisting_summary_contract_mismatch")
    if not existing:
        paid += max(signed, 0)
        refunded += max(-signed, 0)
        pending -= signed
        net += signed
    updates = {}
    for f, val in (("paid_total", paid), ("refunded_total", refunded), ("transaction_total", net), ("pending_difference", pending)):
        updates[f] = format(val, "f")
        updates["raw_" + f] = {**totals["raw_" + f], "value": format(val, "f")}
    # The SQL casts numeric JSON members; no floating point conversion in Python.
    if reference == "refund":
        if evidence.get("idempotency_key") != native["id"]:
            raise RepairBlocked("provider_refund_idempotency_binding_required")
        settlement, dispatch = _one(snapshot, "refund_settlement"), _one(snapshot, "commerce_refund_dispatch")
        plan = settlement["plan"]
        if settlement["scope_id"] != pc["id"] or settlement["order_id"] != order["id"] or settlement["phase"] not in ("refund_started", "refund_completed", "completed") or settlement.get("reversal_receipt_id") is not None or settlement.get("no_effect_receipt_id") is not None:
            raise RepairBlocked("settlement_binding_or_phase_mismatch")
        if any(plan.get(k) != settlement[k] for k in ("operation_id", "order_id", "scope_id")):
            raise RepairBlocked("settlement_plan_identity_mismatch")
        if decimal(plan.get("sellerReversal")) != 0 or decimal(plan.get("customerRefund")) != effect or plan.get("payment_id") != p["id"] or plan.get("split_order_payment_id") != split["id"] or plan.get("currency_code") != "eur":
            raise RepairBlocked("settlement_plan_mismatch")
        if any(dispatch.get(k) != v for k, v in {"refund_id": native["id"], "idempotency_key": native["id"], "operation_id": settlement["operation_id"], "scope_id": pc["id"], "payment_id": p["id"], "provider_id": p["provider_id"], "provider_payment_id": evidence["payment_intent"], "currency_code": "eur"}.items()) or decimal(dispatch["amount"]) != effect or dispatch["state"] not in ("started", "completed"):
            raise RepairBlocked("dispatch_binding_mismatch")
        if not p.get("captured_at") or amount(pc, "refunded_amount") not in (Decimal(0), effect) or amount(split, "captured_amount") != amount(p) or amount(split, "refunded_amount") not in (Decimal(0), effect) or amount(pc, "captured_amount") != amount(p):
            raise RepairBlocked("refund_accounting_shape_unsupported")
        split_refunded = effect
    else:
        tail = _one(snapshot, "marketplace_capture_tail")
        ts = tail["snapshot"]
        allocations = ts.get("allocations")
        if refunds or effect != amount(p) or tail["payment_id"] != p["id"] or tail["cart_id"] != link["cart_id"] or tail.get("capture_id") not in (None, native["id"]):
            raise RepairBlocked("capture_tail_binding_mismatch")
        binding = {"version": 1, "payment_id": p["id"], "cart_id": link["cart_id"], "collection_id": pc["id"], "intent_id": evidence["payment_intent"], "provider_id": p["provider_id"], "currency_code": "eur"}
        if any(ts.get(k) != v for k, v in binding.items()) or decimal(ts.get("amount")) != effect or not isinstance(allocations, list) or len(allocations) != 1:
            raise RepairBlocked("capture_snapshot_mismatch")
        a = allocations[0]
        if a.get("order_id") != order["id"] or a.get("version") != version or a.get("split_id") != split["id"] or a.get("currency_code") != "eur" or decimal(a.get("amount")) != effect:
            raise RepairBlocked("capture_allocation_mismatch")
        if amount(pc, "captured_amount") not in (Decimal(0), effect) or amount(split, "captured_amount") not in (Decimal(0), effect) or amount(split, "refunded_amount") != 0 or amount(pc, "refunded_amount") != 0 or split.get("status") not in ("pending", "captured"):
            raise RepairBlocked("capture_accounting_shape_unsupported")
        split_refunded = Decimal(0)
    proposal = {"cart_id": link["cart_id"], "scope_id": pc["id"], "order_id": order["id"], "version": version,
                "native_id": native["id"], "reference": reference, "signed_amount": format(signed, "f"),
                "insert_transaction": not existing, "summary_updates": updates,
                "collection_captured": format(amount(captures[0]), "f"),
                "collection_refunded": format(sum((amount(r) for r in refunds), Decimal(0)), "f"),
                "split_captured": format(amount(p), "f"), "split_refunded": format(split_refunded, "f"),
                "fully_closed": reference == "refund", "remaining_protocol": None if reference == "refund" else "real_redis_ack_and_runtime_tail_replay_required"}
    return _case(case_id, kind, "ready", None, snapshot, evidence, proposal)


def _case(case_id, kind, status, blocker, snapshot, evidence, proposal):
    body = {"case_id": case_id, "kind": kind, "status": status, "blocker": blocker, "snapshot": snapshot, "evidence": evidence, "proposal": proposal}
    return CasePlan(case_id, kind, status, blocker, canonical(snapshot), canonical(evidence), canonical(proposal), digest(body))


def build_plan(cases: Sequence[Mapping[str, Any]]) -> ReconciliationPlan:
    if len(cases) != 5:
        raise RepairBlocked("exactly_five_cases_required")
    planned = tuple(plan_case(c) for c in cases)
    if len({p.case_id for p in planned}) != 5 or sorted(p.kind for p in planned) != sorted(["refund_success"] * 2 + ["refund_no_effect"] * 2 + ["capture_success"]):
        raise RepairBlocked("five_case_identity_or_kind_mismatch")
    ready = [decode_json(p.proposal_json) for p in planned if p.status == "ready"]
    if len({p["scope_id"] for p in ready}) != len(ready) or len({p["cart_id"] for p in ready}) != len(ready):
        raise RepairBlocked("overlapping_cases_require_dedicated_batch_protocol")
    return ReconciliationPlan(planned, digest([p.as_dict() for p in planned]))


def _query(table: str, proposal: dict, snapshot: dict) -> tuple[str, tuple]:
    scope, oid = proposal["scope_id"], proposal["order_id"]
    if table == ORDER_COLLECTION_LINK:
        return "order_id=%s OR payment_collection_id=%s", (oid, scope)
    if table == ORDER_SPLIT_LINK:
        return "order_id=%s OR split_order_payment_id=%s", (oid, snapshot["split_order_payment"][0]["id"])
    if table == "payment":
        return "payment_collection_id=%s", (scope,)
    if table in ("capture", "refund"):
        return "payment_id IN (SELECT id FROM public.payment WHERE payment_collection_id=%s)", (scope,)
    if table in ("payment_collection",):
        return "id=%s", (scope,)
    if table in ("order",):
        return "id=%s", (oid,)
    if table in ("order_summary", "order_transaction"):
        return "order_id=%s", (oid,)
    if table == "split_order_payment":
        return "payment_collection_id=%s", (scope,)
    if table == "cart_payment_collection":
        return "cart_id=%s OR payment_collection_id=%s", (proposal["cart_id"], scope)
    if table in ("refund_settlement", "commerce_refund_dispatch"):
        return "scope_id=%s", (scope,)
    if table == "marketplace_capture_tail":
        return "cart_id=%s", (proposal["cart_id"],)
    raise RepairBlocked("unsupported_snapshot_table")


def _schema_check(gates: ApplyGates, kind: str) -> dict:
    try:
        schema = decode_json(gates.schema_snapshot_json)
    except (ValueError, TypeError):
        raise RepairBlocked("approved_schema_snapshot_required") from None
    if not isinstance(schema, dict) or any(not isinstance(schema.get(k), list) or any(not isinstance(r, dict) for r in schema[k]) for k in ("columns", "constraints", "triggers", "indexes")):
        raise RepairBlocked("approved_schema_snapshot_required")
    tables = schema_tables(kind)
    columns = {(c.get("table_name"), c.get("column_name")): c for c in schema["columns"]}
    if len(columns) != len(schema["columns"]):
        raise RepairBlocked("duplicate_schema_column")
    for table in tables:
        for field, expected_type in required_columns()[table].items():
            column = columns.get((table, field), {})
            actual_type = column.get("data_type")
            if actual_type != expected_type and not (expected_type == "text" and actual_type == "character varying"):
                raise RepairBlocked("schema_or_staged_audit_migration_missing:" + table + "." + field)
            if table == AUDIT_TABLE and column.get("is_nullable") != "NO":
                raise RepairBlocked("audit_not_null_contract_required")
    normalize = lambda s: " ".join(str(s).lower().replace('"', '').split())
    if not any(c.get("table") == AUDIT_TABLE and normalize(c.get("definition")) == "primary key (id)" for c in schema["constraints"]):
        raise RepairBlocked("audit_unique_identity_required")
    try:
        contract = decode_json(gates.guard_contract_json)
    except (TypeError, ValueError):
        raise RepairBlocked("independently_approved_guard_contract_required") from None
    if not isinstance(contract, dict):
        raise RepairBlocked("independently_approved_guard_contract_required")
    required = [("refund_settlement_guard_trigger", "refund_settlement", "refund_settlement_guard", ("insert", "update", "delete")), ("commerce_refund_dispatch_guard_trigger", "commerce_refund_dispatch", "commerce_refund_dispatch_guard", ("insert", "update", "delete"))] if kind == "refund_success" else [("marketplace_capture_tail_immutable", "marketplace_capture_tail", "marketplace_capture_tail_immutable", ("update", "delete"))]
    required += [("reconciliation_repair_audit_immutable", AUDIT_TABLE, "reconciliation_repair_audit_immutable", ("update", "delete")), ("reconciliation_repair_audit_no_truncate", AUDIT_TABLE, "reconciliation_repair_audit_immutable", ("truncate",))]
    for name, table, function, events in required:
        matches = [t for t in schema["triggers"] if t.get("name") == name and t.get("table") == table]
        if len(matches) != 1:
            raise RepairBlocked("installed_guards_required")
        trigger = matches[0]
        definition = normalize(trigger.get("definition")).replace("public.", "")
        expected_hash = contract.get(table + "." + name)
        level = "statement" if events == ("truncate",) else "row"
        if trigger.get("enabled") not in ("O", "A") or not isinstance(trigger.get("function"), str) or not expected_hash or digest(trigger["function"]) != expected_hash or "raise exception" not in normalize(trigger["function"]) or " before " not in definition or " when " in definition or any(event not in definition.split(" on ")[0].split() for event in events) or (" on " + table + " for each " + level + " ") not in definition or ("execute function " + function + "()") not in definition:
            raise RepairBlocked("installed_guards_required:contract_mismatch")
    if kind == "capture_success":
        expected = {"marketplace_order_capture_once": ("order_transaction", "(order_id, reference_id)", "reference = 'capture'", "reference_id is not null"), "marketplace_payment_full_capture_once": ("capture", "(payment_id)", "", "")}
        for name, (table, keys, predicate, nonnull) in expected.items():
            matches = [i for i in schema["indexes"] if i.get("indexname") == name and i.get("tablename") == table]
            definition = normalize(matches[0].get("indexdef")) if len(matches) == 1 else ""
            prefix = "create unique index " + name + " on public." + table + " using btree " + keys
            suffix = definition[len(prefix):] if definition.startswith(prefix) else "invalid"
            compact = lambda value: "".join(value.replace("::text", "").replace("(", "").replace(")", "").split())
            expected_suffix = " where " + predicate + " and " + nonnull if predicate else ""
            if not definition.startswith(prefix) or compact(suffix) != compact(expected_suffix):
                raise RepairBlocked("capture_unique_guards_required")
    return schema


def generate_sql(case: CasePlan, gates: ApplyGates) -> StatementBundle:
    """Executable bound statements, including preflight assertions and final audit.

    Gate references are explicit operator attestations, not invented DB auth tables.
    DB schema is rechecked inside transaction. Offline generation is NOT DB apply.
    """
    if case.status != "ready":
        raise RepairBlocked(case.blocker or "case_not_ready")
    # Reject hand-crafted or altered dataclass plans, rederive from immutable input.
    verified = plan_case({"case_id": case.case_id, "kind": case.kind, "snapshot": decode_json(case.snapshot_json), "evidence": decode_json(case.evidence_json)})
    if verified != case:
        raise RepairBlocked("plan_integrity_mismatch")
    if gates.sandbox is not True or gates.writers_fenced is not True or gates.expected_plan_hash != case.plan_hash:
        raise RepairBlocked("sandbox_writer_fence_and_expected_plan_required")
    for value in (gates.authorized_actor, gates.authorization_reference, gates.writer_fence_reference, gates.database, gates.schema_approval_reference):
        identifier(value)
    if gates.isolated_test_only is True and not isolated_test_database(gates.database):
        raise RepairBlocked("offline_evidence_requires_disposable_isolated_database")
    try:
        authenticate_evidence(decode_json(case.evidence_json), allow_test_only=gates.isolated_test_only is True)
    except EvidenceBlocked as exc:
        raise RepairBlocked(str(exc)) from None
    schema = _schema_check(gates, case.kind)
    p, s = decode_json(case.proposal_json), decode_json(case.snapshot_json)
    tables = schema_tables(case.kind)
    statements = [Statement("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"), Statement("SET LOCAL lock_timeout='2s'"), Statement("SET LOCAL statement_timeout='15s'"), Statement("SET LOCAL synchronous_commit=on"),
        Statement("SELECT current_database()=%s AND current_setting('session_replication_role')='origin' AND NOT pg_is_in_recovery()", (gates.database,), "true", "database_and_triggers"),
        Statement("SELECT pg_try_advisory_xact_lock(%s::bigint)", (lock_key("commerce-cart", p["cart_id"]),), "true", "cart_lock"),
        Statement("SELECT pg_try_advisory_xact_lock(%s::bigint)", (lock_key("refund-settlement", p["scope_id"]),), "true", "scope_lock")]
    if gates.isolated_test_only is True:
        statements.insert(5, Statement("SELECT shobj_description(oid,'pg_database')=%s FROM pg_database WHERE datname=current_database()", (ISOLATED_DATABASE_MARKER,), "true", "isolated_test_database_marker"))
    statements.append(Statement("SELECT NOT EXISTS (SELECT 1 FROM public.reconciliation_repair_audit WHERE id=%s OR (evidence->'provider'->>'account_id'=%s AND evidence->'provider'->>'provider_effect_id'=%s))", ("recon_" + case.plan_hash, decode_json(case.evidence_json)["account_id"], decode_json(case.evidence_json)["provider_effect_id"]), "true", "audit_duplicate_replay_refusal"))
    # ROW EXCLUSIVE prevents conflicting ALTER/DROP/TRIGGER DDL; it does not fence
    # ordinary writers. The explicit external writer-fence attestation is mandatory.
    statements.append(Statement("LOCK TABLE " + ", ".join('public."' + t + '"' for t in tables) + " IN ROW EXCLUSIVE MODE"))
    statements.append(Statement("SELECT (schema_snapshot=%s::jsonb) FROM (" + SCHEMA_SQL + ") q", (canonical(schema), list(tables), list(tables), list(tables), list(tables)), "true", "approved_live_schema"))
    for table in tables:
        if table == AUDIT_TABLE:
            continue
        where, params = _query(table, p, s)
        if table not in s:
            raise RepairBlocked("missing_snapshot_" + table)
        # Compare complete row sets without ordering dependence, includes soft deletes.
        sql = f'SELECT COALESCE(jsonb_agg(row_json ORDER BY row_json::text),\'[]\'::jsonb) = (SELECT COALESCE(jsonb_agg(v ORDER BY v::text),\'[]\'::jsonb) FROM jsonb_array_elements(%s::jsonb) v) FROM (SELECT to_jsonb(t) AS row_json FROM public."{table}" t WHERE {where} FOR UPDATE) locked'
        statements.append(Statement(sql, (canonical(s[table]), *params), "true", "snapshot_" + table))
    txid = "ordtx_recon_" + case.plan_hash[:32]
    if p["insert_transaction"]:
        statements.append(Statement("INSERT INTO public.order_transaction (id,order_id,version,amount,raw_amount,currency_code,reference,reference_id) VALUES (%s,%s,%s,%s::numeric,%s::jsonb,'eur',%s,%s) RETURNING id", (txid, p["order_id"], p["version"], p["signed_amount"], canonical({"value": p["signed_amount"], "precision": 20}), p["reference"], p["native_id"]), "one", "native_transaction"))
        updates = p["summary_updates"]
        sql = "UPDATE public.order_summary SET totals=totals || jsonb_build_object(" + ",".join("'" + f + "',%s::numeric" for f in ("paid_total", "refunded_total", "transaction_total", "pending_difference")) + ") || %s::jsonb, updated_at=now() WHERE id=%s AND version=%s AND deleted_at IS NULL RETURNING id"
        statements.append(Statement(sql, tuple(updates[f] for f in ("paid_total", "refunded_total", "transaction_total", "pending_difference")) + (canonical({k: v for k, v in updates.items() if k.startswith("raw_")}), s["order_summary"][0]["id"], p["version"]), "one", "summary_delta_preserving_other_totals"))
    pc = s["payment_collection"][0]
    statements.append(Statement("UPDATE public.payment_collection SET captured_amount=%s::numeric,raw_captured_amount=raw_captured_amount || jsonb_build_object('value',%s::text),refunded_amount=%s::numeric,raw_refunded_amount=raw_refunded_amount || jsonb_build_object('value',%s::text),status='completed',completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE id=%s AND deleted_at IS NULL RETURNING id", (p["collection_captured"],p["collection_captured"],p["collection_refunded"],p["collection_refunded"],pc["id"]), "one", "collection_gross_totals"))
    statements.append(Statement("UPDATE public.split_order_payment SET captured_amount=%s::numeric,raw_captured_amount=raw_captured_amount || jsonb_build_object('value',%s::text),refunded_amount=%s::numeric,raw_refunded_amount=raw_refunded_amount || jsonb_build_object('value',%s::text),status=%s,updated_at=now() WHERE id=%s AND deleted_at IS NULL RETURNING id", (p["split_captured"],p["split_captured"],p["split_refunded"],p["split_refunded"],"captured" if p["reference"] == "capture" else ("refunded" if decimal(p["split_refunded"]) == decimal(p["split_captured"]) else "partially_refunded"),s["split_order_payment"][0]["id"]), "one", "split_accounting"))
    if p["reference"] == "refund":
        settlement = s["refund_settlement"][0]
        phase = settlement["phase"]
        for next_phase in (("refund_completed", "completed") if phase == "refund_started" else (("completed",) if phase == "refund_completed" else ())):
            statements.append(Statement("UPDATE public.refund_settlement SET phase=%s,updated_at=now() WHERE operation_id=%s AND scope_id=%s AND phase=%s AND (plan->>'sellerReversal')::numeric=0 RETURNING operation_id", (next_phase,settlement["operation_id"],p["scope_id"],phase), "one", "legal_settlement_forward_transition"))
            phase = next_phase
        if s["commerce_refund_dispatch"][0]["state"] == "started":
            statements.append(Statement("UPDATE public.commerce_refund_dispatch SET state='completed',updated_at=now() WHERE refund_id=%s AND scope_id=%s AND state='started' RETURNING refund_id", (p["native_id"],p["scope_id"]), "one", "legal_dispatch_transition"))
    else:
        statements.append(Statement("UPDATE public.payment SET captured_at=COALESCE(captured_at,now()),updated_at=now() WHERE id=%s AND canceled_at IS NULL AND deleted_at IS NULL RETURNING id", (s["payment"][0]["id"],), "one", "provider_confirmed_full_capture"))
        statements.append(Statement("UPDATE public.marketplace_capture_tail SET capture_id=COALESCE(capture_id,%s),accounting_at=COALESCE(accounting_at,now()),updated_at=now() WHERE payment_id=%s AND (capture_id IS NULL OR capture_id=%s) RETURNING payment_id", (p["native_id"],s["payment"][0]["id"],p["native_id"]), "one", "bookkeeping_only_no_redis_ack"))
    # Assert actual native postconditions before the audit/commit, including JSON raw parity.
    statements.append(Statement("SELECT (SELECT count(*) FROM public.order_transaction WHERE order_id=%s AND reference=%s AND reference_id=%s)=1 AND EXISTS (SELECT 1 FROM public.order_transaction WHERE order_id=%s AND reference=%s AND reference_id=%s AND deleted_at IS NULL AND version=%s AND currency_code='eur' AND amount=%s::numeric AND (raw_amount->>'value')::numeric=amount)", (p["order_id"],p["reference"],p["native_id"],p["order_id"],p["reference"],p["native_id"],p["version"],p["signed_amount"]), "true", "actual_transaction_postcondition"))
    statements.append(Statement("SELECT EXISTS (SELECT 1 FROM public.order_summary WHERE id=%s AND deleted_at IS NULL AND (totals->>'transaction_total')::numeric=%s::numeric AND (totals->'raw_transaction_total'->>'value')::numeric=%s::numeric AND (totals->>'pending_difference')::numeric=%s::numeric AND (totals->'raw_pending_difference'->>'value')::numeric=%s::numeric) AND EXISTS (SELECT 1 FROM public.payment_collection WHERE id=%s AND captured_amount=%s::numeric AND refunded_amount=%s::numeric AND status='completed')", (s["order_summary"][0]["id"],p["summary_updates"]["transaction_total"],p["summary_updates"]["transaction_total"],p["summary_updates"]["pending_difference"],p["summary_updates"]["pending_difference"],pc["id"],p["collection_captured"],p["collection_refunded"]), "true", "actual_summary_collection_postcondition"))
    # Full bounded after-row contracts, including unchanged fields and raw metadata.
    def after_row(table, before, numeric=None, values=None, timestamps=(), totals=None):
        numeric, values = numeric or {}, values or {}
        ignored = ["updated_at", *numeric, *values, *timestamps]
        if totals is not None:
            ignored.append("totals")
        where, params = _query(table, p, s)
        clauses = ["(to_jsonb(t) - %s::text[]) = (%s::jsonb - %s::text[])"]
        args = [ignored, canonical(before), ignored]
        for field, value in numeric.items():
            clauses.append('t."' + field + '"=%s::numeric')
            args.append(value)
        for field, value in values.items():
            clauses.append('to_jsonb(t)->%s = %s::jsonb')
            args.extend((field, canonical(value)))
        for field in timestamps:
            clauses.append('t."' + field + '" IS NOT NULL')
            if before.get(field) is not None:
                clauses.append('to_jsonb(t)->%s = %s::jsonb')
                args.extend((field, canonical(before[field])))
        if totals is not None:
            fields = list(p["summary_updates"])
            clauses.append("(t.totals - %s::text[]) = (%s::jsonb - %s::text[])")
            args.extend((fields, canonical(before["totals"]), fields))
            for field, value in totals.items():
                if field.startswith("raw_"):
                    clauses.append("t.totals->%s = %s::jsonb")
                    args.extend((field, canonical(value)))
                else:
                    clauses.append("(t.totals->>%s)::numeric = %s::numeric")
                    args.extend((field, value))
        condition = " AND ".join("(" + clause + ")" for clause in clauses)
        return Statement('SELECT count(*)=1 AND COALESCE(bool_and(COALESCE(' + condition + ',FALSE)),FALSE) FROM public."' + table + '" t WHERE ' + where, (*args, *params), "true")

    collection_numeric = {"captured_amount": p["collection_captured"], "refunded_amount": p["collection_refunded"]}
    collection_values = {"status": "completed", **{"raw_" + f: {**pc["raw_" + f], "value": value} for f, value in collection_numeric.items()}}
    statements.append(replace_statement_label(after_row("payment_collection", pc, collection_numeric, collection_values, ("completed_at",)), "actual_collection_postcondition"))
    statements.append(replace_statement_label(after_row("order_summary", s["order_summary"][0], totals=p["summary_updates"]), "actual_summary_postcondition"))
    split_before = s["split_order_payment"][0]
    split_numeric = {"captured_amount": p["split_captured"], "refunded_amount": p["split_refunded"]}
    split_status = "captured" if p["reference"] == "capture" else ("refunded" if decimal(p["split_refunded"]) == decimal(p["split_captured"]) else "partially_refunded")
    split_values = {"status": split_status, **{"raw_" + f: {**split_before["raw_" + f], "value": value} for f, value in split_numeric.items()}}
    statements.append(replace_statement_label(after_row("split_order_payment", split_before, split_numeric, split_values), "actual_split_postcondition"))
    statements.append(replace_statement_label(after_row("payment", s["payment"][0], timestamps=("captured_at",)), "actual_payment_postcondition"))
    for table in (ORDER_COLLECTION_LINK, ORDER_SPLIT_LINK, "capture", "refund", "order", "cart_payment_collection"):
        where, params = _query(table, p, s)
        statements.append(Statement('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\'::jsonb) = (SELECT COALESCE(jsonb_agg(v ORDER BY v::text),\'[]\'::jsonb) FROM jsonb_array_elements(%s::jsonb) v) FROM public."' + table + '" t WHERE ' + where, (canonical(s[table]), *params), "true", "actual_native_links_postcondition" if table in (ORDER_COLLECTION_LINK, ORDER_SPLIT_LINK) else "actual_unchanged_" + table + "_postcondition"))
    # Existing transactions are never mutated: compare EVERY column, including
    # created_at/updated_at, optional native identities and unknown JSON metadata.
    # A new row has a separate complete expected contract from explicit INSERT
    # values + approved defaults. No column subtraction or blanket system ignore.
    where, params = _query("order_transaction", p, s)
    if p["insert_transaction"]:
        where += " AND id<>%s"
        params = (*params, txid)
    statements.append(Statement('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\'::jsonb) = (SELECT COALESCE(jsonb_agg(v ORDER BY v::text),\'[]\'::jsonb) FROM jsonb_array_elements(%s::jsonb) v) FROM public.order_transaction t WHERE ' + where, (canonical(s["order_transaction"]), *params), "true", "actual_all_transactions_postcondition"))
    if p["insert_transaction"]:
        expected_new = {"id": txid, "order_id": p["order_id"], "version": p["version"],
                        "currency_code": "eur", "reference": p["reference"],
                        "reference_id": p["native_id"], "amount": decimal(p["signed_amount"]),
                        "raw_amount": {"value": p["signed_amount"], "precision": 20},
                        "deleted_at": None}
        default_timestamps = []
        for column in schema["columns"]:
            if column.get("table_name") != "order_transaction":
                continue
            field = column["column_name"]
            if field in expected_new:
                continue
            default = column.get("column_default")
            if field in ("created_at", "updated_at") and column.get("data_type") == "timestamp with time zone" and default in ("now()", "CURRENT_TIMESTAMP", "transaction_timestamp()"):
                default_timestamps.append(field)
            elif default is None and column.get("is_nullable") == "YES":
                expected_new[field] = None
            else:
                raise RepairBlocked("unsupported_new_transaction_default:" + field)
        expected_sql = "%s::jsonb"
        if default_timestamps:
            expected_sql += " || jsonb_build_object(" + ",".join("'" + field + "',now()" for field in default_timestamps) + ")"
        statements.append(Statement("SELECT count(*)=1 AND COALESCE(bool_and(COALESCE(to_jsonb(t)=(" + expected_sql + "),FALSE)),FALSE) FROM public.order_transaction t WHERE order_id=%s AND id=%s", (canonical(expected_new), p["order_id"], txid), "true", "actual_new_transaction_postcondition"))
    if p["reference"] == "refund":
        statements.append(replace_statement_label(after_row("refund_settlement", s["refund_settlement"][0], values={"phase": "completed"}), "actual_settlement_postcondition"))
        statements.append(replace_statement_label(after_row("commerce_refund_dispatch", s["commerce_refund_dispatch"][0], values={"state": "completed"}), "actual_dispatch_postcondition"))
    else:
        statements.append(replace_statement_label(after_row("marketplace_capture_tail", s["marketplace_capture_tail"][0], values={"capture_id": p["native_id"]}, timestamps=("accounting_at",)), "actual_capture_tail_postcondition"))
    # Audit reads actual after rows in the SAME transaction, never just a proposal.
    parts, after_params = [], []
    for table in tables:
        if table == AUDIT_TABLE:
            continue
        where, params = _query(table, p, s)
        parts.append("'" + table + "', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.\"" + table + '\" t WHERE ' + where + ")")
        after_params.extend(params)
    audit_evidence = {"provider": decode_json(case.evidence_json), "authorization_reference": gates.authorization_reference, "writer_fence_reference": gates.writer_fence_reference, "schema_approval_reference": gates.schema_approval_reference, "fully_closed": p["fully_closed"], "remaining_protocol": p["remaining_protocol"]}
    audit_evidence["approved_guard_contract"] = decode_json(gates.guard_contract_json)
    sql = "INSERT INTO public.reconciliation_repair_audit (id,plan_hash,case_id,actor,evidence,before_snapshot,after_snapshot,created_at) VALUES (%s,%s,%s,%s,%s::jsonb,%s::jsonb,jsonb_build_object(" + ",".join(parts) + "),now()) RETURNING id"
    audit_id = "recon_" + case.plan_hash
    statements.append(Statement(sql, (audit_id,case.plan_hash,case.case_id,gates.authorized_actor,canonical(audit_evidence),case.snapshot_json,*after_params), "one", "atomic_audit_insert"))
    statements.append(Statement("SELECT id FROM public.reconciliation_repair_audit WHERE id=%s AND plan_hash=%s AND case_id=%s AND actor=%s AND evidence=%s::jsonb AND before_snapshot=%s::jsonb AND after_snapshot=jsonb_build_object(" + ",".join(parts) + ") AND created_at IS NOT NULL", (audit_id,case.plan_hash,case.case_id,gates.authorized_actor,canonical(audit_evidence),case.snapshot_json,*after_params), "one", "atomic_actual_after_audit"))
    return StatementBundle(case, gates, canonical([{"sql": st.sql, "params": st.params, "expect": st.expect, "label": st.label} for st in statements]))


def apply_case(connection: Any, case: CasePlan, gates: ApplyGates) -> dict:
    """Preferred real apply facade: validate immutable plan/gates, then execute atomically."""
    return execute_transaction(connection, generate_sql(case, gates))


def execute_transaction(connection: Any, statements: Sequence[Statement]) -> dict:
    """Real psycopg3-compatible execution path; does not connect or call providers.

    Caller supplies an explicitly authorized sandbox connection. Exceptions roll
    back ALL writes + audit. No retry; ambiguous commit requires fresh discovery.
    """
    if not isinstance(statements, StatementBundle) or statements != generate_sql(statements.case, statements.gates):
        raise RepairBlocked("complete_gated_statement_bundle_required:integrity")
    return _execute_transaction(connection, tuple(statements))


def _execute_transaction(connection: Any, statements: tuple[Statement, ...]) -> dict:
    """Internal raw executor, reached only after exact regeneration of the bundle."""
    if not getattr(connection, "autocommit", False):
        raise RepairBlocked("idle_autocommit_connection_required")
    info = getattr(connection, "info", None)
    if info is not None and int(info.transaction_status) != 0:
        raise RepairBlocked("outer_transaction_forbidden")
    labels = [s.label for s in statements]
    required = {"database_and_triggers", "cart_lock", "scope_lock", "approved_live_schema", "collection_gross_totals", "split_accounting"}
    required.update("snapshot_" + t for t in COMMON_TABLES)
    capture_bundle = "bookkeeping_only_no_redis_ack" in labels
    required.update({"snapshot_marketplace_capture_tail", "provider_confirmed_full_capture", "bookkeeping_only_no_redis_ack"} if capture_bundle else {"snapshot_refund_settlement", "snapshot_commerce_refund_dispatch"})
    if not labels or labels[-1] != "atomic_actual_after_audit" or required - set(labels):
        raise RepairBlocked("complete_gated_statement_bundle_required")
    if labels.index("cart_lock") >= labels.index("scope_lock") or any(labels.index(k) > next((i for i,s in enumerate(statements) if s.sql.startswith(("INSERT", "UPDATE"))), len(labels)) for k in required if k.startswith("snapshot_") or k == "approved_live_schema"):
        raise RepairBlocked("preflight_before_mutation_and_cart_scope_order_required")
    with connection.transaction():
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement.sql, statement.params)
                if statement.expect == "true":
                    row = cursor.fetchone()
                    if row is None or row[0] is not True:
                        raise RepairBlocked("assertion_failed:" + statement.label)
                elif statement.expect == "one":
                    if cursor.rowcount != 1 or cursor.fetchone() is None:
                        raise RepairBlocked("rowcount_failed:" + statement.label)
    return {"committed": True, "statements": len(statements), "audit_in_same_transaction": True,
            "provider_calls": 0, "scope": "native_bookkeeping_only"}
