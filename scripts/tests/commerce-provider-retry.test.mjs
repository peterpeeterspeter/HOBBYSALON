import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadMedusaNumeric } from './helpers/medusa-numeric.mjs'
const { BigNumber, MathBN, BigNumberJS, numericSource } = loadMedusaNumeric()
const root = new URL('../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')
// Real money.ts + pinned Medusa/bignumber.js arithmetic; only Stripe, DB, workflow
// and error/transaction infrastructure below are explicit offline collaborators.
const moneySource = read('packages/framework/src/utils/money.ts')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const money = vm.runInNewContext(stripTypeScriptTypes(`${moneySource}; ({getSmallestUnit, getAmountFromSmallestUnit})`, { mode: 'strip' }), {
  BigNumber, MathBN,
})
const makeClass = (path, start, end, bindings = {}) => {
  const source = read(path)
  // Decorator-driven DB transactions are not exercised by this isolated method test.
  const method = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
    .replace(/@MedusaContext\(\)\s*/g, '')
  return vm.runInNewContext(stripTypeScriptTypes(`class Subject { ${method} }; Subject`, { mode: 'strip' }), {
    ...money, BigNumber, MathBN,
    MedusaError: class extends Error { static Types = { NOT_FOUND: 'not_found', UNEXPECTED_STATE: 'unexpected' }; constructor(_type, message) { super(message) } },
    ...bindings,
  })
}
const Card = makeClass('packages/modules/payment-stripe-connect/src/providers/stripe-connect/core/stripe-connect-provider.ts', '  async refundPayment(', '  async retrievePayment(')
const Reversal = makeClass('packages/modules/b2c-core/src/modules/payout/services/provider.ts', '  async reversePayout(', '  async getWebhookActionAndData(')
const Service = makeClass('packages/modules/b2c-core/src/modules/payout/service.ts', '  async createPayoutReversal(', '  async getWebhookActionAndData(')
function cardHarness() {
  const calls = [], unique = new Map()
  const card = new Card()
  card.buildError = (_message, error) => error
  card.client_ = { refunds: { create: async (payload, options) => {
    calls.push({ payload, options })
    const key = options?.idempotencyKey || `unkeyed-${calls.length}`
    if (!unique.has(key)) unique.set(key, { id: `re_${unique.size + 1}` })
    return unique.get(key)
  } } }
  return { card, calls, unique }
}
const refundInput = (key = 'refund-a') => ({ data: { id: 'pi_fixture', currency: 'eur' }, amount: 20, context: { idempotency_key: key } })
test('refund provider forwards Medusa refund identity as Stripe request option', async () => {
  const { card, calls } = cardHarness()
  await card.refundPayment(refundInput())
  assert.equal(calls[0].options?.idempotencyKey, 'refund-a')
  assert.equal(calls[0].payload.amount, 2000)
})
test('same provider refund identity does not create two mock external refunds; distinct equal refunds remain distinct', async () => {
  const { card, unique } = cardHarness()
  await card.refundPayment(refundInput()); await card.refundPayment(refundInput())
  assert.equal(unique.size, 1)
  await card.refundPayment(refundInput('refund-b')); assert.equal(unique.size, 2)
})
for (const key of [undefined, '', '   ']) test(`refund without stable identity fails closed (${String(key)})`, async () => {
  const { card, calls } = cardHarness()
  const input = refundInput(); input.context = { idempotency_key: key }
  await assert.rejects(card.refundPayment(input)); assert.equal(calls.length, 0)
})
test('reversal provider forwards stable operation key', async () => {
  const calls = [], reversal = new Reversal()
  reversal.client_ = { transfers: { createReversal: async (...args) => { calls.push(args); return { id: 'trr_fixture' } } } }
  await reversal.reversePayout({ transfer_id: 'tr_fixture', amount: 18, currency: 'eur', idempotency_key: 'reversal-op-a' })
  assert.equal(calls[0][2]?.idempotencyKey, 'reversal-op-a')
  assert.equal(calls[0][1].amount, 1800)
})
test('reversal provider refuses unkeyed money movement', async () => {
  let calls = 0; const reversal = new Reversal()
  reversal.client_ = { transfers: { createReversal: async () => { calls++; return {} } } }
  await assert.rejects(reversal.reversePayout({ transfer_id: 'tr_fixture', amount: 18, currency: 'eur' }))
  assert.equal(calls, 0)
})
function stepHarness(service) {
  let source = read('packages/modules/b2c-core/src/workflows/payout/steps/create-payout-reversal.ts')
  source = source.replace(/^import\s[\s\S]*?\sfrom\s['"][^'"]+['"];?\s*/gm, '')
  source = stripTypeScriptTypes(source, { mode: 'strip' }).replace(/^export /gm, '')
  return vm.runInNewContext(`${source}; createPayoutReversalStep`, {
    BigNumber, MathBN,
    PAYOUT_MODULE: 'payout', createStep: (_name, body) => (input) => body(input, { container: { resolve: () => service } }),
    StepResponse: class { constructor(value) { this.value = value } },
  })
}
const operation = { payout_id: 'payout-fixture', amount: 18, currency_code: 'eur', operation_id: 'return-fixture' }
test('provider reversal failure rejects the workflow step, never err:true success', async () => {
  const error = new Error('provider failed')
  const step = stepHarness({ createPayoutReversal: async () => { throw error } })
  await assert.rejects(step(operation), (caught) => caught === error)
})
test('zero reversal remains a no-op; invalid positive movement requires operation identity', async () => {
  let calls = 0
  const step = stepHarness({ createPayoutReversal: async () => { calls++; return {} } })
  await step({ ...operation, amount: 0 }); assert.equal(calls, 0)
  await assert.rejects(step({ ...operation, operation_id: undefined })); assert.equal(calls, 0)
  await assert.rejects(step({ ...operation, amount: NaN })); assert.equal(calls, 0)
})
function serviceHarness() {
  const service = new Service(), rows = new Map(), calls = []
  service.retrievePayout = async () => ({ id: 'payout-fixture', currency_code: 'eur', data: { id: 'tr_fixture' } })
  service.listPayoutReversals = async (filter, config = {}) => [...rows.values()]
    .filter(row => row.payout === filter.payout_id)
    .slice(config.skip ?? 0, (config.skip ?? 0) + (config.take ?? 100))
  service.provider_ = { reversePayout: async (input) => {
    calls.push(input)
    return { id: `trr_${input.idempotency_key}`, amount: money.getSmallestUnit(input.amount, input.currency), currency: input.currency, transfer: input.transfer_id }
  } }
  service.createPayoutReversals = async (input) => {
    if (rows.has(input.id)) throw new Error('duplicate primary key')
    const value = { ...input }; rows.set(input.id, value); return value
  }
  return { service, rows, calls }
}
test('completed reversal retry reuses the saved operation without another external call', async () => {
  const { service, rows, calls } = serviceHarness()
  await service.createPayoutReversal(operation); await service.createPayoutReversal(operation)
  assert.equal(calls.length, 1); assert.equal(rows.size, 1)
  assert.ok(calls[0].idempotency_key.includes(operation.operation_id))
})
test('saved operation cannot silently change amount on retry', async () => {
  const { service, calls } = serviceHarness()
  await service.createPayoutReversal(operation)
  await assert.rejects(service.createPayoutReversal({ ...operation, amount: 19 }))
  assert.equal(calls.length, 1)
})
test('distinct equal-amount returns have distinct reversal operations', async () => {
  const { service, calls, rows } = serviceHarness()
  await service.createPayoutReversal(operation)
  await service.createPayoutReversal({ ...operation, operation_id: 'return-other' })
  assert.equal(calls.length, 2); assert.equal(rows.size, 2)
  assert.notEqual(calls[0].idempotency_key, calls[1].idempotency_key)
})
test('local persistence failure retries the exact provider operation and uses external reversal identity as unique row ID', async () => {
  const { service, calls, rows } = serviceHarness()
  const create = service.createPayoutReversals; let failed = false
  service.createPayoutReversals = async (input) => { if (!failed) { failed = true; throw new Error('database unavailable') }; return create(input) }
  await assert.rejects(service.createPayoutReversal(operation))
  await service.createPayoutReversal(operation)
  assert.equal(calls[0].idempotency_key, calls[1].idempotency_key)
  assert.equal(rows.size, 1)
  assert.equal([...rows.values()][0].id, [...rows.values()][0].data.id)
})

for (const invalid of [
  { operation_id: undefined }, { operation_id: '' }, { operation_id: ' '.repeat(4) },
  { operation_id: 'x'.repeat(256) }, { amount: NaN }, { amount: -1 }, { amount: 0 },
  { amount: 18.001 }, { currency_code: 'jpy' },
]) test(`service rejects invalid/mismatched operation ${JSON.stringify(invalid)} before provider`, async () => {
  const { service, calls, rows } = serviceHarness()
  await assert.rejects(service.createPayoutReversal({ ...operation, ...invalid }))
  assert.equal(calls.length, 0); assert.equal(rows.size, 0)
})

for (const mismatch of [{ amount: 1900 }, { currency: 'jpy' }, { transfer: 'tr_other' }, { id: '' }]) {
  test(`service refuses to persist inconsistent provider result ${JSON.stringify(mismatch)}`, async () => {
    const { service, rows } = serviceHarness()
    const reverse = service.provider_.reversePayout
    service.provider_.reversePayout = async input => ({ ...await reverse(input), ...mismatch })
    await assert.rejects(service.createPayoutReversal(operation))
    assert.equal(rows.size, 0)
  })
}

test('replay search includes later pages; saved money mismatch is not silently reused', async () => {
  const { service, rows, calls } = serviceHarness()
  for (let i = 0; i < 101; i++) rows.set(`old-${i}`, { id: `old-${i}`, payout: operation.payout_id, data: {} })
  const saved = await service.createPayoutReversal(operation)
  await service.createPayoutReversal(operation)
  assert.equal(calls.length, 1)
  saved.amount = 19
  await assert.rejects(service.createPayoutReversal(operation))
  assert.equal(calls.length, 1)
})

test('concurrent service calls converge on one external identity and one row; retry finds it', async () => {
  const { service, rows, calls } = serviceHarness()
  const outcomes = await Promise.allSettled([service.createPayoutReversal(operation), service.createPayoutReversal(operation)])
  assert.ok(outcomes.some(result => result.status === 'fulfilled'))
  assert.equal(new Set(calls.map(call => call.idempotency_key)).size, 1)
  assert.equal(rows.size, 1)
  const previousCalls = calls.length
  await service.createPayoutReversal(operation)
  assert.equal(calls.length, previousCalls)
})

for (const [currency, amount, minor] of [['eur', 18, 1800], ['jpy', 18, 18], ['kwd', 1.23, 1230]]) {
  test(`provider and local reversal amount agree for ${currency}`, async () => {
    const { service, rows } = serviceHarness()
    service.retrievePayout = async () => ({ id: operation.payout_id, currency_code: currency, data: { id: 'tr_fixture' } })
    await service.createPayoutReversal({ ...operation, amount, currency_code: currency })
    const saved = [...rows.values()][0]
    assert.equal(saved.data.amount, minor); assert.equal(Number(saved.amount), amount)
    const { card, calls } = cardHarness()
    await card.refundPayment({ ...refundInput(), amount, data: { id: 'pi_fixture', currency } })
    assert.equal(calls[0].payload.amount, minor)
  })
}

for (const [currency, amount] of [['eur', 0.001], ['eur', -1], ['eur', NaN], ['jpy', 1.1], ['kwd', 0.001]]) {
  test(`no silent provider rounding of ${currency} ${amount}`, async () => {
    const { card, calls } = cardHarness()
    await assert.rejects(card.refundPayment({ ...refundInput(), amount, data: { id: 'pi_fixture', currency } }))
    assert.equal(calls.length, 0)
    let reversals = 0
    const reversal = new Reversal()
    reversal.client_ = { transfers: { createReversal: async () => { reversals++; return {} } } }
    await assert.rejects(reversal.reversePayout({ transfer_id: 'tr_fixture', amount, currency, idempotency_key: 'fixture-key' }))
    assert.equal(reversals, 0)
  })
}

// Numeric contract regressions: source-executing boundaries with REAL decimal
// dependencies. These do not establish Stripe SDK, ORM, or workflow durability.
test('numeric dependency is the pinned real implementation, including exact equality', (t) => {
  t.diagnostic(JSON.stringify(numericSource))
  assert.equal(numericSource.medusaVersion, '2.11.3')
  assert.equal(numericSource.bigNumberJSVersion, '9.3.1')
  assert.ok(BigNumberJS.isBigNumber(MathBN.mult('0.29', 100)))
  assert.equal(MathBN.mult('0.29', 100).toString(), '29')
  const precise = new BigNumber('20.00000000000000000001')
  assert.equal(precise.numeric, 20) // numeric coercion loses the extra precision
  assert.equal(MathBN.eq(precise, 20), false)
  assert.equal(MathBN.eq({ value: '20', precision: 20 }, 20), true)
})
test('numeric loader fails for a missing explicit dependency, never substitutes mocks', () => {
  assert.throws(() => loadMedusaNumeric(fileURLToPath(new URL('./missing-numeric-reference/', import.meta.url))),
    /Real Medusa numeric dependency required/)
})

const amountForms = [
  ['number', value => Number(value)],
  ['string', value => value],
  ['raw', value => ({ value, precision: 20 })],
  ['Medusa BigNumber', value => new BigNumber(value)],
  ['bignumber.js', value => new BigNumberJS(value)],
]
const numericBoundaries = ['refund', 'reversal', 'service', 'step']
function numericHarness(boundary) {
  if (boundary === 'refund') {
    const { card, calls } = cardHarness()
    return { calls, invoke: amount => card.refundPayment({ ...refundInput(), amount }) }
  }
  const reversal = new Reversal(), calls = []
  reversal.client_ = { transfers: { createReversal: async (transfer, payload, options) => {
    calls.push({ transfer, payload, options })
    return { id: 'trr_numeric', transfer, amount: payload.amount, currency: 'eur' }
  } } }
  if (boundary === 'reversal') {
    return { calls, invoke: amount => reversal.reversePayout({ transfer_id: 'tr_fixture', amount, currency: 'eur', idempotency_key: 'numeric-operation' }) }
  }
  const { service, rows } = serviceHarness()
  service.provider_ = reversal // real reversal method, explicitly mocked Stripe transport
  const invoke = boundary === 'step' ? stepHarness(service) : input => service.createPayoutReversal(input)
  return { calls, rows, invoke: amount => invoke({ ...operation, amount }) }
}

for (const [form, wrap] of amountForms) {
  for (const [value, minor] of [['0.29', 29], ['8.03', 803]]) {
    test(`real money conversion: EUR ${value} as ${form}`, () => {
      assert.equal(money.getSmallestUnit(wrap(value), 'eur'), minor)
      assert.equal(MathBN.eq(money.getAmountFromSmallestUnit(minor, 'eur'), wrap(value)), true)
    })
  }
  for (const [value, minor] of [['20', 2000], ['0.29', 29], ['8.03', 803]]) {
    for (const boundary of numericBoundaries) {
      test(`numeric contract: ${boundary} accepts EUR ${value} as ${form}`, async () => {
        const { invoke, calls, rows } = numericHarness(boundary)
        await invoke(wrap(value))
        assert.equal(calls.length, 1)
        assert.equal(calls[0].payload.amount, minor)
        if (rows) {
          assert.equal(rows.size, 1)
          const saved = [...rows.values()][0]
          assert.equal(typeof saved.amount, 'number')
          assert.equal(MathBN.eq(saved.amount, wrap(value)), true)
          assert.equal(saved.data.amount, minor)
        }
      })
    }
  }
  test(`numeric contract: exact zero as ${form} is a step no-op without identity`, async () => {
    let calls = 0
    const step = stepHarness({ createPayoutReversal: async () => { calls++; return {} } })
    const result = await step({ ...operation, operation_id: undefined, amount: wrap('0') })
    assert.equal(result.value, undefined)
    assert.equal(calls, 0)
  })
  for (const value of ['0', '-1', '0.001', '0.299', '0.00001', '-0.00001', '90071992547410', 'Infinity', 'not-money']) {
    test(`numeric contract: invalid/unrepresentable EUR ${value} as ${form} fails closed`, async () => {
      for (const boundary of numericBoundaries.filter(b => b !== 'step' || value !== '0')) {
        const { invoke, calls, rows } = numericHarness(boundary)
        await assert.rejects(invoke(wrap(value)), `${boundary} must reject`)
        assert.equal(calls.length, 0, `${boundary} must not call Stripe`)
        if (rows) assert.equal(rows.size, 0, `${boundary} must not persist`)
      }
    })
  }
}

// Do not wrap these as native numbers: doing so erases the very digits tested.
for (const [form, wrap] of amountForms.filter(([form]) => form !== 'number')) {
  for (const value of ['20.00000000000000000001', '0.29000000000000000001']) {
    for (const boundary of numericBoundaries) {
      test(`exactness: ${boundary} rejects overprecision ${value} as ${form}`, async () => {
        const { invoke, calls, rows } = numericHarness(boundary)
        await assert.rejects(invoke(wrap(value)), /not exactly representable/)
        assert.equal(calls.length, 0)
        if (rows) assert.equal(rows.size, 0)
      })
    }
  }
}
for (const [form, wrap] of amountForms) {
  test(`numeric replay accepts an equivalent stored amount as ${form}`, async () => {
    const { service, calls } = serviceHarness()
    const saved = await service.createPayoutReversal(operation)
    saved.amount = wrap('18')
    assert.equal(await service.createPayoutReversal(operation), saved)
    assert.equal(calls.length, 1)
  })
  if (form !== 'number') test(`numeric replay rejects overprecision stored amount as ${form}`, async () => {
    const { service, calls } = serviceHarness()
    const saved = await service.createPayoutReversal(operation)
    saved.amount = wrap('18.00000000000000000001')
    await assert.rejects(service.createPayoutReversal(operation), /conflicts with saved amount/)
    assert.equal(calls.length, 1)
  })
}
for (const [label, amount] of [['null', null], ['undefined', undefined], ['empty object', {}], ['invalid raw value', { value: 'no-money', precision: 20 }]]) {
  test(`numeric contract: ${label} is rejected at all boundaries`, async () => {
    for (const boundary of numericBoundaries) {
      const { invoke, calls, rows } = numericHarness(boundary)
      await assert.rejects(invoke(amount), `${boundary} must reject`)
      assert.equal(calls.length, 0)
      if (rows) assert.equal(rows.size, 0)
    }
  })
}
