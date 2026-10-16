import assert from 'node:assert/strict';
import test from 'node:test';
import * as conversions from './conversions';

const api = () => { assert.equal(typeof conversions.newsletterSuccessEvent, 'function'); return conversions; };
test('pending double opt-in is not a newsletter conversion', () => {
  assert.equal(api().newsletterSuccessEvent(true, 'haak-gids'), 'newsletter_signup_requested');
});
test('failed subscriptions never emit success', () => {
  assert.equal(api().newsletterSuccessEvent(false, undefined), null);
});
test('persisted single opt-in is newsletter signup', () => {
  assert.equal(api().newsletterSuccessEvent(true, undefined), 'newsletter_signup');
});
test('receipt accepts fixed conversion payloads, excludes extra PII and arbitrary names', () => {
  assert.deepEqual(api().parseConversionReceipt(JSON.stringify({event:'sign_up',id:'123',payload:{method:'email',email:'private@example.test'}})), {event:'sign_up',id:'123',payload:{method:'email'}});
  assert.equal(api().parseConversionReceipt(JSON.stringify({event:'purchase',id:'123',payload:{}})), null);
});
test('receipts reject invalid JSON and malformed fixed fields', () => {
  for (const input of ['', '{}', 'null', '[]', '{']) assert.equal(api().parseConversionReceipt(input), null);
  assert.equal(api().parseConversionReceipt(JSON.stringify({event:'listing_published',id:'123',payload:{listing_type:'private-name'}})), null);
});
