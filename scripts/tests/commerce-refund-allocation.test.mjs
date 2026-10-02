import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const root = new URL('../../packages/modules/b2c-core/src/', import.meta.url)
class Amount {
  constructor(value) { this.value = Number(value) }
  minus(value) { return new Amount(this.value - Number(value)) }
  valueOf() { return this.value }
  toString() { return String(this.value) }
}
class MedusaError extends Error {
  static Types = { NOT_ALLOWED: 'not_allowed' }
  constructor(type, message) { super(message); this.type = type }
}
const collaborators = {
  '@medusajs/framework/utils': {
    ContainerRegistrationKeys: { QUERY: 'query' }, MedusaError,
    MathBN: { convert: (v) => new Amount(v), add: (a, b) => new Amount(Number(a) + Number(b)) },
  },
  '@medusajs/framework/workflows-sdk': {
    createStep: (_name, fn) => fn,
    StepResponse: class { constructor(value) { this.value = value } },
  },
  '@mercurjs/framework': {},
}
// Execute real source, replacing only imports with local collaborators. Relative
// money helpers are loaded recursively, not reimplemented inside the tests.
function load(url) {
  const exports = []
  const bindings = {}
  const source = readFileSync(url, 'utf8').replace(
    /^import\s(?:type\s)?\{([^}]+)\}\sfrom\s['"]([^'"]+)['"];?\s*/gm,
    (_match, names, specifier) => {
      const dependency = specifier.startsWith('.')
        ? load(new URL(`${specifier}.ts`, url)) : collaborators[specifier]
      assert.ok(dependency, `Unstubbed dependency: ${specifier}`)
      for (const name of names.split(',').map((v) => v.trim()).filter(Boolean)) bindings[name] = dependency[name]
      return ''
    })
  const code = stripTypeScriptTypes(source, { mode: 'strip' }).replace(
    /export (?:async )?(?:function|const|class) (\w+)/g,
    (match, name) => { exports.push(name); return match.replace('export ', '') })
  return vm.runInNewContext(`${code}\n;({${exports.join(',')}})`, bindings, { timeout: 1000 })
}
const { allocateRefundAndReversal: allocate } = load(new URL('utils/refund-allocation.ts', root))
const { calculatePayoutForOrderStep: payoutStep } = load(new URL('workflows/order/steps/calculate-payout-for-order.ts', root))
const base = { capturedAmount: 100, alreadyRefundedAmount: 0, transferredAmount: 90,
  alreadyReversedAmount: 0, commissionAmount: 10, requestedCustomerRefund: 50 }
async function payout({ captured = 100, refunded = 50, commission = 10, currency = 'eur', lines, items } = {}) {
  const queries = []
  const result = await payoutStep({ order_id: 'order-test' }, { container: {
    resolve: () => ({ graph: async (query) => {
      queries.push(query)
      return { data: query.entity === 'order' ? [{
        currency_code: currency, items: items ?? [{ id: 'item-test' }],
        split_order_payment: { captured_amount: captured, refunded_amount: refunded },
      }] : lines ?? [{ item_line_id: 'item-test', value: commission }] }
    } }),
  } })
  return { amount: Number(result.value), queries }
}

test('EUR 100 capture / 10 commission / 50 refund leaves 45 before OR after transfer', async () => {
  const after = allocate(base)
  assert.equal(after.sellerReversal, 45)
  const before = await payout()
  assert.equal(before.amount, 45)
  assert.equal(before.amount, base.transferredAmount - after.sellerReversal)
})

for (const [currency, unit] of [['eur', 0.01], ['jpy', 1], ['kwd', 0.001]]) {
  test(`${currency}: repeated one-minor-unit refunds use cumulative rounded seller shares`, () => {
    const reversals = []
    let reversed = 0
    for (let n = 0; n < 3; n++) {
      const result = allocate({ capturedAmount: 3 * unit, commissionAmount: unit,
        transferredAmount: 2 * unit, alreadyRefundedAmount: n * unit,
        alreadyReversedAmount: reversed, requestedCustomerRefund: unit, currencyCode: currency })
      reversals.push(result.sellerReversal)
      reversed += result.sellerReversal
      assert.ok(result.sellerReversal <= 2 * unit - reversed + result.sellerReversal)
    }
    assert.deepEqual(reversals, [unit, 0, unit])
    assert.equal(reversed, 2 * unit)
  })
  test(`${currency}: settlement matches post-transfer entitlement at a fractional minor-unit boundary`, async () => {
    const after = allocate({ capturedAmount: 3 * unit, commissionAmount: unit,
      transferredAmount: 2 * unit, alreadyRefundedAmount: 0,
      alreadyReversedAmount: 0, requestedCustomerRefund: unit, currencyCode: currency })
    const before = await payout({ captured: 3 * unit, refunded: unit, commission: unit, currency })
    assert.equal(before.amount, unit)
    assert.equal(before.amount, 2 * unit - after.sellerReversal)
    assert.ok(before.queries[0].fields.includes('currency_code'))
  })
}

test('half-unit tie uses seller refund rounding consistently with settlement', async () => {
  assert.equal(allocate({ ...base, capturedAmount: 0.02, commissionAmount: 0.01,
    transferredAmount: 0.01, requestedCustomerRefund: 0.01 }).sellerReversal, 0.01)
  assert.equal((await payout({ captured: 0.02, refunded: 0.01, commission: 0.01 })).amount, 0)
})

test('refund after a reduced pre-refund settlement reverses only incremental entitlement', () => {
  assert.equal(allocate({ ...base, alreadyRefundedAmount: 50,
    transferredAmount: 45, requestedCustomerRefund: 25 }).sellerReversal, 22.5)
})

test('reversal never exceeds a partially exhausted transfer', () => {
  const result = allocate({ ...base, alreadyRefundedAmount: 99, alreadyReversedAmount: 89.99,
    requestedCustomerRefund: 10 })
  assert.equal(result.customerRefund, 1)
  assert.equal(result.sellerReversal, 0.01)
  assert.equal(result.remainingSellerReversible, 0)
  assert.equal(result.remainingCustomerRefundable, 0)
})

test('zero request never catches up past reversals; absent transfer never reverses', () => {
  assert.equal(allocate({ ...base, requestedCustomerRefund: 0, alreadyRefundedAmount: 50 }).sellerReversal, 0)
  assert.equal(allocate({ ...base, transferredAmount: 0 }).sellerReversal, 0)
})

test('commission readiness rejects missing or partially missing lines', async () => {
  await assert.rejects(payout({ lines: [] }), /Commission not ready/)
  await assert.rejects(payout({ items: [{ id: 'item-test' }, { id: 'other' }] }), /missing lines/)
})

test('intentional zero commission pays remaining captured balance', async () => {
  assert.equal((await payout({ commission: 0 })).amount, 50)
  assert.equal(allocate({ ...base, commissionAmount: 0, transferredAmount: 100 }).sellerReversal, 50)
})

test('settlement clamps exhausted captures and commission larger than capture at zero', async () => {
  assert.equal((await payout({ refunded: 100 })).amount, 0)
  assert.equal((await payout({ refunded: 110 })).amount, 0)
  assert.equal((await payout({ captured: 0, refunded: 0 })).amount, 0)
  assert.equal((await payout({ commission: 110 })).amount, 0)
})

test('no-refund settlement retains original commission', async () => {
  assert.equal((await payout({ refunded: 0 })).amount, 90)
})
