"""Offline-only tests: injected mock HTTP transport, no key/config discovery."""
import copy
import io
import json
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request
from http.client import HTTPMessage
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reconciliation.stripe_readonly import StripeReadOnly, StripeReadBlocked, _NoRedirect, key_hash, project_event, project_effect, request_hash
from reconciliation.comparison import compare, ComparisonBlocked


def charge(identity="ch_1", pi="pi_1", amount=10000):
    return {"id": identity, "object": "charge", "livemode": False, "currency": "eur", "created": 1,
            "payment_intent": pi, "status": "succeeded", "amount": amount,
            "amount_captured": amount, "amount_refunded": 0, "paid": True, "captured": True}


def refund(identity="re_1", status="succeeded", amount=2500):
    return {"id": identity, "object": "refund", "livemode": False, "currency": "eur", "created": 2,
            "payment_intent": "pi_1", "charge": "ch_1", "status": status, "amount": amount}


def payment_intent():
    return {"id": "pi_1", "object": "payment_intent", "livemode": False, "status": "succeeded",
            "amount": 10000, "currency": "eur", "metadata": {"payment_id": "pay_1", "cart_id": "cart_1"}}


def page(*rows, more=False):
    return {"object": "list", "data": list(rows), "has_more": more}


def provider(charges=None, refunds=None, events=None):
    return {"complete": True, "livemode": False, "charges": [charge()] if charges is None else charges,
            "refunds": refunds or [], "events": events or []}


def native():
    return {"payment_intent": "pi_1", "payment_id": "pay_1", "currency": "eur", "captured_at": "2026-10-05T12:00:00Z",
            "captures": [{"id": "cap_1", "amount": "100.00", "status": "completed"}], "refunds": [],
            "collection": {"captured_amount": "100.00", "refunded_amount": "0.00"},
            "transactions": [{"reference": "capture", "reference_id": "cap_1", "amount": "100.00"}], "quarantine": []}


def event(effect, key="local-operation"):
    return {"id": "evt_1", "object": "event", "livemode": False, "created": 2, "type": "charge.captured",
            "request": {"id": "req_1", "idempotency_key": key}, "data": {"object": effect}}


class Response(io.BytesIO):
    def __init__(self, body, url, status=200):
        super().__init__(json.dumps(body).encode())
        self.url, self.status = url, status

    def geturl(self):
        return self.url


class Transport:
    def __init__(self, *pages):
        self.pages, self.calls = list(pages), []

    def __call__(self, request, timeout):
        self.calls.append((request, timeout))
        if not self.pages:
            raise AssertionError("unexpected HTTP request")
        body = self.pages.pop(0)
        if isinstance(body, Exception):
            raise body
        if callable(body):
            return body(request)
        return Response(body, request.full_url)


def reader(transport, **kwargs):
    # Deliberately synthetic restricted-key-shaped fixture; never a real credential.
    return StripeReadOnly("rk_test_OFFLINEFIXTURE", livemode=False, readonly_attested=True,
                          attestation_reference="offline-test-only", transport=transport, **kwargs)


class ReaderTests(unittest.TestCase):
    def test_transport_construction_provenance_without_network(self):
        import urllib.request
        from reconciliation.evidence import _native_transport
        native = StripeReadOnly('rk_test_OFFLINEFIXTURE', livemode=False,
            readonly_attested=True, attestation_reference='synthetic')
        self.assertTrue(_native_transport(native))
        self.assertIs(native._transport, native._internal_transport)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())
        injected = reader(opener.open)
        self.assertFalse(_native_transport(injected))
        class FalseyTransport(Transport):
            def __bool__(self): return False
        transport = FalseyTransport()
        falsey = reader(transport)
        self.assertIs(falsey._transport, transport)
        self.assertFalse(_native_transport(falsey))
        native._transport = opener.open
        self.assertFalse(_native_transport(native))

    def test_full_pagination_old_charge_and_refunds(self):
        transport = Transport(page(charge(), more=True), page(charge("ch_2", "pi_2")),
                              page(refund(status="pending"), more=True), page(refund("re_2", "failed")),
                              page(event(charge()), more=True), page({**event(charge()), "id": "evt_2"}))
        snapshot = reader(transport).scan(page_size=1)
        self.assertTrue(snapshot["complete"])
        self.assertEqual(len(snapshot["charges"]), 2)
        self.assertEqual(len(snapshot["refunds"]), 2)
        for req, timeout in transport.calls:
            self.assertEqual(req.get_method(), "GET")
            self.assertEqual(urlsplit(req.full_url).netloc, "api.stripe.com")
            self.assertIsNone(req.data)
            self.assertEqual(timeout, 10)
            self.assertFalse(any("created" in k for k in parse_qs(urlsplit(req.full_url).query)))
        self.assertIn("starting_after=ch_1", transport.calls[1][0].full_url)
        self.assertIn("starting_after=re_1", transport.calls[3][0].full_url)
        self.assertIn("starting_after=evt_1", transport.calls[5][0].full_url)
        self.assertEqual(len(snapshot["events"]), 2)

    def test_no_unsupported_key_or_secret_fallback(self):
        for key in (None, "", "secret-fixture", "sk_" + "test_OFFLINEFIXTURE", "sk_" + "live_OFFLINEFIXTURE", "pk_test_FAKE", "rk_test_BAD SPACE"):
            with self.subTest(key=key), self.assertRaisesRegex(StripeReadBlocked, "restricted_key_required"):
                StripeReadOnly(key, livemode=False, readonly_attested=True, attestation_reference="test")

    def test_external_attestation_and_mode_required(self):
        with self.assertRaisesRegex(StripeReadBlocked, "external_readonly_attestation_required"):
            StripeReadOnly("rk_test_OFFLINEFIXTURE", livemode=False)
        with self.assertRaisesRegex(StripeReadBlocked, "key_mode_mismatch"):
            StripeReadOnly("rk_live_OFFLINEFIXTURE", livemode=False, readonly_attested=True, attestation_reference="test")
        live = StripeReadOnly("rk_live_OFFLINEFIXTURE", livemode=True, readonly_attested=True, attestation_reference="test", transport=Transport())
        self.assertTrue(live.livemode)

    def test_endpoint_and_idempotency_lookup_forbidden(self):
        t = Transport()
        client = reader(t)
        for path in ("https://evil.invalid/v1/charges", "/v1/charges/ch_1/capture", "/v1/payment_intents/pi_1/capture", "/v1/payment_intents/pi_bad?x"):
            with self.assertRaisesRegex(StripeReadBlocked, "endpoint_not_whitelisted"):
                client._get(path)
        with self.assertRaisesRegex(StripeReadBlocked, "query_not_whitelisted"):
            client._get("/v1/charges", {"idempotency_key": "operation"})
        self.assertEqual(t.calls, [])
        self.assertFalse(hasattr(client, "post"))

    def test_redirect_handler_prevents_second_request(self):
        with self.assertRaisesRegex(StripeReadBlocked, "redirect_forbidden"):
            _NoRedirect().redirect_request(Request("https://api.stripe.com/v1/charges"), io.BytesIO(), 302, "Found", HTTPMessage(), "https://evil.invalid")
        t = Transport(lambda req: Response(page(), "https://evil.invalid"))
        with self.assertRaisesRegex(StripeReadBlocked, "redirect_forbidden"):
            reader(t).scan()
        self.assertEqual(len(t.calls), 1)

    def test_failure_has_no_retry_or_secret_response(self):
        t = Transport(HTTPError("https://api.stripe.com", 403, "sensitive-provider-message", HTTPMessage(), None))
        with self.assertRaisesRegex(StripeReadBlocked, "^provider_read_failed$"):
            reader(t).scan()
        self.assertEqual(len(t.calls), 1)

    def test_pagination_empty_more_duplicate_bound_and_malformed(self):
        cases = [(Transport(page(more=True)), "pagination_no_progress", {}),
                 (Transport(page(charge(), more=True), page(charge())), "pagination_duplicate_id", {}),
                 (Transport(page(charge(), more=True)), "pagination_bound_exceeded", {"max_pages": 1}),
                 (Transport({"object": "list", "data": [], "has_more": "false"}), "invalid_provider_page", {})]
        for t, code, kwargs in cases:
            with self.subTest(code=code), self.assertRaisesRegex(StripeReadBlocked, code):
                reader(t).scan(**kwargs)

    def test_provider_ids_mode_currency_and_amount_are_validated(self):
        for field, value, code in (("id", "ch_bad/path", "invalid_provider_id"), ("payment_intent", "pi_bad?x", "invalid_provider_id"),
                                   ("livemode", True, "provider_mode_mismatch"), ("currency", "usd", "unsupported_currency"),
                                   ("amount", True, "invalid_minor_amount"), ("amount_captured", 10001, "inconsistent_charge_amounts")):
            c = charge(); c[field] = value
            with self.subTest(field=field), self.assertRaisesRegex(StripeReadBlocked, code):
                reader(Transport(page(c))).scan()

    def test_safe_projection_request_hash_and_event_correlation(self):
        c = charge()
        c.update({"metadata": {"secret": "do-not-output"}, "client_secret": "do-not-output", "receipt_email": "do-not-output"})
        t = Transport(page(c), page(), page(event(c)))
        snapshot = reader(t).scan()
        encoded = json.dumps(snapshot)
        self.assertNotIn("do-not-output", encoded)
        self.assertNotIn("local-operation", encoded)
        self.assertNotIn("OFFLINEFIXTURE", encoded)
        self.assertEqual(snapshot["events"][0]["request_idempotency_key_hash"], key_hash("local-operation"))
        self.assertEqual(snapshot["request_hashes"][0], request_hash("/v1/charges", {"limit": 100}))
        self.assertNotIn("OFFLINEFIXTURE", repr(reader(Transport())))

    def test_timeout_and_cursor_validation(self):
        for timeout in (0, 61, True, float("nan")):
            with self.assertRaisesRegex(StripeReadBlocked, "bounded_timeout_required"):
                reader(Transport(), timeout=timeout)
        with self.assertRaisesRegex(StripeReadBlocked, "invalid_provider_id"):
            reader(Transport())._get("/v1/refunds", {"starting_after": "ch_1"})


    def test_refund_optional_mode_requires_observed_parent(self):
        r = refund(); del r["livemode"]
        t = Transport(page(charge()), page(r), page({**event(r), "type": "refund.created"}))
        snapshot = reader(t).scan()
        self.assertIs(snapshot["refunds"][0]["livemode"], False)
        self.assertIs(snapshot["events"][0]["effect"]["livemode"], False)
        for parent, code in ((None, "refund_mode_parent_required"),
                             (charge("ch_wrong"), "refund_parent_binding_mismatch"),
                             ({**charge(), "livemode": True}, "provider_mode_mismatch")):
            with self.subTest(code=code), self.assertRaisesRegex(StripeReadBlocked, code):
                project_effect(r, "refund", False, parent_charge=parent)
        with self.assertRaisesRegex(StripeReadBlocked, "refund_mode_parent_required"):
            reader(Transport(page(), page(r))).scan()
        self.assertIs(project_effect(r, "refund", True,
                                     parent_charge={**charge(), "livemode": True})["livemode"], True)

    def test_account_fixed_get_and_pin(self):
        raw = {"id": "acct_1", "object": "account", "email": "secret-not-output"}
        t = Transport(raw)
        account = reader(t).read_account(expected_account_id="acct_1")
        self.assertEqual(account["id"], "acct_1")
        self.assertNotIn("secret-not-output", json.dumps(account))
        self.assertEqual(t.calls[0][0].get_method(), "GET")
        self.assertEqual(t.calls[0][0].full_url, "https://api.stripe.com/v1/account")
        with self.assertRaisesRegex(StripeReadBlocked, "provider_account_mismatch"):
            reader(Transport(raw)).read_account(expected_account_id="acct_other")
        with self.assertRaisesRegex(StripeReadBlocked, "query_not_whitelisted"):
            reader(Transport())._get("/v1/account", {"limit": 1})

    def test_pi_metadata_projection_and_identity(self):
        pi = payment_intent()
        pi.update({"client_secret": "secret-not-output", "customer": "secret-not-output"})
        pi["metadata"].update({"collection_id": "col_1", "order_id": "order_1", "run_id": "run-1"})
        pi["metadata"].update({"secret": "secret-not-output", "arbitrary": "secret-not-output"})
        t = Transport(pi)
        projected = reader(t).read_payment_intent("pi_1")
        self.assertEqual(projected["metadata"], {"payment_id": "pay_1", "cart_id": "cart_1",
                                               "collection_id": "col_1", "order_id": "order_1", "run_id": "run-1"})
        self.assertNotIn("secret-not-output", json.dumps(projected))
        self.assertEqual(t.calls[0][0].full_url, "https://api.stripe.com/v1/payment_intents/pi_1")
        with self.assertRaisesRegex(StripeReadBlocked, "provider_object_identity_mismatch"):
            reader(Transport({**pi, "id": "pi_other"})).read_payment_intent("pi_1")
        for value in ("x" * 201, "pi_1_secret_abc", "rk_test_OFFLINEFIXTURE", {"bad": "type"}):
            bad = payment_intent(); bad["metadata"]["run_id"] = value
            with self.subTest(value=value), self.assertRaisesRegex(StripeReadBlocked, "invalid_identity_metadata"):
                reader(Transport(bad)).read_payment_intent("pi_1")

    def test_per_pi_refunds_bound_to_fetched_pi_paginated(self):
        r = refund(); del r["livemode"]
        t = Transport(payment_intent(), page(r, more=True), page({**r, "id": "re_2"}))
        snapshot = reader(t).read_payment_intent_refunds("pi_1", page_size=1)
        self.assertTrue(snapshot["complete"])
        self.assertEqual(len(snapshot["refunds"]), 2)
        for req, _ in t.calls[1:]:
            self.assertEqual(parse_qs(urlsplit(req.full_url).query)["payment_intent"], ["pi_1"])
            self.assertEqual(req.get_method(), "GET")
        with self.assertRaisesRegex(StripeReadBlocked, "refund_parent_binding_mismatch"):
            reader(Transport(payment_intent(), page({**r, "payment_intent": "pi_other"}))).read_payment_intent_refunds("pi_1")


class ComparisonTests(unittest.TestCase):
    def codes(self, result):
        return [item["code"] for item in result["discrepancies"]]

    def test_exact_eur_clean_and_no_input_mutation(self):
        p, n = provider(), [native()]
        originals = copy.deepcopy((p, n))
        result = compare(p, n)
        self.assertTrue(result["clean"])
        self.assertEqual(result["payments"][0]["provider_capture"], "100.00")
        self.assertEqual((p, n), originals)

    def test_missing_local_capture_and_reservation_is_not_success(self):
        n = native(); n["captured_at"] = None; n["captures"][0]["status"] = "reserved"
        n["collection"]["captured_amount"] = "0"; n["transactions"] = []
        result = compare(provider(), [n])
        self.assertFalse(result["clean"])
        self.assertIn("missing_payment_captured_at", self.codes(result))
        mismatches = [d for d in result["discrepancies"] if d["code"] == "gross_amount_mismatch"]
        self.assertEqual(len(mismatches), 3)
        self.assertTrue(result["unfinal"])

    def test_provider_only_unknown_pi_is_never_skipped(self):
        result = compare(provider([charge(), charge("ch_2", "pi_unknown")]), [native()])
        self.assertIn("provider_only_payment_intent", self.codes(result))
        self.assertEqual(len(result["payments"]), 2)

    def test_native_only_accounted_capture_mismatch(self):
        result = compare(provider([]), [native()])
        self.assertIn("gross_amount_mismatch", self.codes(result))

    def test_pending_and_requires_action_refunds_are_unfinal(self):
        for status in ("pending", "requires_action"):
            result = compare(provider(refunds=[refund(status=status)]), [native()])
            self.assertEqual(result["status"], "unfinal")
            self.assertFalse(result["clean"])
            self.assertEqual(result["payments"][0]["provider_refund"], "0.00")

    def test_failed_and_canceled_refunds_not_settled(self):
        for status in ("failed", "canceled"):
            self.assertTrue(compare(provider(refunds=[refund(status=status)]), [native()])["clean"])

    def test_succeeded_refund_compares_all_three_gross_ledgers(self):
        c = charge(); c["amount_refunded"] = 2500
        n = native()
        result = compare(provider([c], [refund()]), [n])
        self.assertEqual(len([d for d in result["discrepancies"] if d["code"] == "gross_amount_mismatch"]), 3)
        n["refunds"] = [{"id": "ref_1", "amount": "25.00", "status": "completed"}]
        n["collection"]["refunded_amount"] = "25.00"
        n["transactions"].append({"reference": "refund", "reference_id": "ref_1", "amount": "-25.00"})
        blocked = compare(provider([c], [refund()]), [n])
        self.assertTrue(blocked["gross_clean"])
        self.assertFalse(blocked["clean"])
        self.assertFalse(blocked["identity_verified"])
        n["refunds"][0]["idempotency_key"] = "refund-operation"
        e = {**event(refund(), "refund-operation"), "type": "refund.created"}
        exact = compare(provider([c], [refund()], [project_event(e, False)]), [n])
        self.assertTrue(exact["clean"])
        self.assertTrue(exact["identity_verified"])

    def test_equal_net_cannot_hide_gross_mismatch(self):
        c = charge(); c["amount_refunded"] = 2500
        n = native(); n["captures"][0]["amount"] = "75"; n["collection"]["captured_amount"] = "75"; n["transactions"][0]["amount"] = "75"
        result = compare(provider([c], [refund()]), [n])
        self.assertEqual(len([d for d in result["discrepancies"] if d["code"] == "gross_amount_mismatch"]), 6)

    def test_capture_timestamp_and_accounting_all_required(self):
        for change in ("timestamp", "completed", "collection", "transactions"):
            n = native()
            if change == "timestamp": n["captured_at"] = None
            if change == "completed": n["captures"] = []
            if change == "collection": n["collection"]["captured_amount"] = "0"
            if change == "transactions": n["transactions"] = []
            self.assertFalse(compare(provider(), [n])["clean"], change)

    def test_quarantine_blocks_even_when_amounts_match(self):
        n = native(); n["quarantine"] = ["sensitive-reason-not-echoed"]
        result = compare(provider(), [n])
        self.assertIn("native_quarantined", self.codes(result))
        self.assertNotIn("sensitive-reason", json.dumps(result))

    def test_unsupported_currency_fractional_minor_float_and_incomplete_blocked(self):
        for field, value in (("currency", "usd"),):
            n = native(); n[field] = value
            with self.assertRaises(ComparisonBlocked): compare(provider(), [n])
        for amount in ("1.001", 100.0, "NaN"):
            n = native(); n["captures"][0]["amount"] = amount
            with self.assertRaises(ComparisonBlocked): compare(provider(), [n])
        p = provider(); p["complete"] = False
        with self.assertRaises(ComparisonBlocked): compare(p, [native()])
        with self.assertRaises(ComparisonBlocked): compare(provider(), [native()], native_complete=False)

    def test_idempotency_requires_exact_inventory_object_binding(self):
        n = native(); n["captures"][0]["idempotency_key"] = "local-operation"
        p = provider(events=[project_event(event(charge()), False)])
        result = compare(p, [n])
        self.assertTrue(result["clean"])
        correlation = result["correlations"][0]
        self.assertTrue(correlation["compatible"])
        self.assertTrue(correlation["exact_binding_verified"])
        self.assertEqual(correlation["binding"], "event_idempotency_exact_object")
        self.assertNotIn("local-operation", json.dumps(result))
        p["events"] = [project_event(event(charge(pi="pi_other")), False)]
        self.assertIn("event_idempotency_correlation_mismatch", self.codes(compare(p, [n])))
        p["events"] = [project_event(event(charge("ch_notinventory")), False)]
        result = compare(p, [n])
        self.assertFalse(result["clean"])
        self.assertTrue(result["gross_clean"])
        self.assertIn("native_effect_identity_unverified", self.codes(result))

    def test_missing_event_does_not_prove_no_effect(self):
        n = native(); n["captures"][0]["idempotency_key"] = "not-retained"
        result = compare(provider(), [n])
        self.assertEqual(result["correlations"], [])
        self.assertFalse(result["clean"])
        self.assertTrue(result["gross_clean"])
        self.assertIn("native_effect_identity_unverified", self.codes(result))

    def test_transaction_binding_and_duplicates_not_just_sum(self):
        n = native(); n["transactions"][0]["reference_id"] = "wrong_capture"
        self.assertIn("order_transaction_completion_binding_mismatch", self.codes(compare(provider(), [n])))
        n = native(); n["transactions"].append(copy.deepcopy(n["transactions"][0]))
        self.assertIn("duplicate_order_transaction", self.codes(compare(provider(), [n])))

    def test_refund_charge_pi_mismatch_and_inventory_gap(self):
        c = charge(); c["amount_refunded"] = 2500
        self.assertIn("provider_refund_inventory_mismatch", self.codes(compare(provider([c]), [native()])))
        r = refund(); r["payment_intent"] = "pi_unknown"
        with self.assertRaisesRegex(ComparisonBlocked, "refund_parent_binding_mismatch"):
            compare(provider([c], [r]), [native()])

    def test_equal_refund_swaps_and_reused_keys_never_clean(self):
        c = charge(); c["amount_refunded"] = 2500
        n = native()
        n["refunds"] = [{"id": "ref_1", "amount": "25.00", "status": "completed", "idempotency_key": "refund-op", "provider_effect_id": "re_wrong"}]
        n["collection"]["refunded_amount"] = "25.00"
        n["transactions"].append({"reference": "refund", "reference_id": "ref_1", "amount": "-25.00"})
        e = project_event({**event(refund(), "refund-op"), "type": "refund.created"}, False)
        result = compare(provider([c], [refund()], [e]), [n])
        self.assertTrue(result["gross_clean"])
        self.assertFalse(result["clean"])
        del n["refunds"][0]["provider_effect_id"]
        n["refunds"].append({"id": "ref_2", "amount": "25.00", "status": "failed", "idempotency_key": "refund-op"})
        result = compare(provider([c], [refund()], [e]), [n])
        self.assertTrue(result["gross_clean"])
        self.assertFalse(result["clean"])


    def test_refund_parent_projection_and_mode_mismatch_comparison(self):
        c = charge(); c["amount_refunded"] = 2500
        r = refund(); del r["livemode"]
        result = compare(provider([c], [r]), [native()])
        self.assertEqual(result["payments"][0]["provider_refund"], "25.00")
        with self.assertRaisesRegex(ComparisonBlocked, "refund_mode_parent_required"):
            compare(provider([], [r]), [native()])
        with self.assertRaisesRegex(ComparisonBlocked, "provider_mode_mismatch"):
            compare(provider([c], [{**r, "livemode": True}]), [native()])

    def test_multiple_charge_capture_sums_do_not_prove_identity(self):
        c1, c2 = charge(amount=5000), charge("ch_2", amount=5000)
        result = compare(provider([c1, c2]), [native()])
        self.assertTrue(result["gross_clean"])
        self.assertFalse(result["clean"])
        self.assertIn("native_effect_identity_unverified", self.codes(result))

    def test_valid_event_does_not_hide_another_wrong_object_same_key(self):
        n = native(); n["captures"][0]["idempotency_key"] = "capture-key"
        valid = project_event(event(charge(), "capture-key"), False)
        wrong = project_event({**event(charge("ch_wrong"), "capture-key"), "id": "evt_2"}, False)
        result = compare(provider(events=[valid, wrong]), [n])
        self.assertTrue(result["gross_clean"])
        self.assertFalse(result["clean"])
        self.assertIn("event_exact_object_binding_mismatch", self.codes(result))


    def test_refund_wrong_event_type_or_amount_never_proves_binding(self):
        c = charge(); c["amount_refunded"] = 2500
        n = native()
        n["refunds"] = [{"id": "ref_1", "amount": "25.00", "status": "completed", "idempotency_key": "refund-key"}]
        n["collection"]["refunded_amount"] = "25.00"
        n["transactions"].append({"reference": "refund", "reference_id": "ref_1", "amount": "-25.00"})
        for effect, event_type in ((refund(), "charge.captured"), (refund(amount=2499), "refund.created")):
            e = project_event({**event(effect, "refund-key"), "type": event_type}, False)
            result = compare(provider([c], [refund()], [e]), [n])
            self.assertTrue(result["gross_clean"])
            self.assertFalse(result["clean"])
            self.assertFalse(result["identity_verified"])

    def test_multiple_local_refunds_cannot_claim_single_provider_refund(self):
        c = charge(); c["amount_refunded"] = 2500
        n = native()
        n["refunds"] = [{"id": "ref_1", "amount": "25.00", "status": "completed", "idempotency_key": "refund-key-1"},
                        {"id": "ref_2", "amount": "25.00", "status": "completed", "idempotency_key": "refund-key-2"}]
        events = [project_event({**event(refund(), key), "id": "evt_" + str(i), "type": "refund.created"}, False)
                  for i, key in enumerate(("refund-key-1", "refund-key-2"))]
        result = compare(provider([c], [refund()], events), [n])
        self.assertFalse(result["clean"])
        self.assertIn("provider_effect_multiple_native_bindings", self.codes(result))


    def test_native_effect_identity_cannot_repeat_across_payments(self):
        n1, n2 = native(), native()
        n2["payment_intent"] = "pi_2"; n2["payment_id"] = "pay_2"
        with self.assertRaisesRegex(ComparisonBlocked, "duplicate_native_effect_across_payments"):
            compare(provider([charge(), charge("ch_2", "pi_2")]), [n1, n2])


if __name__ == "__main__":
    unittest.main()
