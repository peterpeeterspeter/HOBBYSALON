import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'
import { loadMedusaNumeric } from './helpers/medusa-numeric.mjs'

// Actual workflow, financial adapter, engine and allocator source. Only SDK,
// query/service and persistence boundaries are replaced. NOT native scheduling,
// PostgreSQL concurrency, provider or framework compensation acceptance.
const { MathBN, BigNumber, BigNumberJS } = loadMedusaNumeric()
const root = new URL('../../packages/modules/b2c-core/src/', import.meta.url)
const plain = (value) => JSON.parse(JSON.stringify(value))
class MedusaError extends Error {
  static Types = { NOT_ALLOWED: 'not_allowed', INVALID_DATA: 'invalid_data' }
  constructor(type, message) { super(message); this.type = type }
}
class StepResponse { constructor(value) { this.value = value } }
class WorkflowResponse { constructor(value) { this.value = value } }
const utils = { MathBN, MedusaError, OrderStatus: { CANCELED: 'canceled' },
  OrderWorkflowEvents: { CANCELED: 'order.canceled' }, ContainerRegistrationKeys: { QUERY: 'query', PG_CONNECTION: 'pg' } }
function load(url, collaborators = {}, cache = new Map()) {
  if (cache.has(url.href)) return cache.get(url.href)
  const exports = [], bindings = {}
  const source = readFileSync(url, 'utf8').replace(
    /^import\s(type\s)?\{([^}]+)\}\sfrom\s['"]([^'"]+)['"];?\s*/gm,
    (_match, typeOnly, names, specifier) => {
      if (typeOnly) return ''
      const dependency = collaborators[specifier] ?? (specifier.startsWith('.')
        ? load(new URL(`${specifier}.ts`, url), collaborators, cache) : undefined)
      assert.ok(dependency, `Unstubbed dependency: ${specifier}`)
      for (const name of names.split(',').map((v) => v.trim()).filter(Boolean)) bindings[name] = dependency[name]
      return ''
    })
  const code = stripTypeScriptTypes(source, { mode: 'strip' }).replace(
    /export (?:async )?(?:function|const|class) (\w+)/g,
    (match, name) => { exports.push(name); return match.replace('export ', '') })
  const module = vm.runInNewContext(`${code}\n;({${exports.join(',')}})`, bindings, { timeout: 1000 })
  cache.set(url.href, module)
  return module
}
const { allocateRefundAndReversal } = load(new URL('utils/refund-allocation.ts', root))
const { executeSettlement } = load(new URL('utils/refund-settlement.ts', root))
export function orderFixture(overrides = {}) {
  const order = { id: 'order-test', status: 'pending', currency_code: 'eur', fulfillments: [],
    items: [{ id: 'line-a', quantity: 4, total: 100 }],
    split_order_payment: { id: 'payment-test', captured_amount: 100, refunded_amount: 50 },
    payouts: [{ id: 'payout-test', amount: 45, reversals: [] }], ...overrides }
  if (order.split_order_payment) order.split_order_payment = { payment_collection_id: 'collection-test',
    currency_code: order.currency_code, ...order.split_order_payment }
  order.payouts = (order.payouts ?? []).map((payout) => ({ currency_code: order.currency_code,
    data: { id: 'transfer-test' }, ...payout }))
  return order
}
export const paymentFixture = (overrides = {}) => ({ id: 'native-payment', currency_code: 'eur', canceled_at: null,
  captures: [{ amount: 100 }], refunds: [], ...overrides })
export const newLedger = () => ({ records: new Map(), locked: false })
export async function run(kind, options = {}) {
  const { order = orderFixture(), lines = [{ item_line_id: 'line-a', value: '10' }], input = {},
    effects = {}, ledger = newLedger() } = options
  Object.assign(effects, { queries: [], allocations: [], refunds: [], reversals: [], validations: [], other: [],
    calls: [], ledgerWrites: [], settlements: [], recoveryReads: [], financialCompensations: [] })
  const payments = options.payments ?? [paymentFixture({ currency_code: order.currency_code,
    captures: [{ amount: order.split_order_payment?.captured_amount ?? 0 }],
    refunds: [{ amount: order.split_order_payment?.refunded_amount ?? 0 }] })]
  const pg = {}
  const store = {
    async withScopeLock(scope, work) {
      assert.equal(ledger.locked, false, 'Test store is serial only')
      ledger.locked = true
      try {
        if (options.onLock) await options.onLock(order)
        return await work({
          getOperation: async (id) => ledger.records.has(id) ? plain(ledger.records.get(id)) : null,
          findUnfinished: async (id) => [...ledger.records.values()].find((r) => r.input.scope_id === scope && r.input.operation_id !== id && r.phase !== 'completed') ?? null,
          create: async (record) => {
            assert.ok(!ledger.records.has(record.input.operation_id))
            ledger.records.set(record.input.operation_id, plain(record)); effects.ledgerWrites.push(plain(record)); effects.calls.push('persist-plan')
          },
          transition: async (id, expected, next, receipt = null) => {
            const record = ledger.records.get(id); assert.equal(record.phase, expected)
            if (options.failTransition === next) throw new Error('durability failure')
            record.phase = next; record.reversal_receipt_id = receipt; effects.calls.push(next)
          },
        })
      } finally { ledger.locked = false }
    },
  }
  const query = { graph: async (queryInput) => {
    const query = plain(queryInput); effects.queries.push({ ...query, locked: ledger.locked })
    if (options.queryOverride) { const response = await options.queryOverride(query, ledger.locked); if (response !== undefined) return response }
    if (query.entity === 'orders') { effects.query = query; return { data: [plain(order)] } }
    if (query.entity === 'order_payout') return { data: plain(options.rawPayoutLinks ?? order.payouts.map(p => ({order_id: order.id, payout_id: p.id}))) }
    if (query.entity === 'commission_line') return { data: plain(lines) }
    if (query.entity === 'payment_collection') return { data: options.collection === null ? [] : [options.collection ?? {
      id: order.split_order_payment?.payment_collection_id ?? 'collection-test', currency_code: order.currency_code,
      payments: payments.map(({ id }) => ({ id })),
    }] }
    assert.equal(query.entity, 'payment')
    return { data: plain(payments) }
  } }
  const payoutService = {
    retrievePayout: async (id) => { effects.recoveryReads.push({ retrieve: id }); return plain(order.payouts.find((p) => p.id === id)) },
    listPayoutReversals: async (filter, config) => {
      effects.recoveryReads.push({ filter, config })
      return plain((options.recoveryRows ?? []).slice(config.skip, config.skip + config.take))
    },
    createPayoutReversal: async (input) => {
      effects.reversals.push(plain(input)); effects.calls.push('reverse')
      if (options.reverseError) throw options.reverseError
      if (Object.hasOwn(options, 'reverseResult')) return options.reverseResult
      const digits = new Intl.NumberFormat('en', { style: 'currency', currency: input.currency_code }).resolvedOptions().maximumFractionDigits
      return { id: 'external-reversal', payout_id: input.payout_id, amount: input.amount, currency_code: input.currency_code,
        data: { id: 'external-reversal', amount: Math.round(input.amount * 10 ** digits), currency: input.currency_code,
          transfer: 'transfer-test', idempotency_key: `payout-reversal:${encodeURIComponent(input.payout_id)}:${encodeURIComponent(input.operation_id)}` } }
    },
  }
  const container = { resolve: (key) => {
    if (key === 'query') return query
    if (key === 'pg') return pg
    if (key === 'payout') return payoutService
    throw new Error(`Unstubbed container key ${key}`)
  } }
  const nodes = [], resolved = new Map()
  class Node {
    constructor(name, input, body) {
      Object.assign(this, { name, input, body })
      const proxy = new Proxy(this, { get(target, key) {
        if (key in target || key === 'then') return target[key]
        return new Node('property', proxy, (value) => value?.[key])
      } })
      nodes.push(proxy)
      return proxy
    }
    config() { return this }
  }
  const dependencies = (value) => value instanceof Node ? [value] : Array.isArray(value)
    ? value.flatMap(dependencies) : value && Object.prototype.toString.call(value) === '[object Object]'
      ? Object.values(value).flatMap(dependencies) : []
  const dependsOn = (node, ancestor) => dependencies(node.input).some((d) => d === ancestor || dependsOn(d, ancestor))
  async function resolve(value) {
    if (value instanceof Node) {
      if (!resolved.has(value)) resolved.set(value, (async () => {
        const input = await resolve(value.input); effects.calls.push(value.name)
        const result = await value.body(input)
        return result instanceof StepResponse ? result.value : result
      })())
      return resolved.get(value)
    }
    if (Array.isArray(value)) return Promise.all(value.map(resolve))
    if (value && Object.prototype.toString.call(value) === '[object Object]' && !(value instanceof BigNumber) && !(value instanceof BigNumberJS)) {
      return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await resolve(v)])))
    }
    return value
  }
  const make = (name, body) => (input) => new Node(name, input, body)
  const record = (name) => make(name, (input) => {
    effects.other.push({ name, input: plain(input) }); if (options.failOther === name) throw new Error(`${name} failed`)
    if (name === 'cancel') order.status = 'canceled'
    return input
  })
  const refund = async ({ input, throwOnError }) => {
    effects.refunds.push(plain(input)); effects.calls.push('refund')
    effects.refundThrowOnError = throwOnError
    if (options.refundError) throw options.refundError
    return Object.hasOwn(options, 'refundResult') ? options.refundResult : { result: [{ id: input.id }], errors: [] }
  }
  const refundWorkflow = () => ({ run: refund })
  refundWorkflow.runAsStep = ({ input }) => make('legacy-refund', (input) => refund({ input }))(input)
  const collaborators = {
    'node:crypto': { createHash },
    '@medusajs/framework/types': {}, '@medusajs/framework/utils': utils,
    '@medusajs/framework/workflows-sdk': {
      createWorkflow: (_name, body) => body,
      createStep: (name, body, compensation) => { if (name === 'settle-order-refund') effects.financialCompensations.push(compensation); return make(name, (input) => body(input, { container })) },
      transform: (input, body) => new Node('transform', input, body),
      when: (input, predicate) => ({ then: (body) => { // Conditional graph nodes, including their dependency edges.
        const before = nodes.length; const result = body(); for (const node of nodes.slice(before)) {
          const original = node.body, originalInput = node.input
          node.input = { condition: input, originalInput }; node.body = ({ condition, originalInput }) => predicate(condition) ? original(originalInput) : undefined
        }
        return result
      } }),
      parallelize: (...steps) => steps, StepResponse, WorkflowResponse,
    },
    '@medusajs/medusa/core-flows': {
      useQueryGraphStep: make('query-step', (input) => query.graph(input)),
      cancelOrdersStep: record('cancel'), deleteReservationsByLineItemsStep: record('reservations'), emitEventStep: record('event'),
    },
    '../../../modules/payout': { PAYOUT_MODULE: 'payout' },
    '../../payout/steps': { createPayoutReversalStep: make('legacy-reverse', (input) => input.amount ? payoutService.createPayoutReversal(input) : undefined) },
    '../../split-order-payment/workflows': { refundSplitOrderPaymentWorkflow: refundWorkflow },
    '../../split-order-payment/workflows/refund-split-order-payment': { refundSplitOrderPaymentWorkflow: refundWorkflow },
    // Scoped persistence boundary only: the actual refund step and its guard run unchanged.
    '../../../utils/payout-execution': { createPostgresPayoutExecutionStore: (connection) => {
      assert.equal(connection, pg)
      return {
        assertScopeResolved: async (scope) => {
          assert.equal(ledger.locked, true, 'Payout guard must run under settlement lock')
          effects.calls.push('payout-scope-guard')
          if ((options.payoutExecutions ?? []).some((row) => row.scope_id === scope && row.phase === 'started')) {
            throw new Error('Unresolved payout execution requires reconciliation')
          }
        },
        get: async (orderId) => {
          assert.equal(ledger.locked, true)
          return plain((options.payoutExecutions ?? []).find((row) => row.order_id === orderId) ?? null)
        },
      }
    } },
    '../../../utils/refund-settlement-store': { createPostgresSettlementStore: (connection) => { assert.equal(connection, pg); return store } },
    '../../../utils/refund-settlement': { executeSettlement: async (...args) => { effects.settlements.push(plain(args[1])); return executeSettlement(...args) } },
    '../../../utils/refund-allocation': { allocateRefundAndReversal: (input) => { effects.allocations.push(plain(input)); return (options.allocate ?? allocateRefundAndReversal)(input) } },
    './refund-allocation': { allocateRefundAndReversal: (input) => { effects.allocations.push(plain(input)); return (options.allocate ?? allocateRefundAndReversal)(input) } },
  }
  const [filename, exportName] = kind === 'return'
    ? ['refund-seller-order-for-return.ts', 'refundSellerOrderForReturnWorkflow'] : ['cancel-order.ts', 'cancelOrderWorkflow']
  const workflow = load(new URL(`workflows/order/workflows/${filename}`, root), collaborators)[exportName]
  const response = workflow({ order_id: order.id, operation_id: 'request-test', return_lines: [{ line_item_id: 'line-a', quantity: 1 }], ...input })
  const harness = { nodes, dependsOn, node: (name) => nodes.find((node) => node.name === name) }
  if (options.inspectGraph) options.inspectGraph(harness)
  for (const node of [...nodes].reverse()) await resolve(node)
  return { result: plain(await resolve(response.value)), effects, ledger, harness }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const kind of ['return', 'cancel']) {
    test(`${kind}: persists fixed allocation under collection lock before either effect`, async () => {
      const { effects, ledger } = await run(kind)
      assert.equal(effects.settlements.length, 1, 'Must execute the durable settlement engine')
      assert.equal(effects.settlements[0].scope_id, 'collection-test')
      assert.match(effects.settlements[0].fingerprint, /^[a-f0-9]{64}$/)
      assert.equal(effects.ledgerWrites[0].plan.payment_id, 'native-payment')
      assert.equal(effects.refunds[0].operation_id, kind === 'return' ? 'return:request-test' : 'cancel:order-test')
      assert.equal(effects.refunds[0].payment_id, 'native-payment')
      assert.equal(effects.refundThrowOnError, true)
      assert.ok(effects.calls.indexOf('persist-plan') < effects.calls.indexOf('refund'))
      assert.ok(effects.calls.indexOf('refund_completed') < effects.calls.indexOf('reverse'))
      assert.ok(effects.queries.filter((q) => q.entity === 'commission_line' || q.entity === 'payment').every((q) => q.locked))
      assert.equal([...ledger.records.values()][0].phase, 'completed')
      assert.deepEqual(effects.financialCompensations, [undefined])
    })
    test(`${kind}: replay does not reallocate changed balances or redispatch money`, async () => {
      const ledger = newLedger(), order = orderFixture()
      const first = await run(kind, { ledger, order })
      order.split_order_payment.refunded_amount = 100; order.items = []
      const replay = await run(kind, { ledger, order })
      assert.deepEqual(replay.result, first.result)
      assert.equal(replay.effects.allocations.length, 0)
      assert.equal(replay.effects.refunds.length, 0)
      assert.equal(replay.effects.reversals.length, 0)
    })
    test(`${kind}: payout guard blocks fresh plans and completed replay, including changed collection`, async () => {
      for (const replay of [false, true]) {
        for (const scenario of ['same-scope', 'changed-collection', 'other-order']) {
          const ledger = newLedger(), order = orderFixture(), effects = {}
          if (replay) await run(kind, { ledger, order })
          const before = plain([...ledger.records.values()])
          const payoutExecutions = [{ order_id: scenario === 'other-order' ? 'other-order' : order.id,
            scope_id: 'collection-test', phase: 'started' }]
          if (scenario === 'changed-collection') order.split_order_payment.payment_collection_id = 'changed-collection'
          // executeSettlement deliberately sanitizes store/lock errors.
          await assert.rejects(run(kind, { ledger, order, effects, payoutExecutions }),
            (error) => error.message === 'Settlement storage_failure' && error.code === 'storage_failure')
          assert.ok(effects.calls.includes('payout-scope-guard'))
          assert.deepEqual(effects.allocations, []); assert.deepEqual(effects.ledgerWrites, [])
          assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.reversals, [])
          assert.deepEqual(effects.other, []); assert.deepEqual(plain([...ledger.records.values()]), before)
          assert.equal(effects.queries.some((query) => query.fields.includes('payouts.*')), false, 'Guard runs before plan snapshot')
        }
      }
      const { effects } = await run(kind, { payoutExecutions: [{ order_id: 'unrelated-order', scope_id: 'unrelated-collection', phase: 'started' }] })
      assert.equal(effects.refunds.length, 1, 'An unrelated collection must not block refund')
    })
    test(`${kind}: completed payout evidence and raw link must agree before refund`, async () => {
      const saved = {order_id:'order-test',scope_id:'collection-test',phase:'completed',payout_id:'payout-test',transfer_id:'transfer-test',
        plan:{amount:45,currency:'eur',account_id:'local-account',account_reference_id:'connected-account',source_transaction:'ch_test',transaction_id:'order-test'}}
      for (const defect of ['none','missing-projection','missing-link','wrong-link','wrong-transfer','wrong-amount','wrong-currency','wrong-account','wrong-destination','deleted-payout','zero-contradiction','disappears-before-plan']) {
        const order=orderFixture(),effects={},record=plain(saved)
        Object.assign(order.payouts[0],{payout_account_id:'local-account',data:{id:'transfer-test',amount:4500,currency:'eur',destination:'connected-account',source_transaction:'ch_test'}})
        const options={order,effects,payoutExecutions:[record]}
        if(defect==='missing-projection')order.payouts=[]
        if(defect==='missing-link')options.rawPayoutLinks=[]
        if(defect==='wrong-link')options.rawPayoutLinks=[{order_id:order.id,payout_id:'wrong'}]
        if(defect==='wrong-transfer')order.payouts[0].data.id='wrong'
        if(defect==='wrong-amount')order.payouts[0].amount=44
        if(defect==='wrong-currency')order.payouts[0].currency_code='usd'
        if(defect==='wrong-account')order.payouts[0].payout_account_id='wrong'
        if(defect==='wrong-destination')order.payouts[0].data.destination='wrong'
        if(defect==='deleted-payout')order.payouts[0].deleted_at='2026-01-01'
        if(defect==='zero-contradiction'){record.plan.amount=0;record.payout_id=null;record.transfer_id=null}
        if(defect==='disappears-before-plan'){
          let fullReads=0
          options.queryOverride=(q)=>{if(q.entity==='orders'&&q.fields.includes('payouts.*')&&++fullReads===2)order.payouts=[]}
        }
        if(defect==='none'){
          await run(kind,options);assert.equal(effects.refunds.length,1);assert.ok(effects.reversals[0].amount>0)
        }else{
          await assert.rejects(run(kind,options),undefined,defect)
          assert.deepEqual(effects.refunds,[],defect);assert.deepEqual(effects.reversals,[],defect);assert.deepEqual(effects.ledgerWrites,[],defect)
        }
      }
    })
    test(`${kind}: successful reversal persists its validated receipt`, async () => {
      const {ledger}=await run(kind)
      assert.equal([...ledger.records.values()][0].reversal_receipt_id,'external-reversal')
    })
    test(`${kind}: only sole eligible captured payment is pinned, not first collection attempt`, async () => {
      const { effects } = await run(kind, { payments: [paymentFixture({ id: 'failed-attempt', captures: [] }), paymentFixture()] })
      assert.equal(effects.refunds[0].payment_id, 'native-payment')
    })
    test(`${kind}: ambiguous payouts or native payments fail before persistence/money`, async () => {
      for (const options of [{ payments: [paymentFixture(), paymentFixture({ id: 'second', captures: [{ amount: 1 }] })] },
        { order: orderFixture({ payouts: [{ id: 'one', amount: 20 }, { id: 'two', amount: 25 }] }) }]) {
        const effects = {}; await assert.rejects(run(kind, { ...options, effects }))
        assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.reversals, []); assert.deepEqual(effects.ledgerWrites, [])
      }
    })
    for (const [name, options] of [['throw', { refundError: new Error('failed') }],
      ['errors', { refundResult: { result: [{ id: 'payment-test' }], errors: [{}] } }],
      ['empty', { refundResult: { result: [], errors: [] } }], ['undefined', { refundResult: undefined }]]) {
      test(`${kind}: refund ${name} never reverses or reports completion and blocks redispatch`, async () => {
        const ledger = newLedger(), effects = {}
        await assert.rejects(run(kind, { ...options, ledger, effects }))
        assert.deepEqual(effects.reversals, []); assert.deepEqual(effects.other, [])
        assert.equal([...ledger.records.values()][0]?.phase, 'refund_started')
        await assert.rejects(run(kind, { ledger, effects }))
        assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.reversals, [])
      })
    }
  }
  test('cancellation financial/fulfillment/event ordering has actual SDK dependency edges', async () => {
    const { effects } = await run('cancel', { inspectGraph: ({ node, dependsOn }) => {
      const financial = node('settle-order-refund')
      assert.ok(financial, 'Missing financial settlement step')
      assert.ok(dependsOn(financial, node('cancel-validate-order')))
      for (const name of ['cancel', 'reservations', 'event']) assert.ok(dependsOn(node(name), financial), `${name} must depend on settlement`)
      assert.ok(dependsOn(node('event'), node('cancel')))
      assert.ok(dependsOn(node('event'), node('reservations')))
    } })
    assert.ok(effects.calls.indexOf('completed') < effects.calls.indexOf('cancel'))
  })
  test('active fulfillment forbids any plan/refund/cancellation/event', async () => {
    const effects = {}
    await assert.rejects(run('cancel', { effects, order: orderFixture({ fulfillments: [{ canceled_at: null }] }) }))
    assert.deepEqual(effects.ledgerWrites, []); assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.other, [])
  })
  test('return identity conflicts reject changed selection/reduction without reallocation', async () => {
    for (const input of [{ return_lines: [{ line_item_id: 'line-a', quantity: 2 }] }, { requested_refund_amount: 10 }]) {
      const ledger = newLedger(); await run('return', { ledger })
      const effects = {}; await assert.rejects(run('return', { ledger, effects, input }), /identity_conflict/)
      assert.deepEqual(effects.allocations, []); assert.deepEqual(effects.refunds, [])
    }
  })
  test('allocation re-reads order inside lock and rejects scope movement', async () => {
    const { effects } = await run('return', { onLock: (order) => { order.split_order_payment.refunded_amount = 60 } })
    assert.equal(effects.allocations[0].alreadyRefundedAmount, 60)
    const bad = {}; await assert.rejects(run('return', { effects: bad, onLock: (order) => { order.split_order_payment.payment_collection_id = 'moved' } }))
    assert.deepEqual(bad.refunds, []); assert.deepEqual(bad.ledgerWrites, [])
  })
  test('unpaid cancellation completes without dereferencing missing split/payout', async () => {
    const { result, effects } = await run('cancel', { order: orderFixture({ split_order_payment: null, payouts: [] }) })
    assert.equal(result, 'order-test'); assert.equal(effects.settlements[0].scope_id, 'order:order-test')
    assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.reversals, [])
    assert.equal(effects.other.length, 3)
  })
  test('missing split with positive captured collection cannot falsely cancel', async () => {
    const effects = {}; await assert.rejects(run('cancel', { effects, order: orderFixture({ split_order_payment: null,
      payment_collections: [{ id: 'collection-test', captured_amount: 100 }], payouts: [] }) }))
    assert.deepEqual(effects.other, []); assert.deepEqual(effects.ledgerWrites, [])
  })
  test('already canceled order needs matching completed settlement, never a new or pending one', async () => {
    for (const phase of [null, 'pending', 'refund_completed', 'reversal_started']) {
      const ledger = newLedger(); await run('cancel', { ledger })
      if (phase === null) ledger.records.clear(); else ledger.records.get('cancel:order-test').phase = phase
      const effects = {}; await assert.rejects(run('cancel', { ledger, effects, order: orderFixture({ status: 'canceled' }) }))
      assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.reversals, []); assert.deepEqual(effects.other, [])
    }
  })
  test('missing split with an existing transfer must not silently zero the cancellation', async () => {
    const effects = {}
    await assert.rejects(run('cancel', { effects, order: orderFixture({ split_order_payment: null }) }))
    assert.deepEqual(effects.other, []); assert.deepEqual(effects.ledgerWrites, [])
  })
  test('completed settlement replay resumes failed cancellation bookkeeping without new money', async () => {
    const ledger = newLedger(), order = orderFixture(), effects = {}
    await assert.rejects(run('cancel', { ledger, order, effects, failOther: 'reservations' }), /reservations failed/)
    assert.equal(order.status, 'canceled')
    assert.equal(ledger.records.get('cancel:order-test').phase, 'completed')
    assert.ok(!effects.other.some((effect) => effect.name === 'event'))
    const replay = await run('cancel', { ledger, order })
    assert.deepEqual(replay.effects.refunds, []); assert.deepEqual(replay.effects.reversals, [])
    assert.deepEqual(replay.effects.other.map((effect) => effect.name), ['reservations', 'event'])
  })
  test('return missing split rejects positive selection before persisting', async () => {
    const effects = {}; await assert.rejects(run('return', { effects, order: orderFixture({ split_order_payment: null, payouts: [] }) }))
    assert.deepEqual(effects.ledgerWrites, []); assert.deepEqual(effects.refunds, [])
  })
  test('canonical return fingerprint ignores line ordering but preserves explicit reduction', async () => {
    const ledger = newLedger(), order = orderFixture({ items: [{ id: 'line-a', quantity: 4, total: 100 }, { id: 'line-b', quantity: 1, total: 10 }] })
    const lines = [{ item_line_id: 'line-a', value: 10 }, { item_line_id: 'line-b', value: 0 }]
    const selected = [{ line_item_id: 'line-b', quantity: 1 }, { line_item_id: 'line-a', quantity: 1 }]
    const first = await run('return', { ledger, order, lines, input: { return_lines: selected } })
    order.items = []
    const replay = await run('return', { ledger, order, lines, input: { return_lines: [...selected].reverse() } })
    assert.deepEqual(replay.result, first.result); assert.deepEqual(replay.effects.allocations, [])
    await assert.rejects(run('return', { ledger, order, lines, input: { return_lines: selected, requested_refund_amount: 35 } }), /identity_conflict/)
  })
  test('refund-completed checkpoint resumes only fixed seller leg with changed balances', async () => {
    const ledger = newLedger(), order = orderFixture()
    await assert.rejects(run('return', { ledger, order, failTransition: 'reversal_started' }))
    assert.equal(ledger.records.get('return:request-test').phase, 'refund_completed')
    order.items = []; order.split_order_payment.refunded_amount = 100
    const { effects, result } = await run('return', { ledger, order })
    assert.equal(result.customer_refund, 25); assert.equal(effects.reversals[0].amount, 22.5)
    assert.deepEqual(effects.allocations, []); assert.deepEqual(effects.refunds, [])
  })
  test('another uncertain operation blocks both sellers sharing one collection', async () => {
    const ledger = newLedger()
    await assert.rejects(run('return', { ledger, refundError: new Error('unknown') }))
    const effects = {}; await assert.rejects(run('return', { ledger, effects, order: orderFixture({ id: 'other-order' }),
      input: { operation_id: 'another-request' } }), /scope_blocked/)
    assert.deepEqual(effects.allocations, []); assert.deepEqual(effects.refunds, [])
  })
  const evidence = (overrides = {}) => ({ id: 'external-reversal', payout_id: 'payout-test', amount: 22.5, currency_code: 'eur',
    data: { id: 'external-reversal', amount: 2250, currency: 'eur', transfer: 'transfer-test',
      idempotency_key: 'payout-reversal:payout-test:return%3Arequest-test' }, ...overrides })
  test('crashed reversal recovers only from paginated matching validated local evidence', async () => {
    const ledger = newLedger(); await assert.rejects(run('return', { ledger, reverseError: new Error('unknown') }))
    const rows = Array.from({ length: 100 }, (_, i) => evidence({ id: `old-${i}`, data: {} })).concat(evidence())
    const { result, effects } = await run('return', { ledger, recoveryRows: rows })
    assert.equal(result.seller_reversal, 22.5); assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.reversals, [])
    assert.ok(effects.recoveryReads.some((r) => r.config?.skip === 100))
    assert.equal(ledger.records.get('return:request-test').reversal_receipt_id, 'external-reversal')
  })
  for (const [name, rows] of [['missing', []], ['wrong major amount', [evidence({ amount: 23 })]],
    ['wrong currency', [evidence({ currency_code: 'usd' })]], ['wrong external id', [evidence({ id: 'different' })]],
    ...['amount', 'currency', 'transfer', 'id'].map((key) => [`wrong provider ${key}`, [evidence({ data: { ...evidence().data, [key]: 'wrong' } })]]),
    ['duplicate evidence', [evidence(), evidence()]]]) {
    test(`recovery ${name} remains blocked without provider calls`, async () => {
      const ledger = newLedger(); await assert.rejects(run('return', { ledger, reverseError: new Error('unknown') }))
      const effects = {}; await assert.rejects(run('return', { ledger, effects, recoveryRows: rows }))
      assert.deepEqual(effects.refunds, []); assert.deepEqual(effects.reversals, [])
      assert.equal(ledger.records.get('return:request-test').phase, 'reversal_started')
    })
  }
  for (const reverseResult of [undefined, null, {}, { err: true }, evidence({ amount: 99 })]) {
    test(`invalid reversal return ${JSON.stringify(reverseResult)} is never completion`, async () => {
      const ledger = newLedger(), effects = {}; await assert.rejects(run('return', { ledger, effects, reverseResult }))
      assert.equal(ledger.records.get('return:request-test').phase, 'reversal_started')
    })
  }
}
