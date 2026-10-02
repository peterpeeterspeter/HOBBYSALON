import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { loadMedusaNumeric } from './helpers/medusa-numeric.mjs'

// No network, server, database or provider. Actual workflow/step source and real
// Medusa 2.11.3 arithmetic; the SDK/effect boundaries are graph-aware stand-ins.
// Run with --experimental-vm-modules. See helpers/medusa-numeric.mjs for offline deps.
const { MathBN, BigNumber, BigNumberJS } = loadMedusaNumeric()
const root = new URL('../../packages/modules/b2c-core/src/workflows/split-order-payment/workflows/', import.meta.url)
class MedusaError extends Error {
  static Types = { INVALID_DATA: 'invalid_data', NOT_ALLOWED: 'not_allowed' }
  constructor(type, message) { super(message); this.type = type }
}
class StepResponse { constructor(value) { this.value = value } }
class WorkflowResponse { constructor(value) { this.value = value } }

function graphHarness(effects, options = {}) {
  const nodes = []
  const calls = effects.calls = []
  const context = { container: { resolve: () => ({ graph: options.query }) } }
  class Node {
    constructor(name, input, run) { Object.assign(this, { name, input, run }); nodes.push(this) }
  }
  const dependencies = (value) => {
    if (value instanceof Node) return [value]
    if (Array.isArray(value)) return value.flatMap(dependencies)
    if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.values(value).flatMap(dependencies)
    // vm-created plain input objects have a different realm's Object.prototype.
    if (value && Object.prototype.toString.call(value) === '[object Object]') return Object.values(value).flatMap(dependencies)
    return []
  }
  const dependsOn = (node, ancestor) => dependencies(node.input).some((dep) => dep === ancestor || dependsOn(dep, ancestor))
  const resolved = new Map()
  async function resolve(value) {
    if (value instanceof Node) {
      if (!resolved.has(value)) resolved.set(value, (async () => {
        const input = await resolve(value.input)
        calls.push(value.name)
        const result = await value.run(input)
        return result instanceof StepResponse ? result.value : result
      })())
      return resolved.get(value)
    }
    if (Array.isArray(value)) return Promise.all(value.map(resolve))
    if (value && Object.prototype.toString.call(value) === '[object Object]' && !(value instanceof BigNumber) && !(value instanceof BigNumberJS)) {
      return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await resolve(entry)])))
    }
    return value
  }
  const make = (name, body) => (input) => new Node(name, input, body)
  const sdk = {
    createStep: (name, body) => make(name, (input) => body(input, context)),
    createWorkflow: (_config, body) => body,
    transform: make('transform', null),
    StepResponse, WorkflowResponse,
  }
  sdk.transform = (input, body) => new Node('transform', input, body)
  return {
    sdk, nodes, make, dependsOn,
    node: (name) => { const found = nodes.find((node) => node.name === name); assert.ok(found, `Missing ${name}`); return found },
    async execute(response) {
      // Deliberately visit sinks in REVERSE declaration order. Only graph edges
      // can prevent transactions before refunds or partial refunds before updates.
      for (const node of [...nodes].reverse()) await resolve(node)
      return resolve(response.value)
    },
  }
}

async function load(filename, bindings) {
  const context = vm.createContext({})
  const source = stripTypeScriptTypes(readFileSync(new URL(filename, root), 'utf8'), { mode: 'strip' })
  const module = new vm.SourceTextModule(source, { context, identifier: filename })
  await module.link((specifier) => {
    assert.ok(Object.hasOwn(bindings, specifier), `Unstubbed dependency ${specifier}`)
    const exports = bindings[specifier]
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}
const payment = (overrides = {}) => ({
  id: 'pay-a', currency_code: 'eur', canceled_at: null,
  captures: [{ id: 'cap-a', amount: 100 }], refunds: [], ...overrides,
})
const defaultInput = { id: 'split-a', amount: 10 }

async function partial({ input = {}, payments = [payment()], collection, link, queryOverride,
  refundResult, refundError, effects = {} } = {}) {
  effects.queries = []; effects.refunds = []; effects.transactions = []
  const collectionData = collection === undefined ? {
    id: 'pc-a', currency_code: 'eur', payments: payments.map(({ id }) => ({ id })),
  } : collection
  const linkData = link === undefined ? {
    order_id: 'order-a', split_order_payment: { payment_collection_id: 'pc-a', currency_code: 'eur' },
  } : link
  const harness = graphHarness(effects, { query: async (query) => {
    effects.queries.push(query)
    if (queryOverride) { const override = queryOverride(query); if (override !== undefined) return override }
    if (query.entity === 'order_split_order_payment') return { data: linkData ? [linkData] : [] }
    if (query.entity === 'payment_collection') return { data: collectionData ? [collectionData] : [] }
    assert.equal(query.entity, 'payment')
    const ids = Array.isArray(query.filters.id) ? query.filters.id : [query.filters.id]
    return { data: payments.filter((p) => ids.includes(p.id)) }
  } })
  const module = await load('partial-payment-refund.ts', {
    '@medusajs/framework/utils': { MathBN, MedusaError, ContainerRegistrationKeys: { QUERY: 'query' } },
    '@medusajs/framework/workflows-sdk': harness.sdk,
    '@medusajs/medusa/core-flows': {
      refundPaymentsStep: harness.make('native-refund', (input) => {
        effects.refunds.push(input)
        if (refundError) throw refundError
        return refundResult === undefined ? [payments.find((p) => p.id === input[0].payment_id)] : refundResult
      }),
      addOrderTransactionStep: harness.make('order-transaction', (input) => {
        effects.transactions.push(input); return [input]
      }),
    },
    '@mercurjs/framework': { RefundSplitOrderPaymentsDTO: undefined },
    '../../../links/order-split-order-payment': { default: { entryPoint: 'order_split_order_payment' } },
  })
  const response = module.partialPaymentRefundWorkflow({ ...defaultInput, ...input })
  return { harness, response, effects, run: () => harness.execute(response) }
}

async function outer({ updateError, effects = {} } = {}) {
  effects.partial = []
  const harness = graphHarness(effects)
  const module = await load('refund-split-order-payment.ts', {
    '@medusajs/framework/workflows-sdk': harness.sdk,
    '@mercurjs/framework': { RefundSplitOrderPaymentsDTO: undefined },
    '../steps': { updateSplitOrderPaymentsStep: harness.make('update-split', (input) => {
      if (updateError) throw updateError
      return input
    }) },
    '../steps/validate-refund-split-order-payment': {
      validateRefundSplitOrderPaymentStep: harness.make('validate-split', (input) => ({ id: input.id, refunded_amount: input.amount })),
    },
    './partial-payment-refund': { partialPaymentRefundWorkflow: {
      runAsStep: ({ input }) => harness.make('partial-refund', (input) => { effects.partial.push(input); return [] })(input),
    } },
  })
  const input = { ...defaultInput, operation_id: 'return:request-a', payment_id: 'pay-b' }
  const response = module.refundSplitOrderPaymentWorkflow(input)
  return { harness, effects, input, run: () => harness.execute(response) }
}

const rejectsBeforeRefund = async (options, pattern) => {
  const { run, effects } = await partial(options)
  await assert.rejects(run(), pattern)
  assert.equal(effects.refunds.length, 0)
  assert.equal(effects.transactions.length, 0)
  return effects
}

test('DTO preserves legacy fields and allows optional business operation/payment identities', () => {
  const source = readFileSync(new URL('../../packages/framework/src/types/split-order-payment/mutations.ts', import.meta.url), 'utf8')
  const dto = source.match(/export type RefundSplitOrderPaymentsDTO = \{([^}]+)\}/s)?.[1]
  assert.match(dto, /operation_id\?: string/)
  assert.match(dto, /payment_id\?: string/)
  assert.match(dto, /amount: number/)
})

test('split update is an actual ancestor of the nested refund and preserves identity input', async () => {
  const { harness, effects, input, run } = await outer()
  assert.ok(harness.dependsOn(harness.node('partial-refund'), harness.node('update-split')), 'Missing update -> partial refund graph dependency')
  await run()
  assert.ok(effects.calls.indexOf('update-split') < effects.calls.indexOf('partial-refund'))
  assert.deepEqual(effects.partial[0], input)
})

test('failed split update prevents the nested refund even with reverse scheduling', async () => {
  const { run, effects } = await outer({ updateError: new Error('update failed') })
  await assert.rejects(run(), /update failed/)
  assert.equal(effects.partial.length, 0)
})

test('order transaction has a real native-refund ancestor, not just a payment-selection ancestor', async () => {
  const { harness, run, effects } = await partial()
  assert.ok(harness.dependsOn(harness.node('order-transaction'), harness.node('native-refund')), 'Missing native refund -> transaction graph dependency')
  await run()
  assert.ok(effects.calls.indexOf('native-refund') < effects.calls.indexOf('order-transaction'))
})

for (const [name, result] of [['empty swallowed-error result', []], ['wrong payment', [payment({ id: 'other' })]],
  ['wrong currency', [payment({ currency_code: 'usd' })]], ['duplicate result', [payment(), payment()]]]) {
  test(`does not book an order refund on ${name}`, async () => {
    const { run, effects } = await partial({ refundResult: result })
    await assert.rejects(run(), /refund|payment|currency/i)
    assert.equal(effects.refunds.length, 1)
    assert.equal(effects.transactions.length, 0)
  })
}
test('native thrown failure cannot race a negative order transaction', async () => {
  const { run, effects } = await partial({ refundError: new Error('native failed') })
  await assert.rejects(run(), /native failed/)
  assert.equal(effects.transactions.length, 0)
})

test('exact supplied payment is selected from its collection, never payments[0]', async () => {
  const { run, effects } = await partial({ input: { payment_id: 'pay-b' }, payments: [payment(), payment({ id: 'pay-b' })] })
  await run()
  assert.equal(effects.refunds[0][0].payment_id, 'pay-b')
  assert.equal(effects.transactions[0].reference_id, 'pay-b')
})

test('foreign payment identity is refused before querying that payment or refunding anything', async () => {
  const effects = await rejectsBeforeRefund({ input: { payment_id: 'foreign' } }, /belong|collection|payment/i)
  assert.ok(!effects.queries.some((query) => query.entity === 'payment'))
})

test('legacy selection finds the only remaining captured payment, not an uncaptured first attempt', async () => {
  const { run, effects } = await partial({ payments: [payment({ captures: [] }), payment({ id: 'pay-b' })] })
  await run()
  assert.equal(effects.refunds[0][0].payment_id, 'pay-b')
})

test('legacy selection refuses multiple refundable captured payments even when only one fits amount', async () => {
  await rejectsBeforeRefund({ payments: [payment(), payment({ id: 'pay-b', captures: [{ amount: 1 }] })] }, /ambiguous|multiple|specify/i)
})

for (const [name, overrides] of [
  ['missing split link', { link: null }], ['missing collection', { collection: null }],
  ['empty collection', { payments: [] }], ['no captured balance', { payments: [payment({ captures: [] })] }],
  ['already fully refunded', { payments: [payment({ refunds: [{ amount: 100 }] })] }],
  ['canceled payment', { payments: [payment({ canceled_at: '2026-01-01' })] }],
  ['supplied payment not captured', { input: { payment_id: 'pay-a' }, payments: [payment({ captures: [] }), payment({ id: 'pay-b' })] }],
  ['missing payment record', { queryOverride: (query) => query.entity === 'payment' ? { data: [] } : undefined }],
]) {
  test(`rejects ${name} cleanly`, async () => {
    await rejectsBeforeRefund(overrides, (error) => error instanceof MedusaError && /payment|collection|refund|captur/i.test(error.message))
  })
}

for (const amount of [0, -1, NaN, Infinity, -Infinity, '10', null, undefined, 100.01, 0.001, 0.1 + 0.2, Number.MAX_SAFE_INTEGER]) {
  test(`rejects invalid, over-balance or non-minor-unit requested amount ${String(amount)}`, async () => {
    await rejectsBeforeRefund({ input: { amount } }, /amount|precision|refund/i)
  })
}
for (const value of [undefined, null, NaN, Infinity, -1, 'bad']) {
  test(`rejects invalid native capture/refund value ${String(value)}`, async () => {
    for (const key of ['captures', 'refunds']) await rejectsBeforeRefund({ payments: [payment({ [key]: [{ amount: value }] })] }, /amount|refund|captur/i)
  })
}
for (const identity of ['', '  ', null, 7]) {
  test(`rejects malformed supplied identity ${JSON.stringify(identity)} instead of legacy fallback`, async () => {
    for (const key of ['payment_id', 'operation_id']) await rejectsBeforeRefund({ input: { [key]: identity } }, /identity|operation|payment/i)
  })
}
for (const [name, overrides] of [
  ['payment mismatch', { payments: [payment({ currency_code: 'usd' })] }],
  ['collection mismatch', { collection: { id: 'pc-a', currency_code: 'usd', payments: [{ id: 'pay-a' }] } }],
  ['missing payment currency', { payments: [payment({ currency_code: undefined })] }],
  ['invalid payment currency', { payments: [payment({ currency_code: 'euro' })] }],
  ['missing split currency', { link: { order_id: 'order-a', split_order_payment: { payment_collection_id: 'pc-a' } } }],
]) {
  test(`rejects ${name} before native refund`, async () => { await rejectsBeforeRefund(overrides, /currency/i) })
}

for (const [currency, captured, prior, requested] of [['EUR', '1.00', '0.70', 0.3], ['jpy', '3', '2', 1], ['kwd', '0.003', '0.002', 0.001]]) {
  test(`accepts exact remaining ${currency} amount with real Medusa decimal shapes`, async () => {
    const { run, effects } = await partial({ input: { amount: requested },
      payments: [payment({ currency_code: currency, captures: [{ amount: new BigNumber(captured) }], refunds: [{ amount: { value: prior, precision: 20 } }] })],
      collection: { id: 'pc-a', currency_code: currency.toLowerCase(), payments: [{ id: 'pay-a' }] },
      link: { order_id: 'order-a', split_order_payment: { payment_collection_id: 'pc-a', currency_code: currency.toLowerCase() } },
    })
    await run()
    assert.ok(MathBN.eq(effects.transactions[0].amount, MathBN.mult(requested, -1)))
    assert.equal(effects.transactions[0].reference, 'refund')
    assert.equal(effects.transactions[0].order_id, 'order-a')
    assert.equal(effects.refunds[0][0].amount, requested)
  })
}

test('business reference survives retries and amount changes; equal amounts with different operations stay distinct', async () => {
  for (const [operation_id, amount] of [['return:one', 10], ['return:one', 5], ['return:two', 10]]) {
    const { run, effects } = await partial({ input: { operation_id, amount } })
    await run()
    assert.equal(effects.transactions[0].reference_id, operation_id)
    assert.equal(effects.refunds[0][0].note, `Split order payment refund operation: ${operation_id}`)
    assert.equal(effects.refunds[0][0].operation_id, undefined, 'Native note is not provider idempotency forwarding')
  }
})

test('legacy caller still books native payment reference and omits operation note', async () => {
  const { run, effects } = await partial()
  const result = await run()
  assert.equal(effects.transactions[0].reference_id, 'pay-a')
  assert.equal(effects.refunds[0][0].note, undefined)
  assert.equal(result[0].id, 'pay-a')
})
