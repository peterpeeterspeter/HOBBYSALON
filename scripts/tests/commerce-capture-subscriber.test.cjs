// Source-bound, OFFLINE only. Reuse the strict synthetic PG/native Medusa
// numeric/order API fixture, not a replacement implementation of the consumers.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const root = path.resolve(__dirname, '../..')
const fixturePath = path.join(__dirname, 'commerce-capture-tail.test.cjs')
let source = fs.readFileSync(fixturePath, 'utf8').split("test('captured payment repairs")[0]
for (const line of [
  "const webhook = require(path.join(root, 'apps/backend/src/utils/marketplace-payment-webhook.ts'))\n",
  "const route = require(path.join(root, 'packages/modules/b2c-core/src/api/store/carts/[id]/complete/route.ts'))\n",
  "const job = require(path.join(root, 'packages/modules/b2c-core/src/jobs/marketplace-capture-tail-recovery.ts')).default\n"
]) source = source.replace(line, '')
assert.ok(source.includes('function harness(') && !source.includes("test('"), 'fixture is harness-only')
const fixture = new Module(fixturePath, module)
fixture.filename = fixturePath; fixture.paths = module.paths
fixture._compile(source + '\nmodule.exports = { harness, tail, lock };', fixturePath)
const { harness, tail, lock } = fixture.exports
const utils = path.join(root, 'packages/modules/b2c-core/src/utils')
const subdir = path.join(root, 'packages/modules/b2c-core/src/subscribers')
const loader = Module._load
// Only event enum is substituted; real order-set consumer, helper and lock run.
Module._load = function (name, parent, main) {
  if (name === '@mercurjs/framework') return { OrderSetWorkflowEvents: { PLACED: 'order_set.placed' } }
  return loader.call(this, name, parent, main)
}
const captured = require(path.join(subdir, 'split-payment-payment-captured.ts')).default
const placed = require(path.join(subdir, 'order-set-placed-payment-capture.ts')).default
const { ContainerRegistrationKeys: K } = require('@medusajs/framework/utils')
function setup() {
  const h = harness()
  const raw = h.knex.raw.bind(h.knex)
  h.acks = []; h.rootLookups = 0; h.failAck = null; h.readback = null
  h.knex.raw = (sql, values = []) => {
    if (sql === 'SELECT cart_id FROM marketplace_capture_tail WHERE payment_id = ?') {
      h.rootLookups++
      return Promise.resolve({ rows: h.store.row && h.store.row.payment_id === values[0] ? [{ cart_id: h.store.row.cart_id }] : [] })
    }
    if (!sql.includes('marketplace_capture_consumer_ack')) return raw(sql, values)
    // Strict new receipt adapter: only a real physical-session .connection(c)
    // response can persist/read a synthetic row. No fake factory or claim token.
    return { connection: async c => {
      assert.ok(h.held.has(c.keys?.[0]), 'ACK SQL uses the actual lock session')
      lock.assertCommerceCartLock(h.container, 'cart')
      h.store.queries.push({ sql, values, c })
      if (h.failAck === 'insert' && sql.startsWith('INSERT')) { h.failAck = null; throw Error('synthetic ACK insert failure') }
      if (h.failAck === 'readback' && sql.startsWith('SELECT')) { h.failAck = null; throw Error('synthetic ACK readback failure') }
      if (sql.startsWith('INSERT')) {
        assert.match(sql, /ON CONFLICT \(payment_id\) DO NOTHING/)
        if (!h.acks.length) h.acks.push(Object.fromEntries(['payment_id', 'cart_id', 'capture_id', 'event_id', 'snapshot_sha256', 'subscriber_id', 'protocol_version', 'acked_at'].map((key, i) => [key, i === 7 ? '2026-10-06T00:00:00Z' : values[i]])))
        return { rows: [] }
      }
      assert.equal(sql, 'SELECT * FROM marketplace_capture_consumer_ack WHERE payment_id = ?')
      if (h.readback === 'missing') return { rows: [] }
      const rows = structuredClone(h.acks.filter(a => a.payment_id === values[0]))
      if (h.readback === 'wrong') rows[0].payment_id = 'other'
      if (h.readback === 'duplicate') rows.push(...structuredClone(rows))
      return { rows }
    } }
  }
  h.event = () => ({ data: { id: h.payment.id }, metadata: {
    marketplace_capture_event_id: h.store.row.event_id, marketplace_capture_id: h.store.row.capture_id
  } })
  h.receipt = () => JSON.stringify({ payment: h.payment, collection: h.collection, cart: h.cart,
    order: h.order, row: h.store.row,
    transactions: h.store.transactions, summaries: h.store.summaries,
    splitCalls: h.store.splitCalls, apiCalls: h.store.apiCalls, providerCalls: h.store.providerCalls, jobs: [...h.store.jobs] })
  h.consume = event => captured({ container: h.container, event: event || h.event() })
  h.refund = (amount, status = 'refunded') => {
    h.payment.refunds = [{ id: 'refund', payment_id: h.payment.id, amount }]
    h.collection.refunded_amount = amount
    h.order.split_order_payment.refunded_amount = amount
    h.order.split_order_payment.status = status
  }
  return h
}
for (const [label, mutate] of [
  ['delayed capture', () => {}],
  ['partial refund', h => h.refund('1.23', 'partially_refunded')],
  ['full refund', h => h.refund('12.34')],
  ['canceled split', h => { h.order.split_order_payment.status = 'canceled'; h.payment.canceled_at = 'later' }],
  ['refunded then canceled', h => { h.refund('12.34', 'canceled'); h.payment.canceled_at = 'later' }]
]) test(`reached real captured consumer ACKs ${label} and duplicate without any accounting write`, async () => {
  const h = setup(); await h.run(); mutate(h)
  const before = h.receipt(), sqlStart = h.store.queries.length
  await h.consume(); await h.consume()
  assert.equal(h.receipt(), before)
  assert.ok(h.store.queries.slice(sqlStart).some(x => x.sql.includes('SELECT * FROM marketplace_capture_tail')))
  assert.ok(h.store.queries.slice(sqlStart).every(x => !/^(INSERT|UPDATE|DELETE)/.test(x.sql) || x.sql.startsWith('INSERT INTO marketplace_capture_consumer_ack')))
  assert.equal(h.acks.length, 1, 'actual tagged handler durably inserts one synthetic ACK')
  assert.equal(h.rootLookups, 2, 'one root discovery per public invocation, not recursive validation')
  assert.equal(h.acks[0].subscriber_id, 'split-payment-payment-captured-handler')
  assert.equal(h.acks[0].snapshot_sha256, h.store.row.event_id.slice('marketplace-captured-'.length))
  assert.equal(h.store.queries.slice(sqlStart).filter(q => q.sql.startsWith('INSERT INTO marketplace_capture_consumer_ack')).length, 2)
  assert.equal(h.store.queries.slice(sqlStart).filter(q => q.sql === 'SELECT * FROM marketplace_capture_consumer_ack WHERE payment_id = ?').length, 2,
    'each actual handler invocation must perform independent ACK readback')
  assert.equal(h.held.size, 0); assert.ok(h.clients.every(c => c.released))
})
test('untagged native capture before outbox is read-only and existing tail subsequently completes', async () => {
  const h = setup(); h.failNext('emit'); await assert.rejects(h.run())
  assert.ok(h.store.row.accounting_at); assert.equal(h.store.row.completed_at, null)
  const before = h.receipt()
  await h.consume({ data: { id: h.payment.id } }); assert.equal(h.receipt(), before)
  await h.run(); assert.ok(h.store.row.completed_at)
  await h.consume({ data: { id: h.payment.id } })
  assert.equal(h.acks.length, 0, 'untagged early and ready events never ACK')
})
test('untagged native EmitEvents inside active capability does not deadlock or project splits', async () => {
  const h = setup(); h.failNext('collection'); await assert.rejects(h.run())
  const before = h.receipt(), clients = h.clients.length
  await lock.withCommerceCartLock(h.container, 'cart', async () => {
    await h.consume({ data: { id: h.payment.id } })
  })
  assert.equal(h.receipt(), before); assert.equal(h.clients.length, clients + 1)
})
test('independent async capture dispatch while emitter owns lock fails fast for retry', async () => {
  const h = setup(); await h.run(); let enter, finish
  const entered = new Promise(r => { enter = r }), done = new Promise(r => { finish = r })
  const running = lock.withCommerceCartLock(h.container, 'cart', async () => { enter(); await done })
  await entered
  const before = h.receipt()
  await assert.rejects(h.consume({ data: { id: h.payment.id } }), /busy; retry/)
  assert.equal(h.receipt(), before); finish(); await running
  await h.consume()
})
for (const [label, mutate] of [
  ['wrong named event', (h,e) => { e.name = 'payment.authorized' }],
  ['missing capture tag', (h,e) => { delete e.metadata.marketplace_capture_id }],
  ['extra immutable snapshot field', h => { h.store.row.snapshot.extra = true }],
  ['wrong capture marker', (h,e) => { e.metadata.marketplace_capture_id = 'other' }],
  ['wrong event marker', (h,e) => { e.metadata.marketplace_capture_event_id = 'other' }],
  ['changed immutable snapshot', h => { h.store.row.snapshot.intent_id = 'other' }],
  ['pending tagged tail', h => { h.store.row.completed_at = null }],
  ['wrong native capture', h => { h.payment.captures[0].id = 'other' }],
  ['capture amount regression', h => { h.order.split_order_payment.captured_amount = '0' }],
  ['refund greater than capture', h => { h.refund('13') }],
  ['native refund differs', h => { h.refund('1.23'); h.collection.refunded_amount = '0' }],
  ['deleted capture accounting', h => { h.store.transactions[0].deleted_at = 'deleted' }],
  ['changed native payment', h => { h.payment.data.id = 'other' }],
  ['changed cart binding', h => { h.cart.payment_collection.id = 'other' }]
]) test(`captured consumer fails closed without writes: ${label}`, async () => {
  const h = setup(); await h.run(); const event = h.event(); mutate(h, event)
  const before = h.receipt(); await assert.rejects(h.consume(event)); assert.equal(h.receipt(), before)
  assert.equal(h.acks.length, 0)
  assert.equal(h.rootLookups, 1)
})
test('nonmarketplace event refuses legacy full-authorized split snapshot', async () => {
  const h = setup(); const before = h.receipt()
  await assert.rejects(h.consume({ data: { id: h.payment.id } }))
  assert.equal(h.receipt(), before)
})
test('real order-set consumer invokes SAME real capture helper with SAME ALS lock capability', async () => {
  const h = setup(); h.payment.captured_at = null; h.payment.captures = []
  const original = h.container.resolve.bind(h.container)
  const service = original(require('@medusajs/framework/utils').Modules.PAYMENT)
  const capture = service.capturePayment
  service.capturePayment = async data => {
    lock.assertCommerceCartLock(h.container, 'cart')
    assert.ok(h.store.row, 'real helper persisted immutable snapshot before native API')
    h.payment.captures = [{ id: 'cap', payment_id: 'pay', amount: '12.34' }]
    return capture(data)
  }
  await placed({ container: h.container, event: { data: { id: h.set.id } } })
  assert.ok(h.store.row.completed_at); assert.equal(h.store.transactions.length, 1)
  assert.equal(h.store.providerCalls, 1); assert.equal(h.store.splitCalls, 1)
  await placed({ container: h.container, event: { data: { id: h.set.id } } })
  assert.equal(h.store.providerCalls, 1); assert.equal(h.store.transactions.length, 1)
  assert.throws(() => lock.assertCommerceCartLock(h.container, 'cart'), /not held/)
})
test('order-set/cart binding re-read rejects TOCTOU before real capture helper', async () => {
  const h = setup(), resolve = h.container.resolve.bind(h.container)
  let sets = 0
  h.container.resolve = name => {
    const dependency = resolve(name)
    if (name !== K.QUERY) return dependency
    return { graph: async args => {
      const result = await dependency.graph(args)
      if (args.entity === 'order_set' && ++sets === 2) result.data[0].cart_id = 'foreign'
      return result
    } }
  }
  await assert.rejects(placed({ container: h.container, event: { data: { id: h.set.id } } }), /binding changed/)
  assert.equal(sets, 2); assert.equal(h.store.row, null); assert.equal(h.store.apiCalls, 0)
})
test('delayed order-set event after refund fails closed; never recaptures or resets status', async () => {
  const h = setup(); await h.run(); h.refund('1.23', 'partially_refunded')
  const before = h.receipt()
  await assert.rejects(placed({ container: h.container, event: { data: { id: h.set.id } } }))
  assert.equal(h.receipt(), before)
})
test('public handler cannot accept a no-op validator supplied by its caller', async () => {
  const h = setup(); await h.run(); h.payment.captures[0].id = 'invalid'
  const event = h.event(); event.validateUnderLock = async () => {}
  event.metadata.validated = true
  const before = h.receipt()
  await assert.rejects(captured({ container: h.container, event, validateUnderLock: async () => {} }))
  assert.equal(h.acks.length, 0); assert.equal(h.receipt(), before)
  const publicAPI = require(path.join(utils, 'marketplace-capture-subscriber.ts'))
  assert.deepEqual(Object.keys(publicAPI), ['acknowledgeMarketplaceCapture'])
})
for (const [label, mutate] of [
  ['partial refund', h => h.refund('1.23', 'partially_refunded')],
  ['full refund', h => h.refund('12.34')],
  ['cancel', h => { h.order.split_order_payment.status = 'canceled'; h.payment.canceled_at = 'later' }]
]) test(`existing ACK replay validates later ${label} without financial effects`, async () => {
  const h = setup(); await h.run(); await h.consume(); assert.equal(h.acks.length, 1)
  const saved = structuredClone(h.acks[0]); mutate(h); const before = h.receipt()
  await h.consume(); assert.equal(h.receipt(), before); assert.deepEqual(h.acks, [saved])
  h.payment.captures[0].id = 'invalid'; const invalid = h.receipt(), queries = h.store.queries.length
  await assert.rejects(h.consume()); assert.equal(h.receipt(), invalid); assert.deepEqual(h.acks, [saved])
  assert.ok(h.store.queries.slice(queries).every(q => !q.sql.startsWith('INSERT')))
})
for (const failure of ['insert', 'readback']) test(`actual handler ACK ${failure} failure rejects queue return and retry revalidates`, async () => {
  const h = setup(); await h.run(); const before = h.receipt(); h.failAck = failure
  await assert.rejects(h.consume(), /storage failed/)
  // Autocommit INSERT can already persist before readback fails: no SUCCESS
  // acknowledgement is returned, but deleting its durable row would be unsafe.
  assert.equal(h.acks.length, failure === 'insert' ? 0 : 1)
  assert.equal(h.receipt(), before); assert.equal(h.held.size, 0)
  await h.consume(); assert.equal(h.acks.length, 1); assert.equal(h.receipt(), before)
  assert.equal(h.rootLookups, 2)
})
for (const mode of ['missing', 'wrong', 'duplicate']) test(`actual handler requires exact ACK readback: ${mode}`, async () => {
  const h = setup(); await h.run(); h.readback = mode; const before = h.receipt()
  await assert.rejects(h.consume()); assert.equal(h.receipt(), before)
  assert.equal(h.acks.length, 1, 'insert is not successful readback/queue return')
})
for (const [label, mutate] of [
  ['lock loss', h => h.clients.at(-1).emit('end')],
  ['snapshot mutation', h => { h.store.row.snapshot.intent_id = 'changed' }],
  ['completion removed', h => { h.store.row.completed_at = null }]
]) test(`real private validator ${label} prevents ACK insertion`, async () => {
  const h = setup(); await h.run()
  const service = h.container.resolve(require('@medusajs/framework/utils').Modules.PAYMENT)
  const retrieve = service.retrievePaymentCollection
  service.retrievePaymentCollection = async (...args) => { const result = await retrieve(...args); mutate(h); return result }
  await assert.rejects(h.consume()); assert.equal(h.acks.length, 0)
  assert.equal(h.held.size, 0); assert.ok(h.clients.every(c => c.released))
})
test('root discovery finishes before actual handler acquires its only lock session', async () => {
  const h = setup(); await h.run(); const raw = h.knex.raw.bind(h.knex)
  h.knex.raw = (sql, values) => {
    if (sql === 'SELECT cart_id FROM marketplace_capture_tail WHERE payment_id = ?') {
      assert.equal(h.held.size, 0, 'no pool lookup while public handler owns cart session')
    }
    return raw(sql, values)
  }
  await h.consume(); assert.equal(h.rootLookups, 1); assert.equal(h.acks.length, 1)
})
test('subscriber source contains neither native capture workflow bypass nor legacy mark workflow', () => {
  for (const name of ['split-payment-payment-captured.ts', 'order-set-placed-payment-capture.ts']) {
    const s = fs.readFileSync(path.join(subdir, name), 'utf8')
    assert.ok(!s.includes('capturePaymentWorkflow')); assert.ok(!s.includes('markSplitOrderPaymentsAsCapturedWorkflow'))
  }
})
