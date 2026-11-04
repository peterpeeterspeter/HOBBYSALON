import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseThreshold,
  evaluateShippingPolicy
} from '../../packages/modules/b2c-core/src/shared/shipping/policy.ts';
const policy = {
  seller_id: 'a',
  country_code: 'be',
  currency_code: 'eur',
  free_shipping_threshold: 75,
  shipping_option_ids: ['standard']
};
const evaluate = (items, extra = {}) =>
  evaluateShippingPolicy({ ...policy, ...extra }, items, 'be', 'eur');
test('inclusive threshold after discounts', () => {
  for (const [total, expected] of [
    [74.99, false],
    [75, true],
    [75.01, true],
    [72, false]
  ])
    assert.equal(evaluate([{ seller_id: 'a', total }]).qualified, expected);
});
test('seller totals never combine', () => {
  assert.equal(
    evaluate([
      { seller_id: 'a', total: 40 },
      { seller_id: 'b', total: 40 }
    ]).qualified,
    false
  );
  assert.equal(
    evaluate([
      { seller_id: 'a', total: 75 },
      { seller_id: 'b', total: 20 }
    ]).qualified,
    true
  );
});
test('country, currency, disabled and always free', () => {
  const items = [{ seller_id: 'a', total: 1 }];
  assert.equal(
    evaluate(items, { free_shipping_threshold: null }).qualified,
    false
  );
  assert.equal(evaluate(items, { free_shipping_threshold: 0 }).qualified, true);
  assert.equal(evaluate(items, { country_code: 'nl' }).qualified, false);
  assert.equal(evaluate(items, { currency_code: 'usd' }).qualified, false);
});
test('decimal input preserves zero and rejects malformed money', () => {
  assert.equal(parseThreshold('6,95'), 6.95);
  assert.equal(parseThreshold('0'), 0);
  assert.equal(parseThreshold(''), null);
  for (const value of [-1, '1.001', 'NaN', {}, '1e3'])
    assert.throws(() => parseThreshold(value));
});

test('fractional discount cents are summed per seller before rounding', () => {
  const result = evaluate([
    { seller_id: 'a', total: 24.997 },
    { seller_id: 'a', total: 24.997 },
    { seller_id: 'a', total: 24.997 }
  ]);
  assert.equal(result.subtotal, 74.99);
  assert.equal(result.qualified, false);
  assert.equal(result.remaining_amount, 0.01);
});
