"""Read-only Stripe-to-native evidence bridge; JSON attestations are NOT authority.

Only this bridge seals an in-process receipt after account/PI/inventory/event reads.
The process-local MAC is an integrity boundary against arbitrary external JSON, not
an operator authorization or a portable provider signature. A new process must
read again. No credentials are discovered; None blocks without a provider call.
Injected transports and offline_fixture_evidence always produce TEST-ONLY receipts.
They can only generate/apply to explicitly marked disposable integration databases.
Python code/reader transport and operator approvals remain trusted process inputs.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import hmac
import json
import re
import secrets
import urllib.request
from typing import Mapping

from .stripe_readonly import StripeReadOnly as StripeReadOnlyReader, StripeReadBlocked, identifier, key_hash


class EvidenceBlocked(ValueError):
    pass


_MAC_KEY = secrets.token_bytes(32)  # NOT a provider key; never persisted/exported
_TEST_DATABASE = re.compile(r"hs_recon_it_[a-f0-9]{32}")
ISOLATED_DATABASE_MARKER = "hs-reconciliation-isolated-test-v1"


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def _seal(payload, source):
    body = json.loads(_canonical(payload))
    body.pop("verified", None)  # the old caller attestation has no authority
    body["authentication"] = {"version": 1, "source": source}
    body["authentication"]["mac"] = hmac.new(_MAC_KEY, _canonical(body).encode(), hashlib.sha256).hexdigest()
    return body


def authenticate_evidence(evidence: Mapping, *, allow_test_only=False):
    try:
        detached = json.loads(_canonical(evidence))
        auth = detached["authentication"]
        mac = auth.pop("mac")
        expected = hmac.new(_MAC_KEY, _canonical(detached).encode(), hashlib.sha256).hexdigest()
        valid = (auth["version"] == 1 and isinstance(mac, str) and hmac.compare_digest(mac, expected))
        source = auth["source"]
    except (KeyError, TypeError, ValueError, AttributeError):
        raise EvidenceBlocked("authenticated_reader_evidence_required") from None
    if not valid or source not in ("stripe_readonly_reader", "offline_fixture_test_only", "offline_reader_test_only"):
        raise EvidenceBlocked("authenticated_reader_evidence_required")
    if source != "stripe_readonly_reader" and not allow_test_only:
        raise EvidenceBlocked("offline_evidence_is_nonoperational")
    _validate_receipt_scope(evidence, required=source != "offline_fixture_test_only")
    return source


def isolated_test_database(name):
    return isinstance(name, str) and _TEST_DATABASE.fullmatch(name) is not None


def offline_fixture_evidence(payload: Mapping, *, payment_intent=None, inventory=None):
    """Synthetic issuance adapter, NEVER real authority.

    Old minimal fixtures remain test-only. New native fixtures should supply the
    explicitly synthetic projected PI/inventory to exercise the scoped contract.
    """
    payload = dict(payload)
    if payment_intent is not None or inventory is not None:
        scope = _scoped_inventory(payment_intent, inventory, payload["payment_intent"],
            payload["kind"], payload["provider_effect_id"], payload["amount_minor"], payload["currency"])
        payload["scoped_inventory"] = scope
        payload["scoped_inventory_hash"] = hashlib.sha256(_canonical(scope).encode()).hexdigest()
        _validate_receipt_scope(payload, required=True)
    return _seal(payload, "offline_fixture_test_only")


@dataclass(frozen=True)
class EvidenceBinding:
    account_id: str
    payment_intent: str
    kind: str
    provider_effect_id: str
    amount_minor: int
    currency: str
    idempotency_key: str
    operation_id: str
    identity_metadata: Mapping[str, str]


def _binding(binding):
    if not isinstance(binding, EvidenceBinding) or binding.kind not in ("capture_success", "refund_success"):
        raise EvidenceBlocked("bounded_success_binding_required")
    identifier(binding.account_id, "acct")
    identifier(binding.payment_intent, "pi")
    identifier(binding.provider_effect_id, "ch" if binding.kind == "capture_success" else "re")
    if binding.currency != "eur" or type(binding.amount_minor) is not int or not 0 < binding.amount_minor <= 9007199254740991:
        raise EvidenceBlocked("positive_exact_eur_minor_amount_required")
    key_hash(binding.idempotency_key)
    if not isinstance(binding.operation_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", binding.operation_id):
        raise EvidenceBlocked("operation_identity_required")
    keys = {"cart_id", "payment_id", "collection_id", "order_id", "run_id"}
    metadata = dict(binding.identity_metadata)
    if set(metadata) != keys or any(not isinstance(v, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", v) for v in metadata.values()):
        raise EvidenceBlocked("complete_identity_metadata_required")
    return metadata


def _native_transport(reader):
    """Only internally constructed transport has operational provenance.

    Private Python attributes are a trusted-process boundary, NOT a sandbox.
    """
    return (type(reader) is StripeReadOnlyReader
            and not any(name in vars(reader) for name in
                        ("read_account", "read_payment_intent", "scan", "_get", "_pages"))
            and reader._internal_transport is not None
            and reader._transport is reader._internal_transport)


def _scoped_inventory(pi, inventory, payment_intent, kind, effect_id, amount_minor, currency):
    """Narrow fail-closed contract: one full charge, zero or one refund success.

    OR scoping catches both same-PI/wrong-charge and same-charge/wrong-PI paths.
    Multi-success and nonterminal workflows are unsupported, not reconciled.
    """
    if (inventory.get("complete") is not True or inventory.get("livemode") is not False
            or pi.get("id") != payment_intent or pi.get("status") != "succeeded"
            or pi.get("livemode") is not False or pi.get("currency") != currency
            or currency != "eur" or type(pi.get("amount")) is not int or pi["amount"] <= 0):
        raise EvidenceBlocked("scoped_pi_terminal_identity_required")
    charges = [c for c in inventory["charges"] if c.get("payment_intent") == payment_intent]
    if len(charges) != 1:
        raise EvidenceBlocked("scoped_single_charge_required")
    charge = charges[0]
    if (charge.get("object") != "charge" or charge.get("livemode") is not False
            or charge.get("currency") != currency or charge.get("status") != "succeeded"
            or charge.get("paid") is not True or charge.get("captured") is not True
            or any(type(charge.get(k)) is not int for k in ("amount", "amount_captured", "amount_refunded"))
            or charge["amount"] != pi["amount"] or charge["amount_captured"] != pi["amount"]
            or not 0 <= charge["amount_refunded"] <= charge["amount_captured"]):
        raise EvidenceBlocked("scoped_exact_full_capture_required")
    refunds = [r for r in inventory["refunds"]
               if r.get("payment_intent") == payment_intent or r.get("charge") == charge["id"]]
    for refund in refunds:
        if (refund.get("payment_intent") != payment_intent or refund.get("charge") != charge["id"]
                or refund.get("object") != "refund" or refund.get("livemode") is not False
                or refund.get("currency") != currency or type(refund.get("amount")) is not int
                or not 0 < refund["amount"] <= charge["amount_captured"]
                or refund.get("status") not in ("succeeded", "failed", "canceled")):
            raise EvidenceBlocked("scoped_refund_parent_terminal_amount_required")
    if len({r["id"] for r in refunds}) != len(refunds):
        raise EvidenceBlocked("scoped_unique_refund_inventory_required")
    successes = [r for r in refunds if r["status"] == "succeeded"]
    refunded = sum(r["amount"] for r in successes)
    if refunded != charge["amount_refunded"]:
        raise EvidenceBlocked("scoped_refund_total_mismatch")
    if kind == "capture_success":
        if successes or refunded != 0 or effect_id != charge["id"] or amount_minor != charge["amount_captured"]:
            raise EvidenceBlocked("scoped_capture_without_refund_required")
    elif kind == "refund_success":
        if len(successes) != 1 or successes[0]["id"] != effect_id or refunded != amount_minor:
            raise EvidenceBlocked("scoped_single_selected_refund_required")
    else:
        raise EvidenceBlocked("scoped_supported_success_required")
    return {"version": 1, "complete": True, "scope": "single_pi_single_full_charge",
            "payment_intent": pi, "currency": currency, "charge_id": charge["id"],
            "amount_minor": pi["amount"], "captured_minor": charge["amount_captured"],
            "refunded_minor": refunded, "successful_charge_ids": [charge["id"]],
            "successful_refund_ids": sorted(r["id"] for r in successes),
            "charges": charges, "refunds": sorted(refunds, key=lambda r: r["id"])}


def _validate_receipt_scope(evidence, *, required):
    scope = evidence.get("scoped_inventory")
    if scope is None:
        if not required:
            return  # Legacy synthetic fixtures only; never reader/operational authority.
        raise EvidenceBlocked("scoped_inventory_contract_required")
    try:
        expected = _scoped_inventory(scope["payment_intent"],
            {"complete": scope["complete"], "livemode": False,
             "charges": scope["charges"], "refunds": scope["refunds"]},
            evidence["payment_intent"], evidence["kind"], evidence["provider_effect_id"],
            evidence["amount_minor"], evidence["currency"])
        if (_canonical(scope) != _canonical(expected)
                or evidence["scoped_inventory_hash"] != hashlib.sha256(_canonical(scope).encode()).hexdigest()
                or scope["payment_intent"]["metadata"] != evidence["identity_metadata"]):
            raise EvidenceBlocked("scoped_inventory_contract_mismatch")
        effect = scope["charges"][0] if evidence["kind"] == "capture_success" else next(
            r for r in scope["refunds"] if r["id"] == evidence["provider_effect_id"])
        if evidence.get("provider_object", effect) != effect:
            raise EvidenceBlocked("scoped_selected_effect_mismatch")
    except (KeyError, TypeError, ValueError, StopIteration):
        raise EvidenceBlocked("scoped_inventory_contract_required") from None


def read_evidence(reader: StripeReadOnlyReader | None, binding: EvidenceBinding, *,
                  readonly_attestation_reference: str, isolated_test_only=False,
                  page_size=100, max_pages=10000):
    """Account pin -> PI metadata -> complete inventory/events -> PI/account recheck.

    A restricted reader must already have independently attested read-only grants.
    Its missing credential is a blocker; no automatic env/config discovery occurs.
    Absence of an event or metadata is a blocker, not evidence of no financial effect.
    """
    if reader is None:
        raise EvidenceBlocked("restricted_readonly_credential_unavailable_nonoperational")
    metadata = _binding(binding)
    if type(reader) is not StripeReadOnlyReader or reader.livemode is not False:
        raise EvidenceBlocked("exact_testmode_readonly_reader_required")
    operational = _native_transport(reader)
    if not operational and isolated_test_only is not True:
        raise EvidenceBlocked("injected_reader_is_test_only")
    if not isinstance(readonly_attestation_reference, str) or not readonly_attestation_reference.strip():
        raise EvidenceBlocked("external_readonly_grant_attestation_required")
    try:
        account = reader.read_account(expected_account_id=binding.account_id)
        pi = reader.read_payment_intent(binding.payment_intent)
        inventory = reader.scan(page_size=page_size, max_pages=max_pages)
        pi_after = reader.read_payment_intent(binding.payment_intent)
        account_after = reader.read_account(expected_account_id=binding.account_id)
    except StripeReadBlocked:
        raise EvidenceBlocked("restricted_provider_read_blocked") from None
    if account != account_after or pi != pi_after:
        raise EvidenceBlocked("provider_identity_changed_during_read")
    if pi["metadata"] != metadata or pi["livemode"] is not False or pi["currency"] != binding.currency or pi["status"] != "succeeded":
        raise EvidenceBlocked("provider_pi_identity_metadata_or_terminal_mismatch")
    if inventory.get("complete") is not True or inventory.get("livemode") is not False:
        raise EvidenceBlocked("complete_testmode_inventory_required")
    kind = "charge" if binding.kind == "capture_success" else "refund"
    rows = inventory["charges" if kind == "charge" else "refunds"]
    selected = [row for row in rows if row["id"] == binding.provider_effect_id]
    if len(selected) != 1:
        raise EvidenceBlocked("unique_inventory_effect_required")
    effect = selected[0]
    measure = "amount_captured" if kind == "charge" else "amount"
    expected = {"id": binding.provider_effect_id, "object": kind, "payment_intent": binding.payment_intent,
                "livemode": False, "status": "succeeded", "currency": binding.currency, measure: binding.amount_minor}
    if any(effect.get(k) != v for k, v in expected.items()):
        raise EvidenceBlocked("exact_provider_effect_binding_mismatch")
    if kind == "charge":
        if effect.get("paid") is not True or effect.get("captured") is not True or effect["amount"] != binding.amount_minor or pi["amount"] != binding.amount_minor:
            raise EvidenceBlocked("exact_full_capture_required")
    else:
        parents = [c for c in inventory["charges"] if c["id"] == effect["charge"]]
        if len(parents) != 1 or parents[0]["payment_intent"] != binding.payment_intent or parents[0]["livemode"] is not False or parents[0].get("paid") is not True or parents[0].get("captured") is not True or parents[0]["amount_captured"] < binding.amount_minor or pi["amount"] != parents[0]["amount"]:
            raise EvidenceBlocked("refund_charge_pi_parent_binding_required")
    scope = _scoped_inventory(pi, inventory, binding.payment_intent, binding.kind,
                              binding.provider_effect_id, binding.amount_minor, binding.currency)
    correlation = key_hash(binding.idempotency_key)
    related = [e for e in inventory["events"] if e["request_idempotency_key_hash"] == correlation]
    allowed_types = {"charge.captured"} if kind == "charge" else {"refund.created", "refund.updated"}
    matched = []
    for event in related:
        ev = event.get("effect")
        if ev is None or any(ev.get(k) != v for k, v in expected.items()) or (kind == "refund" and ev.get("charge") != effect["charge"]):
            raise EvidenceBlocked("idempotency_key_reused_or_effect_mismatch")
        if event["type"] in allowed_types:
            if kind == "charge" and (ev.get("paid") is not True or ev.get("captured") is not True):
                raise EvidenceBlocked("capture_event_terminal_binding_required")
            matched.append(event["id"])
    if not matched:
        raise EvidenceBlocked("retained_exact_idempotency_event_required")
    payload = {"account_id": account["id"], "expected_account_id": binding.account_id,
               "livemode": False, "payment_intent": pi["id"], "kind": binding.kind,
               "object": kind, "provider_effect_id": effect["id"], "amount_minor": binding.amount_minor,
               "currency": binding.currency, "status": effect["status"],
               "idempotency_key": binding.idempotency_key, "idempotency_key_hash": correlation,
               "operation_id": binding.operation_id, "identity_metadata": metadata,
               "readonly_attestation_reference": readonly_attestation_reference,
               "event_ids": sorted(matched), "provider_object": effect,
               "scoped_inventory": scope,
               "scoped_inventory_hash": hashlib.sha256(_canonical(scope).encode()).hexdigest(),
               "request_hashes": [account["request_hash"], pi["request_hash"], *inventory["request_hashes"], pi_after["request_hash"], account_after["request_hash"]]}
    return _seal(payload, "stripe_readonly_reader" if operational else "offline_reader_test_only")
