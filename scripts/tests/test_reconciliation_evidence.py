"""Offline real-reader regressions. No provider HTTP or real credential ever used."""
import copy
import hashlib
import json
import sys
import unittest
from dataclasses import replace
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reconciliation.evidence import (EvidenceBinding, EvidenceBlocked, StripeReadOnlyReader,
    authenticate_evidence, offline_fixture_evidence, read_evidence)
from reconciliation.native_repair import RepairBlocked, generate_sql, plan_case, apply_case
from test_reconciliation_native import fixture, gates, FakeConnection


class Response:
    status = 200
    def __init__(self, request, data):
        self.url, self.data = request.full_url, data
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def geturl(self):
        return self.url
    def read(self, limit):
        return json.dumps(self.data).encode()[:limit]


def reader_fixture(kind="refund_success"):
    native = fixture(kind)
    evidence = native["evidence"]
    charge = {"object": "charge", "id": "ch_a", "payment_intent": "pi_a", "currency": "eur",
              "livemode": False, "status": "succeeded", "created": 1, "amount": 1000,
              "amount_captured": 1000, "amount_refunded": 250 if kind == "refund_success" else 0,
              "paid": True, "captured": True}
    refund = {"object": "refund", "id": "re_a", "payment_intent": "pi_a", "charge": "ch_a",
              "currency": "eur", "status": "succeeded", "created": 2, "amount": 250}
    event = {"object": "event", "id": "evt_a", "type": "refund.created" if kind == "refund_success" else "charge.captured",
             "livemode": False, "created": 3, "request": {"idempotency_key": evidence["idempotency_key"]},
             "data": {"object": refund if kind == "refund_success" else charge}}
    data = {"/v1/account": {"id": "acct_TestOnly", "object": "account"},
            "/v1/payment_intents/pi_a": {"id": "pi_a", "object": "payment_intent", "livemode": False,
                "amount": 1000, "currency": "eur", "status": "succeeded", "metadata": copy.deepcopy(evidence["identity_metadata"])},
            "/v1/charges": {"object": "list", "has_more": False, "data": [charge]},
            "/v1/refunds": {"object": "list", "has_more": False, "data": [refund] if kind == "refund_success" else []},
            "/v1/events": {"object": "list", "has_more": False, "data": [event]}}
    calls = []
    def transport(request, timeout):
        calls.append((request.get_method(), urlparse(request.full_url).path))
        return Response(request, data[urlparse(request.full_url).path])
    reader = StripeReadOnlyReader("rk_test_OFFLINEFIXTURE", livemode=False, readonly_attested=True,
                                  attestation_reference="test-only-grant", transport=transport)
    binding = EvidenceBinding("acct_TestOnly", "pi_a", kind, "re_a" if kind == "refund_success" else "ch_a",
        evidence["amount_minor"], "eur", evidence["idempotency_key"], evidence["operation_id"], evidence["identity_metadata"])
    return reader, binding, data, calls, native


def read_fixture(reader, binding):
    return read_evidence(reader, binding, readonly_attestation_reference="test-only-grant", isolated_test_only=True)


class EvidenceTests(unittest.TestCase):
    def test_f1_injected_real_opener_is_always_test_only(self):
        import urllib.request
        from reconciliation.stripe_readonly import _NoRedirect
        from reconciliation.evidence import _native_transport
        _, binding, data, calls, native = reader_fixture()
        class FixtureHTTPS(urllib.request.BaseHandler):
            handler_order = 100
            def https_open(self, request):
                calls.append(('IN_MEMORY', urlparse(request.full_url).path))
                response = Response(request, data[urlparse(request.full_url).path])
                setattr(response, 'code', 200)
                setattr(response, 'msg', 'OK')
                setattr(response, 'info', lambda: {})
                return response
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect(), FixtureHTTPS())
        reader = StripeReadOnlyReader('rk_test_OFFLINEFIXTURE', livemode=False,
            readonly_attested=True, attestation_reference='synthetic', transport=opener.open)
        self.assertFalse(_native_transport(reader))
        with self.assertRaisesRegex(EvidenceBlocked, 'injected_reader_is_test_only'):
            read_evidence(reader, binding, readonly_attestation_reference='synthetic')
        self.assertEqual(calls, [])
        receipt = read_fixture(reader, binding)
        self.assertEqual(len(calls), 7)
        with self.assertRaisesRegex(EvidenceBlocked, 'nonoperational'):
            authenticate_evidence(receipt)
        native['evidence'] = receipt
        plan = plan_case(native)
        with self.assertRaisesRegex(RepairBlocked, 'nonoperational'):
            generate_sql(plan, replace(gates(plan), isolated_test_only=False, database='existing_sandbox'))

    def test_f2_exact_second_successful_refund_repro_blocks(self):
        reader, binding, data, _, native = reader_fixture()
        data['/v1/charges']['data'][0]['amount_refunded'] = 500
        data['/v1/refunds']['data'].append(dict(data['/v1/refunds']['data'][0], id='re_extra'))
        with self.assertRaisesRegex(EvidenceBlocked, 'scoped_'):
            native['evidence'] = read_fixture(reader, binding)
            plan_case(native)

    def test_f2_scoped_adversarial_shapes_block(self):
        mutations = ('extra_charge', 'pending_charge', 'partial_capture', 'refund_total',
                     'pending_refund', 'requires_action_refund', 'same_pi_other_charge',
                     'same_charge_other_pi', 'capture_with_refund', 'capture_hidden_refund_total')
        for mutation in mutations:
            kind = 'capture_success' if mutation.startswith('capture_') else 'refund_success'
            reader, binding, data, _, _ = reader_fixture(kind)
            charge = data['/v1/charges']['data'][0]
            refund = {'object': 'refund', 'id': 're_extra', 'payment_intent': 'pi_a',
                      'charge': 'ch_a', 'currency': 'eur', 'status': 'succeeded', 'created': 2, 'amount': 250}
            if mutation == 'extra_charge':
                data['/v1/charges']['data'].append(dict(charge, id='ch_extra', amount_refunded=0))
            elif mutation == 'pending_charge':
                data['/v1/charges']['data'].append(dict(charge, id='ch_extra', status='pending', paid=False, captured=False, amount_captured=0, amount_refunded=0))
            elif mutation == 'partial_capture': charge['amount_captured'] = 500
            elif mutation == 'refund_total': charge['amount_refunded'] = 500
            elif mutation in ('pending_refund', 'requires_action_refund'):
                refund['status'] = 'pending' if mutation == 'pending_refund' else 'requires_action'
                data['/v1/refunds']['data'].append(refund)
            elif mutation == 'same_pi_other_charge':
                refund['charge'] = 'ch_other'; refund['livemode'] = False
                data['/v1/refunds']['data'].append(refund)
            elif mutation == 'same_charge_other_pi':
                refund['payment_intent'] = 'pi_other'; refund['livemode'] = False
                data['/v1/refunds']['data'].append(refund)
            elif mutation == 'capture_with_refund':
                charge['amount_refunded'] = 250
                data['/v1/refunds']['data'].append(refund)
            else: charge['amount_refunded'] = 250
            with self.subTest(mutation=mutation), self.assertRaises(EvidenceBlocked):
                read_fixture(reader, binding)

    def test_f2_scope_hash_contract_and_fixture_adapter(self):
        from reconciliation.evidence import _seal
        for kind in ('capture_success', 'refund_success'):
            reader, binding, _, _, native = reader_fixture(kind)
            receipt = read_fixture(reader, binding)
            scope = receipt['scoped_inventory']
            self.assertEqual(scope['captured_minor'], 1000)
            self.assertEqual(scope['refunded_minor'], 250 if kind == 'refund_success' else 0)
            encoded = json.dumps(scope, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
            self.assertEqual(receipt['scoped_inventory_hash'], hashlib.sha256(encoded.encode()).hexdigest())
            adapted = offline_fixture_evidence(native['evidence'], payment_intent=scope['payment_intent'],
                inventory={'complete': True, 'livemode': False, 'charges': scope['charges'], 'refunds': scope['refunds']})
            self.assertEqual(authenticate_evidence(adapted, allow_test_only=True), 'offline_fixture_test_only')
            for mutation in ('missing', 'hash', 'total', 'metadata', 'selected_object'):
                changed = copy.deepcopy(receipt)
                if mutation == 'missing': changed.pop('scoped_inventory')
                elif mutation == 'hash': changed['scoped_inventory_hash'] = '0' * 64
                elif mutation == 'total': changed['scoped_inventory']['refunded_minor'] = 999
                elif mutation == 'metadata': changed['scoped_inventory']['payment_intent']['metadata'] = {}
                else: changed['provider_object'] = {}
                # Trusted test issuer re-MAC isolates semantic validation from the MAC.
                changed = _seal(changed, 'offline_reader_test_only')
                with self.subTest(kind=kind, mutation=mutation), self.assertRaises(EvidenceBlocked):
                    authenticate_evidence(changed, allow_test_only=True)

    def test_real_reader_offline_bridge_binds_every_dimension(self):
        for kind in ("refund_success", "capture_success"):
            reader, binding, data, calls, native = reader_fixture(kind)
            evidence = read_fixture(reader, binding)
            self.assertEqual(authenticate_evidence(evidence, allow_test_only=True), "offline_reader_test_only")
            self.assertNotIn("verified", evidence)
            self.assertEqual(evidence["account_id"], binding.account_id)
            self.assertEqual(evidence["provider_effect_id"], binding.provider_effect_id)
            self.assertEqual(evidence["operation_id"], binding.operation_id)
            self.assertEqual(evidence["identity_metadata"], dict(binding.identity_metadata))
            self.assertEqual(evidence["idempotency_key_hash"], hashlib.sha256(binding.idempotency_key.encode()).hexdigest())
            self.assertEqual(evidence["provider_object"]["object"], "charge" if kind == "capture_success" else "refund")
            self.assertTrue(all(method == "GET" for method, _ in calls))
            self.assertEqual([path for _, path in calls], ["/v1/account", "/v1/payment_intents/pi_a", "/v1/charges", "/v1/refunds", "/v1/events", "/v1/payment_intents/pi_a", "/v1/account"])
            native["evidence"] = evidence
            p = plan_case(native)
            self.assertEqual(p.status, "ready")
            with self.assertRaisesRegex(RepairBlocked, "nonoperational"):
                generate_sql(p, replace(gates(p), isolated_test_only=False))

    def test_no_credential_has_no_calls_and_never_operational_evidence(self):
        reader, binding, _, calls, _ = reader_fixture()
        with self.assertRaisesRegex(EvidenceBlocked, "credential_unavailable_nonoperational"):
            read_evidence(None, binding, readonly_attestation_reference="anything")
        self.assertEqual(calls, [])
        with self.assertRaisesRegex(EvidenceBlocked, "injected_reader_is_test_only"):
            read_evidence(reader, binding, readonly_attestation_reference="anything")
        self.assertEqual(calls, [])

    def test_arbitrary_verified_flag_and_external_receipt_are_not_authority(self):
        native = fixture()
        native["evidence"].pop("authentication")
        native["evidence"]["verified"] = True
        with self.assertRaisesRegex(RepairBlocked, "authenticated_reader_evidence_required"):
            plan_case(native)
        native["evidence"]["authentication"] = {"version": 1, "source": "stripe_readonly_reader", "mac": "0" * 64}
        with self.assertRaises(RepairBlocked):
            plan_case(native)

    def test_all_bound_fields_are_mac_protected(self):
        reader, binding, _, _, _ = reader_fixture()
        evidence = read_fixture(reader, binding)
        changes = {"account_id": "acct_Other", "expected_account_id": "acct_Other", "livemode": True,
                   "payment_intent": "pi_Other", "kind": "capture_success", "object": "charge",
                   "provider_effect_id": "re_Other", "amount_minor": 251, "currency": "usd",
                   "idempotency_key": "another", "idempotency_key_hash": "0" * 64,
                   "operation_id": "op_other", "identity_metadata": {}, "event_ids": [],
                   "request_hashes": [], "provider_object": {}, "readonly_attestation_reference": "other"}
        for key, value in changes.items():
            changed = copy.deepcopy(evidence)
            changed[key] = value
            with self.subTest(key=key), self.assertRaises(EvidenceBlocked):
                authenticate_evidence(changed, allow_test_only=True)
        changed = copy.deepcopy(evidence)
        changed["authentication"]["source"] = "stripe_readonly_reader"
        with self.assertRaises(EvidenceBlocked):
            authenticate_evidence(changed)

    def test_exact_kind_ids_reject_wrong_prefix_suffix_and_unicode(self):
        for kind, bad in (("refund_success", "ch_a"), ("capture_success", "re_a"),
                          ("refund_success", "re_"), ("capture_success", "ch_a_b"),
                          ("refund_success", "re_é"), ("refund_success", "provider_a")):
            native = fixture(kind)
            native["evidence"]["provider_effect_id"] = bad
            native["evidence"] = offline_fixture_evidence(native["evidence"])
            with self.subTest(kind=kind, bad=bad), self.assertRaisesRegex(RepairBlocked, "kind_bound_provider_identity"):
                plan_case(native)

    def test_reader_data_mismatches_and_missing_identity_event_block(self):
        for mutation in ("account", "metadata", "mode", "pi", "object", "amount", "currency", "status", "key", "charge", "no_event", "reused_key", "parent"):
            reader, binding, data, _, _ = reader_fixture()
            refund = data["/v1/refunds"]["data"][0]
            if mutation == "account":
                data["/v1/account"]["id"] = "acct_Wrong"
            elif mutation == "metadata":
                data["/v1/payment_intents/pi_a"]["metadata"]["order_id"] = "order_other"
            elif mutation == "mode":
                refund["livemode"] = True
            elif mutation == "pi":
                refund["payment_intent"] = "pi_other"
            elif mutation == "object":
                refund["object"] = "charge"
            elif mutation == "amount":
                refund["amount"] = 251
            elif mutation == "currency":
                refund["currency"] = "usd"
            elif mutation == "status":
                refund["status"] = "pending"
            elif mutation == "key":
                data["/v1/events"]["data"][0]["request"]["idempotency_key"] = "other"
            elif mutation == "charge":
                refund["charge"] = "ch_wrong"
            elif mutation == "parent":
                data["/v1/charges"]["data"][0]["payment_intent"] = "pi_other"
            elif mutation == "no_event":
                data["/v1/events"]["data"] = []
            else:
                other = copy.deepcopy(data["/v1/events"]["data"][0])
                other["id"], other["data"]["object"]["id"] = "evt_other", "re_other"
                data["/v1/events"]["data"].append(other)
            with self.subTest(mutation=mutation), self.assertRaises(EvidenceBlocked):
                read_fixture(reader, binding)

    def test_offline_fixture_cannot_unlock_either_real_sandbox_or_production(self):
        case = plan_case(fixture())
        for database in ("hobbysalon_e2e_fixed_3bea5f66", "hobbysalon_e2e_gate_53332bce", "production", "hs_recon_it_fake"):
            for enabled in (True, False):
                g = replace(gates(case), database=database, isolated_test_only=enabled)
                conn = FakeConnection(())
                with self.subTest(database=database, enabled=enabled), self.assertRaises(RepairBlocked):
                    apply_case(conn, case, g)
                self.assertEqual(conn.seen, [])
                self.assertEqual(conn.commits, 0)

    def test_authenticated_fixture_still_requires_native_identity_operation_and_key(self):
        for key, value in (("identity_metadata", {}), ("operation_id", "op_other"),
                           ("idempotency_key", "ref_other"), ("account_id", "acct_other"),
                           ("object", "charge"), ("kind", "capture_success")):
            native = fixture()
            native["evidence"][key] = value
            native["evidence"] = offline_fixture_evidence(native["evidence"])
            with self.subTest(key=key), self.assertRaises(RepairBlocked):
                plan_case(native)


if __name__ == "__main__":
    unittest.main()
