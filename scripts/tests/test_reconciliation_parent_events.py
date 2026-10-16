"""Offline regression only; all native rows/fixtures are RECONSTRUCTED, not DB evidence.

Saved provider projecties are read-only historical inputs, never new provider proof.
No reader, DB adapter, credentials, network, build or operational acceptance is used.
"""
import copy
import hashlib
import json
import sys
import unittest
from unittest.mock import patch
import builtins
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reconciliation.comparison import compare, ComparisonBlocked
import reconciliation.comparison as comparator
from reconciliation.stripe_readonly import key_hash

SAVED = Path('/home/hermes/audits/hobbysalon-reconciliation-20261005/provider-user-confirmed')


def reconstructed(partials=(200,)):
    charge = {'id': 'ch_parent', 'object': 'charge', 'livemode': False,
              'currency': 'eur', 'created': 1, 'payment_intent': 'pi_parent',
              'status': 'succeeded', 'amount': 1000, 'amount_captured': 1000,
              'amount_refunded': sum(partials), 'paid': True, 'captured': True}
    row = {'payment_intent': 'pi_parent', 'payment_id': 'pay_reconstructed',
           'currency': 'eur', 'captured_at': 'reconstructed-timestamp',
           'captures': [{'id': 'cap_reconstructed', 'amount': '10.00', 'status': 'completed'}],
           'refunds': [], 'collection': {'captured_amount': '10.00',
                                       'refunded_amount': str(Decimal(sum(partials)) / 100)},
           'transactions': [{'reference': 'capture', 'reference_id': 'cap_reconstructed', 'amount': '10.00'}],
           'quarantine': []}
    provider = {'complete': True, 'livemode': False, 'charges': [charge], 'refunds': [], 'events': []}
    cumulative = 0
    for i, amount in enumerate(partials):
        key = 'reconstructed-refund-' + str(i)
        refund = {'id': 're_' + str(i), 'object': 'refund', 'livemode': False,
                  'currency': 'eur', 'created': 2 + i, 'payment_intent': 'pi_parent',
                  'charge': 'ch_parent', 'status': 'succeeded', 'amount': amount}
        provider['refunds'].append(refund)
        row['refunds'].append({'id': 'ref_' + str(i), 'amount': str(Decimal(amount) / 100),
                               'status': 'completed', 'idempotency_key': key, 'provider_effect_id': refund['id']})
        row['transactions'].append({'reference': 'refund', 'reference_id': 'ref_' + str(i),
                                    'amount': str(-Decimal(amount) / 100)})
        cumulative += amount
        # Parent before refund receipt deliberately tests order independence.
        for kind, effect in [('charge.refunded', {**charge, 'amount_refunded': cumulative}),
                             ('refund.created', refund)]:
            provider['events'].append({'id': 'evt_' + str(i) + ('p' if kind.startswith('charge') else 'r'),
                                       'object': 'event', 'livemode': False, 'created': 2 + i,
                                       'type': kind, 'request_idempotency_key_hash': key_hash(key),
                                       'effect': copy.deepcopy(effect)})
    return provider, [row]


def saved_reconstructed():
    """Three healthy PIs reconstructed from diagnostic amounts/exact correlations.

    Neither raw DB rows nor native completion are independently re-observed here.
    """
    expected = {'PROVIDER-PROJECTED.json': 'cbf475177c9c91edd8e186b7729560f8e3ef3bc0a6e60bb7986f176542cc2f38',
                'FULL-DIAGNOSTIC.json': '7531d4122ae8e1be95e142b6c3342462797aa1cdf74e9141fdef6bffef9a43b2'}
    loaded = {}
    for name, digest in expected.items():
        data = (SAVED / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise AssertionError('saved input integrity changed: ' + name)
        loaded[name] = json.loads(data)
    provider = loaded['PROVIDER-PROJECTED.json']
    diagnostic = loaded['FULL-DIAGNOSTIC.json']['global_comparison']
    refunds = {r['id']: r for r in provider['refunds']}
    exact = [c for c in diagnostic['correlations'] if c['binding'] == 'event_idempotency_exact_object'
             and c['provider_effect_id'] in refunds]
    pis = {refunds[c['provider_effect_id']]['payment_intent'] for c in exact}
    rows = []
    for pi in sorted(pis):
        payment = next(p for p in diagnostic['payments'] if p['payment_intent'] == pi)
        capture = next(c for c in diagnostic['correlations'] if c['binding'] == 'unique_payment_intent_charge'
                       and any(ch['id'] == c['provider_effect_id'] and ch['payment_intent'] == pi for ch in provider['charges']))
        row = {'payment_intent': pi, 'payment_id': 'pay_reconstructed_' + str(len(rows)), 'currency': 'eur',
               'captured_at': 'reconstructed-timestamp', 'quarantine': [],
               'captures': [{'id': capture['native_effect_id'], 'amount': payment['native']['capture_completed'], 'status': 'completed'}],
               'refunds': [], 'collection': {'captured_amount': payment['native']['capture_collection'],
                                           'refunded_amount': payment['native']['refund_collection']},
               'transactions': [{'reference': 'capture', 'reference_id': capture['native_effect_id'],
                                 'amount': payment['native']['capture_transactions']}]}
        for correlation in exact:
            refund = refunds[correlation['provider_effect_id']]
            if refund['payment_intent'] != pi:
                continue
            native_id = correlation['native_effect_id']
            assert key_hash(native_id) == correlation['request_idempotency_key_hash']
            amount = str(Decimal(refund['amount']) / 100)
            row['refunds'].append({'id': native_id, 'amount': amount, 'status': 'completed',
                                  'idempotency_key': native_id, 'provider_effect_id': refund['id']})
            row['transactions'].append({'reference': 'refund', 'reference_id': native_id, 'amount': '-' + amount})
        rows.append(row)
    provider['charges'] = [c for c in provider['charges'] if c['payment_intent'] in pis]
    provider['refunds'] = [r for r in provider['refunds'] if r['payment_intent'] in pis]
    assert len(rows) == 3 and sum(len(r['refunds']) for r in rows) == 4
    return provider, rows


class ParentEventTests(unittest.TestCase):
    def codes(self, result):
        return [d['code'] for d in result['discrepancies']]

    def assert_closed(self, provider, rows):
        try:
            result = compare(provider, rows)
        except ComparisonBlocked:
            return
        self.assertFalse(result['clean'])
        self.assertFalse(result['identity_verified'])

    def assert_parent_informative(self, provider, result, rows):
        local_hashes = {key_hash(e['idempotency_key']) for row in rows
                        for e in row['captures'] + row['refunds'] if e.get('idempotency_key') is not None}
        parent_ids = {e['id'] for e in provider['events'] if e['type'] in ('charge.refunded', 'charge.updated')
                      and e.get('request_idempotency_key_hash') in local_hashes}
        correlations = [c for c in result['correlations'] if c.get('event_id') in parent_ids]
        self.assertEqual(len(correlations), len(parent_ids))
        for c in correlations:
            self.assertTrue(c['compatible'])
            self.assertFalse(c['exact_binding_verified'])
            self.assertEqual(c['binding'], 'parent_charge_refund_correlation_only')

    def test_same_hash_parent_and_exact_refund_no_false_mismatch(self):
        provider, rows = reconstructed()
        original = copy.deepcopy((provider, rows))
        result = compare(provider, rows)
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assert_parent_informative(provider, result, rows)
        self.assertEqual((provider, rows), original)

    def test_partial_two_eight_parent_cumulative_ten(self):
        provider, rows = reconstructed((200, 800))
        result = compare(provider, rows)
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assert_parent_informative(provider, result, rows)
        self.assertEqual(result['payments'][0]['provider_refund'], '10.00')
        self.assertEqual(sum(c['exact_binding_verified'] for c in result['correlations']), 3)

    def test_charge_updated_counterfactual(self):
        provider, rows = reconstructed((200, 800))
        for event in provider['events']:
            if event['type'] == 'charge.refunded':
                event['type'] = 'charge.updated'
        result = compare(provider, rows)
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assert_parent_informative(provider, result, rows)

    def test_parent_only_never_refund_receipt_even_with_pin(self):
        provider, rows = reconstructed()
        provider['events'] = provider['events'][:1]
        result = compare(provider, rows)
        self.assertFalse(result['clean'])
        self.assertIn('native_effect_identity_unverified', self.codes(result))
        self.assertFalse(any(c.get('exact_binding_verified') for c in result['correlations'] if c.get('event_id')))

    def test_reserved_refund_parent_informative_not_completed(self):
        provider, rows = reconstructed()
        rows[0]['refunds'][0]['status'] = 'reserved'
        rows[0]['collection']['refunded_amount'] = '0'
        rows[0]['transactions'] = rows[0]['transactions'][:1]
        result = compare(provider, rows)
        self.assertFalse(result['clean'])
        self.assertNotIn('event_idempotency_correlation_mismatch', self.codes(result))
        self.assertIn('gross_amount_mismatch', self.codes(result))
        self.assertIn('provider_effect_identity_unverified', self.codes(result))
        self.assertTrue(result['unfinal'])
        self.assert_parent_informative(provider, result, rows)

    def test_parent_wrong_pi_id_capture_amount_or_cumulative_fail_closed(self):
        for field, value in [('payment_intent', 'pi_wrong'), ('id', 'ch_wrong'),
                             ('amount_captured', 999), ('amount', 1001),
                             ('amount_refunded', 0), ('amount_refunded', 201)]:
            with self.subTest(field=field, value=value):
                provider, rows = reconstructed()
                provider['events'][0]['effect'][field] = value
                self.assert_closed(provider, rows)

    def test_wrong_native_refund_pin_and_amount_fail_closed(self):
        for field, value in [('provider_effect_id', 're_wrong'), ('amount', '1.99')]:
            with self.subTest(field=field):
                provider, rows = reconstructed()
                rows[0]['refunds'][0][field] = value
                self.assert_closed(provider, rows)

    def test_exact_refund_wrong_pi_parent_id_amount_fail_closed(self):
        for field, value in [('payment_intent', 'pi_wrong'), ('charge', 'ch_wrong'),
                             ('id', 're_wrong'), ('amount', 199)]:
            with self.subTest(field=field):
                provider, rows = reconstructed()
                provider['events'][1]['effect'][field] = value
                self.assert_closed(provider, rows)

    def test_capture_operation_event_not_blanket_dropped(self):
        for event_type in ('charge.captured', 'charge.succeeded', 'charge.failed'):
            with self.subTest(event_type=event_type):
                provider, rows = reconstructed()
                provider['events'][0]['type'] = event_type
                self.assert_closed(provider, rows)

    def test_parent_cannot_claim_capture_key_or_prove_capture_receipt(self):
        for keep_exact in (False, True):
            with self.subTest(keep_exact=keep_exact):
                provider, rows = reconstructed()
                rows[0]['captures'][0]['idempotency_key'] = 'capture-key'
                parent = copy.deepcopy(provider['events'][0])
                parent['id'] = 'evt_captureparent'
                parent['request_idempotency_key_hash'] = key_hash('capture-key')
                provider['events'].append(parent)
                if keep_exact:
                    receipt = copy.deepcopy(parent)
                    receipt['id'], receipt['type'] = 'evt_capture', 'charge.captured'
                    provider['events'].append(receipt)
                self.assert_closed(provider, rows)

    def test_key_reuse_including_failed_local_claim_fail_closed(self):
        provider, rows = reconstructed()
        other = copy.deepcopy(rows[0]['refunds'][0])
        other['id'], other['status'] = 'ref_other', 'failed'
        rows[0]['refunds'].append(other)
        self.assert_closed(provider, rows)

    def test_multiple_refund_objects_same_key_fail_closed(self):
        provider, rows = reconstructed((200, 200))
        digest = provider['events'][0]['request_idempotency_key_hash']
        for event in provider['events'][2:]:
            event['request_idempotency_key_hash'] = digest
        self.assert_closed(provider, rows)

    def test_multiple_local_claims_single_refund_fail_closed(self):
        provider, rows = reconstructed()
        other = copy.deepcopy(rows[0]['refunds'][0])
        other['id'], other['idempotency_key'] = 'ref_other', 'other-key'
        rows[0]['refunds'].append(other)
        for event in list(provider['events']):
            other_event = copy.deepcopy(event)
            other_event['id'] += 'other'
            other_event['request_idempotency_key_hash'] = key_hash('other-key')
            provider['events'].append(other_event)
        self.assert_closed(provider, rows)

    def test_missing_refund_inventory_cannot_use_parent(self):
        provider, rows = reconstructed()
        provider['refunds'] = []
        self.assert_closed(provider, rows)

    def test_parent_mode_and_currency_still_block(self):
        for field, value in [('livemode', True), ('currency', 'usd')]:
            provider, rows = reconstructed()
            provider['events'][0]['effect'][field] = value
            with self.subTest(field=field), self.assertRaises(ComparisonBlocked):
                compare(provider, rows)

    def test_no_pin_and_reverse_event_order_keep_exact_refund_binding(self):
        provider, rows = reconstructed((200, 800))
        for refund in rows[0]['refunds']:
            del refund['provider_effect_id']
        provider['events'].reverse()
        result = compare(provider, rows)
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assert_parent_informative(provider, result, rows)

    def test_refund_updated_receipt_also_supports_parent_correlation(self):
        provider, rows = reconstructed()
        provider['events'][1]['type'] = 'refund.updated'
        result = compare(provider, rows)
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assert_parent_informative(provider, result, rows)

    def test_parent_cumulative_must_include_exact_refund_not_future_or_earlier_only(self):
        for partials, event_index, field, value in [((200, 200), 2, 'amount_refunded', 200),
                                                  ((200, 800), 0, 'amount_refunded', 1000)]:
            with self.subTest(partials=partials, event_index=event_index):
                provider, rows = reconstructed(partials)
                provider['events'][event_index]['effect'][field] = value
                self.assert_closed(provider, rows)

    def test_parent_only_without_pin_or_retained_receipt_never_infers_identity(self):
        provider, rows = reconstructed()
        del rows[0]['refunds'][0]['provider_effect_id']
        provider['events'] = provider['events'][:1]
        self.assert_closed(provider, rows)

    def test_saved_provider_projected_reconstructed_healthy_regression(self):
        provider, rows = saved_reconstructed()
        result = compare(provider, rows)
        self.assertTrue(result['gross_clean'])
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assert_parent_informative(provider, result, rows)
        self.assertEqual(sum(c['exact_binding_verified'] for c in result['correlations']), 7)

    def test_saved_projected_charge_updated_counterfactual_not_observed_incident(self):
        provider, rows = saved_reconstructed()
        for event in provider['events']:
            if event['type'] == 'charge.refunded':
                event['type'] = 'charge.updated'
        result = compare(provider, rows)
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assert_parent_informative(provider, result, rows)


    def tied(self, partials, ids):
        provider, rows = reconstructed(partials)
        for i, rid in enumerate(ids):
            provider['refunds'][i].update(id=rid, created=2)
            rows[0]['refunds'][i]['provider_effect_id'] = rid
            provider['events'][2*i + 1]['effect'].update(id=rid, created=2)
        for event in provider['events']:
            event['created'] = 2
        return provider, rows

    def test_tied_history_fail_closed_independent_of_opaque_ids_and_order(self):
        for ids in [('re_a', 're_z'), ('re_z', 're_a')]:
            for reverse in (False, True):
                with self.subTest(ids=ids, reverse=reverse):
                    provider, rows = self.tied((200, 800), ids)
                    if reverse:
                        provider['refunds'].reverse()
                        provider['events'].reverse()
                    result = compare(provider, rows)
                    self.assertTrue(result['gross_clean'])
                    self.assertFalse(result['clean'])
                    parents = [c for c in result['correlations'] if c.get('binding') == 'parent_charge_refund_correlation_only']
                    self.assertTrue(parents)
                    self.assertTrue(all(not c['compatible'] and not c['exact_binding_verified'] for c in parents))

    def test_tied_full_group_cumulative_still_not_history_proof(self):
        provider, rows = self.tied((200, 200), ('re_a', 're_z'))
        provider['events'][0]['effect']['amount_refunded'] = 400
        self.assert_closed(provider, rows)

    def test_snapshot_arrays_explicitly_bounded_before_processing(self):
        provider, rows = reconstructed()
        for field in ('charges', 'refunds', 'events'):
            oversized = {**provider, field: [None] * 100001}
            with self.subTest(field=field), self.assertRaisesRegex(ComparisonBlocked, 'snapshot_array_bound_exceeded'):
                compare(oversized, rows)
        with self.assertRaisesRegex(ComparisonBlocked, 'snapshot_array_bound_exceeded'):
            compare(provider, [None] * 100001)
        for field in ('captures', 'refunds', 'transactions', 'quarantine'):
            row = {**rows[0], field: [None] * 100001}
            with self.subTest(field=field), self.assertRaisesRegex(ComparisonBlocked, 'snapshot_array_bound_exceeded'):
                compare(provider, [row])
        combined = {**provider, **{field: [None] * 100000 for field in ('charges', 'refunds', 'events')}}
        with self.assertRaisesRegex(ComparisonBlocked, 'snapshot_entry_bound_exceeded'):
            compare(combined, rows * 100000)
        # Exact per-array boundary is allowed; no evidence is inferred from these
        # irrelevant reconstructed events, and the original clean effects persist.
        provider['events'] += [{'livemode': False, 'created': 2, 'effect': None}] * (100000 - len(provider['events']))
        self.assertTrue(compare(provider, rows)['clean'])

    def test_per_charge_prefix_is_sorted_once_not_per_parent(self):
        provider, rows = reconstructed((1,) * 12)
        provider['events'] += [copy.deepcopy(e) for e in provider['events'] if e['type'] == 'charge.refunded'] * 4
        class CountedList(list):
            iterations = 0
            def __iter__(self):
                self.iterations += 1
                return super().__iter__()
        rows[0]['refunds'] = counted = CountedList(rows[0]['refunds'])
        with patch.object(comparator, 'sorted', wraps=builtins.sorted, create=True) as sorting:
            result = compare(provider, rows)
        self.assertTrue(result['clean'], result['discrepancies'])
        self.assertLessEqual(sorting.call_count, 2)  # one charge history + PI output
        self.assertLessEqual(counted.iterations, 3)  # no native effect scan per transaction/parent
        provider['events'] += [copy.deepcopy(e) for e in provider['events'] if e['type'] == 'refund.created'] * 4
        self.assertTrue(compare(provider, rows)['clean'])  # identical receipt duplicates cached
        bad = copy.deepcopy(provider['events'][1])
        bad['effect']['amount'] += 1
        provider['events'].append(bad)
        self.assert_closed(provider, rows)

    def test_event_timestamp_must_be_nonnegative_exact_integer(self):
        for index in (0, 1):
            for value in (None, '2', 2.0, True, -1):
                provider, rows = reconstructed()
                provider['events'][index]['created'] = value
                with self.subTest(index=index, value=value), self.assertRaisesRegex(ComparisonBlocked, 'invalid_event_timestamp'):
                    compare(provider, rows)
        provider, rows = reconstructed()
        del provider['events'][0]['created']
        with self.assertRaisesRegex(ComparisonBlocked, 'invalid_event_timestamp'):
            compare(provider, rows)

    def test_parent_created_matches_inventory_and_not_after_event(self):
        for value in (0, 999):
            provider, rows = reconstructed()
            provider['events'][0]['effect']['created'] = value
            self.assert_closed(provider, rows)
        provider, rows = reconstructed()
        provider['charges'][0]['created'] = 999
        provider['events'][0]['effect']['created'] = 999
        self.assert_closed(provider, rows)

    def test_inventory_parent_created_cannot_disagree_with_historical_parent(self):
        provider, rows = reconstructed()
        provider['charges'][0]['created'] = 999
        self.assert_closed(provider, rows)

    def test_refund_receipt_created_matches_inventory_and_not_after_event(self):
        for value in (1, 999):
            provider, rows = reconstructed()
            provider['events'][1]['effect']['created'] = value
            self.assert_closed(provider, rows)
        provider, rows = reconstructed()
        provider['refunds'][0]['created'] = 999
        provider['events'][1]['effect']['created'] = 999
        self.assert_closed(provider, rows)


if __name__ == '__main__':
    unittest.main()
