"""Pure, fail-closed full-provider/native comparison (no DB or HTTP writes).

compare(provider_snapshot, native_rows, *, native_complete=True) -> dict.
Provider input is StripeReadOnly.scan() (including complete/mode flags).
Native input: one normalized row per Stripe PaymentIntent, from a FULL DB SELECT,
not a queue/started-record filter. Include deleted/missing bindings as quarantine.
Schema per row:
  payment_intent: pi_..., payment_id: native id, currency: 'eur',
  captured_at: timestamp or None,
  captures/refunds: [{id, amount: Decimal or exact major-unit string,
                     status: 'completed'|'reserved'|'pending'|'failed',
                     idempotency_key: optional raw local key,
                     provider_effect_id: optional exact provider object pin}],
  collection: {captured_amount, refunded_amount} (major-unit decimals),
  transactions: [{reference: 'capture'|'refund', reference_id: native effect id,
                  amount: exact signed major-unit decimal}],
  quarantine: [reason, ...].

'completed' MUST come from independently confirmed durable runtime completion,
not existence of a native capture/refund row. Adapter supplies ONLY active, bound,
current-order-version transactions; unbound/deleted/duplicate scope is quarantined.
Collection values must be attributable to this payment; shared collections require
allocation by the DB adapter, not reusing a collection total for every payment.
No capture success without captured_at + completed rows + collection + transactions.
All provider and native PIs are unioned; unrecognized provider PIs are discrepancies.
Both GROSS sides are compared separately (never hide capture/refund gaps in net).
Only EUR minor-unit conversion is supported. Amounts remain Decimal throughout.
Event idempotency hashes must bind the completed native effect to the exact settled
object in the full inventory (PI, kind, ID, amount and optional object pin all agree).
Refund totals alone never prove identity; missing retained evidence is discrepant.
Only a sole completed capture and sole settled charge on a unique PI may use the
PI/charge identity fallback, and never when an operation key was explicitly supplied.
gross_clean reports financial agreement separately; clean also requires identity.
No-effect inference from absent events is forbidden (Stripe event retention limit).
Historical parent correlation is refused for a charge with tied settled-refund
seconds: opaque IDs prove no subsecond chronology, even for a full tied group.
Arrays are limited to 100,000 entries each and 500,000 combined snapshot entries.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation, localcontext
from collections import defaultdict

from .stripe_readonly import StripeReadBlocked, identifier, key_hash, project_effect


class ComparisonBlocked(ValueError):
    pass


_MAX_ARRAY = 100_000
_MAX_SNAPSHOT_ENTRIES = 500_000


def _amount(value):
    if isinstance(value, bool) or value is None or isinstance(value, float):
        raise ComparisonBlocked("exact_major_decimal_required")
    try:
        amount = Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        raise ComparisonBlocked("invalid_native_amount") from None
    if not amount.is_finite() or len(amount.as_tuple().digits) > 40 or abs(amount.adjusted()) > 40:
        raise ComparisonBlocked("invalid_native_amount")
    if amount != amount.quantize(Decimal("0.01")):
        raise ComparisonBlocked("fractional_minor_unit")
    return amount


def _display(amount):
    return format(amount, ".2f")


def compare(provider_snapshot, native_rows, *, native_complete=True):
    with localcontext() as context:
        context.prec = 100
        return _compare(provider_snapshot, native_rows, native_complete)


def _compare(provider, native_rows, native_complete):
    if not isinstance(provider, dict):
        raise ComparisonBlocked("provider_snapshot_required")
    if provider.get("complete") is not True or native_complete is not True:
        raise ComparisonBlocked("complete_provider_and_native_snapshots_required")
    mode = provider.get("livemode")
    if type(mode) is not bool:
        raise ComparisonBlocked("provider_mode_required")
    for plural in ("charges", "refunds", "events"):
        if not isinstance(provider.get(plural), list):
            raise ComparisonBlocked("missing_provider_collection")
    if not isinstance(native_rows, (list, tuple)):
        raise ComparisonBlocked("native_row_list_required")
    arrays = [provider[p] for p in ("charges", "refunds", "events")] + [native_rows]
    if any(len(a) > _MAX_ARRAY for a in arrays):
        raise ComparisonBlocked("snapshot_array_bound_exceeded")
    entry_count = sum(len(a) for a in arrays)
    for row in native_rows:
        if not isinstance(row, dict):
            raise ComparisonBlocked("native_row_required")
        for field in ("captures", "refunds", "transactions", "quarantine"):
            if not isinstance(row.get(field), list):
                raise ComparisonBlocked("native_snapshot_array_required")
            if len(row[field]) > _MAX_ARRAY:
                raise ComparisonBlocked("snapshot_array_bound_exceeded")
            entry_count += len(row[field])
    if entry_count > _MAX_SNAPSHOT_ENTRIES:
        raise ComparisonBlocked("snapshot_entry_bound_exceeded")
    for event in provider["events"]:
        if not isinstance(event, dict):
            raise ComparisonBlocked("provider_event_required")
        if type(event.get("created")) is not int or event["created"] < 0:
            raise ComparisonBlocked("invalid_event_timestamp")
    discrepancies, unfinal, correlations = [], [], []
    totals = defaultdict(lambda: {"capture": Decimal(0), "refund": Decimal(0), "effects": []})
    charges, refunds = {}, {}

    def issue(code, pi=None, **detail):
        discrepancies.append({"code": code, "payment_intent": pi, **detail})

    try:
        for raw in provider["charges"]:
            row = project_effect(raw, "charge", mode)
            if row["id"] in charges:
                raise ComparisonBlocked("duplicate_provider_charge")
            charges[row["id"]] = row
            pi = row["payment_intent"]
            if pi is None:
                issue("provider_charge_missing_payment_intent", provider_effect_id=row["id"])
                pi = "orphan:" + row["id"]
            bucket = totals[pi]
            bucket["effects"].append(row["id"])
            if row["status"] == "succeeded" and row["paid"] and row["captured"]:
                bucket["capture"] += Decimal(row["amount_captured"]) / 100
            elif row["amount_captured"]:
                issue("provider_capture_state_inconsistent", pi, provider_effect_id=row["id"])
            if row["status"] == "pending":
                unfinal.append({"payment_intent": pi, "kind": "charge", "provider_effect_id": row["id"], "status": "pending"})
        for raw in provider["refunds"]:
            row = project_effect(raw, "refund", mode,
                                 parent_charge=charges.get(raw.get("charge")))
            if row["id"] in refunds:
                raise ComparisonBlocked("duplicate_provider_refund")
            refunds[row["id"]] = row
            charge = charges.get(row["charge"])
            pi = row["payment_intent"] or (charge or {}).get("payment_intent")
            if charge is None:
                issue("provider_refund_charge_missing", pi, provider_effect_id=row["id"])
            elif row["payment_intent"] is not None and row["payment_intent"] != charge["payment_intent"]:
                issue("provider_refund_payment_binding_mismatch", pi, provider_effect_id=row["id"])
            if pi is None:
                issue("provider_refund_missing_payment_intent", provider_effect_id=row["id"])
                pi = "orphan:" + row["id"]
            bucket = totals[pi]
            bucket["effects"].append(row["id"])
            if row["status"] == "succeeded":
                bucket["refund"] += Decimal(row["amount"]) / 100
            elif row["status"] in ("pending", "requires_action"):
                unfinal.append({"payment_intent": pi, "kind": "refund", "provider_effect_id": row["id"], "status": row["status"]})
    except StripeReadBlocked as exc:
        raise ComparisonBlocked(str(exc)) from None

    refunds_by_charge = defaultdict(list)
    settled_charges_by_pi = defaultdict(list)
    for refund in refunds.values():
        refunds_by_charge[refund["charge"]].append(refund)
    # One sort/cache per charge, never an inventory walk/sort per parent event.
    histories = {}
    for charge in charges.values():
        related = refunds_by_charge[charge["id"]]
        settled = sum((r["amount"] for r in related if r["status"] == "succeeded"), 0)
        if settled > charge["amount_captured"]:
            issue("provider_refunds_exceed_capture", charge["payment_intent"], provider_effect_id=charge["id"])
        if not any(r["status"] in ("pending", "requires_action") for r in related) and settled != charge["amount_refunded"]:
            issue("provider_refund_inventory_mismatch", charge["payment_intent"], provider_effect_id=charge["id"])
        ordered = sorted((r for r in related if r["status"] == "succeeded"), key=lambda r: r["created"])
        prefixes, positions, timestamps = {}, {}, set()
        cumulative, ambiguous = 0, False
        for index, refund in enumerate(ordered):
            ambiguous |= refund["created"] in timestamps
            timestamps.add(refund["created"])
            cumulative += refund["amount"]
            positions[refund["id"]] = index
            prefixes[cumulative] = (index, refund["created"])
        histories[charge["id"]] = (ambiguous, positions, prefixes)
        if charge["status"] == "succeeded" and charge["paid"] and charge["captured"]:
            settled_charges_by_pi[charge["payment_intent"]].append(charge)

    native, local_keys = {}, defaultdict(list)
    completed_effects = {}
    native_effects = {}
    completed_captures_by_pi = defaultdict(list)
    native_identities = set()
    for row in native_rows:
        try:
            pi = identifier(row.get("payment_intent"), "pi")
        except StripeReadBlocked:
            raise ComparisonBlocked("invalid_native_payment_intent") from None
        if pi in native:
            raise ComparisonBlocked("duplicate_native_payment_intent")
        if row.get("currency") != "eur":
            raise ComparisonBlocked("unsupported_currency_only_eur")
        if not isinstance(row.get("payment_id"), str) or not row["payment_id"]:
            raise ComparisonBlocked("native_payment_identity_required")
        native[pi] = row
        if not isinstance(row.get("quarantine"), list):
            raise ComparisonBlocked("explicit_quarantine_list_required")
        if row["quarantine"]:
            issue("native_quarantined", pi)  # never echo free-text quarantine payload
        for plural, kind in (("captures", "capture"), ("refunds", "refund")):
            if not isinstance(row.get(plural), list):
                raise ComparisonBlocked("native_effect_rows_required")
            seen = set()
            for effect in row[plural]:
                if not isinstance(effect.get("id"), str) or not effect["id"] or effect["id"] in seen:
                    raise ComparisonBlocked("invalid_or_duplicate_native_effect")
                seen.add(effect["id"])
                native_identity = (kind, effect["id"])
                if native_identity in native_identities:
                    raise ComparisonBlocked("duplicate_native_effect_across_payments")
                native_identities.add(native_identity)
                native_effects[(pi, kind, effect["id"])] = effect
                if effect.get("provider_effect_id") is not None:
                    try:
                        identifier(effect["provider_effect_id"], "ch" if kind == "capture" else "re")
                    except StripeReadBlocked:
                        raise ComparisonBlocked("invalid_native_provider_effect_pin") from None
                if effect.get("status") not in ("completed", "reserved", "pending", "failed"):
                    raise ComparisonBlocked("explicit_native_completion_status_required")
                if _amount(effect.get("amount")) <= 0:
                    raise ComparisonBlocked("positive_native_effect_required")
                if effect["status"] in ("reserved", "pending"):
                    unfinal.append({"payment_intent": pi, "kind": kind, "native_effect_id": effect["id"], "status": effect["status"]})
                if effect["status"] == "completed":
                    completed_effects[(pi, kind, effect["id"])] = effect
                    if kind == "capture":
                        completed_captures_by_pi[pi].append(effect)
                if effect.get("idempotency_key") is not None:
                    try:
                        digest = key_hash(effect["idempotency_key"])
                    except StripeReadBlocked as exc:
                        raise ComparisonBlocked(str(exc)) from None
                    local_keys[digest].append((pi, kind, effect["id"], _amount(effect["amount"])))

    results = []
    for pi in sorted(set(totals) | set(native)):
        expected = totals[pi]
        row = native.get(pi)
        if row is None:
            issue("provider_only_payment_intent", pi)
            results.append({"payment_intent": pi, "provider_capture": _display(expected["capture"]), "provider_refund": _display(expected["refund"]), "native": None})
            continue
        collection = row.get("collection")
        if not isinstance(collection, dict) or not isinstance(row.get("transactions"), list):
            raise ComparisonBlocked("native_accounting_and_transactions_required")
        actual = {"capture_completed": sum((_amount(e["amount"]) for e in row["captures"] if e["status"] == "completed"), Decimal(0)),
                  "refund_completed": sum((_amount(e["amount"]) for e in row["refunds"] if e["status"] == "completed"), Decimal(0)),
                  "capture_collection": _amount(collection.get("captured_amount")),
                  "refund_collection": _amount(collection.get("refunded_amount")),
                  "capture_transactions": Decimal(0), "refund_transactions": Decimal(0)}
        transaction_refs = set()
        for transaction in row["transactions"]:
            kind = transaction.get("reference")
            if kind not in ("capture", "refund"):
                issue("unsupported_order_transaction", pi)
                continue
            reference = (kind, transaction.get("reference_id"))
            if reference in transaction_refs:
                issue("duplicate_order_transaction", pi)
            transaction_refs.add(reference)
            amount = _amount(transaction.get("amount"))
            if (kind == "capture" and amount <= 0) or (kind == "refund" and amount >= 0):
                issue("order_transaction_sign_mismatch", pi)
            actual[kind + "_transactions"] += amount if kind == "capture" else -amount
            match = completed_effects.get((pi, kind, reference[1]))
            if match is None or _amount(match["amount"]) != abs(amount):
                issue("order_transaction_completion_binding_mismatch", pi)
        if expected["capture"] > 0 or actual["capture_completed"] > 0 or actual["capture_collection"] > 0 or actual["capture_transactions"] > 0:
            if not row.get("captured_at"):
                issue("missing_payment_captured_at", pi)
        elif row.get("captured_at"):
            issue("native_captured_at_without_provider_capture", pi)
        for metric, amount in actual.items():
            kind = metric.split("_")[0]
            if amount < 0:
                issue("negative_native_gross_amount", pi, dimension=metric)
            if amount != expected[kind]:
                issue("gross_amount_mismatch", pi, dimension=metric, provider=_display(expected[kind]), native=_display(amount))
        results.append({"payment_intent": pi, "provider_capture": _display(expected["capture"]), "provider_refund": _display(expected["refund"]), "native": {k: _display(v) for k, v in actual.items()}})

    gross_clean = not discrepancies and not unfinal
    identity_issues = []
    verified = {}
    def identity_issue(code, pi, **detail):
        identity_issues.append({"code": code, "payment_intent": pi, **detail})
        issue(code, pi, **detail)

    # Refund receipts may arrive after their parent-charge event in the retained
    # list. Index exact-object candidates independently of event iteration order.
    # This index is ONLY correlation evidence; it never completes a native effect.
    refund_receipts = defaultdict(dict)
    conflicting_receipts = set()
    def check_event_time(event, effect):
        inventory = (charges if effect["object"] == "charge" else refunds).get(effect["id"])
        if (effect["created"] > event["created"]
                or (inventory is not None and inventory["created"] != effect["created"])):
            raise ComparisonBlocked("event_object_timestamp_inconsistent")

    for event in provider["events"]:
        digest, effect = event.get("request_idempotency_key_hash"), event.get("effect")
        if (digest in local_keys and effect and effect.get("object") == "refund"
                and event.get("type") in {"refund.created", "refund.updated"}):
            try:
                receipt = project_effect(effect, "refund", mode,
                                         parent_charge=charges.get(effect.get("charge")))
            except StripeReadBlocked as exc:
                raise ComparisonBlocked(str(exc)) from None
            check_event_time(event, receipt)
            previous = refund_receipts[digest].get(receipt["id"])
            if previous is not None and previous != receipt:
                conflicting_receipts.add(digest)
            refund_receipts[digest][receipt["id"]] = receipt

    def parent_refund_agrees(event, parent, digest, pi, local_kind, native_id, local_amount):
        if local_kind != "refund" or len(local_keys[digest]) != 1:
            return False
        inventory_parent = charges.get(parent["id"])
        if inventory_parent is None or parent["payment_intent"] != pi:
            return False
        # A historical parent has a cumulative refunded amount, NOT the current
        # operation's amount. Capture identity/state must still match inventory.
        if any(parent[field] != inventory_parent[field] for field in
               ("payment_intent", "amount", "amount_captured", "status", "paid", "captured")):
            return False
        if not (parent["status"] == "succeeded" and parent["paid"] and parent["captured"]):
            return False
        local_effect = native_effects[(pi, "refund", native_id)]
        pin = local_effect.get("provider_effect_id")
        if digest in conflicting_receipts or len(refund_receipts[digest]) > 1:
            return False
        candidates = list(refund_receipts[digest].values())
        # An explicit pin can identify the inventory object for an informative
        # parent-only correlation, but cannot replace a retained exact receipt.
        if not candidates and pin in refunds:
            candidates = [refunds[pin]]
        if not candidates or len({r["id"] for r in candidates}) != 1:
            return False
        for receipt in candidates:
            inventory = refunds.get(receipt["id"])
            if (inventory is None or inventory["status"] != "succeeded"
                    or receipt["status"] != "succeeded"
                    or receipt["charge"] != parent["id"] or inventory["charge"] != parent["id"]
                    or receipt["payment_intent"] != pi or inventory["payment_intent"] != pi
                    or Decimal(receipt["amount"]) / 100 != local_amount
                    or inventory["amount"] != receipt["amount"]
                    or (pin is not None and pin != receipt["id"])):
                return False
        # Fail closed on impossible historical cumulative amounts. Only complete
        # settled inventory prefixes are allowed; never compare cumulative EUR10
        # to the second partial-refund operation's EUR8.
        ambiguous, positions, prefixes = histories[parent["id"]]
        if ambiguous:
            return False  # fail closed; no ID-based or subsecond ordering claim
        candidate_id = candidates[0]["id"]
        prefix = prefixes.get(parent["amount_refunded"])
        return (prefix is not None and candidate_id in positions
                and positions[candidate_id] <= prefix[0] and prefix[1] <= event["created"]
                and Decimal(parent["amount_refunded"]) / 100 >= local_amount
                and parent["amount_refunded"] <= inventory_parent["amount_refunded"])

    for event in provider["events"]:
        if event.get("livemode") is not mode:
            raise ComparisonBlocked("event_mode_mismatch")
        digest, effect = event.get("request_idempotency_key_hash"), event.get("effect")
        if digest not in local_keys or not effect:
            continue
        kind = effect.get("object")
        if kind not in ("charge", "refund"):
            continue
        try:
            effect = project_effect(effect, kind, mode,
                                    parent_charge=charges.get(effect.get("charge")) if kind == "refund" else None)
            identifier(event.get("id"), "evt")
        except StripeReadBlocked as exc:
            raise ComparisonBlocked(str(exc)) from None
        check_event_time(event, effect)
        event_pi = effect["payment_intent"] or charges.get(effect.get("charge"), {}).get("payment_intent")
        observed = Decimal(effect["amount_captured"] if kind == "charge" else effect["amount"]) / 100
        for pi, local_kind, native_id, local_amount in local_keys[digest]:
            if kind == "charge" and event.get("type") in {"charge.refunded", "charge.updated"}:
                compatible = parent_refund_agrees(event, effect, digest, pi, local_kind, native_id, local_amount)
                correlations.append({"event_id": event["id"], "provider_effect_id": effect["id"], "native_effect_id": native_id,
                                     "request_idempotency_key_hash": digest, "compatible": compatible,
                                     "binding": "parent_charge_refund_correlation_only", "exact_binding_verified": False})
                if not compatible:
                    identity_issue("event_idempotency_correlation_mismatch", pi, provider_effect_id=effect["id"])
                continue  # Parent events can NEVER populate verified/claimed.
            compatible = pi == event_pi and local_kind == ("capture" if kind == "charge" else "refund") and local_amount == observed
            local_identity = (pi, local_kind, native_id)
            inventory = (charges if kind == "charge" else refunds).get(effect["id"])
            local_effect = completed_effects.get(local_identity)
            expected_type = event.get("type") in ({"charge.captured", "charge.succeeded"} if kind == "charge" else {"refund.created", "refund.updated"})
            settled = effect["status"] == "succeeded" and (kind == "refund" or (effect["paid"] and effect["captured"]))
            inventory_settled = inventory is not None and inventory["status"] == "succeeded" and (kind == "refund" or (inventory["paid"] and inventory["captured"]))
            inventory_amount = None if inventory is None else Decimal(inventory["amount_captured"] if kind == "charge" else inventory["amount"]) / 100
            same_parent = inventory is not None and inventory["payment_intent"] == effect["payment_intent"] and (kind == "charge" or inventory["charge"] == effect["charge"])
            pinned_effect = None if local_effect is None else local_effect.get("provider_effect_id")
            object_agrees = bool(inventory is not None and same_parent and inventory_amount == local_amount
                                 and (pinned_effect is None or pinned_effect == effect["id"]))
            exact = bool(compatible and local_effect and len(local_keys[digest]) == 1 and expected_type and settled and inventory_settled
                         and object_agrees)
            correlations.append({"event_id": event["id"], "provider_effect_id": effect["id"], "native_effect_id": native_id,
                                 "request_idempotency_key_hash": digest, "compatible": compatible,
                                 "binding": "event_idempotency_exact_object" if exact else "correlation_only_not_exact", "exact_binding_verified": exact})
            if exact:
                prior = verified.get(local_identity)
                if prior is not None and prior != effect["id"]:
                    identity_issue("native_effect_multiple_provider_objects", pi, native_effect_id=native_id)
                verified[local_identity] = effect["id"]
            if not compatible:
                identity_issue("event_idempotency_correlation_mismatch", pi, provider_effect_id=effect["id"])
            elif local_effect and (not object_agrees or len(local_keys[digest]) != 1):
                identity_issue("event_exact_object_binding_mismatch", pi, provider_effect_id=effect["id"])

    # A single settled charge on a uniquely bound PI can establish its sole capture,
    # but an explicitly supplied operation key always requires retained exact evidence.
    for identity, effect in completed_effects.items():
        pi, kind, native_id = identity
        if identity not in verified and kind == "capture" and effect.get("idempotency_key") is None:
            candidates = settled_charges_by_pi[pi]
            local_captures = completed_captures_by_pi[pi]
            if (len(candidates) == len(local_captures) == 1 and Decimal(candidates[0]["amount_captured"]) / 100 == _amount(effect["amount"])
                    and effect.get("provider_effect_id", candidates[0]["id"]) == candidates[0]["id"]):
                verified[identity] = candidates[0]["id"]
                correlations.append({"provider_effect_id": candidates[0]["id"], "native_effect_id": native_id,
                                     "binding": "unique_payment_intent_charge", "exact_binding_verified": True})
        if identity not in verified:
            identity_issue("native_effect_identity_unverified", pi, kind=kind, native_effect_id=native_id)
    claimed = defaultdict(list)
    for identity, provider_id in verified.items():
        claimed[provider_id].append(identity)
    for provider_id, identities in claimed.items():
        if len(identities) > 1:
            identity_issue("provider_effect_multiple_native_bindings", identities[0][0], provider_effect_id=provider_id)
    for effect in [*charges.values(), *refunds.values()]:
        settled = effect["status"] == "succeeded" and (effect["object"] == "refund" or (effect["paid"] and effect["captured"] and effect["amount_captured"] > 0))
        if settled and effect["id"] not in claimed:
            identity_issue("provider_effect_identity_unverified", effect["payment_intent"], provider_effect_id=effect["id"])
    return {"status": "discrepancy" if discrepancies else ("unfinal" if unfinal else "clean"),
            "clean": not discrepancies and not unfinal, "discrepancies": discrepancies,
            "gross_clean": gross_clean, "identity_verified": not identity_issues,
            "identity_discrepancies": identity_issues,
            "unfinal": unfinal, "payments": results, "correlations": correlations,
            "livemode": mode, "currency": "eur", "comparison": "gross_capture_and_refund_not_net"}
