// OFFLINE: real Medusa 2.11.3 subclass/decorators/numerics, synthetic persistence and provider adapters.
// Run in pinned disposable image, read-only source mount; never contacts Stripe or production.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const swc = require('@swc/core')
const Native = require('@medusajs/payment').default
const { MathBN, BigNumber, PaymentSessionStatus } = require('@medusajs/framework/utils')
assert.equal(require('@medusajs/payment/package.json').version, '2.11.3')
const root = path.resolve(__dirname, '../..')
const base = path.join(root, 'apps/backend/src/modules/payment-capture-recovery')
const stripeFile = path.join(root, 'packages/modules/payment-stripe-connect/src/providers/stripe-connect/core/stripe-connect-provider.ts')
const nativeBaseline = process.env.CAPTURE_BASELINE === 'native'
function compile(mod, filename) {
  mod.paths = [...module.paths, ...mod.paths]
  mod._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'typescript', decorators: true }, target: 'es2021', transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' }
  }).code, filename)
}
Module._extensions['.ts'] = compile
// The subclass and fixture must share the source module's actual ALS capability.
const lockFile = path.join(root, 'packages/modules/b2c-core/src/utils/commerce-cart-lock.ts')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if(request === '@mercurjs/b2c-core/utils/commerce-financial-lock') request = path.join(root,'packages/modules/b2c-core/src/utils/commerce-financial-lock.ts')
  return originalResolve.call(this, request === '@mercurjs/b2c-core/utils/commerce-cart-lock' ? lockFile : request, ...args)
}
const { withCommerceCartLock, commerceCartLockKey, assertCommercePaymentLock } = require(lockFile)
const Service = nativeBaseline ? Native.service : require(path.join(base, 'service.ts')).default
const StripeProvider = require(stripeFile).default
const intent = (status = 'requires_capture', extra = {}) => ({ id: 'pi_offline_capture', currency: 'eur', amount: 1234, amount_received: status === 'succeeded' ? 1234 : 0, amount_capturable: status === 'requires_capture' ? 1234 : 0, status, ...extra })
const paymentLinkSQL = 'SELECT p.id AS payment_id,p.payment_collection_id,c.cart_id FROM payment p JOIN cart_payment_collection c ON c.payment_collection_id=p.payment_collection_id WHERE p.id=? AND p.deleted_at IS NULL AND c.deleted_at IS NULL'
function harness(options = {}) {
  const rows = (options.rows || []).map(row => ({ ...row }))
  const payment = { id: 'pay_offline', payment_collection_id: 'paycol_offline', provider_id: 'pp_stripe-connect', amount: new BigNumber('12.34'), raw_amount: { value: '12.34', precision: 20 }, currency_code: 'eur', captured_at: null, canceled_at: null, data: intent(), ...options.payment }
  let current = options.intent || intent()
  let updateFail = !!options.updateFail
  let captureFail = !!options.captureFail
  let collectionFail = !!options.collectionFail
  const captures = [], reads = [], deletes = [], collectionUpdates = [], transactions = [], order = [], writes = []
  const linkQueries = [], retrievals = [], quarantineQueries = []
  const cartId = options.lockCartId || 'cart_offline'
  const linkRows = Object.hasOwn(options, 'linkRows') ? options.linkRows
    : [{ payment_id: payment.id, payment_collection_id: payment.payment_collection_id, cart_id: 'cart_offline' }]
  let connection, lostAt
  const loseLock = boundary => {
    if (lostAt) return
    lostAt = boundary
    connection.emit('end')
  }
  const knex = {
    client: {
      acquireConnection: async () => (connection = new EventEmitter()),
      releaseConnection: async () => {},
      destroyRawConnection: async () => {}
    },
    raw: (sql, bindings = []) => ({ connection: async actual => {
      assert.equal(actual, connection)
      if (sql === 'SELECT pg_try_advisory_lock(?::bigint) AS locked' || sql === 'SELECT pg_advisory_unlock(?::bigint) AS unlocked') {
        assert.deepEqual(bindings, [commerceCartLockKey(cartId)])
        return { rows: [sql.includes('pg_try_advisory_lock') ? { locked: true } : { unlocked: true }] }
      }
      if (sql === 'SET SESSION synchronous_commit = on') {
        assert.deepEqual(bindings, [])
        return { rows: [] }
      }
      if (sql === paymentLinkSQL) {
        assert.deepEqual(bindings, [payment.id])
        linkQueries.push({ sql, bindings: [...bindings] })
        if (options.loseOnLinkQuery) loseLock('payment-link-query')
        if (options.linkQueryFail) throw new Error('offline payment link query failure')
        return { rows: linkRows }
      }
      const query = sql.replace(/\s+/g, ' ').trim()
      if (query === 'SELECT c.cart_id,pc.id AS scope_id,pc.currency_code FROM payment_collection pc JOIN cart_payment_collection c ON c.payment_collection_id=pc.id WHERE pc.id=? AND pc.deleted_at IS NULL AND c.deleted_at IS NULL') {
        assert.deepEqual(bindings, ['paycol_offline'])
        quarantineQueries.push('scope')
        return { rows: [{ cart_id: 'cart_offline', scope_id: 'paycol_offline', currency_code: 'eur' }] }
      }
      if (query === "SELECT operation_id,scope_id,phase,plan, to_jsonb(refund_settlement)->>'no_effect_receipt_id' AS no_effect_receipt_id FROM refund_settlement WHERE scope_id=? AND (phase <> 'completed' OR to_jsonb(refund_settlement)->>'no_effect_receipt_id' IS NOT NULL)" ||
          query === "SELECT * FROM commerce_refund_dispatch WHERE scope_id=? AND state = 'started'") {
        assert.deepEqual(bindings, ['paycol_offline'])
        quarantineQueries.push(query.includes('refund_settlement') ? 'settlements' : 'dispatches')
        return { rows: [] }
      }
      assert.fail(`Unrecognized offline SQL: ${sql}`)
    } })
  }
  const lockContainer = { resolve: () => knex }
  let inTransaction = false
  const service = Object.create(Service.prototype)
  const snapshot = () => ({ ...payment, captures: rows.map(row => ({ ...row })) })
  service.baseRepository_ = {
    getFreshManager: () => ({}),
    transaction: async fn => {
      const manager = {}; transactions.push(manager); inTransaction = true; order.push('transaction-start')
      try { const result = await fn(manager); order.push('transaction-commit'); return result }
      finally { inTransaction = false }
    },
    serialize: async value => value
  }
  service.paymentService_ = {
    retrieve: async id => { retrievals.push(id); return snapshot() },
    update: async data => {
      writes.push(data)
      if (updateFail) { updateFail = false; throw new Error('offline storage failure') }
      Object.assign(payment, data); return snapshot()
    }
  }
  service.captureService_ = {
    create: async (data, context) => {
      assert.ok(inTransaction, 'native creation must run in its native transaction')
      assert.equal(context.transactionManager, transactions.at(-1))
      assert.equal(data.payment, payment.id, 'native capture relation is payment, not payment_id')
      const amount = new BigNumber(data.amount)
      if (options.reservationConflict && rows.length === 0) {
        rows.push(fullRow({ payment_id: payment.id }))
        throw Object.assign(new Error('offline unique capture payment conflict'), { code: '23505' })
      }
      assert.equal(rows.length, 0, 'unique capture(payment_id) rejects a second reservation')
      const row = { id: `cap_offline_${rows.length + 1}`, amount, raw_amount: amount.raw, payment_id: payment.id }
      rows.push(row); order.push('capture-create')
      if (options.loseOnReservation) loseLock('reservation')
      return row
    },
    delete: async filter => { deletes.push(filter); rows.splice(0, rows.length); return [] }
  }
  service.paymentProviderService_ = {
    getStatus: async (_, input) => { reads.push(input); if (options.loseOnRead) loseLock('GET'); if (options.readFail) throw new Error('offline GET failure'); return { status: current.status === 'succeeded' ? PaymentSessionStatus.CAPTURED : PaymentSessionStatus.AUTHORIZED, data: { ...current } } },
    capturePayment: async (_, input) => {
      assert.equal(inTransaction, false, 'dispatch must follow committed native creation')
      captures.push(input); order.push('provider-capture')
      if (captureFail) { captureFail = false; if (options.effectBeforeFailure) current = intent('succeeded'); throw new Error('offline capture uncertain') }
      current = intent('succeeded', options.receipt)
      if (options.loseOnProvider) loseLock('provider-return')
      return { data: { ...current } }
    }
  }
  // Strict collection adapter, exercising inherited native collection calculation.
  service.paymentCollectionService_ = {
    retrieve: async () => ({ id: payment.payment_collection_id, amount: payment.amount, currency_code: 'eur', payment_sessions: [{ status: PaymentSessionStatus.AUTHORIZED, amount: payment.amount }], payments: [{ captures: rows, refunds: [] }] }),
    update: async data => { if (collectionFail) { collectionFail = false; throw new Error('offline collection storage failure') }; collectionUpdates.push(data); return data }
  }
  // Generated native CRUD methods resolve services through __container__, not
  // the protected fields used by handwritten native capture methods.
  service.__container__ = { paymentService: service.paymentService_, captureService: service.captureService_ }
  const facade = new Proxy(service, { get(target, key, receiver) {
    if (key === 'capturePayment') return (...args) => withCommerceCartLock(lockContainer, cartId, () => target.capturePayment(...args))
    return Reflect.get(target, key, receiver)
  } })
  return { service: facade, unheldService: service, rows, payment, captures, reads, deletes, collectionUpdates, transactions, order, writes, linkQueries, retrievals, quarantineQueries, get lostAt() { return lostAt }, setIntent: value => { current = value }, run: (data = {}) => facade.capturePayment({ payment_id: payment.id, ...data }, { manager: {} }) }
}
const fullRow = (extra = {}) => ({ id: 'cap_persisted_offline', amount: new BigNumber('12.34'), raw_amount: { value: '12.34', precision: 20 }, ...extra })
test('payment link assertion without private lock fails closed', async () => {
  await assert.rejects(assertCommercePaymentLock('pay_offline', 'paycol_offline'), /financial lock is not held/)
})
for (const captured of [false, true]) {
  const state = captured ? { rows: [fullRow()], payment: { captured_at: new Date() } } : {}
  test(`retrieved identity must equal requested payment before link SQL or financial work (captured=${captured})`, async () => {
    const h = harness(state)
    await assert.rejects(h.run({ payment_id: 'pay_other', cart_id: 'cart_offline' }), /retrieved payment identity mismatch/)
    assert.deepEqual(h.retrievals, ['pay_other'])
    assert.equal(h.linkQueries.length, 0)
    assert.equal(h.reads.length, 0)
    assert.equal(h.transactions.length, 0)
    assert.equal(h.captures.length, 0)
    assert.equal(h.writes.length, 0)
    assert.equal(h.collectionUpdates.length, 0)
    assert.equal(h.rows.length, captured ? 1 : 0)
  })
  for (const [label, options] of [
    ['wrong locked cart despite caller cart', { lockCartId: 'cart_other' }],
    ['wrong linked cart', { linkRows: [{ payment_id: 'pay_offline', payment_collection_id: 'paycol_offline', cart_id: 'cart_other' }] }],
    ['missing live payment/cart link', { linkRows: [] }],
    ['ambiguous live links', { linkRows: [
      { payment_id: 'pay_offline', payment_collection_id: 'paycol_offline', cart_id: 'cart_offline' },
      { payment_id: 'pay_offline', payment_collection_id: 'paycol_offline', cart_id: 'cart_other' }
    ] }],
    ['duplicate matching links', { linkRows: Array.from({ length: 2 }, () => ({ payment_id: 'pay_offline', payment_collection_id: 'paycol_offline', cart_id: 'cart_offline' })) }],
    ['wrong native collection', { linkRows: [{ payment_id: 'pay_offline', payment_collection_id: 'paycol_other', cart_id: 'cart_offline' }] }],
    ['wrong query payment identity', { linkRows: [{ payment_id: 'pay_other', payment_collection_id: 'paycol_offline', cart_id: 'cart_offline' }] }],
    ['malformed row result', { linkRows: null }],
    ['lock loss while matching link query resolves', { loseOnLinkQuery: true }],
    ['link query failure', { linkQueryFail: true }]
  ]) test(`payment/cart authority fences financial work: ${label} (captured=${captured})`, async () => {
    const h = harness({ ...state, ...options })
    await assert.rejects(h.run({ cart_id: 'cart_offline' }), options.loseOnLinkQuery ? /lock.*not held|lock.*lost/i
      : options.linkQueryFail ? /storage failed/ : /does not belong to the locked cart and collection/)
    assert.equal(h.linkQueries.length, 1, 'must reach the exact session-affine native link query')
    if (options.loseOnLinkQuery) assert.equal(h.lostAt, 'payment-link-query')
    assert.equal(h.reads.length, 0)
    assert.equal(h.transactions.length, 0)
    assert.equal(h.captures.length, 0)
    assert.equal(h.writes.length, 0)
    assert.equal(h.collectionUpdates.length, 0)
    assert.equal(h.deletes.length, 0)
    assert.equal(h.rows.length, captured ? 1 : 0)
  })
}
test('valid native link is checked before each capture and captured repair', async () => {
  const h = harness()
  await h.run()
  assert.equal(h.linkQueries.length, 1)
  await h.run()
  assert.equal(h.linkQueries.length, 2)
  assert.equal(h.reads.length, 1)
  assert.equal(h.collectionUpdates.length, 2)
  assert.deepEqual(h.quarantineQueries, ['scope', 'settlements', 'dispatches', 'scope', 'settlements', 'dispatches'])
})
test('native/admin capture without private lock capability fails before financial work', async () => {
  const h = harness()
  await assert.rejects(h.unheldService.capturePayment({ payment_id: h.payment.id }, { manager: {} }), /lock.*not held|lock.*lost/i)
  assert.equal(h.reads.length, 0)
  assert.equal(h.transactions.length, 0)
  assert.equal(h.rows.length, 0)
  assert.equal(h.captures.length, 0)
  assert.equal(h.writes.length, 0)
})
for (const [label, options, expectedRows, expectedCaptures] of [
  ['GET', { loseOnRead: true }, 0, 0],
  ['reservation', { loseOnReservation: true }, 1, 0],
  ['provider-return', { loseOnProvider: true }, 1, 1]
]) test(`reached session loss during ${label} fences dispatch/finalization; fresh retry reuses reservation`, async () => {
  const h = harness(options)
  await assert.rejects(h.run(), /lock.*not held|lock.*lost/i)
  assert.equal(h.lostAt, label, 'must reach injected loss, not an earlier refusal')
  assert.equal(h.reads.length, 1)
  assert.equal(h.rows.length, expectedRows)
  assert.equal(h.captures.length, expectedCaptures)
  assert.equal(h.writes.length, 0)
  assert.equal(h.collectionUpdates.length, 0)
  assert.equal(h.deletes.length, 0)
  const reservedId = h.rows[0]?.id
  await h.run()
  assert.equal(h.rows.length, 1)
  if (reservedId) assert.equal(h.rows[0].id, reservedId)
  assert.equal(h.captures.length, 1)
  assert.ok(h.payment.captured_at)
})
test('native unique reservation conflict fails before dispatch; fresh retry reuses winner', async () => {
  const h = harness({ reservationConflict: true })
  await assert.rejects(h.run(), /unique capture payment conflict/)
  assert.equal(h.transactions.length, 1)
  assert.equal(h.rows.length, 1)
  assert.equal(h.captures.length, 0)
  assert.equal(h.writes.length, 0)
  await h.run()
  assert.equal(h.transactions.length, 1)
  assert.equal(h.rows[0].id, 'cap_persisted_offline')
  assert.equal(h.captures[0].context.idempotency_key, h.rows[0].id)
})
test('storage failure retains pre-dispatch native capture; retry reconciles GET without redispatch; returns fresh payment', async () => {
  const h = harness({ updateFail: true })
  await assert.rejects(h.run(), /storage failure/)
  assert.equal(h.captures.length, 1, 'injected write failure follows reached provider dispatch')
  assert.equal(h.rows.length, 1, 'durable uncertain capture must survive storage error')
  const id = h.rows[0].id
  const result = await h.run()
  assert.equal(h.rows[0].id, id)
  assert.equal(h.captures.length, 1)
  assert.equal(h.deletes.length, 0)
  assert.ok(result.captured_at)
  assert.equal(result.captures[0].id, id)
  assert.equal(h.collectionUpdates.at(-1).status, 'completed')
  assert.deepEqual(h.order, ['transaction-start', 'capture-create', 'transaction-commit', 'provider-capture'])
})
test('captured_at never dispatches provider and repairs failed collection', async () => {
  const h = harness({ rows: [fullRow()], payment: { captured_at: new Date() }, collectionFail: true })
  await assert.rejects(h.run(), /collection storage/)
  const result = await h.run()
  assert.ok(result.captured_at)
  assert.equal(h.captures.length, 0)
  assert.equal(h.reads.length, 0)
  assert.equal(h.collectionUpdates.length, 1)
})
test('provider uncertain outcome keeps single native row and stable idempotency key', async () => {
  const h = harness({ captureFail: true })
  await assert.rejects(h.run(), /capture uncertain/)
  assert.equal(h.captures.length, 1, 'injected provider failure was reached')
  assert.equal(h.rows.length, 1)
  const id = h.rows[0].id
  await h.run(); await h.run()
  assert.equal(h.rows.length, 1)
  assert.deepEqual(h.captures.map(x => x.context.idempotency_key), [id, id])
  assert.equal(h.transactions.length, 1, 'retry must reuse the original committed capture')
})
test('effect followed by provider timeout reconciles succeeded instead of redispatch', async () => {
  const h = harness({ captureFail: true, effectBeforeFailure: true })
  await assert.rejects(h.run(), /capture uncertain/)
  await h.run()
  assert.equal(h.captures.length, 1)
  assert.ok(h.payment.captured_at)
})
test('existing succeeded provider without local row creates full native accounting row but never captures provider', async () => {
  const h = harness({ intent: intent('succeeded') })
  await h.run()
  assert.equal(h.rows.length, 1)
  assert.equal(h.captures.length, 0)
  assert.ok(h.payment.captured_at)
})
test('pending full row reused for requires_capture, exact raw BigNumber amount; request unchanged', async () => {
  const h = harness({ rows: [fullRow()] })
  const request = { payment_id: h.payment.id, amount: { value: '12.340', precision: 20 } }
  const before = JSON.stringify(request)
  await h.service.capturePayment(request, { manager: {} })
  assert.equal(JSON.stringify(request), before)
  assert.equal(h.rows.length, 1)
  assert.equal(h.captures[0].context.idempotency_key, 'cap_persisted_offline')
})
for (const [label, options, data] of [
  ['partial requested', {}, { amount: 6 }], ['zero requested', {}, { amount: 0 }],
  ['partial row', { rows: [fullRow({ raw_amount: { value: '6', precision: 20 } })] }],
  ['multi rows', { rows: [fullRow(), fullRow({ id: 'cap_other' })] }],
  ['missing row id', { rows: [fullRow({ id: undefined })] }],
  ['canceled local', { payment: { canceled_at: new Date() } }],
  ['currency mismatch', { intent: intent('requires_capture', { currency: 'usd' }) }],
  ['provider id mismatch', { intent: intent('requires_capture', { id: 'pi_other' }) }],
  ['authorized amount mismatch', { intent: intent('requires_capture', { amount: 1233 }) }],
  ['fractional minor units', { payment: { amount: new BigNumber('12.345'), raw_amount: { value: '12.345', precision: 20 } } }],
  ['unsafe amount', { payment: { amount: new BigNumber('90071992547409.92'), raw_amount: { value: '90071992547409.92', precision: 20 } } }],
  ['partial succeeded', { intent: intent('succeeded', { amount_received: 600 }) }],
  ['partial requires_capture', { intent: intent('requires_capture', { amount_capturable: 600 }) }],
  ['already received on authorization', { intent: intent('requires_capture', { amount_received: 600 }) }],
  ['canceled provider', { intent: intent('canceled') }], ['unknown provider', { intent: intent('processing') }],
  ['read error', { readFail: true }]
]) test(`fails closed before provider mutation: ${label}`, async () => {
  const h = harness(options)
  await assert.rejects(h.run(data))
  assert.equal(h.captures.length, 0)
  assert.equal(h.deletes.length, 0)
  assert.equal(h.payment.captured_at, null)
})
for (const receipt of [{ id: 'pi_wrong' }, { currency: 'usd' }, { amount: 1233 }, { amount_received: 600 }, { amount_capturable: 1 }, { status: 'processing' }]) test(`bad capture receipt never finalizes and never deletes uncertain row ${JSON.stringify(receipt)}`, async () => {
  const h = harness({ receipt })
  await assert.rejects(h.run())
  assert.equal(h.captures.length, 1)
  assert.equal(h.rows.length, 1)
  assert.equal(h.deletes.length, 0)
  assert.equal(h.payment.captured_at, null)
})
test('outer transaction is refused before reads, creation or provider dispatch', async () => {
  const h = harness()
  await assert.rejects(h.service.capturePayment({ payment_id: h.payment.id }, { manager: {}, transactionManager: {} }), /outer transaction/)
  assert.equal(h.reads.length, 0)
  assert.equal(h.transactions.length, 0)
  assert.equal(h.rows.length, 0)
  assert.equal(h.captures.length, 0)
})
test('native refund reservation stays inherited while public dispatch is commerce-fenced', async () => {
  assert.equal(Service.prototype.refundPayment_, Native.service.prototype.refundPayment_)
  if (!nativeBaseline) {
    assert.notEqual(Service.prototype.refundPayment, Native.service.prototype.refundPayment)
    await assert.rejects(assertCommercePaymentLock('pay_offline', 'paycol_offline'), /financial lock/)
  }
})
function providerHarness(extra = {}) {
  const service = Object.create(StripeProvider.prototype)
  const calls = [], gets = []
  service.client_ = { paymentIntents: {
    capture: async (...args) => { calls.push(args); if (extra.error) throw extra.error; return intent('succeeded', extra.receipt) },
    retrieve: async id => { gets.push(id); return intent('succeeded', extra.getReceipt) }
  } }
  return { service, calls, gets, run: (data = intent(), context = { idempotency_key: 'cap_stable_offline' }) => service.capturePayment({ data, context }) }
}
test('Stripe full capture forwards durable native id to actual capture call', async () => {
  const h = providerHarness()
  await h.run(); await h.run()
  assert.deepEqual(h.calls, [['pi_offline_capture', {}, { idempotencyKey: 'cap_stable_offline' }], ['pi_offline_capture', {}, { idempotencyKey: 'cap_stable_offline' }]])
})
for (const key of [undefined, '', ' ', 'x'.repeat(256)]) test(`Stripe absent/invalid stable identity fails closed (${String(key).slice(0, 8)})`, async () => {
  const h = providerHarness()
  await assert.rejects(h.run(intent(), { idempotency_key: key }))
  assert.equal(h.calls.length, 0)
})
for (const receipt of [{ id: 'pi_other' }, { currency: 'usd' }, { amount_received: 12 }, { amount: 12 }, { status: 'processing' }, { amount_capturable: 1 }]) test(`Stripe validates full capture receipt ${JSON.stringify(receipt)}`, async () => {
  const h = providerHarness({ receipt })
  await assert.rejects(h.run())
})
test('Stripe unexpected-state error object is not proof: verified provider GET required', async () => {
  const h = providerHarness({ error: { code: 'payment_intent_unexpected_state', payment_intent: intent('succeeded') }, getReceipt: { id: 'pi_wrong' } })
  await assert.rejects(h.run())
  assert.equal(h.gets.length, 1)
})
test('Stripe unexpected-state with exact verified GET accepts full capture', async () => {
  const h = providerHarness({ error: { code: 'payment_intent_unexpected_state', payment_intent: intent('succeeded') } })
  assert.equal((await h.run()).data.status, 'succeeded')
  assert.equal(h.gets.length, 1)
})
if (!nativeBaseline) test('actual native resource resolver preserves subclass, registrations, models and migrations', async () => {
  const { loadResources, resolveModuleExports } = require('@medusajs/modules-sdk/dist/loaders/utils/load-internal')
  const { createMedusaContainer, Modules } = require('@medusajs/framework/utils')
  const filename = path.join(base, 'index.ts')
  const resolution = { resolutionPath: filename, definition: { key: Modules.PAYMENT }, moduleDeclaration: {} }
  const exported = await resolveModuleExports({ resolution })
  assert.equal(exported.service, Service)
  const resources = await loadResources({ container: createMedusaContainer(), moduleResolution: resolution, discoveryPath: exported.discoveryPath, loadedModuleLoaders: exported.loaders })
  assert.equal(resources.moduleService, Service)
  const container = createMedusaContainer()
  await resources.loaders.find(x => x.name === 'containerLoader')({ container, options: {} })
  for (const name of ['capture', 'payment', 'paymentCollection', 'paymentProvider', 'paymentSession', 'refund', 'refundReason', 'accountHolder']) {
    assert.equal(container.hasRegistration(`${name}Service`), true, `${name}Service`)
    assert.equal(container.hasRegistration(`${name}Repository`), true, `${name}Repository`)
  }
  const wrapper = require(filename).default
  const manager = {}
  await resources.loaders.find(x => x.name === 'connectionLoader')({ container, options: { manager } })
  assert.equal(container.resolve('manager'), manager, 'native injected-manager loader path is preserved without DB')
  const nativeMigrations = path.join(path.dirname(require.resolve('@medusajs/payment')), 'migrations')
  assert.ok(fs.readdirSync(nativeMigrations).some(name => /^Migration.*\.js$/.test(name)))
  assert.deepEqual(wrapper.loaders.map(x => x.name), ['connectionLoader', 'containerLoader', ...Native.loaders.map(x => x.name)])
  assert.equal(wrapper.linkable, Native.linkable)
  for (const name of ['runMigrations', 'revertMigration', 'generateMigration']) assert.equal(typeof wrapper[name], 'function')
})
