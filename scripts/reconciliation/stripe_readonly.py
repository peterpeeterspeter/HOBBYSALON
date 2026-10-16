"""Stdlib-only Stripe reader. No credentials are discovered or persisted.

API: StripeReadOnly(key, *, livemode, readonly_attested, attestation_reference,
                    timeout=10, transport=None).scan() -> projected snapshot.
transport(request, timeout) is an injectable HTTP-response factory for offline tests.
read_account(expected_account_id=...) checks a fixed account identity; accounts do
not establish test/live object mode. read_payment_intent(id) retrieves one exact PI.
read_payment_intent_refunds(id) validates its actual fetched parent and paginates.
Only an independently attested restricted key is accepted; rk_ does NOT establish
read-only grants. Default transport disables proxies, redirects and retries.
scan reads ALL charge/refund pages, not charge-created windows. Events correlate
request.idempotency_key hashes to provider objects; comparison verifies exact identity.
Projections exclude customer data, client secrets and raw idempotency keys; direct PI
reads expose only five bounded identity metadata keys.
A successful full scan is not an atomic provider snapshot; writers must be fenced
for acceptance. Events are retention-bounded, so absence cannot prove no effect.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = "https://api.stripe.com"
_MAX_AMOUNT = 9007199254740991


class StripeReadBlocked(ValueError):
    """Sanitized failure: no provider response body, URL credentials or key."""


def identifier(value, prefix):
    if not isinstance(value, str) or not re.fullmatch(re.escape(prefix) + r"_[A-Za-z0-9]{1,200}", value):
        raise StripeReadBlocked("invalid_provider_id")
    return value


def key_hash(value):
    if not isinstance(value, str) or not value or len(value) > 255:
        raise StripeReadBlocked("invalid_idempotency_key")
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def request_hash(path, params):
    """Hash method/origin/path/parameters only, NEVER authentication headers."""
    body = {"method": "GET", "origin": ORIGIN, "path": path, "params": params}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _minor(value):
    if type(value) is not int or not 0 <= value <= _MAX_AMOUNT:
        raise StripeReadBlocked("invalid_minor_amount")
    return value


def _mode(obj, livemode):
    if type(obj.get("livemode")) is not bool or obj["livemode"] is not livemode:
        raise StripeReadBlocked("provider_mode_mismatch")


def project_payment_intent(obj, livemode):
    """Five fixed metadata keys, each at most 200 safe identity characters."""
    if not isinstance(obj, dict) or obj.get("object") != "payment_intent":
        raise StripeReadBlocked("unexpected_provider_object")
    _mode(obj, livemode)
    if obj.get("currency") != "eur":
        raise StripeReadBlocked("unsupported_currency_only_eur")
    if obj.get("status") not in {"requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded"}:
        raise StripeReadBlocked("unsupported_provider_status")
    raw_metadata = obj.get("metadata", {})
    if not isinstance(raw_metadata, dict):
        raise StripeReadBlocked("invalid_identity_metadata")
    metadata = {}
    for key in ("cart_id", "payment_id", "collection_id", "order_id", "run_id"):
        if key not in raw_metadata:
            continue
        value = raw_metadata[key]
        if (not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", value)
                or re.match(r"(?:sk|rk|pk)_(?:test|live)_", value) or "_secret_" in value):
            raise StripeReadBlocked("invalid_identity_metadata")
        metadata[key] = value
    return {"id": identifier(obj.get("id"), "pi"), "object": "payment_intent",
            "livemode": obj["livemode"], "status": obj["status"], "amount": _minor(obj.get("amount")),
            "currency": "eur", "metadata": metadata}


def project_effect(obj, kind, livemode, *, parent_charge=None, parent_payment_intent=None):
    if not isinstance(obj, dict) or obj.get("object") != kind:
        raise StripeReadBlocked("unexpected_provider_object")
    if kind == "refund":
        parent = None
        if parent_charge is not None:
            parent = project_effect(parent_charge, "charge", livemode)
            if parent["id"] != obj.get("charge") or (obj.get("payment_intent") is not None and parent["payment_intent"] != obj["payment_intent"]):
                raise StripeReadBlocked("refund_parent_binding_mismatch")
        if parent_payment_intent is not None:
            pi_parent = project_payment_intent(parent_payment_intent, livemode)
            if obj.get("payment_intent") != pi_parent["id"] or (parent is not None and parent["payment_intent"] != pi_parent["id"]):
                raise StripeReadBlocked("refund_parent_binding_mismatch")
            parent = pi_parent
        if "livemode" not in obj:
            if parent is None:
                raise StripeReadBlocked("refund_mode_parent_required")
            observed_mode = parent["livemode"]
        else:
            _mode(obj, livemode)
            observed_mode = obj["livemode"]
    else:
        _mode(obj, livemode)
        observed_mode = obj["livemode"]
    identity = identifier(obj.get("id"), "ch" if kind == "charge" else "re")
    currency = obj.get("currency")
    if currency != "eur":
        raise StripeReadBlocked("unsupported_currency_only_eur")
    created = obj.get("created")
    if type(created) is not int or created < 0:
        raise StripeReadBlocked("invalid_provider_timestamp")
    pi = obj.get("payment_intent")
    if pi is not None:
        identifier(pi, "pi")
    status = obj.get("status")
    allowed = {"succeeded", "pending", "failed"} if kind == "charge" else {"succeeded", "pending", "requires_action", "failed", "canceled"}
    if status not in allowed:
        raise StripeReadBlocked("unsupported_provider_status")
    result = {"id": identity, "object": kind, "livemode": observed_mode, "currency": currency,
              "created": created, "payment_intent": pi, "status": status, "amount": _minor(obj.get("amount"))}
    if kind == "charge":
        for field in ("paid", "captured"):
            if type(obj.get(field)) is not bool:
                raise StripeReadBlocked("invalid_charge_state")
            result[field] = obj[field]
        for field in ("amount_captured", "amount_refunded"):
            result[field] = _minor(obj.get(field))
        if result["amount_captured"] > result["amount"] or result["amount_refunded"] > result["amount_captured"]:
            raise StripeReadBlocked("inconsistent_charge_amounts")
        if result["captured"] and (not result["paid"] or status != "succeeded"):
            raise StripeReadBlocked("inconsistent_charge_state")
    else:
        result["charge"] = identifier(obj.get("charge"), "ch")
    return result


def project_event(obj, livemode, *, charges=None, payment_intents=None):
    if not isinstance(obj, dict) or obj.get("object") != "event":
        raise StripeReadBlocked("unexpected_provider_object")
    _mode(obj, livemode)
    identity = identifier(obj.get("id"), "evt")
    event_type = obj.get("type")
    if not isinstance(event_type, str) or not re.fullmatch(r"[a-z_]+(?:\.[a-z_]+)+", event_type):
        raise StripeReadBlocked("invalid_event_type")
    created = obj.get("created")
    if type(created) is not int or created < 0:
        raise StripeReadBlocked("invalid_provider_timestamp")
    request = obj.get("request")
    correlation = None
    if isinstance(request, dict) and request.get("idempotency_key") is not None:
        correlation = key_hash(request["idempotency_key"])
    data = obj.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("object"), dict):
        raise StripeReadBlocked("unexpected_provider_object")
    effect = data["object"]
    projected = None
    if effect.get("object") in ("charge", "refund"):
        projected = project_effect(effect, effect["object"], livemode,
                                   parent_charge=(charges or {}).get(effect.get("charge")) if effect["object"] == "refund" else None,
                                   parent_payment_intent=(payment_intents or {}).get(effect.get("payment_intent")) if effect["object"] == "refund" else None)
    return {"id": identity, "object": "event", "livemode": livemode, "created": created,
            "type": event_type, "request_idempotency_key_hash": correlation, "effect": projected}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise StripeReadBlocked("redirect_forbidden")


class StripeReadOnly:
    def __init__(self, key, *, livemode, readonly_attested=False, attestation_reference="", timeout=10, transport=None):
        if not isinstance(key, str) or not re.fullmatch(r"rk_(test|live)_[A-Za-z0-9]+", key):
            raise StripeReadBlocked("restricted_key_required")
        if type(livemode) is not bool or ("_live_" in key) is not livemode:
            raise StripeReadBlocked("key_mode_mismatch")
        if readonly_attested is not True or not isinstance(attestation_reference, str) or not attestation_reference.strip():
            raise StripeReadBlocked("external_readonly_attestation_required")
        if isinstance(timeout, bool) or not isinstance(timeout, (float, int)) or not math.isfinite(timeout) or not 0 < timeout <= 60:
            raise StripeReadBlocked("bounded_timeout_required")
        self._key = key
        self.livemode = livemode
        self.timeout = timeout
        # Provenance is construction history, not handler ducktyping. All explicitly
        # supplied callables (including real openers and falsey callables) are fixtures.
        self._internal_transport = None
        if transport is None:
            self._internal_transport = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect()).open
            self._transport = self._internal_transport
        else:
            self._transport = transport

    def __repr__(self):
        return f"StripeReadOnly(livemode={self.livemode!r}, credentials=<redacted>)"

    def _get(self, path, params=None):
        params = dict(params or {})
        listing = path in ("/v1/charges", "/v1/refunds", "/v1/events")
        direct_pi = isinstance(path, str) and re.fullmatch(r"/v1/payment_intents/pi_[A-Za-z0-9]{1,200}", path)
        if not listing and path != "/v1/account" and not direct_pi:
            raise StripeReadBlocked("endpoint_not_whitelisted")
        allowed = {"limit", "starting_after"} if listing else set()
        if path == "/v1/refunds":
            allowed.add("payment_intent")
        if set(params) - allowed:
            raise StripeReadBlocked("query_not_whitelisted")
        if "payment_intent" in params:
            identifier(params["payment_intent"], "pi")
        if "limit" in params and (type(params["limit"]) is not int or not 1 <= params["limit"] <= 100):
            raise StripeReadBlocked("invalid_page_size")
        if "starting_after" in params:
            identifier(params["starting_after"], {"/v1/charges": "ch", "/v1/refunds": "re", "/v1/events": "evt"}[path])
        url = ORIGIN + path + ("?" + urllib.parse.urlencode(sorted(params.items())) if params else "")
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + self._key, "Accept": "application/json"}, method="GET")
        try:
            with self._transport(req, timeout=self.timeout) as response:
                if response.geturl() != url:
                    raise StripeReadBlocked("redirect_forbidden")
                if response.status != 200:
                    raise StripeReadBlocked("provider_http_failure")
                payload = response.read(8_000_001)
                if len(payload) > 8_000_000:
                    raise StripeReadBlocked("provider_response_too_large")
                data = json.loads(payload)
        except StripeReadBlocked:
            raise
        except Exception:
            raise StripeReadBlocked("provider_read_failed") from None
        return data, request_hash(path, params)

    def read_account(self, *, expected_account_id=None):
        """Fixed GET /v1/account; identity only, optionally checked against a pin."""
        if expected_account_id is not None:
            identifier(expected_account_id, "acct")
        raw, fingerprint = self._get("/v1/account")
        if not isinstance(raw, dict) or raw.get("object") != "account":
            raise StripeReadBlocked("unexpected_provider_object")
        identity = identifier(raw.get("id"), "acct")
        if expected_account_id is not None and identity != expected_account_id:
            raise StripeReadBlocked("provider_account_mismatch")
        return {"id": identity, "object": "account", "request_hash": fingerprint}

    def read_payment_intent(self, payment_intent_id):
        identity = identifier(payment_intent_id, "pi")
        raw, fingerprint = self._get("/v1/payment_intents/" + identity)
        projected = project_payment_intent(raw, self.livemode)
        if projected["id"] != identity:
            raise StripeReadBlocked("provider_object_identity_mismatch")
        return {**projected, "request_hash": fingerprint}

    def read_payment_intent_refunds(self, payment_intent_id, *, page_size=100, max_pages=10000):
        pi = self.read_payment_intent(payment_intent_id)
        rows, hashes = self._pages("refund", page_size=page_size, max_pages=max_pages,
                                   payment_intent=pi["id"], payment_intents={pi["id"]: pi})
        return {"complete": True, "payment_intent": pi, "refunds": rows,
                "request_hashes": [pi["request_hash"], *hashes]}

    def _pages(self, kind, *, page_size=100, max_pages=10000, charges=None, payment_intents=None, payment_intent=None):
        if type(max_pages) is not int or not 1 <= max_pages <= 100000:
            raise StripeReadBlocked("invalid_page_bound")
        path = "/v1/" + {"charge": "charges", "refund": "refunds", "event": "events"}[kind]
        params: dict[str, object] = {"limit": page_size}
        if payment_intent is not None:
            params["payment_intent"] = identifier(payment_intent, "pi")
        seen, rows, hashes = set(), [], []
        for _ in range(max_pages):
            page, fingerprint = self._get(path, params)
            if not isinstance(page, dict) or page.get("object") != "list" or type(page.get("has_more")) is not bool or not isinstance(page.get("data"), list):
                raise StripeReadBlocked("invalid_provider_page")
            if len(page["data"]) > page_size or (not page["data"] and page["has_more"]):
                raise StripeReadBlocked("pagination_no_progress")
            hashes.append(fingerprint)
            for raw in page["data"]:
                if not isinstance(raw, dict):
                    raise StripeReadBlocked("unexpected_provider_object")
                if payment_intent is not None and raw.get("payment_intent") != payment_intent:
                    raise StripeReadBlocked("refund_parent_binding_mismatch")
                row = project_event(raw, self.livemode, charges=charges, payment_intents=payment_intents) if kind == "event" else project_effect(
                    raw, kind, self.livemode,
                    parent_charge=(charges or {}).get(raw.get("charge")) if kind == "refund" else None,
                    parent_payment_intent=(payment_intents or {}).get(raw.get("payment_intent")) if kind == "refund" else None)
                if payment_intent is not None and row["payment_intent"] != payment_intent:
                    raise StripeReadBlocked("refund_parent_binding_mismatch")
                if row["id"] in seen:
                    raise StripeReadBlocked("pagination_duplicate_id")
                seen.add(row["id"])
                rows.append(row)
            if not page["has_more"]:
                return rows, hashes
            params["starting_after"] = rows[-1]["id"]
        raise StripeReadBlocked("pagination_bound_exceeded")

    def scan(self, *, page_size=100, max_pages=10000):
        snapshot = {"complete": False, "livemode": self.livemode, "scope": "all_charges_all_refunds_retained_events", "request_hashes": []}
        for kind, plural in (("charge", "charges"), ("refund", "refunds"), ("event", "events")):
            rows, hashes = self._pages(kind, page_size=page_size, max_pages=max_pages,
                                       charges={c["id"]: c for c in snapshot.get("charges", [])})
            snapshot[plural] = rows
            snapshot["request_hashes"].extend(hashes)
        snapshot["complete"] = True
        return snapshot
