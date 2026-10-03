import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { run, orderFixture as settlementOrderFixture } from './commerce-settlement-wiring.test.mjs'

const root = new URL('../../', import.meta.url)
const helperUrl = new URL('packages/modules/b2c-core/src/utils/return-refund-amount.ts', root)
// Missing helper is a single API-surface RED, not the behavioral regression witness.
let calculateReturnRefundAmount
try {
  ;({ calculateReturnRefundAmount } = await import(helperUrl.href))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
}

// Execute the actual workflow bodies with local, synchronous SDK stand-ins.
// This checks amount selection and payload wiring, NOT Medusa execution/rollback.
function loadWorkflow(relativePath, exportName, bindings) {
  const source = readFileSync(new URL(relativePath, root), 'utf8')
  const withoutImports = source.replace(/^import\s[\s\S]*?\sfrom\s['"][^'"]+['"];?\s*/gm, '')
  const code = stripTypeScriptTypes(withoutImports, { mode: 'strip' })
    .replace(/^export /gm, '')
  return vm.runInNewContext(`${code}\n${exportName}`, {
    createWorkflow: (_name, body) => body,
    transform: (input, body) => body(input),
    when: (input, predicate) => ({ then: (body) => predicate(input) ? body() : undefined }),
    WorkflowResponse: class { constructor(value) { return value } },
    ...bindings,
  }, { timeout: 1000 })
}

function orderFixture(overrides = {}) {
  return {
    id: 'order-test', currency_code: 'eur',
    items: [{ id: 'line-a', quantity: 3, total: 60, subtotal: 49.59, unit_price: 20 }],
    shipping_total: 15,
    split_order_payment: { id: 'payment-test', captured_amount: 75, refunded_amount: 0 },
    payouts: [],
    ...overrides,
  }
}

async function runRefund(input, order = orderFixture(), effects = {}) {
  const { result } = await run('return', { input, order: settlementOrderFixture(order), effects, lines: [],
    // Preserve this suite's original capping-boundary stand-in. Rejection must
    // occur before allocation; real allocation is covered by refund-wiring.
    allocate: (allocation) => ({ customerRefund: Math.min(allocation.requestedCustomerRefund,
      allocation.capturedAmount - allocation.alreadyRefundedAmount), sellerReversal: 0 }),
  })
  return result
}

const selection = (quantity = 1) => [{ line_item_id: 'line-a', quantity }]

for (const [quantity, expected] of [[1, 20], [2, 40], [3, 60]]) {
  test(`workflow refunds ${expected} EUR for ${quantity} of three units; never shipping`, async () => {
    const effects = {}
    const result = await runRefund({ return_lines: selection(quantity) }, orderFixture(), effects)
    assert.equal(result.customer_refund, expected)
    assert.equal(effects.refunds[0].amount, expected)
    assert.equal(effects.allocations[0].requestedCustomerRefund, expected)
    assert.ok(effects.query.fields.includes('items.quantity'))
    assert.ok(effects.query.fields.includes('items.total'))
  })
}

test('workflow proportions the discounted tax-inclusive total, not subtotal or unit price', async () => {
  const order = orderFixture({ items: [
    { id: 'line-a', quantity: 3, total: 54.45, subtotal: 45, unit_price: 20 },
    { id: 'line-b', quantity: 1, total: 30, subtotal: 24.79, unit_price: 30 },
  ] })
  assert.equal((await runRefund({ return_lines: selection(1) }, order)).customer_refund, 18.15)
  assert.equal((await runRefund({ return_lines: selection(2) }, order)).customer_refund, 36.30)
})

for (const [currency_code, total, quantity, expected] of [
  ['eur', '10.00', 1, 3.33], ['eur', '10.00', 2, 6.67],
  ['jpy', 100, 1, 33], ['kwd', '1.001', 2, 0.667],
]) {
  test(`workflow rounds the selected proportion in ${currency_code} to ${expected}`, async () => {
    const order = orderFixture({ currency_code,
      items: [{ id: 'line-a', quantity: 3, total }],
      split_order_payment: { id: 'payment-test', captured_amount: 150, refunded_amount: 0 },
    })
    assert.equal((await runRefund({ return_lines: selection(quantity) }, order)).customer_refund, expected)
  })
}

test('workflow rejects a selected share rounding to zero even alongside a paid line', async () => {
  const effects = {}
  const order = orderFixture({ items: [
    { id: 'line-a', quantity: 3, total: 0.01 },
    { id: 'line-b', quantity: 1, total: 10 },
  ] })
  await assert.rejects(runRefund({ return_lines: [
    ...selection(), { line_item_id: 'line-b', quantity: 1 },
  ] }, order, effects))
  assert.equal(effects.allocations.length, 0)
})

const invalidSelections = [
  ['unknown line ID', [{ line_item_id: 'missing', quantity: 1 }]],
  ['mixed known and unknown IDs', [...selection(), { line_item_id: 'missing', quantity: 1 }]],
  ['duplicate IDs', [...selection(), ...selection()]],
  ['empty selection', []],
  ['missing selection', undefined],
  ['zero quantity', selection(0)],
  ['negative quantity', selection(-1)],
  ['fractional quantity', selection(1.5)],
  ['string quantity', selection('1')],
  ['NaN quantity', selection(NaN)],
  ['infinite quantity', selection(Infinity)],
  ['excess quantity', selection(4)],
]
for (const [name, return_lines] of invalidSelections) {
  test(`workflow rejects ${name} before refund/allocation; no balance fallback`, async () => {
    const effects = {}
    await assert.rejects(runRefund({ return_lines }, orderFixture(), effects))
    assert.equal(effects.allocations.length, 0)
    assert.equal(effects.refunds.length, 0)
    assert.equal(effects.reversals.length, 0)
  })
}

for (const [name, total] of [['zero-net', 0], ['missing-net', undefined], ['negative-net', -10]]) {
  test(`workflow rejects ${name} line despite positive unit price/subtotal and captured balance`, async () => {
    const effects = {}
    const order = orderFixture({ items: [{ id: 'line-a', quantity: 3, total, subtotal: 60, unit_price: 20 }] })
    await assert.rejects(runRefund({ return_lines: selection() }, order, effects))
    assert.equal(effects.allocations.length, 0)
    assert.equal(effects.refunds.length, 0)
  })
}

test('workflow rejects a refund above remaining captured funds instead of silently capping', async () => {
  const effects = {}
  const order = orderFixture({ split_order_payment: {
    id: 'payment-test', captured_amount: 75, refunded_amount: 65,
  } })
  await assert.rejects(runRefund({ return_lines: selection() }, order, effects))
  assert.equal(effects.allocations.length, 0)
  assert.equal(effects.refunds.length, 0)
})

test('large balance magnitudes cannot turn an excessive return into a capped refund', async () => {
  const effects = {}
  const order = orderFixture({ split_order_payment: {
    id: 'payment-test', captured_amount: 1e16, refunded_amount: 1e16 - 16,
  } })
  await assert.rejects(runRefund({ return_lines: selection() }, order, effects))
  assert.equal(effects.allocations.length, 0)
  assert.equal(effects.refunds.length, 0)
})

for (const amount of [0, -1, NaN, Infinity, 20.001, 21]) {
  test(`workflow rejects invalid/excess explicit amount ${amount} rather than falling back`, async () => {
    const effects = {}
    await assert.rejects(runRefund({ return_lines: selection(), requested_refund_amount: amount }, orderFixture(), effects))
    assert.equal(effects.allocations.length, 0)
    assert.equal(effects.refunds.length, 0)
  })
}

test('an explicit lower merchandise refund remains supported', async () => {
  assert.equal((await runRefund({ return_lines: selection(), requested_refund_amount: 10 })).customer_refund, 10)
})

function runProceed(request) {
  let received
  const workflow = loadWorkflow(
    'packages/modules/requests/src/workflows/order-return-request/workflows/proceed-return-request.ts',
    'proceedReturnRequestWorkflow', {
      retrieveOrderFromReturnRequestStep: () => ({ order_id: 'order-test', order_return_request: request }),
      // This test isolates downstream payload wiring. Durable identity and
      // native execution are exercised by the lifecycle and adapter suites.
      prepareNativeReturnStep: plan => ({ plan, identity: {
        return_id: 'saved-native-return', order_change_id: 'saved-order-change',
      } }),
      refundSellerOrderForReturnWorkflow: { runAsStep: ({ input }) => { received = input } },
    })
  workflow({ id: 'request-test', location_id: 'location-test' })
  return JSON.parse(JSON.stringify(received))
}

test('proceed forwards explicit return quantities, with stable existing request identity', async () => {
  const lines = [{ line_item_id: 'line-a', quantity: 2, reason_id: 'reason-test' }]
  assert.deepEqual(runProceed({ id: 'request-test', line_items: lines }), {
    order_id: 'order-test', return_lines: selection(2), operation_id: 'request-test',
  })
})

test('proceed does not invent an operation identity when the stored request lacks one', async () => {
  assert.throws(() => runProceed({ line_items: selection() }), /Return request identity mismatch/)
})

test('pure helper API exists and is imported by the workflow settlement planner', async () => {
  assert.equal(typeof calculateReturnRefundAmount, 'function')
  const source = readFileSync(new URL('packages/modules/b2c-core/src/utils/order-refund-plan.ts', root), 'utf8')
  assert.match(source, /import\s*\{[^}]*\bcalculateReturnRefundAmount\b[^}]*\}\s*from\s*['"]\.\/return-refund-amount['"]/)
})

test('pure helper uses currency precision and decimal-safe proportional rounding', async () => {
  assert.equal(typeof calculateReturnRefundAmount, 'function')
  for (const [currencyCode, total, quantity, expected] of [
    ['eur', 60, 1, 20], ['eur', 60, 2, 40],
    ['eur', '54.45', 1, 18.15], ['eur', '10.00', 1, 3.33],
    ['eur', '10.00', 2, 6.67], ['eur', '0.09', 1, 0.03],
    ['jpy', 100, 1, 33], ['kwd', '1.001', 2, 0.667],
  ]) {
    assert.equal(calculateReturnRefundAmount({
      items: [{ id: 'line-a', quantity: 3, total }],
      returnLines: selection(quantity), currencyCode,
    }), expected)
  }
})

test('pure helper rejects currency-rounded zero and does not mutate inputs', async () => {
  assert.equal(typeof calculateReturnRefundAmount, 'function')
  const items = Object.freeze([Object.freeze({ id: 'line-a', quantity: 3, total: 60 })])
  const returnLines = Object.freeze([Object.freeze({ line_item_id: 'line-a', quantity: 1 })])
  assert.equal(calculateReturnRefundAmount({ items, returnLines, currencyCode: 'eur' }), 20)
  assert.throws(() => calculateReturnRefundAmount({
    items: [{ id: 'line-a', quantity: 3, total: 0.01 }], returnLines, currencyCode: 'eur',
  }))
})
