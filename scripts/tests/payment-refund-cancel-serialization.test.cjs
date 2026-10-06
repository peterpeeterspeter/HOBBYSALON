'use strict'
// OFFLINE: real Medusa 2.11.3 constructors/decorators/dispatcher/numerics/loaders,
// source ALS and financial-authority helpers. Synthetic persistence, SQL results
// and provider adapters only; no actual provider or database is ever contacted.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const swc = require('@swc/core')
const Native = require('@medusajs/payment').default
const { PaymentProviderService: NativeDispatcher } = require('@medusajs/payment/dist/services')
const { BigNumber, MathBN, PaymentSessionStatus, ModulesSdkUtils } = require('@medusajs/framework/utils')
assert.equal(require('@medusajs/payment/package.json').version, '2.11.3')
const root = path.resolve(__dirname, '../..')
const base = path.join(root, 'apps/backend/src/modules/payment-capture-recovery')
const utils = path.join(root, 'packages/modules/b2c-core/src/utils')
const baseline = process.env.PAYMENT_REFUND_CANCEL_BASELINE === 'native'
Module._extensions['.ts'] = (mod, filename) => {
  mod.paths = [...module.paths, ...mod.paths]
  mod._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'typescript', decorators: true }, target: 'es2022', transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' }
  }).code, filename)
}
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('@mercurjs/b2c-core/utils/')) request = path.join(utils, request.split('/').at(-1) + '.ts')
  return resolve.call(this, request, ...args)
}
const cartLock = require(path.join(utils, 'commerce-cart-lock.ts'))
const { withCommerceCartLock, withCommerceRefundSequence, commerceCartLockKey, assertCommerceFinancialLock, assertCommerceCartLock, commerceCartLockQuery } = cartLock
const { assertCommerceOrderCancellation } = require(path.join(utils, 'commerce-financial-lock.ts'))
const OrderService = require(path.join(root, 'apps/backend/src/modules/order-commerce-serialization/service.ts')).default
const effectFence = require(path.join(utils, 'refund-effect-fence.ts'))
const { withRefundEffectFence } = effectFence
const Service = baseline ? Native.service : require(path.join(base, 'service.ts')).default
const Dispatcher = baseline ? NativeDispatcher : require(path.join(base, 'financial-provider.ts')).default
const factoryCalls = {}
const sdk = { ...ModulesSdkUtils }
for (const name of ['mikroOrmConnectionLoaderFactory', 'moduleContainerLoaderFactory', 'buildMigrationScript', 'buildRevertMigrationScript', 'buildGenerateMigrationScript']) {
  sdk[name] = options => { factoryCalls[name] = options; return ModulesSdkUtils[name](options) }
}
const load = Module._load
Module._load = function (request, parent, ...args) {
  const value = load.call(this, request, parent, ...args)
  return request === '@medusajs/framework/utils' && parent?.filename === path.join(base, 'index.ts') ? { ...value, ModulesSdkUtils: sdk } : value
}
const Wrapped = require(path.join(base, 'index.ts')).default
Module._load = load
const lockError = /lock.*not held|lock.*lost/i
function harness(options = {}) {
  const connection = new EventEmitter()
  const h = { events: [], providers: [], writes: [], rows: [], reads: [], transactions: [], counts: {}, connection, scopeActive: true, physicalHeld: false, unlocks: 0, releases: 0, cancellationWrites: [], receiptReads: 0, dispatchRows: [], quarantineQueries: [] }
  // This receipt exists BEFORE the failing batch, not as proof of its success.
  h.oldReceipt = Object.freeze({ operation_id: 'cancel:order_fixture', order_id: 'order_fixture', scope_id: 'paycol_fixture', phase: 'completed' })
  h.invalidateScope = name => {
    assertCommerceFinancialLock() // Scope-only fault: the actual cart owner stays live.
    h.scopeActive = false; h.scopeLostAt = name
    h.atScopeLoss = { writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length }
  }
  const payment = { id: 'pay_fixture', payment_collection_id: 'paycol_fixture', provider_id: 'pp_fixture', currency_code: 'eur', amount: new BigNumber('12.34'), raw_amount: { value: '12.34', precision: 20 }, captures: options.uncaptured ? [] : [{ id: 'cap_fixture', amount: new BigNumber('12.34'), raw_amount: { value: '12.34', precision: 20 } }], refunds: h.rows, captured_at: null, canceled_at: null, data: { id: 'pi_fixture' }, ...options.payment }
  const cart = options.cart || 'cart_fixture'
  h.boundary = async name => {
    h.events.push(name); const count = h.counts[name] = (h.counts[name] || 0) + 1
    await Promise.resolve()
    if (options.loseAt === name && count === (options.loseNth || 1)) { h.lostAt = name; connection.emit('end') }
    if (options.loseScopeAt === name && count === (options.loseNth || 1)) h.invalidateScope(name)
    if (options.failAt === name) {
      h.atFailure ??= { writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length }
      throw new Error('synthetic failure: ' + name)
    }
  }
  const knex = {
    client: { acquireConnection: async () => connection, releaseConnection: async () => { h.releases++ }, destroyRawConnection: async () => {} },
    raw: (sql, bindings = []) => ({ connection: async actual => {
      assert.equal(actual, connection)
      if (sql === 'SET SESSION synchronous_commit = on') return { rows: [] }
      if (sql.includes('pg_try_advisory_lock') || sql.includes('pg_advisory_unlock')) {
        assert.deepEqual(bindings, [commerceCartLockKey(cart)])
        if (sql.includes('pg_try')) h.physicalHeld = true
        else { h.physicalHeld = false; h.unlocks++ }
        return { rows: [sql.includes('pg_try') ? { locked: true } : { unlocked: true }] }
      }
      if (sql.startsWith('SELECT s.cart_id,s.payment_collection_id')) {
        assert.deepEqual(bindings, ['order_fixture'])
        return { rows: [{ cart_id: cart, payment_collection_id: 'paycol_fixture' }] }
      }
      if (sql.startsWith('SELECT operation_id,order_id,scope_id,phase FROM refund_settlement')) {
        assert.deepEqual(bindings, ['cancel:order_fixture', 'order_fixture', 'paycol_fixture'])
        h.receiptReads++
        return { rows: [h.oldReceipt] }
      }
      if (sql.startsWith('SELECT p.id AS payment_id')) {
        await h.boundary('payment-link')
        return { rows: Object.hasOwn(options, 'links') ? options.links : [{ payment_id: payment.id, payment_collection_id: payment.payment_collection_id, cart_id: 'cart_fixture' }] }
      }
      if (sql.startsWith('SELECT s.id,c.cart_id')) {
        await h.boundary('session-link')
        return { rows: Object.hasOwn(options, 'sessions') ? options.sessions : [{ id: 'payses_fixture', cart_id: 'cart_fixture', payment_collection_id: 'paycol_fixture' }] }
      }
      if (sql.startsWith('SELECT 1 AS bound')) {
        await h.boundary('session-bound'); return { rows: [{ bound: 1 }] }
      }
      // Wiring tests replace the final SQL refusal with their shared fault ledger.
      // Never shadow those explicit persistence fixtures with these clean defaults.
      if (!options.ledger && !options.settlements && !options.engineRows) {
        assertCommerceFinancialLock()
        const query = sql.replace(/\s+/g, ' ').trim()
        const nativeFrom = 'FROM refund r JOIN payment p ON p.id=r.payment_id JOIN payment_collection pc ON pc.id=p.payment_collection_id JOIN cart_payment_collection c ON c.payment_collection_id=pc.id'
        const nativeLive = 'r.deleted_at IS NULL AND p.deleted_at IS NULL AND pc.deleted_at IS NULL AND c.deleted_at IS NULL'
        const nativeAmount = "COALESCE(r.raw_amount->>'value',r.amount::text)::numeric"
        const nativeSQL = `SELECT r.id AS refund_id,p.id AS payment_id,pc.id AS scope_id,c.cart_id, p.provider_id,p.data->>'id' AS provider_payment_id,${nativeAmount} AS amount,p.currency_code ${nativeFrom} WHERE r.id=? AND ${nativeLive}`
        const insertSQL = `INSERT INTO commerce_refund_dispatch (operation_id,refund_id,payment_id,scope_id,provider_id,provider_payment_id,amount,currency_code,idempotency_key,state) SELECT wanted.operation_id,r.id,p.id,pc.id,p.provider_id,p.data->>'id',${nativeAmount},p.currency_code,r.id,'started' ${nativeFrom} CROSS JOIN (SELECT ?::text AS operation_id,?::text AS refund_id,?::text AS payment_id,?::text AS scope_id, ?::text AS provider_id,?::text AS provider_payment_id,?::numeric AS amount,?::text AS currency_code) wanted WHERE r.id=wanted.refund_id AND p.id=wanted.payment_id AND pc.id=wanted.scope_id AND p.provider_id=wanted.provider_id AND p.data->>'id'=wanted.provider_payment_id AND ${nativeAmount}=wanted.amount AND p.currency_code=wanted.currency_code AND pc.currency_code=wanted.currency_code AND c.cart_id=? AND ${nativeLive} ON CONFLICT (refund_id) DO NOTHING RETURNING *`
        const updateSQL = "UPDATE commerce_refund_dispatch SET state = 'completed',updated_at=now() WHERE refund_id=? AND scope_id=? AND state='started' AND operation_id=? AND idempotency_key=? AND payment_id=? AND provider_id=? AND provider_payment_id=? AND amount=?::numeric AND currency_code=? RETURNING *"
        const nativeRow = id => {
          const row = h.rows.find(r => r.id === id)
          if (!row || (row.payment_id ?? row.payment?.id) !== payment.id) return null
          assert.ok(MathBN.eq(row.amount, row.raw_amount.value))
          return { refund_id: row.id, payment_id: payment.id, scope_id: payment.payment_collection_id, cart_id: 'cart_fixture', provider_id: payment.provider_id, provider_payment_id: payment.data.id, amount: row.raw_amount.value, currency_code: payment.currency_code }
        }
        if (query === 'SELECT c.cart_id,pc.id AS scope_id,pc.currency_code FROM payment_collection pc JOIN cart_payment_collection c ON c.payment_collection_id=pc.id WHERE pc.id=? AND pc.deleted_at IS NULL AND c.deleted_at IS NULL') {
          assert.deepEqual(bindings, ['paycol_fixture'])
          h.quarantineQueries.push('scope')
          return { rows: [{ cart_id: 'cart_fixture', scope_id: 'paycol_fixture', currency_code: 'eur' }] }
        }
        if (query === "SELECT operation_id,scope_id,phase,plan, to_jsonb(refund_settlement)->>'no_effect_receipt_id' AS no_effect_receipt_id FROM refund_settlement WHERE scope_id=? AND (phase <> 'completed' OR to_jsonb(refund_settlement)->>'no_effect_receipt_id' IS NOT NULL)") {
          assert.deepEqual(bindings, ['paycol_fixture'])
          h.quarantineQueries.push('settlements')
          return { rows: [] }
        }
        if (query === "SELECT * FROM commerce_refund_dispatch WHERE scope_id=? AND state = 'started'") {
          assert.deepEqual(bindings, ['paycol_fixture'])
          h.quarantineQueries.push('dispatches')
          return { rows: h.dispatchRows.filter(r => r.scope_id === bindings[0] && r.state === 'started').map(r => ({ ...r })) }
        }
        if (query === nativeSQL) {
          assert.equal(bindings.length, 1)
          h.quarantineQueries.push('native-refund')
          const row = nativeRow(bindings[0])
          return { rows: row ? [row] : [] }
        }
        if (query === insertSQL) {
          const native = nativeRow(bindings[1])
          assert.ok(native, 'dispatch must reference persisted native refund identity')
          assert.deepEqual(bindings, [native.refund_id, native.refund_id, native.payment_id, native.scope_id, native.provider_id, native.provider_payment_id, new BigNumber(native.amount).bigNumber.toString(), native.currency_code, native.cart_id])
          if (h.writes.some(w => w.name === 'refund-create')) assert.ok(h.events.includes('transaction-commit'), 'native reservation committed before dispatch')
          h.quarantineQueries.push('dispatch-start')
          if (h.dispatchRows.some(r => r.refund_id === native.refund_id || (r.scope_id === native.scope_id && r.state === 'started'))) return { rows: [], rowCount: 0 }
          const { cart_id, ...identity } = native
          const row = { ...identity, operation_id: native.refund_id, idempotency_key: native.refund_id, state: 'started' }
          h.dispatchRows.push(row)
          return { rows: [{ ...row }], rowCount: 1 }
        }
        if (query === 'SELECT * FROM commerce_refund_dispatch WHERE refund_id=?') {
          assert.equal(bindings.length, 1)
          h.quarantineQueries.push('dispatch-receipt')
          return { rows: h.dispatchRows.filter(r => r.refund_id === bindings[0]).map(r => ({ ...r })) }
        }
        if (query === updateSQL) {
          const row = h.dispatchRows.find(r => r.refund_id === bindings[0] && r.state === 'started')
          if (!row) return { rows: [], rowCount: 0 }
          assert.deepEqual(bindings, [row.refund_id, row.scope_id, row.operation_id, row.refund_id, row.payment_id, row.provider_id, row.provider_payment_id, new BigNumber(row.amount).bigNumber.toString(), row.currency_code])
          assert.ok(h.events.includes('collection-update'), 'native accounting precedes dispatch completion')
          h.quarantineQueries.push('dispatch-complete')
          row.state = 'completed'
          return { rows: [{ ...row }], rowCount: 1 }
        }
      }
      assert.fail('Unexpected synthetic SQL: ' + sql)
    } })
  }
  const lockContainer = { resolve: () => knex }
  const provider = {}
  for (const name of ['refundPayment', 'cancelPayment', 'deletePayment', 'initiatePayment', 'authorizePayment']) {
    provider[name] = async input => {
      h.providers.push({ name, input }); await h.boundary('provider:' + name)
      return { data: { ...input.data, syntheticReceipt: true }, status: PaymentSessionStatus.AUTHORIZED }
    }
  }
  const dispatcher = new Dispatcher({ pp_fixture: provider, logger: console })
  const paymentService = {
    retrieve: async (id, config) => {
      h.reads.push({ id, config }); await h.boundary('payment-retrieve')
      if (options.missing) return null
      const snapshot = { ...payment, refunds: h.rows }
      if (!config?.select) return snapshot
      const fields = new Set([...config.select, ...(config.relations || []).map(r => r.split('.')[0])])
      return Object.fromEntries(Object.entries(snapshot).filter(([key]) => fields.has(key)))
    },
    update: async data => { h.writes.push({ name: 'payment', data }); await h.boundary('payment-update'); Object.assign(payment, data); return payment }
  }
  const refundService = {
    retrieve: async id => {
      await h.boundary('refund-retrieve')
      return options.refund || h.rows.find(row => row.id === id) || null
    },
    create: async (data, context) => {
      assert.ok(context.transactionManager, 'native refund creation has internal transaction')
      assert.equal(data.payment, payment.id)
      h.writes.push({ name: 'refund-create', data }); await h.boundary('refund-create')
      const amount = new BigNumber(data.amount)
      const row = { id: 'ref_fixture_' + (h.rows.length + 1), amount, raw_amount: amount.raw, payment_id: data.payment }
      h.rows.push(row); return row
    },
    delete: async data => { h.writes.push({ name: 'refund-delete', data }); await h.boundary('refund-delete'); h.rows.splice(0); return [] }
  }
  const sessionService = {
    retrieve: async id => { await h.boundary('session-retrieve'); return { id, provider_id: 'pp_fixture', payment_collection_id: 'paycol_fixture', data: payment.data, amount: payment.amount, currency_code: 'eur', ...options.session } },
    delete: async id => { h.writes.push({ name: 'session-delete', id }); await h.boundary('session-delete'); return [] },
    create: async data => { await h.boundary('session-create'); return { id: 'payses_fixture', ...data } },
    update: async data => { h.writes.push({ name: 'session-update', data }); await h.boundary('session-update'); return data }
  }
  const dependencies = {
    baseRepository: {
      getFreshManager: () => { h.events.push('manager'); return {} },
      transaction: async fn => { h.transactions.push('native'); await h.boundary('transaction'); const value = await fn({ syntheticTransaction: true }); await h.boundary('transaction-commit'); return value },
      serialize: async value => { await h.boundary('serialize'); return value }
    },
    paymentService, refundService, paymentSessionService: sessionService, captureService: {}, paymentProviderService: dispatcher,
    paymentCollectionService: {
      retrieve: async () => { await h.boundary('collection-retrieve'); return { id: payment.payment_collection_id, amount: payment.amount, currency_code: 'eur', payment_sessions: [{ status: PaymentSessionStatus.AUTHORIZED, amount: payment.amount }], payments: [{ captures: payment.captures, refunds: h.rows }] } },
      update: async data => { h.writes.push({ name: 'collection', data }); await h.boundary('collection-update'); return data }
    }, accountHolderService: {}
  }
  const service = new Service(dependencies, {})
  const orderService = new OrderService({ baseRepository: dependencies.baseRepository,
    orderService: { list: async () => [{ id: 'order_fixture', status: 'pending' }],
      update: async data => { h.cancellationWrites.push(data); return data } } }, {})
  h.withEffect = fn => withRefundEffectFence(() => {
    assertCommerceFinancialLock()
    if (!h.scopeActive) throw new Error('Synthetic refund scope lost')
  }, fn)
  Object.assign(h, { service, dispatcher, payment, dependencies, orderService, lockContainer, cart,
    run: fn => withCommerceCartLock(lockContainer, cart, () => options.effectFence ? h.withEffect(fn) : fn()) })
  h.refund = (context = {}) => h.run(() => service.refundPayment({ payment_id: payment.id, amount: new BigNumber('3.21'), created_by: 'actor_fixture', note: 'synthetic note', refund_reason_id: 'reason_fixture' }, context))
  h.cancel = (context = {}) => h.run(() => service.cancelPayment(payment.id, context))
  h.session = (context = {}) => h.run(() => service.deletePaymentSession('payses_fixture', context))
  return h
}
for (const method of ['refund', 'cancel', 'session']) {
  test(method + ': no ALS capability, forged caller context rejected before native work', async () => {
    const h = harness({ uncaptured: true })
    const input = method === 'refund' ? { payment_id: h.payment.id, amount: 1, cart_id: 'cart_fixture' } : method === 'cancel' ? h.payment.id : 'payses_fixture'
    const name = { refund: 'refundPayment', cancel: 'cancelPayment', session: 'deletePaymentSession' }[method]
    await assert.rejects(h.service[name](input, { manager: {}, cart_id: 'cart_fixture', financialLock: true }), lockError)
    assert.deepEqual(h.events, []); assert.deepEqual(h.providers, []); assert.deepEqual(h.writes, [])
  })
  for (const transactionManager of [{}, null, false, 0]) test(method + ': defined outer transaction is rejected (' + String(transactionManager) + ')', async () => {
    const h = harness({ uncaptured: true })
    await assert.rejects(h[method]({ transactionManager }), /outer transaction/)
    assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.reads.length, 0)
  })
  test(method + ': wrong locked cart rejected without effects', async () => {
    const h = harness({ cart: 'cart_other', uncaptured: true })
    await assert.rejects(h[method](), /different cart|locked cart|identity/)
    assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
  })
}
for (const method of ['refund', 'cancel']) {
  for (const [label, options] of [
    ['missing payment', { missing: true }], ['mismatched id', { payment: { id: 'pay_other' } }],
    ['missing collection', { payment: { payment_collection_id: undefined } }], ['malformed collection', { payment: { payment_collection_id: ' bad' } }],
    ['missing link', { links: [] }], ['malformed links', { links: null }],
    ['wrong collection', { links: [{ payment_id: 'pay_fixture', payment_collection_id: 'paycol_other', cart_id: 'cart_fixture' }] }],
    ['ambiguous links', { links: [1, 2] }]
  ]) test(method + ': authoritative identity refuses ' + label, async () => {
    const h = harness({ uncaptured: method === 'cancel', ...options })
    const run = label === 'mismatched id' ? () => h.run(() => h.service[method + 'Payment'](method === 'refund' ? { payment_id: 'pay_fixture', amount: 1 } : 'pay_fixture', {})) : h[method]
    await assert.rejects(run)
    assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
  })
  for (const boundary of ['payment-retrieve', 'payment-link']) test(method + ': loss after ' + boundary + ' fences effects', async () => {
    const h = harness({ uncaptured: true, loseAt: boundary })
    await assert.rejects(h[method](), lockError)
    assert.equal(h.lostAt, boundary); assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
  })
}
function nativeWorkflowPayment(h) {
  const { LocalWorkflow } = require('@medusajs/orchestration')
  const { createMedusaContainer, MedusaModuleType } = require('@medusajs/framework/utils')
  // Native module bootstrap brands the service class before workflow resolution.
  // The isolated native-service fixture skips bootstrap, so brand only its subclass.
  Object.defineProperty(h.service.constructor, '__type', { value: MedusaModuleType, configurable: true })
  // Actual Medusa 2.11.3 module contextualizer, not a lookalike JS Proxy.
  const container = createMedusaContainer()
  container.register({ payment: require('@medusajs/framework/awilix').asValue(h.service) })
  const wrapped = LocalWorkflow.prototype.contextualizedMedusaModules.call({}, container).resolve('payment')
  assert.notEqual(wrapped, h.service, 'must exercise actual workflow module proxy')
  return wrapped
}
for (const name of ['refundPayment', 'cancelPayment', 'deletePaymentSession', 'refundPaymentFromProvider_', 'capturePayment']) {
  test('native workflow proxy resolves guarded entry without bypassing immutable protection: ' + name, async () => {
    const h = harness()
    const wrapped = nativeWorkflowPayment(h)
    assert.equal(typeof wrapped[name], 'function', 'real workflow proxy must resolve the guarded entry')
    const original = h.service[name]
    assert.throws(() => { h.service[name] = () => {} }, TypeError)
    assert.throws(() => { delete h.service[name] }, TypeError)
    assert.throws(() => Object.defineProperty(h.service, name, { value: () => {} }), TypeError)
    assert.equal(h.service[name], original)
    await assert.rejects(wrapped[name](), lockError)
    assert.deepEqual(h.events, []); assert.deepEqual(h.providers, []); assert.deepEqual(h.writes, [])
  })
}
test('native workflow refund step reaches reservation, dispatch receipt and accounting through actual contextualizer', async () => {
  const h = harness()
  const { createWorkflow, WorkflowResponse } = require('@medusajs/framework/workflows-sdk')
  const { refundPaymentsStep } = require('@medusajs/core-flows')
  const { createMedusaContainer } = require('@medusajs/framework/utils')
  const errors = []
  nativeWorkflowPayment(h) // apply the native bootstrap module brand before real flow
  const container = createMedusaContainer()
  const { asValue } = require('@medusajs/framework/awilix')
  container.register({ payment: asValue(h.service), logger: asValue({ error: error => errors.push(error) }) })
  const flow = createWorkflow('refund-proxy-native-positive-regression', input => new WorkflowResponse(refundPaymentsStep(input)))
  const response = await h.run(() => flow(container).run({ input: [{ payment_id: h.payment.id, amount: new BigNumber('3.21') }], throwOnError: true }))
  assert.deepEqual(errors, []); assert.deepEqual(response.errors, [])
  assert.equal(response.result.length, 1, 'swallowed native failure is not successful refund')
  assert.equal(h.providers.length, 1); assert.equal(h.rows.length, 1)
  assert.equal(h.providers[0].input.context.idempotency_key, h.rows[0].id)
  assert.equal(h.dispatchRows[0].state, 'completed')
  assert.ok(MathBN.eq(h.writes.find(w => w.name === 'collection').data.refunded_amount, '3.21'))
})
for (const [entry, id] of [['cancelPayment', 'pay_fixture'], ['deletePaymentSession', 'payses_fixture']]) {
  test('native workflow contextualizer preserves locked positive path: ' + entry, async () => {
    const h = harness({ uncaptured: true })
    await h.run(() => nativeWorkflowPayment(h)[entry](id))
    assert.equal(h.providers.length, 1); assert.equal(h.writes.length, 1)
  })
}
test('locked refund preserves real native numeric reservation, metadata, provider key, update and collection accounting', async () => {
  const h = harness()
  const result = await h.refund()
  assert.equal(h.transactions.length, 1)
  assert.equal(h.counts['payment-retrieve'], 5, 'public preflight, native read, fresh reservation, fresh dispatch, native result')
  assert.equal(h.counts['refund-retrieve'], 1, 'dispatch reads persisted refund')
  assert.equal(h.providers.length, 1)
  assert.equal(h.providers[0].name, 'refundPayment')
  assert.equal(h.providers[0].input.context.idempotency_key, h.rows[0].id)
  assert.ok(MathBN.eq(h.providers[0].input.amount, '3.21'))
  assert.equal(h.writes[0].data.refund_reason_id, 'reason_fixture')
  assert.equal(h.writes[0].data.created_by, 'actor_fixture')
  assert.equal(h.writes[0].data.note, 'synthetic note')
  assert.ok(MathBN.eq(h.writes.find(w => w.name === 'collection').data.refunded_amount, '3.21'))
  assert.equal(result.refunds[0].id, h.rows[0].id)
  assert.ok(h.events.indexOf('transaction-commit') < h.events.indexOf('provider:refundPayment'))
  assert.ok(h.reads[0].config.select.includes('currency_code'))
  assert.equal(h.dispatchRows.length, 1)
  assert.equal(h.dispatchRows[0].refund_id, h.rows[0].id)
  assert.equal(h.dispatchRows[0].state, 'completed')
  assert.equal(h.quarantineQueries.filter(q => q === 'native-refund').length, 2)
  assert.ok(h.quarantineQueries.includes('dispatch-receipt'))
})
test('native refund limit and existing-refund numeric totals stay enforced', async () => {
  const h = harness()
  await h.refund(); await h.refund(); await h.refund()
  await assert.rejects(h.refund(), /more than what is captured/)
  assert.equal(h.providers.length, 3)
})
for (const boundary of ['transaction', 'refund-create', 'transaction-commit']) test('refund loss before dispatch: ' + boundary, async () => {
  const h = harness({ loseAt: boundary })
  await assert.rejects(h.refund(), lockError)
  assert.equal(h.lostAt, boundary); assert.equal(h.providers.length, 0)
  if (boundary === 'transaction') assert.equal(h.writes.length, 0)
})
for (const method of ['refund', 'cancel', 'session']) test(method + ': provider-return loss prevents local finalization', async () => {
  const name = { refund: 'refundPayment', cancel: 'cancelPayment', session: 'deletePayment' }[method]
  const h = harness({ uncaptured: method !== 'refund', loseAt: 'provider:' + name })
  await assert.rejects(h[method](), lockError)
  assert.equal(h.providers.length, 1); assert.equal(h.lostAt, 'provider:' + name)
  assert.equal(h.writes.filter(w => w.name !== 'refund-create').length, 0)
})
for (const boundary of ['session-link', 'session-bound', 'session-retrieve']) test('session deletion loss fences provider: ' + boundary, async () => {
  const h = harness({ loseAt: boundary })
  await assert.rejects(h.session(), lockError)
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.lostAt, boundary)
})
for (const sessions of [[], null, [{ id: 'other', cart_id: 'cart_fixture', payment_collection_id: 'paycol_fixture' }]]) test('session authoritative missing/malformed identity ' + JSON.stringify(sessions), async () => {
  const h = harness({ sessions })
  await assert.rejects(h.session())
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
test('native session identity mismatch after authoritative helper fails before provider deletion', async () => {
  const h = harness({ session: { id: 'payses_other' } })
  await assert.rejects(h.session(), /session identity mismatch/)
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
test('locked session deletion retains native retrieve/provider/delete protocol', async () => {
  const h = harness(); await h.session()
  assert.equal(h.providers[0].name, 'deletePayment'); assert.equal(h.writes[0].name, 'session-delete')
  assert.equal(h.counts['session-retrieve'], 2, 'authoritative preflight plus unchanged native session retrieve')
})
test('uncaptured cancel retains native provider idempotency and canceled timestamp; repeated cancel has no provider', async () => {
  const h = harness({ uncaptured: true })
  await h.cancel(); await h.cancel()
  assert.equal(h.providers.length, 1); assert.equal(h.providers[0].input.context.idempotency_key, h.payment.id)
  assert.ok(h.payment.canceled_at instanceof Date); assert.equal(h.writes.length, 1)
  assert.equal(h.counts['payment-retrieve'], 4, 'each cancel performs authoritative preflight and native fresh result')
})
for (const payment of [{ captured_at: new Date() }, {}]) test('captured cancel requires refund settlement (' + !!payment.captured_at + ')', async () => {
  const h = harness({ payment })
  await assert.rejects(h.cancel(), /use refund settlement/)
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
test('constructor wraps actual private JS entry immutably and direct unheld call has no native work', async () => {
  const h = harness()
  const descriptor = Object.getOwnPropertyDescriptor(h.service, 'refundPayment_')
  assert.ok(descriptor); assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, false)
  await assert.rejects(h.service.refundPayment_(h.payment, { payment_id: h.payment.id, amount: 1 }, {}), lockError)
  assert.deepEqual(h.events, [])
})
test('direct private reservation rejects payment/data identity mismatch then permits locked native transaction', async () => {
  const h = harness()
  await assert.rejects(h.run(() => h.service.refundPayment_(h.payment, { payment_id: 'pay_other', amount: 1 }, {})), /identity mismatch/)
  assert.equal(h.transactions.length, 0)
  const row = await h.run(() => h.service.refundPayment_(h.payment, { payment_id: h.payment.id, amount: new BigNumber('1.11') }, {}))
  assert.ok(MathBN.eq(row.amount, '1.11')); assert.equal(h.providers.length, 0)
})
test('protected provider refund direct entry requires lock, identity, and disallows outer transaction', async () => {
  const h = harness(); const row = { id: 'ref_fixture', raw_amount: { value: '1', precision: 20 } }
  await assert.rejects(h.service.refundPaymentFromProvider_(h.payment, row, {}), lockError)
  await assert.rejects(h.run(() => h.service.refundPaymentFromProvider_({ ...h.payment, payment_collection_id: undefined }, row, {})))
  await assert.rejects(h.run(() => h.service.refundPaymentFromProvider_(h.payment, row, { transactionManager: {} })), /outer transaction/)
  assert.equal(h.providers.length, 0)
})
for (const name of ['deleteSession', 'cancelPayment', 'refundPayment']) {
  test('dispatcher ' + name + ': direct forged context without ALS fails closed', async () => {
    const h = harness()
    await assert.rejects(h.dispatcher[name]('pp_fixture', { data: h.payment.data, amount: 1, context: { financialLock: true, cart_id: 'cart_fixture' } }), lockError)
    assert.equal(h.providers.length, 0)
  })
  test('dispatcher ' + name + ': arbitrary held cart never grants provider authority', async () => {
    const h = harness()
    for (const data of [h.payment.data, { id: 'pi_other_cart' }]) {
      await assert.rejects(h.run(() => h.dispatcher[name]('pp_fixture', { data, amount: 1 })), /operation.*binding/i)
    }
    assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
  })
}
test('protected refund rejects injected cross-cart provider data before dispatch', async () => {
  const h = harness()
  const row = { id: 'ref_persisted', payment_id: h.payment.id, amount: new BigNumber(1), raw_amount: { value: '1', precision: 20 } }
  h.rows.push(row)
  await assert.rejects(h.run(() => h.service.refundPaymentFromProvider_({ ...h.payment, data: { id: 'pi_other_cart' } }, row, {})), /identity|binding/i)
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
test('protected refund rejects a persisted refund from another payment', async () => {
  const h = harness()
  const row = { id: 'ref_other', payment_id: 'pay_other', amount: new BigNumber(1), raw_amount: { value: '1', precision: 20 } }
  h.rows.push(row)
  await assert.rejects(h.run(() => h.service.refundPaymentFromProvider_(h.payment, row, {})), /relationship|identity|binding/i)
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
test('direct reservation uses fresh captured totals, never caller-injected captures', async () => {
  const h = harness({ uncaptured: true })
  const injected = { ...h.payment, captures: [{ raw_amount: { value: '999', precision: 20 } }] }
  await assert.rejects(h.run(() => h.service.refundPayment_(injected, { payment_id: h.payment.id, amount: 1 }, {})), /more than what is captured/)
  assert.equal(h.transactions.length, 1); assert.equal(h.writes.length, 0); assert.equal(h.providers.length, 0)
})
test('direct reservation rejects swapped provider data before reserving', async () => {
  const h = harness()
  await assert.rejects(h.run(() => h.service.refundPayment_({ ...h.payment, data: { id: 'pi_other_cart' } }, { payment_id: h.payment.id, amount: 1 }, {})), /identity|binding/i)
  assert.equal(h.transactions.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.providers.length, 0)
})
for (const [label, tamper] of [
  ['provider', args => { args[0] = 'pp_other' }],
  ['provider data identity', args => { args[1].data = { id: 'pi_other_cart' } }],
  ['provider data extra fields', args => { args[1].data = { ...args[1].data, injected: true } }],
  ['idempotency', args => { args[1].context.idempotency_key = 'ref_other' }],
  ['amount', args => { args[1].amount = { value: '2', precision: 20 } }],
  ['kind', () => {}]
]) test('authoritative refund binding rejects changed ' + label + ' before provider contact', async () => {
  const h = harness()
  const original = h.dispatcher.refundPayment.bind(h.dispatcher)
  h.dispatcher.refundPayment = async (...args) => {
    tamper(args)
    return label === 'kind' ? h.dispatcher.cancelPayment(...args) : original(...args)
  }
  await assert.rejects(h.refund(), lockError)
  assert.equal(h.providers.length, 0)
  assert.deepEqual(h.writes.map(w => w.name), ['refund-create'], 'failed binding revokes native cleanup writes; reservation remains for reconciliation')
})
test('bound refund dispatches once and cannot leak authority to a later held invocation', async () => {
  const h = harness()
  const original = h.dispatcher.refundPayment.bind(h.dispatcher)
  let recorded
  h.dispatcher.refundPayment = async (...args) => {
    recorded = args
    const result = await original(...args)
    await assert.rejects(original(...args), /operation.*binding/i)
    return result
  }
  await assert.rejects(h.refund(), lockError, 'swallowed second dispatch rejection now revokes the whole invocation')
  await assert.rejects(h.run(() => original(...recorded)), /operation.*binding/i)
  assert.equal(h.providers.length, 1)
})
for (const raw_amount of [{ value: '2', precision: 20 }, undefined]) test('protected refund refuses caller-injected amount ' + JSON.stringify(raw_amount), async () => {
  const h = harness()
  const row = { id: 'ref_persisted', payment_id: h.payment.id, amount: new BigNumber(1), raw_amount: { value: '1', precision: 20 } }
  h.rows.push(row)
  await assert.rejects(h.run(() => h.service.refundPaymentFromProvider_(h.payment, { ...row, raw_amount }, {})), /identity|binding/i)
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
for (const boundary of ['payment-retrieve', 'refund-retrieve']) test('protected refund fresh read loss fences dispatch: ' + boundary, async () => {
  const h = harness({ loseAt: boundary })
  const row = { id: 'ref_persisted', payment_id: h.payment.id, amount: new BigNumber(1), raw_amount: { value: '1', precision: 20 } }
  h.rows.push(row)
  await assert.rejects(h.run(() => h.service.refundPaymentFromProvider_(h.payment, row, {})), lockError)
  assert.equal(h.lostAt, boundary); assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
test('protected refund supports native persisted payment relation rather than caller payment_id', async () => {
  const h = harness()
  const row = { id: 'ref_persisted', payment: { id: h.payment.id }, amount: new BigNumber('1.11'), raw_amount: { value: '1.11', precision: 20 } }
  h.rows.push(row)
  const { withCommerceRefundDispatchContext } = require(path.join(utils, 'commerce-refund-quarantine.ts'))
  await h.run(() => withCommerceRefundDispatchContext(() => h.service.refundPaymentFromProvider_(h.payment, row, {})))
  assert.equal(h.providers.length, 1); assert.equal(h.providers[0].input.context.idempotency_key, row.id)
  assert.ok(MathBN.eq(h.providers[0].input.amount, '1.11'))
  assert.equal(h.counts['payment-retrieve'], 1); assert.equal(h.counts['refund-retrieve'], 1)
  assert.equal(h.dispatchRows[0].state, 'started', 'protected provider-only work has no full native accounting receipt')
})
test('native compensation under an arbitrary cart lock cannot cancel an unbound provider payment', async () => {
  const h = harness()
  h.service.authorizePaymentSession_ = async () => { throw new Error('synthetic authorization persistence failure') }
  await assert.rejects(h.run(() => h.service.authorizePaymentSession('payses_fixture', {}, {})), /operation.*binding/i)
  assert.deepEqual(h.providers.map(p => p.name), ['authorizePayment'])
})
test('direct reservation snapshots primitive identity before authoritative await', async () => {
  const h = harness()
  const supplied = { ...h.payment, data: { ...h.payment.data } }
  const retrieve = h.dependencies.paymentService.retrieve
  h.dependencies.paymentService.retrieve = async (...args) => {
    supplied.id = 'pay_other'; supplied.provider_id = 'pp_other'; supplied.data.id = 'pi_other_cart'
    return retrieve(...args)
  }
  const row = await h.run(() => h.service.refundPayment_(supplied, { payment_id: h.payment.id, amount: 1 }, {}))
  assert.equal(row.payment_id, h.payment.id); assert.equal(h.providers.length, 0)
})
test('native authorize compensation cannot bypass guarded dispatcher without ALS', async () => {
  const h = harness()
  h.service.authorizePaymentSession_ = async () => { throw new Error('synthetic authorization persistence failure') }
  await assert.rejects(h.service.authorizePaymentSession('payses_fixture', {}, {}), lockError)
  assert.deepEqual(h.providers.map(p => p.name), ['authorizePayment'])
})
test('native create-session compensation cannot delete provider without ALS', async () => {
  const h = harness({ failAt: 'session-update' })
  h.service.createPaymentSession_ = async () => ({ id: 'payses_fixture' })
  await assert.rejects(h.service.createPaymentSession('paycol_fixture', { provider_id: 'pp_fixture', amount: 1, currency_code: 'eur', data: {} }, {}), lockError)
  assert.deepEqual(h.providers.map(p => p.name), ['initiatePayment'])
})
for (const method of ['refund', 'cancel', 'session']) test(method + ': reached loss immediately before dispatcher is refused by custom native dispatcher', async () => {
  const h = harness({ uncaptured: method !== 'refund' })
  const name = { refund: 'refundPayment', cancel: 'cancelPayment', session: 'deleteSession' }[method]
  const original = h.dispatcher[name].bind(h.dispatcher)
  h.dispatcher[name] = async (...args) => { h.lostAt = 'before-dispatch'; h.connection.emit('end'); return original(...args) }
  await assert.rejects(h[method](), lockError)
  assert.equal(h.lostAt, 'before-dispatch'); assert.equal(h.providers.length, 0)
})
for (const payment of [{ id: undefined }, { id: ' malformed' }, { payment_collection_id: undefined }, { payment_collection_id: '' }]) test('direct private entry refuses malformed identity ' + JSON.stringify(payment), async () => {
  const h = harness({ payment })
  await assert.rejects(h.run(() => h.service.refundPayment_(h.payment, { payment_id: h.payment.id, amount: 1 }, {})))
  assert.equal(h.transactions.length, 0); assert.equal(h.writes.length, 0)
})
test('real native batch workflow catches unheld refund/cancel rejections but never reaches provider or persistence', async () => {
  const { createWorkflow, WorkflowResponse } = require('@medusajs/framework/workflows-sdk')
  const { cancelPaymentStep, refundPaymentsStep } = require('@medusajs/core-flows')
  const { createMedusaContainer } = require('@medusajs/framework/utils')
  const { asValue } = require('@medusajs/framework/awilix')
  const h = harness({ uncaptured: true }), errors = []
  const container = createMedusaContainer()
  container.register({ payment: asValue(h.service), logger: asValue({ error: message => errors.push(message) }) })
  const cancelBatch = createWorkflow('offline-financial-cancel-batch', function (input) {
    cancelPaymentStep(input)
    return new WorkflowResponse('finished')
  })
  const refundBatch = createWorkflow('offline-financial-refund-batch', function (input) {
    return new WorkflowResponse(refundPaymentsStep(input))
  })
  const canceled = await cancelBatch(container).run({ input: { paymentIds: ['pay_fixture', 'pay_second'] } })
  const refunded = await refundBatch(container).run({ input: [{ payment_id: 'pay_fixture', amount: 1 }, { payment_id: 'pay_second', amount: 1 }] })
  assert.equal(canceled.result, 'finished'); assert.deepEqual(refunded.result, [])
  assert.equal(errors.length, 4)
  assert.deepEqual(h.providers, []); assert.deepEqual(h.writes, []); assert.deepEqual(h.reads, [])
})
test('real native payment container loader resolves guarded dispatcher under native DI name, offline metadata only', async () => {
  const { MikroORM } = require('@medusajs/framework/mikro-orm/postgresql')
  const { createMedusaContainer } = require('@medusajs/framework/utils')
  const { asValue } = require('@medusajs/framework/awilix')
  const orm = await MikroORM.init({ entities: factoryCalls.mikroOrmConnectionLoaderFactory.moduleModels, dbName: 'synthetic_payment_metadata', connect: false, metadataCache: { enabled: false } })
  const container = createMedusaContainer()
  container.register({ manager: asValue(orm.em), config: asValue({}), logger: asValue(console) })
  try {
    await Wrapped.loaders[1]({ container, options: {} })
    const dispatcher = container.resolve('paymentProviderService')
    assert.equal(dispatcher.constructor.name, 'PaymentProviderService')
    assert.ok(dispatcher instanceof NativeDispatcher)
    await assert.rejects(dispatcher.cancelPayment('pp_not_connected', { data: {} }), lockError)
    for (const name of ['paymentService', 'refundService', 'paymentSessionService', 'captureService', 'baseRepository']) assert.ok(container.hasRegistration(name))
  } finally { await orm.close(true) }
})
test('locked provider failure revokes native cleanup and retains reservation for reconciliation', async () => {
  const h = harness({ failAt: 'provider:refundPayment' })
  await assert.rejects(h.refund(), lockError, 'native cleanup cannot write after provider failure; its guard supersedes the native provider error')
  assert.equal(h.providers.length, 1)
  assert.deepEqual(h.writes.map(w => w.name), ['refund-create'])
  assert.equal(h.rows.length, 1)
})
test('module preserves native loaders/models and registers custom dispatcher with expected DI class name', () => {
  assert.equal(Wrapped.service.name, 'PaymentCaptureRecoveryService')
  const registered = factoryCalls.moduleContainerLoaderFactory.moduleServices.PaymentProviderService
  assert.equal(registered.name, 'PaymentProviderService')
  assert.notEqual(registered, NativeDispatcher)
  assert.equal(registered.prototype instanceof NativeDispatcher, true)
  assert.deepEqual(Wrapped.loaders.slice(2), Native.loaders || [])
  assert.ok(factoryCalls.moduleContainerLoaderFactory.moduleModels.Refund)
})

// Native reservation, provider dispatcher, numerics and source ALS are real;
// only synthetic collaborators inject a scope-only revocation at awaits.
const scopeError = /refund scope lost|refund effect authority unavailable|lock.*lost after payment failure/i
function assertNoEffectsAfterScopeLoss(h) {
  assert.ok(h.atScopeLoss, 'scope-only boundary was actually reached')
  assert.equal(h.writes.length, h.atScopeLoss.writes, 'zero writes after observed scope revocation')
  assert.equal(h.providers.length, h.atScopeLoss.providers, 'zero provider invocations after observed scope revocation')
  assert.equal(h.transactions.length, h.atScopeLoss.transactions, 'zero new reservations after observed scope revocation')
}
test('scope-only: real effect-fenced customer refund preserves native numeric accounting', async () => {
  const h = harness({ effectFence: true })
  const result = await h.refund()
  assert.equal(h.providers.length, 1); assert.equal(h.rows.length, 1)
  assert.ok(MathBN.eq(result.refunds[0].amount, '3.21'))
  assert.ok(MathBN.eq(h.writes.find(w => w.name === 'collection').data.refunded_amount, '3.21'))
})
for (const [boundary, nth, priorWrites, priorProviders] of [
  ['payment-retrieve', 1, 0, 0], ['payment-retrieve', 2, 0, 0],
  ['payment-retrieve', 3, 0, 0], ['payment-retrieve', 4, 1, 0],
  ['payment-link', 1, 0, 0], ['payment-link', 2, 0, 0],
  ['payment-link', 3, 0, 0], ['payment-link', 4, 0, 0],
  ['transaction', 1, 0, 0], ['refund-create', 1, 1, 0],
  ['transaction-commit', 1, 1, 0], ['refund-retrieve', 1, 1, 0],
  ['provider:refundPayment', 1, 1, 1], ['collection-retrieve', 1, 2, 1]
]) test('scope-only: native customer refund loss at ' + boundary + '#' + nth, async () => {
  const h = harness({ effectFence: true, loseScopeAt: boundary, loseNth: nth })
  await assert.rejects(h.refund(), scopeError)
  assert.equal(h.scopeLostAt, boundary)
  assert.equal(h.atScopeLoss.writes, priorWrites, 'only writes already entered before revocation')
  assert.equal(h.atScopeLoss.providers, priorProviders, 'only dispatch already entered before revocation')
  assertNoEffectsAfterScopeLoss(h)
})
test('scope-only: dispatcher checks live effect authority immediately before native provider dispatch', async () => {
  const h = harness({ effectFence: true, loseScopeAt: 'before-dispatch' })
  const dispatch = h.dispatcher.refundPayment.bind(h.dispatcher)
  h.dispatcher.refundPayment = async (...args) => { await h.boundary('before-dispatch'); return dispatch(...args) }
  await assert.rejects(h.refund(), scopeError)
  assert.equal(h.providers.length, 0); assertNoEffectsAfterScopeLoss(h)
})
for (const boundary of ['payment-retrieve', 'refund-retrieve']) test('scope-only: direct protected native refund read at ' + boundary, async () => {
  const h = harness({ effectFence: true, loseScopeAt: boundary })
  const row = { id: 'ref_persisted', payment: { id: h.payment.id }, amount: new BigNumber('1.11'), raw_amount: { value: '1.11', precision: 20 } }
  h.rows.push(row)
  await assert.rejects(h.run(() => h.service.refundPaymentFromProvider_(h.payment, row, {})), scopeError)
  assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0); assertNoEffectsAfterScopeLoss(h)
})
test('scope-only: revoked invocation never degrades to absent authority or retries after provider return', async () => {
  const h = harness({ effectFence: true, loseScopeAt: 'provider:refundPayment' })
  await assert.rejects(h.run(async () => {
    await assert.rejects(h.service.refundPayment({ payment_id: h.payment.id, amount: 1 }), scopeError)
    assertNoEffectsAfterScopeLoss(h)
    const events = h.events.length
    h.scopeActive = true // A later successful check cannot revive this invocation.
    await assert.rejects(h.service.refundPayment({ payment_id: h.payment.id, amount: 1 }), scopeError)
    assert.equal(h.events.length, events, 'revoked entry rejects before native manager/read')
    assertNoEffectsAfterScopeLoss(h)
  }), scopeError)
  assert.equal(h.providers.length, 1)
})
test('scope-only: financial operation cannot grant binding after effect authority loss', async () => {
  const { withFinancialOperation } = require(path.join(base, 'financial-operation.ts'))
  const h = harness({ effectFence: true })
  await assert.rejects(h.run(async () => {
    h.invalidateScope('before-binding')
    await withFinancialOperation({ kind: 'refundPayment', nativeId: 'ref_fixture', providerId: h.payment.provider_id,
      data: h.payment.data, idempotencyKey: 'ref_fixture', amount: 1 }, async () => { h.events.push('bound-work') })
  }), scopeError)
  assert.ok(!h.events.includes('bound-work')); assertNoEffectsAfterScopeLoss(h)
})
test('scope-only: optional assertion returns no authority and refuses inactive inherited ALS', async () => {
  assert.equal(effectFence.assertRefundEffectFenceIfPresent(), undefined, 'no scope retains cart-only admin contract')
  let proceed, escaped
  const gate = new Promise(resolve => { proceed = resolve })
  await withRefundEffectFence(() => {}, async () => {
    assert.equal(effectFence.assertRefundEffectFenceIfPresent(), undefined)
    escaped = gate.then(() => effectFence.assertRefundEffectFenceIfPresent())
  })
  const rejected = assert.rejects(escaped, scopeError)
  proceed(); await rejected
})

for (const [method, failAt] of [
  ['refund', 'payment-retrieve'], ['refund', 'refund-create'],
  ['refund', 'provider:refundPayment'], ['refund', 'payment-update'],
  ['cancel', 'provider:cancelPayment'], ['cancel', 'payment-update']
]) test('financial-failure: real native ' + method + ' batch swallows ' + failAt + ' but OLD COMPLETED receipt cannot cancel', async () => {
  const { createWorkflow, WorkflowResponse } = require('@medusajs/framework/workflows-sdk')
  const { cancelPaymentStep, refundPaymentsStep } = require('@medusajs/core-flows')
  const { createMedusaContainer } = require('@medusajs/framework/utils')
  const { asValue } = require('@medusajs/framework/awilix')
  const h = harness({ uncaptured: method === 'cancel', failAt }), errors = []
  const batchSize = 2
  const container = createMedusaContainer()
  container.register({ payment: asValue(h.service), logger: asValue({ error: error => errors.push(error) }) })
  const batch = createWorkflow('offline-failure-' + method + '-' + failAt.replace(/:/g, '-'), function (input) {
    return new WorkflowResponse(method === 'refund' ? refundPaymentsStep(input) : cancelPaymentStep(input))
  })
  await assert.rejects(h.run(async () => {
    await assertCommerceOrderCancellation('order_fixture')
    assert.equal(h.receiptReads, 1, 'genuine cancellation helper accepts the pre-existing completed receipt before failure')
    const result = await batch(container).run({ input: method === 'refund'
      ? Array.from({ length: batchSize }, () => ({ payment_id: h.payment.id, amount: 1 }))
      : { paymentIds: [h.payment.id, h.payment.id] } })
    assert.equal(result.errors.length, 0, 'native batch really swallowed payment errors')
    assert.equal(errors.length, batchSize, 'native logger swallowed every requested rejection')
    assert.ok(h.events.includes(failAt), 'requested payment failure was reached')
    assert.deepEqual({ writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length }, h.atFailure, 'parallel native batch work already entered before failure only; no effects after rejection')
    const effects = { writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length, events: h.events.length }
    assert.equal(h.physicalHeld, true, 'failure revokes authority, not the physical lock')
    assert.equal(h.unlocks, 0)
    await assert.rejects(assertCommerceOrderCancellation('order_fixture'), lockError)
    await assert.rejects(h.orderService.cancel('order_fixture'), lockError)
    await assert.rejects(h.orderService.cancel_('order_fixture'), lockError)
    assert.throws(() => assertCommerceFinancialLock(), lockError)
    assert.throws(() => assertCommerceCartLock(h.lockContainer, h.cart), lockError)
    await assert.rejects(commerceCartLockQuery(h.lockContainer, h.cart, 'UPDATE order SET status=?', ['canceled']), lockError)
    for (const invoke of [
      () => h.service.refundPayment({ payment_id: h.payment.id, amount: 1 }),
      () => h.service.cancelPayment(h.payment.id),
      () => h.service.deletePaymentSession('payses_fixture'),
      () => h.service.refundPayment_(h.payment, { payment_id: h.payment.id, amount: 1 }, {}),
      () => h.service.capturePayment({ payment_id: h.payment.id }),
      () => h.dispatcher.cancelPayment('pp_fixture', { data: h.payment.data })
    ]) await assert.rejects(invoke(), lockError)
    assert.deepEqual({ writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length, events: h.events.length }, effects, 'no native work resumes after caught payment failure')
    assert.equal(h.cancellationWrites.length, 0)
    assert.equal(h.receiptReads, 1, 'failed owner cannot reread an old receipt as fresh authority')
    console.log(JSON.stringify({ evidence: 'financial-failure', method, failAt, swallowed: errors.length, oldReceipt: h.oldReceipt.phase, cancellationWrites: h.cancellationWrites.length, physicalHeld: h.physicalHeld, effects }))
  }), lockError)
  assert.equal(h.physicalHeld, false); assert.equal(h.unlocks, 1); assert.equal(h.releases, 1)
})

for (const [label, options, invoke] of [
  ['direct reservation', { failAt: 'refund-create' }, h => h.service.refundPayment_(h.payment, { payment_id: h.payment.id, amount: 1 }, {})],
  ['direct protected dispatch', { failAt: 'provider:refundPayment' }, h => require(path.join(utils, 'commerce-refund-quarantine.ts')).withCommerceRefundDispatchContext(() => h.service.refundPaymentFromProvider_(h.payment, h.rows[0], {}))],
  ['direct protected read', { failAt: 'refund-retrieve' }, h => h.service.refundPaymentFromProvider_(h.payment, h.rows[0], {})],
  ['public session deletion', { failAt: 'provider:deletePayment' }, h => h.service.deletePaymentSession('payses_fixture')]
]) test('financial-failure: caught ' + label + ' cannot restore owner or cancel using OLD COMPLETED receipt', async () => {
  const h = harness(options)
  h.rows.push({ id: 'ref_persisted', payment_id: h.payment.id, amount: new BigNumber(1), raw_amount: { value: '1', precision: 20 } })
  await assert.rejects(h.run(async () => {
    await assertCommerceOrderCancellation('order_fixture')
    await assert.rejects(invoke(h), /synthetic failure:/)
    await assert.rejects(assertCommerceOrderCancellation('order_fixture'), lockError)
    await assert.rejects(h.orderService.cancel('order_fixture'), lockError)
    assert.equal(cartLock.revokeCommerceFinancialWork(), undefined)
    assert.throws(assertCommerceFinancialLock, lockError)
    assert.equal(h.physicalHeld, true); assert.equal(h.unlocks, 0)
    assert.deepEqual({ writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length }, h.atFailure)
    assert.equal(h.cancellationWrites.length, 0)
  }), lockError)
  assert.equal(h.unlocks, 1); assert.equal(h.releases, 1)
})

test('financial-failure: void revoke is no-op outside genuine owner and failure is invocation-local', async () => {
  assert.equal(cartLock.revokeCommerceFinancialWork(), undefined)
  const h = harness({ uncaptured: true })
  await assert.rejects(h.run(async () => {
    assert.equal(cartLock.revokeCommerceFinancialWork(), undefined)
    assert.equal(cartLock.revokeCommerceFinancialWork(), undefined)
    await assert.rejects(h.run(async () => {}), lockError, 'nested same-cart work cannot revive authority')
    assert.throws(assertCommerceFinancialLock, lockError)
  }), lockError)
  assert.equal(h.unlocks, 1)
  await h.cancel() // New independently acquired owner remains usable.
  assert.equal(h.providers.length, 1); assert.equal(h.unlocks, 2)
})

test('refund sequence: unrelated physical-session owners do not share a queue', { timeout: 5000 }, async () => {
  const first = harness(), other = harness({ cart: 'cart_other' }), order = []
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const entered = new Promise(resolve => { started = resolve })
  const pending = first.run(() => Promise.all([
    withCommerceRefundSequence(async () => { order.push('first'); started(); await gate; order.push('first-finished'); return 1 }),
    withCommerceRefundSequence(async () => { order.push('queued'); return 2 })
  ]))
  await entered
  try {
    await other.run(() => withCommerceRefundSequence(async () => { order.push('unrelated') }))
    assert.deepEqual(order, ['first', 'unrelated'])
    assert.equal(first.physicalHeld, true); assert.equal(first.unlocks, 0)
  } finally { release() }
  assert.deepEqual(await pending, [1, 2])
  assert.deepEqual(order, ['first', 'unrelated', 'first-finished', 'queued'])
  assert.equal(first.unlocks, 1); assert.equal(other.unlocks, 1)
})
test('refund sequence: predecessor rejection latches failure without starting queued work or unlocking early', async () => {
  const h = harness(), entered = []
  await assert.rejects(h.run(async () => {
    const outcomes = await Promise.allSettled([
      withCommerceRefundSequence(async () => { entered.push('first'); throw new Error('synthetic predecessor failure') }),
      withCommerceRefundSequence(async () => { entered.push('queued') })
    ])
    assert.deepEqual(outcomes.map(r => r.status), ['rejected', 'rejected'])
    assert.deepEqual(entered, ['first'])
    assert.equal(h.physicalHeld, true); assert.equal(h.unlocks, 0)
    assert.throws(assertCommerceFinancialLock, lockError)
    await assert.rejects(h.service.refundPayment({ payment_id: h.payment.id, amount: 1 }), lockError)
    assert.deepEqual(h.writes, []); assert.deepEqual(h.providers, [])
  }), lockError)
  assert.equal(h.unlocks, 1); assert.equal(h.releases, 1)
})
test('refund sequence: a successful predecessor cannot revive revoked invocation authority', async () => {
  const h = harness(), entered = []
  await assert.rejects(h.run(async () => {
    const outcomes = await Promise.allSettled([
      withCommerceRefundSequence(async () => { entered.push('first'); cartLock.revokeCommerceFinancialWork(); return 'finished' }),
      withCommerceRefundSequence(async () => { entered.push('queued') })
    ])
    assert.equal(outcomes[0].status, 'fulfilled'); assert.equal(outcomes[1].status, 'rejected')
    assert.match(outcomes[1].reason.message, lockError)
    assert.deepEqual(entered, ['first'])
    assert.equal(h.physicalHeld, true); assert.equal(h.unlocks, 0)
  }), lockError)
  assert.equal(h.unlocks, 1)
})
