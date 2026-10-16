"""Docker/psql sandbox reader; never connects to an arbitrary database.

scan_runtime(path) -> {rows, counts, issues, complete, database}.
Two read-only transactions: discover schema first, then recheck that schema inside
one repeatable-read full scan. Only explicit finance columns are selected; payment
JSON is reduced to its intent id and order customer fields are NEVER selected.
This is a normalized accounting snapshot, NOT a complete raw repair snapshot.
Do not feed these projections to native_repair.plan_case.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import stat
import subprocess
from decimal import Decimal, InvalidOperation


class DBReadBlocked(ValueError):
    pass


SANDBOXES = {
    "hobbysalon_e2e_gate_53332bce": ("hs-gate-pg-53332bce", "hs-gate-app-53332bce"),
    "hobbysalon_e2e_fixed_3bea5f66": ("hs-gate-pg-53332bce", "hs-fixed-app-3bea5f66"),
}
# Never to_jsonb(order), payment.data, metadata, notes, provider responses or emails.
FIELDS = {
    "payment": "id payment_collection_id provider_id currency_code captured_at canceled_at deleted_at amount raw_amount updated_at",
    "payment_collection": "id currency_code status completed_at deleted_at amount raw_amount authorized_amount raw_authorized_amount captured_amount raw_captured_amount refunded_amount raw_refunded_amount updated_at",
    "capture": "id payment_id amount raw_amount deleted_at",
    "refund": "id payment_id amount raw_amount deleted_at",
    "order": "id version currency_code deleted_at",
    "order_summary": "id order_id version totals deleted_at",
    "order_transaction": "id order_id version currency_code reference reference_id amount raw_amount deleted_at",
    "split_order_payment": "id payment_collection_id currency_code status authorized_amount raw_authorized_amount captured_amount raw_captured_amount refunded_amount raw_refunded_amount deleted_at updated_at",
    "cart_payment_collection": "cart_id payment_collection_id deleted_at",
    "order_payment_collection": "order_id payment_collection_id deleted_at",
    "order_order_split_order_payment_split_order_payment": "order_id split_order_payment_id deleted_at",
    "refund_settlement": "operation_id order_id scope_id plan phase reversal_receipt_id updated_at",
    "commerce_refund_dispatch": "refund_id idempotency_key operation_id scope_id payment_id provider_id provider_payment_id currency_code amount state updated_at",
    "marketplace_capture_tail": "payment_id cart_id capture_id snapshot accounting_at event_enqueued_at completed_at updated_at",
}
OPTIONAL = {"refund_settlement", "commerce_refund_dispatch", "marketplace_capture_tail"}


def private_json(path):
    """Owner-only config/runtime file. Errors intentionally hide content and paths."""
    try:
        path = Path(path).expanduser()
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "r", encoding="utf-8") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_size > 65536:
                raise DBReadBlocked("private_owner_file_required")
            result = json.load(stream)
        if not isinstance(result, dict):
            raise DBReadBlocked("json_object_required")
        return result
    except DBReadBlocked:
        raise
    except Exception:
        raise DBReadBlocked("private_file_read_failed") from None


def validate_runtime(path):
    if Path(path).is_dir():
        path = Path(path) / "state.json"
    state = private_json(path)
    db, pg, app = (state.get(k) for k in ("db", "pg", "app"))
    if db not in SANDBOXES or SANDBOXES[db] != (pg, app) or state.get("production_release") is True:
        raise DBReadBlocked("sandbox_allowlist_required")
    return {"db": db, "pg": pg, "app": app}


def _schema_sql():
    names = ",".join("'" + t + "'" for t in FIELDS)
    return ("SELECT COALESCE(jsonb_agg(jsonb_build_object('table_name',table_name,'column_name',column_name,'data_type',data_type) "
            "ORDER BY table_name,ordinal_position),'[]'::jsonb) FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name IN (" + names + ")")


def _psql(runtime, sql, runner=None):
    command = ["docker", "exec", "-i", runtime["pg"], "psql", "-X", "-qAt", "-h", "/var/run/postgresql", "-p", "5432", "-U", "gate", "-d", runtime["db"], "-v", "ON_ERROR_STOP=1"]
    script = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='3s';\n" + sql + ";\nROLLBACK;\n"
    try:
        result = (runner or subprocess.run)(command, input=script, text=True, capture_output=True, timeout=45, check=False)
        if result.returncode or len(result.stdout) > 20_000_000:
            raise DBReadBlocked("database_read_failed_or_bound_exceeded")
        return [json.loads(line, parse_float=Decimal) for line in result.stdout.splitlines() if line.strip()]
    except DBReadBlocked:
        raise
    except Exception:
        raise DBReadBlocked("database_read_failed") from None


def _validate_schema(schema):
    if not isinstance(schema, list):
        raise DBReadBlocked("schema_snapshot_required")
    columns = {}
    for row in schema:
        columns.setdefault(row["table_name"], {})[row["column_name"]] = row["data_type"]
    for table, fields in FIELDS.items():
        if table not in columns and table in OPTIONAL:
            continue
        for field in fields.split() + (["data"] if table == "payment" else []):
            kind = columns.get(table, {}).get(field)
            expected = ("numeric",) if field == "amount" or field.endswith("_amount") and not field.startswith("raw_") else None
            if field.startswith("raw_") or field in ("data", "totals", "plan", "snapshot"):
                expected = ("jsonb",)
            if field == "version":
                expected = ("integer",)
            if kind is None or expected and kind not in expected:
                raise DBReadBlocked("required_financial_schema_missing_or_changed")
    return columns


def _projection_sql(table):
    pairs = []
    for field in FIELDS[table].split():
        expr = 'r."' + field + '"'
        if field == "amount" or field.endswith("_amount") and not field.startswith("raw_"):
            expr += "::text"
        if field in ("plan", "snapshot"):
            keys = ("operation_id order_id scope_id payment_id currency_code customerRefund sellerReversal payout_id split_order_payment_id" if field == "plan" else
                    "version cart_id collection_id payment_id intent_id provider_id currency_code amount allocations")
            expr = "jsonb_build_object(" + ",".join("'" + k + "',r.\"" + field + "\"->'" + k + "'" for k in keys.split()) + ")"
        pairs.extend(["'" + field + "'", expr])
    if table == "payment":
        pairs.extend(["'payment_intent'", "r.data->>'id'"])
    if table == "refund_settlement":
        # Optional candidate column: whole-row JSON tolerates old schemas without
        # the column, but never hides a marker from a newer/forged row.
        pairs.extend(["'no_effect_receipt_id'", "to_jsonb(r)->>'no_effect_receipt_id'"])
    # No WHERE filters: scan deleted rows and orphan records too. Bound overflow blocks.
    return ("'" + table + "', COALESCE((SELECT jsonb_agg(j) FROM (SELECT jsonb_build_object(" + ",".join(pairs) +
            ') AS j FROM public."' + table + '" r LIMIT 100001) q),\'[]\'::jsonb)')


def _money(value):
    try:
        if isinstance(value, (bool, float)) or value is None:
            raise ValueError
        result = Decimal(value)
        if not result.is_finite() or len(result.as_tuple().digits) > 40 or abs(result.adjusted()) > 40 or result != result.quantize(Decimal(".01")):
            raise ValueError
        return result
    except (ValueError, InvalidOperation, TypeError):
        raise DBReadBlocked("exact_financial_amount_required") from None


def _active(rows):
    return [r for r in rows if r.get("deleted_at") is None]


SUMMARY_FIELDS = "paid_total refunded_total transaction_total pending_difference original_order_total current_order_total credit_line_total accounting_total".split()


def _raw_issues(record, fields, *, nullable=False):
    reasons = []
    for field in fields:
        try:
            raw = record.get("raw_" + field)
            # Native nullable collection aggregates may be unset together; not a
            # malformed amount or permission to accept one-sided missing raw data.
            if nullable and field != "amount" and record.get(field) is None and raw is None:
                continue
            numeric = _money(record.get(field))
            if (not isinstance(raw, dict) or not isinstance(raw.get("value"), str) or
                    type(raw.get("precision")) is not int or not 1 <= raw["precision"] <= 100):
                reasons.append("raw_numeric_field_invalid")
            elif _money(raw["value"]) != numeric:
                reasons.append("raw_numeric_mismatch")
        except DBReadBlocked:
            reasons.append("raw_numeric_field_invalid")
    return reasons


def _settlement_shape_issues(settlement):
    """Only zero seller reversal is proven; receipts do not prove payout effects."""
    if settlement.get("no_effect_receipt_id") is not None:
        return ["unsupported_no_effect_receipt_marker"]
    plan = settlement.get("plan")
    if not isinstance(plan, dict): return ["malformed_settlement_plan"]
    try:
        reversal = _money(plan.get("sellerReversal"))
    except DBReadBlocked:
        return ["malformed_seller_reversal"]
    if reversal != 0 or settlement.get("reversal_receipt_id") is not None:
        return ["unsupported_seller_reversal_shape"]
    payout = plan.get("payout_id")
    if payout is not None and (not isinstance(payout, str) or not re.fullmatch(r"[A-Za-z0-9_:\-]{1,255}", payout)):
        return ["malformed_seller_reversal"]
    return []


def _dispatch_valid(d, snapshot):
    """Immutable operation binding; equal money and row existence are not completion."""
    ps = [p for p in snapshot["payment"] if p["id"] == d.get("payment_id")]
    rs = [r for r in snapshot["refund"] if r["id"] == d.get("refund_id")]
    ss = [s for s in snapshot.get("refund_settlement", []) if s["operation_id"] == d.get("operation_id")]
    if len(ps) != 1 or len(rs) != 1 or len(ss) != 1: return False
    p, r, s = ps[0], rs[0], ss[0]
    plan = s.get("plan")
    if not isinstance(plan, dict) or _settlement_shape_issues(s): return False
    links = [x for x in _active(snapshot["order_payment_collection"]) if x["payment_collection_id"] == p["payment_collection_id"]]
    split_links = [x for x in _active(snapshot["order_order_split_order_payment_split_order_payment"]) if x["order_id"] == s["order_id"]]
    unique = all(len([x for x in snapshot.get("commerce_refund_dispatch", []) if x.get(k) == d.get(k)]) == 1
                 for k in ("refund_id", "idempotency_key", "operation_id"))
    try:
        return (unique and p.get("deleted_at") is None and r.get("deleted_at") is None and
                r["payment_id"] == p["id"] and d.get("idempotency_key") == r["id"] and
                d.get("provider_id") == p.get("provider_id") == "pp_card_stripe-connect" and
                d.get("provider_payment_id") == p.get("payment_intent") and
                d.get("currency_code") == p.get("currency_code") == plan.get("currency_code") and
                d.get("scope_id") == s["scope_id"] == p["payment_collection_id"] == plan.get("scope_id") and
                plan.get("operation_id") == s["operation_id"] and plan.get("order_id") == s["order_id"] and
                plan.get("payment_id") == p["id"] and len(links) == 1 and links[0]["order_id"] == s["order_id"] and
                len(split_links) == 1 and split_links[0]["split_order_payment_id"] == plan.get("split_order_payment_id") and
                _money(d.get("amount")) == _money(r.get("amount")) == _money(plan.get("customerRefund")) > 0)
    except DBReadBlocked: return False


def normalize(snapshot):
    """Derive completion from durable accounting, not row existence or HTTP return."""
    rows, issues = [], []
    payments = snapshot["payment"]
    # Validate identifiers before any comparison can echo a native effect id.
    # Free-form statuses/keys remain internal; only fixed reason codes are reported.
    for table, records in snapshot.items():
        for record in records:
            required = [f for f in FIELDS[table].split() if (f == "id" or f.endswith("_id")) and f not in ("capture_id", "reversal_receipt_id")]
            if table == "commerce_refund_dispatch": required.append("idempotency_key")
            if any(record.get(field) is None for field in required):
                raise DBReadBlocked("required_native_identity_missing")
            for field, value in record.items():
                if (field == "id" or field.endswith("_id") or field == "reference_id") and value is not None:
                    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_:\-]{1,255}", value):
                        raise DBReadBlocked("safe_native_identity_required")
    for table, records in snapshot.items():
        ids = [r["id"] for r in records if "id" in r]
        if len(ids) != len(set(ids)): issues.append("duplicate_native_identity")
        for r in records:
            fields = [f for f in FIELDS[table].split() if f == "amount" or f.endswith("_amount") and not f.startswith("raw_")]
            if table != "commerce_refund_dispatch": issues.extend(_raw_issues(r, fields, nullable=table == "payment_collection"))
    payment_ids = {p["id"] for p in payments}
    effects = {k: {e["id"] for e in snapshot[k]} for k in ("capture", "refund")}
    for kind in ("capture", "refund"):
        if any(e["payment_id"] not in payment_ids for e in snapshot[kind]):
            issues.append("orphan_native_" + kind)
    if any(t["reference"] not in effects or t["reference_id"] not in effects.get(t["reference"], set()) for t in snapshot["order_transaction"]):
        issues.append("unbound_order_transaction")
    # Native marketplace refund transactions reference the durable operation id,
    # not refund.id. Resolve ONLY a unique dispatch binding, never amount alone.
    resolved_transactions = []
    for transaction in snapshot["order_transaction"]:
        t = dict(transaction)
        if t["reference"] == "refund" and t["reference_id"] not in effects["refund"]:
            bindings = [d for d in snapshot.get("commerce_refund_dispatch", []) if d["operation_id"] == t["reference_id"] and d["refund_id"] in effects["refund"]]
            if len(bindings) == 1 and _dispatch_valid(bindings[0], snapshot):
                t["reference_id"] = bindings[0]["refund_id"]
        resolved_transactions.append(t)
    issues = [i for i in issues if i != "unbound_order_transaction"]
    if any(t["reference"] not in effects or t["reference_id"] not in effects.get(t["reference"], set()) for t in resolved_transactions):
        issues.append("unbound_order_transaction")
    used_collections = {p["payment_collection_id"] for p in payments}
    collection_ids_all = {c["id"] for c in snapshot["payment_collection"]}
    for link in snapshot["cart_payment_collection"]:
        if link["payment_collection_id"] not in collection_ids_all:
            issues.append("orphan_cart_collection_binding")
    order_ids_all = {o["id"] for o in snapshot["order"]}
    split_ids_all = {s["id"] for s in snapshot["split_order_payment"]}
    for link in snapshot["order_payment_collection"]:
        if link["order_id"] not in order_ids_all or link["payment_collection_id"] not in used_collections: issues.append("orphan_order_collection_binding")
    for link in snapshot["order_order_split_order_payment_split_order_payment"]:
        if link["order_id"] not in order_ids_all or link["split_order_payment_id"] not in split_ids_all: issues.append("orphan_order_split_binding")
    for s in snapshot["split_order_payment"]:
        if s["payment_collection_id"] not in used_collections: issues.append("orphan_split_payment")
    for s in snapshot["order_summary"]:
        if s["order_id"] not in order_ids_all: issues.append("orphan_order_summary")
        if not isinstance(s.get("totals"), dict): issues.append("summary_numeric_fields_invalid")
        else: issues.extend(_raw_issues(s["totals"], SUMMARY_FIELDS))
    dispatches_all = snapshot.get("commerce_refund_dispatch", [])
    if any(d["payment_id"] not in payment_ids or d["refund_id"] not in effects["refund"] or d["scope_id"] not in used_collections for d in dispatches_all):
        issues.append("orphan_refund_dispatch")
    if any(not _dispatch_valid(d, snapshot) for d in dispatches_all): issues.append("dispatch_identity_binding_mismatch")
    if any(t["payment_id"] not in payment_ids or (t["capture_id"] is not None and t["capture_id"] not in effects["capture"]) for t in snapshot.get("marketplace_capture_tail", [])):
        issues.append("orphan_capture_tail")
    if any(s["order_id"] not in order_ids_all or s["scope_id"] not in used_collections for s in snapshot.get("refund_settlement", [])):
        issues.append("orphan_refund_settlement")
    for settlement in snapshot.get("refund_settlement", []):
        issues.extend(_settlement_shape_issues(settlement))
    if any(s["phase"] != "completed" for s in snapshot.get("refund_settlement", [])):
        issues.append("unfinished_settlement_inventory")
    if any(d["state"] != "completed" for d in dispatches_all):
        issues.append("unfinished_dispatch_inventory")
    if any(not t["completed_at"] or not t["accounting_at"] or not t["event_enqueued_at"] for t in snapshot.get("marketplace_capture_tail", [])):
        issues.append("unfinished_capture_tail_inventory")
    for col in snapshot["payment_collection"]:
        if col["id"] not in used_collections and (_money(col["captured_amount"] or "0") or _money(col["refunded_amount"] or "0")):
            issues.append("orphan_financial_collection")
    for p in payments:
        pi = p.get("payment_intent")
        if not isinstance(pi, str) or not re.fullmatch(r"pi_[A-Za-z0-9]{1,200}", pi):
            issues.append("unrecognized_native_payment")
            continue
        q = []
        collection_id = p["payment_collection_id"]
        collection_rows = [c for c in snapshot["payment_collection"] if c["id"] == collection_id]
        shared = len([x for x in payments if x["payment_collection_id"] == collection_id]) != 1
        if len(collection_rows) != 1 or shared:
            q.append("missing_or_shared_collection")
        collection = collection_rows[0] if len(collection_rows) == 1 and not shared else {}
        bindings = [x for x in snapshot["order_payment_collection"] if x["payment_collection_id"] == collection_id]
        if len(bindings) != 1:
            q.append("ambiguous_order_binding")
        order_ids = {x["order_id"] for x in bindings}
        orders = [o for o in snapshot["order"] if o["id"] in order_ids]
        if len(orders) != 1:
            q.append("missing_or_ambiguous_order")
        current = {(o["id"], o["version"]) for o in _active(orders)}
        if any(type(o.get("version")) is not int or o["version"] < 1 for o in orders): q.append("invalid_order_version")
        if p.get("provider_id") != "pp_card_stripe-connect": q.append("provider_binding_mismatch")
        if p.get("currency_code") != "eur" or any(o["currency_code"] != p["currency_code"] for o in orders): q.append("currency_binding_mismatch")
        carts = [x for x in snapshot["cart_payment_collection"] if x["payment_collection_id"] == collection_id]
        if len(carts) != 1: q.append("missing_or_ambiguous_cart_binding")
        native_effects = {k: [e for e in snapshot[k] if e["payment_id"] == p["id"]] for k in ("capture", "refund")}
        if not native_effects["capture"]: q.append("unsupported_no_capture_effect")
        if (p.get("canceled_at") is not None or
                bool(p.get("captured_at")) and (collection.get("status") != "completed" or not collection.get("completed_at"))):
            q.append("unsupported_native_completion_shape")
        transactions = [t for t in resolved_transactions if t["reference"] in native_effects and t["reference_id"] in {e["id"] for e in native_effects[t["reference"]]}]
        if any(t["deleted_at"] is not None or (t["order_id"], t["version"]) not in current or t["currency_code"] != p["currency_code"] for t in transactions):
            q.append("deleted_unbound_or_stale_transaction")
        tx = [t for t in _active(transactions) if (t["order_id"], t["version"]) in current and t["currency_code"] == p["currency_code"]]
        settlements = [s for s in snapshot.get("refund_settlement", []) if s["scope_id"] == collection_id or s["order_id"] in order_ids]
        dispatches = [d for d in snapshot.get("commerce_refund_dispatch", []) if d["payment_id"] == p["id"] or d["scope_id"] == collection_id]
        tails = [t for t in snapshot.get("marketplace_capture_tail", []) if t["payment_id"] == p["id"]]
        if any(s["phase"] != "completed" for s in settlements): q.append("unfinished_settlement")
        if any(d["state"] != "completed" for d in dispatches): q.append("unfinished_dispatch")
        if any(not t["completed_at"] or not t["accounting_at"] or not t["event_enqueued_at"] for t in tails): q.append("unfinished_capture_tail")
        splits = [s for s in snapshot["split_order_payment"] if s["payment_collection_id"] == collection_id]
        split_links = [s for s in snapshot["order_order_split_order_payment_split_order_payment"] if s["split_order_payment_id"] in {x["id"] for x in splits} or s["order_id"] in order_ids]
        summaries = [s for s in snapshot["order_summary"] if s["order_id"] in order_ids]
        if len(splits) != 1 or len(split_links) != 1: q.append("missing_or_ambiguous_split_binding")
        current_summaries = [s for s in _active(summaries) if (s["order_id"], s["version"]) in current]
        if len(current_summaries) != 1: q.append("missing_or_ambiguous_current_summary")
        if any((s["order_id"], s["version"]) not in current for s in _active(summaries)): q.append("stale_summary_version")
        relevant = [p] + collection_rows + bindings + carts + orders + splits + split_links + summaries + native_effects["capture"] + native_effects["refund"]
        for r in relevant + transactions:
            for table in ("payment", "payment_collection", "capture", "refund", "order_transaction", "split_order_payment"):
                if r in snapshot[table]:
                    q.extend(_raw_issues(r, [f for f in FIELDS[table].split() if f == "amount" or f.endswith("_amount") and not f.startswith("raw_")]))
        for d in dispatches:
            if not _dispatch_valid(d, snapshot): q.append("dispatch_identity_binding_mismatch")
            ss = [s for s in settlements if s["operation_id"] == d["operation_id"]]
            if d["state"] == "completed" and (len(ss) != 1 or ss[0]["phase"] != "completed"): q.append("dispatch_settlement_completion_mismatch")
        for s in settlements:
            q.extend(_settlement_shape_issues(s))
            plan = s.get("plan") if isinstance(s.get("plan"), dict) else {}
            if (s["scope_id"] != collection_id or s["order_id"] not in order_ids or
                    any(plan.get(k) != s[k] for k in ("order_id", "scope_id", "operation_id")) or
                    plan.get("payment_id") != p["id"] or plan.get("currency_code") != p["currency_code"] or
                    plan.get("split_order_payment_id") not in {x["id"] for x in splits}): q.append("settlement_identity_binding_mismatch")
            if s["phase"] == "completed" and not any(d["operation_id"] == s["operation_id"] and d["state"] == "completed" and _dispatch_valid(d, snapshot) for d in dispatches): q.append("settlement_missing_completed_dispatch")
        for t in tails:
            saved = t.get("snapshot") or {}
            if (len(tails) != 1 or len(carts) != 1 or t["cart_id"] != carts[0]["cart_id"] or
                    saved.get("cart_id") != t["cart_id"] or saved.get("collection_id") != collection_id or
                    saved.get("payment_id") != p["id"] or saved.get("intent_id") != pi or
                    saved.get("provider_id") != p.get("provider_id") or saved.get("currency_code") != p["currency_code"] or
                    saved.get("version") != 1 or
                    (t["completed_at"] is not None and t["capture_id"] is None) or
                    (t["capture_id"] is not None and t["capture_id"] not in {e["id"] for e in native_effects["capture"]})):
                q.append("capture_tail_identity_binding_mismatch")
            try:
                if _money(saved.get("amount")) != _money(p.get("amount")): q.append("capture_tail_amount_mismatch")
                allocations = saved.get("allocations")
                expected = [{"order_id": o["id"], "version": o["version"], "split_id": sp["id"], "amount": sp["authorized_amount"], "currency_code": o["currency_code"]} for o in orders for sp in splits]
                if not isinstance(allocations, list) or len(allocations) != 1 or len(expected) != 1 or any(allocations[0].get(k) != expected[0][k] for k in ("order_id", "version", "split_id", "currency_code")) or _money(allocations[0].get("amount")) != _money(expected[0]["amount"]): q.append("capture_tail_allocation_mismatch")
            except DBReadBlocked: q.append("capture_tail_amount_mismatch")
        if any(r.get("deleted_at") is not None for r in relevant): q.append("deleted_scope_ambiguity")
        if any(x["order_id"] not in order_ids or x["split_order_payment_id"] not in {s["id"] for s in splits} for x in split_links): q.append("ambiguous_split_binding")
        if any(s["currency_code"] != p["currency_code"] for s in splits) or collection and collection["currency_code"] != p["currency_code"]: q.append("currency_binding_mismatch")
        normalized = {}
        for kind in ("capture", "refund"):
            normalized[kind + "s"] = []
            reservation = sum((_money(e["amount"]) for e in _active(native_effects[kind])), Decimal(0))
            col_amount = _money(collection.get("captured_amount" if kind == "capture" else "refunded_amount") or "0")
            for e in native_effects[kind]:
                positive = _money(e["amount"]) > 0
                if not positive: q.append("nonpositive_native_" + kind + "_effect")
                matches = [t for t in tx if t["reference"] == kind and t["reference_id"] == e["id"] and _money(t["amount"]) == (_money(e["amount"]) if kind == "capture" else -_money(e["amount"]))]
                ds = [d for d in dispatches if d["refund_id"] == e["id"]]
                completed_dispatch = len(ds) == 1 and _dispatch_valid(ds[0], snapshot) and ds[0]["state"] == "completed" and any(s["operation_id"] == ds[0]["operation_id"] and s["phase"] == "completed" for s in settlements)
                completed = positive and e.get("deleted_at") is None and (bool(p["captured_at"]) and col_amount == reservation and len(matches) == 1 if kind == "capture" else len(matches) == 1 and (not ds or completed_dispatch))
                if len([t for t in tx if t["reference"] == kind and t["reference_id"] == e["id"]]) > 1: q.append("duplicate_effect_transaction")
                effect = {"id": e["id"], "amount": e["amount"], "status": "completed" if completed else "reserved", "observed_status": "completed" if completed else "reserved"}
                if kind == "refund":
                    ds = [d for d in dispatches if d["refund_id"] == e["id"]]
                    if len(ds) == 1: effect["idempotency_key"] = ds[0]["idempotency_key"]
                normalized[kind + "s"].append(effect)
        accounting = {}
        try:
            paid = sum((_money(t["amount"]) for t in tx if _money(t["amount"]) > 0), Decimal(0))
            refunded = sum((-_money(t["amount"]) for t in tx if _money(t["amount"]) < 0), Decimal(0))
            cap = _money(collection.get("captured_amount") or "0")
            ref = _money(collection.get("refunded_amount") or "0")
            if _money(p.get("amount")) != _money(collection.get("amount")): q.append("payment_collection_amount_mismatch")
            accounting["payment_amount"] = format(_money(p.get("amount")), ".2f")
            accounting["collection_authorized"] = format(_money(collection.get("authorized_amount")), ".2f")
            if min(cap, ref, _money(p.get("amount"))) < 0 or ref > cap or cap > _money(p.get("amount")): q.append("financial_amount_bounds_mismatch")
            for sp in splits:
                auth, captured, returned = (_money(sp.get(f)) for f in ("authorized_amount", "captured_amount", "refunded_amount"))
                accounting.update(split_authorized=format(auth, ".2f"), split_captured=format(captured, ".2f"), split_refunded=format(returned, ".2f"))
                if auth != _money(collection.get("amount")) or auth != _money(collection.get("authorized_amount")): q.append("split_authorized_mismatch")
                if captured != cap or captured != paid: q.append("split_capture_gross_mismatch")
                if returned != ref or returned != refunded: q.append("split_refund_gross_mismatch")
                status = "refunded" if captured > 0 and returned == captured else "partially_refunded" if returned > 0 else "captured" if captured > 0 else "pending"
                if min(auth, captured, returned) < 0 or returned > captured or captured > auth or sp.get("status") != status: q.append("split_status_amount_mismatch")
            for s in current_summaries:
                totals = s.get("totals")
                if not isinstance(totals, dict): q.append("summary_numeric_fields_invalid"); continue
                q.extend(_raw_issues(totals, SUMMARY_FIELDS))
                values = {f: _money(totals.get(f)) for f in SUMMARY_FIELDS}
                accounting.update({"summary_" + f: format(v, ".2f") for f, v in values.items()})
                if min(values[f] for f in SUMMARY_FIELDS if f != "pending_difference") < 0 or values["refunded_total"] > values["paid_total"]:
                    q.append("summary_amount_bounds_mismatch")
                if len(splits) != 1 or values["accounting_total"] != _money(splits[0].get("authorized_amount")):
                    q.append("summary_accounting_authorized_mismatch")
                # Changed orders/credit lines require evidence absent from this
                # projection. Do not invent a general equality or pending=0 law.
                if (s["version"] != 1 or values["credit_line_total"] != 0 or
                        values["original_order_total"] != values["current_order_total"] or
                        values["current_order_total"] != values["accounting_total"]):
                    q.append("unsupported_order_change_summary")
                if values["paid_total"] != paid or values["paid_total"] != cap: q.append("summary_paid_mismatch")
                if values["refunded_total"] != refunded or values["refunded_total"] != ref: q.append("summary_refunded_mismatch")
                if values["transaction_total"] != paid - refunded or values["transaction_total"] != values["paid_total"] - values["refunded_total"]: q.append("summary_transaction_mismatch")
                # Stored native summary, not decorated API pending/return reservations.
                if values["pending_difference"] != values["current_order_total"] - values["transaction_total"]: q.append("summary_pending_formula_mismatch")
        except DBReadBlocked:
            q.append("financial_numeric_fields_invalid")
        if any(reason not in ("unfinished_settlement", "unfinished_dispatch", "unfinished_capture_tail") for reason in q):
            for effects_list in normalized.values():
                for effect in effects_list: effect["status"] = "reserved"
        rows.append({"payment_intent": pi, "payment_id": p["id"], "currency": p["currency_code"], "captured_at": p["captured_at"], "accounting": accounting,
                     **normalized, "collection": {"captured_amount": collection.get("captured_amount") or "0", "refunded_amount": collection.get("refunded_amount") or "0"},
                     "transactions": [{k: t[k] for k in ("reference", "reference_id", "amount")} for t in tx], "quarantine": sorted(set(q))})
    return rows, sorted(set(issues))


def scan_runtime(path, *, runner=None):
    runtime = validate_runtime(path)
    schema_output = _psql(runtime, _schema_sql(), runner)
    if len(schema_output) != 1:
        raise DBReadBlocked("schema_snapshot_required")
    schema = schema_output[0]
    columns = _validate_schema(schema)
    data_sql = "SELECT jsonb_build_object('schema',(" + _schema_sql() + "),'snapshot',jsonb_build_object(" + ",".join(_projection_sql(t) for t in FIELDS if t in columns) + "))"
    result = _psql(runtime, data_sql, runner)
    if len(result) != 1 or result[0].get("schema") != schema:
        raise DBReadBlocked("schema_changed_during_scan")
    snapshot = result[0]["snapshot"]
    if any(not isinstance(v, list) or len(v) > 100000 for v in snapshot.values()):
        raise DBReadBlocked("native_full_scan_bound_exceeded")
    rows, issues = normalize(snapshot)
    return {"rows": rows, "counts": {t: len(v) for t, v in snapshot.items()}, "issues": issues, "complete": True, "database": runtime["db"]}


def ledger_report(scan):
    """Local independent dimensions only; does not assert Stripe success."""
    checks = []
    for row in scan["rows"]:
        dimensions = {"capture_completed": sum((_money(e["amount"]) for e in row["captures"] if e["status"] == "completed"), Decimal(0)),
                      "refund_completed": sum((_money(e["amount"]) for e in row["refunds"] if e["status"] == "completed"), Decimal(0)),
                      "capture_collection": _money(row["collection"]["captured_amount"]), "refund_collection": _money(row["collection"]["refunded_amount"]),
                      "capture_transactions": sum((_money(t["amount"]) for t in row["transactions"] if t["reference"] == "capture"), Decimal(0)),
                      "refund_transactions": sum((-_money(t["amount"]) for t in row["transactions"] if t["reference"] == "refund"), Decimal(0))}
        dimensions.update({k: _money(v) for k, v in row.get("accounting", {}).items()})
        reasons = list(row["quarantine"])
        for kind in ("capture", "refund"):
            values = [dimensions[kind + suffix] for suffix in ("_completed", "_collection", "_transactions")]
            if len(set(values)) != 1: reasons.append(kind + "_gross_mismatch")
            if any(e["status"] != "completed" for e in row[kind + "s"]): reasons.append(kind + "_not_completed")
            if any(_money(e["amount"]) <= 0 for e in row[kind + "s"]): reasons.append("nonpositive_native_" + kind + "_effect")
            dimensions[kind + "_native_observed_completed"] = sum((_money(e["amount"]) for e in row[kind + "s"] if e.get("observed_status", e["status"]) == "completed"), Decimal(0))
        checks.append({"payment_intent": row["payment_intent"], "amounts": {k: format(v, ".2f") for k, v in dimensions.items()}, "issues": sorted(set(reasons))})
    return {"status": "discrepancy" if scan["issues"] or any(c["issues"] for c in checks) else "clean", "scope": "native_ledger_only_not_provider_verified", "completion_semantics": "completed_is_conditional_accounting_projection_native_observed_is_pre_quarantine_not_provider_verified", "counts": scan["counts"], "issues": scan["issues"], "payments": checks}
