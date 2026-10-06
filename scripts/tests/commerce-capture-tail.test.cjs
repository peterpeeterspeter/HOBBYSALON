// OFFLINE source-bound tests. Real installed Medusa numerics, complete invariant,
// native order API/decorators and RedisEventBus envelope builder; strict synthetic
// PG/graph/persistence adapters. No appboot, sockets, provider or database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const swc = require('@swc/core')
const { MathBN, ContainerRegistrationKeys: K, Modules, PaymentActions, PaymentEvents } = require('@medusajs/framework/utils')
const root = path.resolve(__dirname, '../..')
const utils = path.join(root, 'packages/modules/b2c-core/src/utils')
let completionRuns = 0
const loader = Module._load
Module._extensions['.ts'] = (mod, filename) => {
  mod.paths = [...module.paths, ...mod.paths]
  mod._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), { filename,
    jsc: { parser: { syntax: 'typescript', decorators: true }, target: 'es2021', transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' } }).code, filename)
}
Module._load = function (name, parent, main) {
  if (name.startsWith('@mercurjs/b2c-core/utils/')) return loader.call(this, path.join(utils, name.split('/').at(-1) + '.ts'), parent, main)
  if (name.includes('workflows/cart/workflows/split-and-complete-cart')) return { splitAndCompleteCartWorkflow: () => ({ run: async () => { completionRuns++; throw Error('Uncompleted fixture cannot authorize') } }) }
  if (name.includes('workflows/order-set/workflows')) return { getFormattedOrderSetListWorkflow: () => ({ run: async () => ({ result: { data: [{ id: 'os' }] } }) }) }
  return loader.call(this, name, parent, main)
}
// Fail on any attempted transport (container also network=none).
for (const [name, keys] of [['node:net', ['connect', 'createConnection']], ['node:http', ['request', 'get']], ['node:https', ['request', 'get']]]) {
  for (const key of keys) require(name)[key] = () => { throw Error('OFFLINE transport prohibited') }
}
const lock = require(path.join(utils, 'commerce-cart-lock.ts'))
const tail = require(path.join(utils, 'marketplace-capture.ts'))
const webhook = require(path.join(root, 'apps/backend/src/utils/marketplace-payment-webhook.ts'))
const route = require(path.join(root, 'packages/modules/b2c-core/src/api/store/carts/[id]/complete/route.ts'))
const job = require(path.join(root, 'packages/modules/b2c-core/src/jobs/marketplace-capture-tail-recovery.ts')).default
const RedisBus = require('/app/node_modules/@medusajs/event-bus-redis/dist/services/event-bus-redis.js').default
const NativeOrder = require('@medusajs/order').default.service
assert.equal(require('@medusajs/payment/package.json').version, '2.11.3')
const expected = { session_id: 'ps', collection_id: 'pc', intent_id: 'pi', amount: '12.34', currency_code: 'eur' }
const input = { action: PaymentActions.SUCCESSFUL, provider_id: 'pp_card_stripe-connect', data: { ...expected, payment_intent_id: 'pi', payment_collection_id: 'pc', cart_id: 'cart' } }
const clone = x => structuredClone(x)
function harness(options = {}) {
  const session = { id: 'ps', payment_collection_id: 'pc', provider_id: 'pp_card_stripe-connect', amount: '12.34', currency_code: 'eur', data: { id: 'pi' } }
  const cart = { id: 'cart', completed_at: 'done', currency_code: 'eur', total: '12.34', items: [{ id: 'ci', variant_id: 'v', quantity: 1, unit_price: '12.34' }], payment_collection: { id: 'pc', amount: '12.34', currency_code: 'eur', payment_sessions: [session] } }
  const order = { id: 'o', version: 1, currency_code: 'eur', items: [{ id: 'oi', variant_id: 'v', quantity: 1, unit_price: '12.34' }], summary: { accounting_total: '12.34' }, payment_collections: [{ id: 'pc' }], split_order_payment: { id: 'split', payment_collection_id: 'pc', currency_code: 'eur', authorized_amount: '12.34', captured_amount: '0', refunded_amount: '0', status: 'pending' } }
  const set = { id: 'os', cart_id: 'cart', payment_collection_id: 'pc', orders: [order] }
  const payment = { id: 'pay', payment_session_id: 'ps', payment_collection_id: 'pc', provider_id: session.provider_id, amount: '12.34', currency_code: 'eur', captured_at: 'done', canceled_at: null, data: { id: 'pi' }, captures: [{ id: 'cap', payment_id: 'pay', amount: '12.34' }], refunds: [] }
  const collection = { id: 'pc', amount: '12.34', captured_amount: '12.34', refunded_amount: '0', currency_code: 'eur', completed_at: 'done', status: 'completed' }
  const store = { row: null, transactions: [], jobs: new Map(), queries: [], apiCalls: 0, providerCalls: 0, splitCalls: 0, warns: [], summaries: [] }
  const clients = [], held = new Set()
  const client = {
    acquireConnection: async () => { const c = new EventEmitter(); clients.push(c); return c },
    releaseConnection: async c => { c.released = true },
    destroyRawConnection: async c => { c.destroyed = true; for (const k of c.keys || []) held.delete(k) },
  }
  let fail = options.fail
  const trip = key => { if (fail === key) { fail = null; throw Error(`synthetic ${key} failure`) } }
  const knex = { client, raw(sql, values = []) {
    return { connection: async c => {
      store.queries.push({ sql, values, c })
      if (sql.includes('pg_try_advisory_lock')) { c.keys = [values[0]]; if (held.has(values[0])) return { rows: [{ locked: false }] }; held.add(values[0]); return { rows: [{ locked: true }] } }
      if (sql.includes('pg_advisory_unlock')) { if (options.badUnlock) return { rows: [{ unlocked: false }] }; return { rows: [{ unlocked: held.delete(values[0]) }] } }
      if (sql.startsWith('SET SESSION')) return { rows: [] }
      assert.ok(held.size, 'ledger write requires held session')
      if (sql.startsWith('INSERT')) {
        trip('insert')
        if (!store.row) store.row = { payment_id: values[0], cart_id: values[1], snapshot: JSON.parse(values[2]), event_id: values[3], capture_id: null, accounting_at: null, event_enqueued_at: null, completed_at: null, attempts: 0 }
        return { rows: [] }
      }
      if (sql.startsWith('SELECT *')) return { rows: store.row && store.row.payment_id === values[0] ? [clone(store.row)] : [] }
      if (sql.startsWith('UPDATE')) {
        assert.ok(store.row)
        if (sql.includes('last_attempt_at = now()')) { if (store.row.completed_at || store.row.last_attempt_at) return { rows: [] }; store.row.last_attempt_at = 'now'; store.row.attempts++; return { rows: [{ snapshot: clone(store.row.snapshot) }] } }
        if (sql.includes('last_error = ?')) store.row.last_error = values[0]
        else if (sql.includes('capture_id =')) { if (store.row.capture_id) assert.equal(values[0], store.row.capture_id, 'immutable capture'); store.row.capture_id ||= values[0] }
        else if (sql.includes('accounting_at =')) store.row.accounting_at ||= 'now'
        else if (sql.includes('event_enqueued_at =')) { trip('ack'); assert.ok(store.row.accounting_at); store.row.event_enqueued_at ||= 'now'; store.row.completed_at ||= 'now' }
        else if (sql.includes('completed_at =')) { assert.ok(store.row.event_enqueued_at); store.row.completed_at ||= 'now' }
        else throw Error(`Unknown strict SQL ${sql}`)
        return { rows: [{ payment_id: 'pay' }] }
      }
      throw Error(`Unknown strict SQL ${sql}`)
    }, then(resolve, reject) { // root worker SELECT only
      assert.match(sql, /SELECT payment_id, cart_id FROM marketplace_capture_tail/)
      assert.match(sql, /completed_at IS NULL/); assert.match(sql, /LIMIT 20/)
      return Promise.resolve({ rows: store.row && !store.row.completed_at ? [{ payment_id: 'pay', cart_id: 'cart' }] : [] }).then(resolve, reject)
    } }
  } }
  const native = Object.create(NativeOrder.prototype)
  native.baseRepository_ = { getFreshManager: () => ({}), serialize: async x => x,
    transaction: async fn => { const before = clone(store.transactions); try { return await fn({}) } catch (e) { store.transactions = before; throw e } } }
  native.orderService_ = { list: async () => [{ id: 'o', version: 1 }] }
  native.orderTransactionService_ = { create: async data => data.map(d => {
    assert.equal(d.version, 1); assert.equal(d.order_id, 'o'); assert.equal(d.reference, 'capture'); assert.equal(d.reference_id, 'cap')
    assert.ok(!store.transactions.some(t => t.order_id === d.order_id && t.reference_id === d.reference_id), 'strict unique capture transaction')
    const row = { ...d, id: 'trx', deleted_at: null }; store.transactions.push(row); return row
  }) }
  native.updateOrderPaidRefundableAmount_ = async rows => { trip('summary'); store.summaries.push(clone(rows)) }
  const orderService = { listOrderTransactions: async (_, config) => { assert.equal(config.withDeleted, true); if (options.afterList) options.afterList(h); return clone(store.transactions) }, addOrderTransactions: data => native.addOrderTransactions(data, { manager: {} }) }
  const paymentService = { capturePayment: async data => {
    store.apiCalls++; assert.ok(store.row, 'snapshot durable before capture API')
    assert.equal(data.payment_id, 'pay'); assert.equal(data.amount, '12.34')
    if (!payment.captured_at) { store.providerCalls++; payment.captured_at = 'done' }
    trip('collection'); if (options.afterCapture) options.afterCapture(h)
    return clone(payment)
  }, retrievePayment: async () => clone(payment), retrievePaymentCollection: async () => clone(collection) }
  const bus = Object.create(RedisBus.prototype); bus.moduleOptions_ = {}
  const container = { registrations: {}, resolve(name) {
    if (name === K.PG_CONNECTION) return knex
    if (name === K.QUERY) return { graph: async ({ entity }) => { const data = clone(entity === 'cart' ? [cart] : entity === 'order_set' ? (h.noSet ? [] : [set]) : entity === 'payment' ? (h.payments || [payment]) : entity === 'payment_session' ? [session] : entity === 'cart_payment_collection' ? [{ cart_id: 'cart' }] : []); if (options.afterGraph) options.afterGraph(h, entity); return { data } } }
    if (name === Modules.PAYMENT) return paymentService
    if (name === Modules.ORDER) return orderService
    if (name === 'split_order_payment') return { updateSplitOrderPayments: async d => { store.splitCalls++; trip('split'); Object.assign(order.split_order_payment, d) } }
    if (name === Modules.EVENT_BUS) return { emit: async message => { trip('emit'); const built = bus.buildEvents([message])[0]; assert.equal(built.name, PaymentEvents.CAPTURED); assert.equal(built.opts.removeOnComplete, false); assert.equal(built.opts.removeOnFail, false); assert.equal(built.data.metadata.marketplace_capture_event_id, built.opts.jobId); assert.ok(!built.opts.jobId.includes(':')); store.jobs.set(built.opts.jobId, built) } }
    if (name === K.LOGGER) return { warn: s => store.warns.push(s) }
    throw Error(`Forbidden dependency ${name}`)
  } }
  const h = { cart, order, set, session, payment, collection, store, container, clients, knex, held, noSet: false,
    run: (mode = 'capture') => lock.withCommerceCartLock(container, 'cart', () => tail.captureMarketplacePaymentUnderLock(container, 'cart', expected, mode)),
    failNext: key => { fail = key } }
  return h
}
test('captured payment repairs all tail effects; real native order API called once over replay', async () => {
  const h = harness(); await h.run(); await h.run()
  assert.equal(h.store.providerCalls, 0); assert.equal(h.store.transactions.length, 1); assert.equal(h.store.summaries.length, 1)
  assert.equal(h.store.jobs.size, 1); assert.ok(h.store.row.completed_at)
  assert.equal(h.order.split_order_payment.captured_amount, '12.34')
  assert.equal(h.store.row.snapshot.intent_id, 'pi')
  assert.ok(h.clients.every(c => c.released)); assert.equal(h.held.size, 0)
})
test('lock lost during native transaction list refuses NEW accounting and summary writes', async () => {
  const h = harness({ afterList: h => h.clients.at(-1).emit('end') })
  await assert.rejects(h.run(), /lock/)
  assert.equal(h.store.transactions.length, 0)
  assert.equal(h.store.summaries.length, 0)
  assert.equal(h.store.splitCalls, 0)
  assert.equal(h.store.jobs.size, 0)
})
test('lock lost during completion graph refuses workflow entry before authorization effects', async () => {
  const h = harness({ afterGraph: (h, entity) => { if (entity === 'order_set') h.clients.at(-1).emit('end') } })
  h.cart.completed_at = null; h.noSet = true
  const before = completionRuns
  await assert.rejects(lock.withCommerceCartLock(h.container, 'cart', () => tail.completeMarketplaceCartUnderLock(h.container, 'cart', expected)), /lock/)
  assert.equal(completionRuns, before)
  assert.equal(h.store.providerCalls, 0)
})
for (const failure of ['insert', 'collection', 'summary', 'split', 'emit', 'ack']) test(`restart repairs ${failure} gap; immutable snapshot/queue/accounting identity retained`, async () => {
  const h = harness({ fail: failure }); await assert.rejects(h.run())
  const snapshot = h.store.row && tail.marketplaceSnapshotKey(h.store.row.snapshot)
  const eventId = h.store.row?.event_id
  await h.run(); await h.run()
  if (snapshot) assert.equal(tail.marketplaceSnapshotKey(h.store.row.snapshot), snapshot)
  if (eventId) assert.equal(h.store.row.event_id, eventId)
  assert.equal(h.store.providerCalls, 0); assert.equal(h.store.transactions.length, 1); assert.equal(h.store.jobs.size, 1)
})
test('full pre-capture immutable operation persisted before new capture and no recapture', async () => {
  const h = harness(); h.payment.captured_at = null; await h.run(); await h.run()
  assert.equal(h.store.providerCalls, 1); assert.equal(h.store.transactions.length, 1)
})
test('storefront retains response and shared lock; authorization-only never initiates capture', async () => {
  const h = harness(); h.payment.captured_at = null; let response
  await route.POST({ scope: h.container, params: { id: 'cart' } }, { json: x => { response = x } })
  assert.deepEqual(response, { order_set: { id: 'os' } }); assert.equal(h.store.apiCalls, 0); assert.equal(h.store.row, null)
  assert.equal(completionRuns, 0)
})
test('successful webhook consumes same lock and repairs captured tail instead of skipping it', async () => {
  const h = harness(); await webhook.processMarketplacePaymentWebhook(h.container, clone(input))
  assert.equal(h.store.providerCalls, 0); assert.ok(h.store.row.completed_at)
  assert.equal(h.store.transactions.length, 1)
})
test('authorized webhook does not capture', async () => {
  const h = harness(); await webhook.processMarketplacePaymentWebhook(h.container, { ...clone(input), action: PaymentActions.AUTHORIZED })
  assert.equal(h.store.apiCalls, 0)
})
for (const [label, mutation] of [
  ['missing session', x => { delete x.data.session_id }], ['provider', x => { x.provider_id = 'pp_other' }],
  ['amount', x => { x.data.amount = '1' }], ['currency', x => { x.data.currency_code = 'usd' }],
  ['intent', x => { x.data.payment_intent_id = 'pi_wrong' }], ['collection', x => { x.data.payment_collection_id = 'wrong' }],
  ['cart', x => { x.data.cart_id = 'other' }], ['action', x => { x.action = 'failed' }],
]) test(`earlier webhook session-binding negative preserved: ${label}`, async () => {
  const h = harness(), bad = clone(input); mutation(bad)
  await assert.rejects(webhook.processMarketplacePaymentWebhook(h.container, bad)); assert.equal(h.store.apiCalls, 0); assert.equal(h.store.row, null)
})
for (const [label, mutate] of [
  ['missing completed_at', h => { h.cart.completed_at = null }], ['missing set', h => { h.noSet = true }],
  ['wrong order currency', h => { h.order.currency_code = 'usd' }], ['wrong allocation', h => { h.order.summary.accounting_total = '1' }],
  ['wrong quantity', h => { h.order.items[0].quantity = 2 }], ['wrong session', h => { h.payment.payment_session_id = 'other' }],
  ['wrong intent', h => { h.payment.data.id = 'pi_other' }], ['wrong provider', h => { h.payment.provider_id = 'other' }],
  ['wrong collection', h => { h.payment.payment_collection_id = 'other' }], ['wrong capture payment', h => { h.payment.captures[0].payment_id = 'other' }],
  ['multi payment', h => { h.payments = [h.payment, h.payment] }], ['canceled', h => { h.payment.canceled_at = 'done' }],
  ['refund', h => { h.payment.refunds = [{ id: 'ref', amount: '1' }] }], ['refunded split', h => { h.order.split_order_payment.refunded_amount = '1' }],
  ['collection incomplete', h => { h.collection.status = 'authorized' }], ['duplicate capture', h => { h.payment.captures.push(clone(h.payment.captures[0])) }],
]) test(`fails closed without accounting/event: ${label}`, async () => {
  const h = harness(); mutate(h); await assert.rejects(h.run())
  assert.equal(h.store.transactions.length, 0); assert.equal(h.store.jobs.size, 0); assert.equal(h.store.providerCalls, 0)
})
test('immutable snapshot mismatch refused BEFORE capture API, jsonb key ordering accepted', async () => {
  const h = harness({ fail: 'collection' }); await assert.rejects(h.run())
  h.store.row.snapshot = Object.fromEntries(Object.entries(h.store.row.snapshot).reverse())
  await h.run(); const before = h.store.apiCalls
  h.store.row.snapshot.intent_id = 'mutated'; await assert.rejects(h.run(), /snapshot changed/)
  assert.equal(h.store.apiCalls, before)
})
test('post-capture identity mutation refused before any accounting', async () => {
  const h = harness({ afterCapture: h => { h.cart.items[0].id = 'changed' } })
  await assert.rejects(h.run(), /operation changed/); assert.equal(h.store.transactions.length, 0)
})
test('duplicate/tombstone accounting refuses without recreating transaction', async () => {
  for (const mutate of [h => { h.payment.refunds = [{ id: 'ref' }] }, h => { h.payment.captures[0].payment_id = 'wrong' },
    h => { h.payment.captures[0].amount = '1' }, h => { h.payment.captures.push(clone(h.payment.captures[0])) }]) {
    const bad = harness(); mutate(bad); await assert.rejects(bad.run(), /pre-capture ledger/); assert.equal(bad.store.apiCalls, 0)
  }
  const h = harness(); await h.run(); h.store.transactions[0].deleted_at = 'deleted'
  await assert.rejects(h.run(), /accounting mismatch/); assert.equal(h.store.transactions.length, 1)
})
test('recovery worker selects only incomplete tails and never blindly captures uncaptured payment', async () => {
  const checkpoint = harness(); await checkpoint.run(); checkpoint.store.row.completed_at = null
  await checkpoint.run(); assert.ok(checkpoint.store.row.completed_at); assert.equal(checkpoint.store.jobs.size, 1)
  const changed = harness({ fail: 'emit' }); await assert.rejects(changed.run()); const callsBefore = changed.store.apiCalls
  changed.cart.items[0].tax_lines = [{ id: 'tax', rate: '21', code: 'vat' }]
  await assert.rejects(changed.run(), /snapshot changed/); assert.equal(changed.store.apiCalls, callsBefore)
  const h = harness({ fail: 'emit' }); await assert.rejects(h.run()); await job(h.container)
  assert.ok(h.store.row.completed_at); assert.equal(h.store.providerCalls, 0)
  await job(h.container); assert.equal(h.store.row.attempts, 1)
  const pending = harness({ fail: 'collection' }); await assert.rejects(pending.run()); pending.payment.captured_at = null
  const calls = pending.store.apiCalls; await job(pending.container)
  assert.equal(pending.store.apiCalls, calls); assert.equal(pending.store.providerCalls, 0)
  assert.match(pending.store.row.last_error, /reconciliation/); assert.equal(pending.store.row.completed_at, null)
})
test('shared session lock denies concurrent consumers, nested same cart reuses capability; no TTL', async () => {
  const h = harness(); let entered, finish
  const started = new Promise(r => { entered = r }), stopped = new Promise(r => { finish = r })
  const running = lock.withCommerceCartLock(h.container, 'cart', async () => {
    lock.assertCommerceCartLock(h.container, 'cart'); await lock.withCommerceCartLock(h.container, 'cart', async () => {})
    entered(); await stopped
  })
  await started; await assert.rejects(webhook.processMarketplacePaymentWebhook(h.container, clone(input)), /busy/)
  finish(); await running; assert.equal(h.held.size, 0)
  assert.throws(() => lock.assertCommerceCartLock(h.container, 'cart'), /not held/)
  assert.equal(h.clients.length, 2)
})
test('lost session stops side effects and is discarded; bad unlock discards connection', async () => {
  const h = harness(); await assert.rejects(lock.withCommerceCartLock(h.container, 'cart', async () => {
    h.clients[0].emit('end'); await tail.captureMarketplacePaymentUnderLock(h.container, 'cart', expected)
  }), /not held/); assert.ok(h.clients[0].destroyed); assert.equal(h.store.apiCalls, 0)
  const bad = harness({ badUnlock: true }); await assert.rejects(lock.withCommerceCartLock(bad.container, 'cart', async () => {}), /unlock failed/)
  assert.ok(bad.clients[0].destroyed)
})
test('invalid/nested wrong-cart/root transaction locks refused', async () => {
  for (const v of ['', ' ', 'x\n', 'x'.repeat(256)]) assert.throws(() => lock.commerceCartLockKey(v))
  const h = harness(); await lock.withCommerceCartLock(h.container, 'cart', async () => {
    await assert.rejects(lock.withCommerceCartLock(h.container, 'other', async () => {}))
  })
  h.knex.isTransaction = true; await assert.rejects(h.run(), /root PostgreSQL/)
})
test('real marketplace module discovery lifecycle contains migration; SQL has immutable/dedup guards', async () => {
  const { loadResources, resolveModuleExports } = require('@medusajs/modules-sdk/dist/loaders/utils/load-internal')
  const { createMedusaContainer } = require('@medusajs/framework/utils')
  const base = path.join(root, 'packages/modules/b2c-core/src/modules/marketplace')
  const resolution = { resolutionPath: path.join(base, 'index.ts'), definition: { key: 'marketplace' }, moduleDeclaration: {} }
  const exported = await resolveModuleExports({ resolution })
  const resources = await loadResources({ container: createMedusaContainer(), moduleResolution: resolution, discoveryPath: exported.discoveryPath, loadedModuleLoaders: exported.loaders })
  assert.equal(resources.normalizedPath, base); assert.ok(resources.models.length)
  assert.ok(resources.loaders.some(x => x.name === 'connectionLoader'))
  const { Migration20261005190000: Migration } = require(path.join(base, 'migrations/Migration20261005190000.ts'))
  const m = Object.create(Migration.prototype), sql = []; m.addSql = x => sql.push(x); await m.up()
  const ddl = sql.join('\n'); assert.match(ddl, /CREATE TABLE marketplace_capture_tail/)
  assert.match(ddl, /CREATE UNIQUE INDEX marketplace_order_capture_once/)
  assert.match(ddl, /BEFORE UPDATE OR DELETE/); assert.match(ddl, /NEW.snapshot IS DISTINCT FROM OLD.snapshot/)
  assert.match(ddl, /WHERE reference = 'capture' AND reference_id IS NOT NULL/)
  assert.ok(!ddl.includes('deleted_at IS NULL'), 'capture tombstones remain dedup evidence')
})
