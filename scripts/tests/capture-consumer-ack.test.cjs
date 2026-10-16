// OFFLINE contract tests: actual source, actual SWC migration emission, synthetic PG only.
// Reuse the established harness in memory; never edit/inject into its source fixture.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const root = path.resolve(__dirname, '../..')
const fixturePath = path.join(__dirname, 'commerce-capture-tail.test.cjs')
const source = fs.readFileSync(fixturePath, 'utf8').split("test('captured payment repairs")[0]
assert.ok(source.includes('function harness(') && !source.includes("test('"), 'established harness boundary must exist')
const fixture = new Module(fixturePath, module)
fixture.filename = fixturePath; fixture.paths = module.paths
fixture._compile(source + '\nmodule.exports = { harness, tail, lock };', fixturePath)
const { harness, lock } = fixture.exports
const utils = path.join(root, 'packages/modules/b2c-core/src/utils')
const ack = require(path.join(utils, 'marketplace-capture-ack.ts'))
const { acknowledgeMarketplaceCapture } = require(path.join(utils, 'marketplace-capture-subscriber.ts'))
const migrationPath = path.join(root, 'packages/modules/b2c-core/src/modules/marketplace/migrations/Migration20261006113000.ts')
const clone = x => structuredClone(x)
function setup(options = {}) {
  const h = harness(), raw = h.knex.raw.bind(h.knex)
  h.acks = []; h.ackSQL = []; h.failAck = null; h.readback = null
  h.knex.raw = (sql, values = []) => {
    if (sql === 'SELECT cart_id FROM marketplace_capture_tail WHERE payment_id = ?') {
      return Promise.resolve({ rows: h.store.row ? [{ cart_id: h.store.row.cart_id }] : [] })
    }
    if (!sql.includes('marketplace_capture_consumer_ack')) return raw(sql, values)
    return { connection: async c => {
      assert.ok(h.held.has(c.keys?.[0]), 'ACK uses the physical lock session')
      h.ackSQL.push({ sql, values, c })
      if (h.failAck === 'insert' && sql.startsWith('INSERT')) { h.failAck = null; throw Error('synthetic ACK insert failure') }
      if (h.failAck === 'readback' && sql.startsWith('SELECT')) { h.failAck = null; throw Error('synthetic ACK readback failure') }
      if (sql.startsWith('INSERT')) {
        assert.match(sql, /ON CONFLICT \(payment_id\) DO NOTHING/)
        if (!h.acks.length) h.acks.push(Object.fromEntries(['payment_id', 'cart_id', 'capture_id', 'event_id', 'snapshot_sha256', 'subscriber_id', 'protocol_version', 'acked_at'].map((key, i) => [key, i === 7 ? '2026-10-06T00:00:00Z' : values[i]])))
        if (h.loseAfterInsert) c.emit('end')
        return { rows: [] }
      }
      assert.match(sql, /^SELECT \* FROM marketplace_capture_consumer_ack WHERE payment_id = \?$/)
      if (h.readback === 'missing') return { rows: [] }
      if (h.readback === 'duplicate') return { rows: clone([...h.acks, ...h.acks]) }
      const rows = clone(h.acks)
      if (h.readback === 'wrong') rows[0].snapshot_sha256 = '0'.repeat(64)
      return { rows }
    } }
  }
  h.event = () => ({ data: { id: h.payment.id }, metadata: { marketplace_capture_event_id: h.store.row.event_id, marketplace_capture_id: h.store.row.capture_id } })
  h.validationRuns = 0
  const consume = ack.createMarketplaceCaptureAckConsumer({
    subscriberId: ack.MARKETPLACE_CAPTURE_ACK_SUBSCRIBER,
    validateUnderLock: async (container, event) => {
      h.validationRuns++
      // Contract-only adapter: the public tagged path now owns its own ACK
      // factory. Invoke ONLY its untagged, completed native-ledger validation
      // branch, on a local clone. The outer kernel retains and binds the ORIGINAL
      // tagged event before/after validation. Actual tagged dispatch is covered
      // separately by commerce-capture-subscriber.test.cjs, not by this adapter.
      const original = clone(event), validationEvent = clone(event)
      delete validationEvent.metadata
      const ackSQLBefore = h.ackSQL.length, receiptsBefore = clone(h.acks)
      await acknowledgeMarketplaceCapture(container, validationEvent)
      assert.deepEqual(event, original, 'validation adapter must preserve original tagged identities')
      assert.equal(h.ackSQL.length, ackSQLBefore, 'untagged validation must not execute ACK SQL')
      assert.deepEqual(h.acks, receiptsBefore, 'validation must not issue or change receipts')
      if (options.afterValidation) options.afterValidation(h)
    }
  })
  h.consume = event => lock.withCommerceCartLock(h.container, 'cart', () => consume(h.container, 'cart', event || h.event()))
  h.consumeUnlocked = event => consume(h.container, 'cart', event || h.event())
  h.financial = () => JSON.stringify({ payment: h.payment, collection: h.collection, order: h.order, row: h.store.row, transactions: h.store.transactions, summaries: h.store.summaries, splitCalls: h.store.splitCalls, apiCalls: h.store.apiCalls, providerCalls: h.store.providerCalls, jobs: [...h.store.jobs] })
  return h
}
for (const [label, mutate] of [
  ['capture', () => {}],
  ['partial refund', h => { h.payment.refunds = [{ id: 'refund', payment_id: 'pay', amount: '1.23' }]; h.collection.refunded_amount = '1.23'; Object.assign(h.order.split_order_payment, { refunded_amount: '1.23', status: 'partially_refunded' }) }],
  ['canceled', h => { h.payment.canceled_at = 'later'; h.order.split_order_payment.status = 'canceled' }],
  ['full refund', h => { h.payment.refunds = [{ id: 'refund', payment_id: 'pay', amount: '12.34' }]; h.collection.refunded_amount = '12.34'; Object.assign(h.order.split_order_payment, { refunded_amount: '12.34', status: 'refunded' }) }]
]) test(`validated ${label}: immutable receipt, duplicate revalidates and no financial writes`, async () => {
  const h = setup(); await h.run(); mutate(h)
  const before = h.financial(), start = h.store.queries.length
  const first = await h.consume(), second = await h.consume()
  assert.deepEqual(first, second); assert.equal(h.acks.length, 1); assert.equal(h.validationRuns, 2)
  assert.equal(h.ackSQL.filter(q => q.sql.startsWith('INSERT')).length, 2, 'duplicate validates before idempotent INSERT')
  assert.equal(h.ackSQL.filter(q => q.sql.startsWith('SELECT')).length, 2, 'each acceptance requires ACK readback')
  assert.equal(h.financial(), before); assert.ok(Object.isFrozen(first))
  assert.equal(first.subscriber_id, 'split-payment-payment-captured-handler'); assert.equal(first.protocol_version, 1)
  assert.equal(first.snapshot_sha256, h.store.row.event_id.slice('marketplace-captured-'.length))
  assert.ok(h.store.queries.slice(start).every(q => !/^(INSERT|UPDATE|DELETE|TRUNCATE)/.test(q.sql)))
  assert.equal(h.held.size, 0); assert.ok(h.clients.every(c => c.released))
})
test('enqueue/completed is not consumer ACK; diagnostic absence stays null', async () => {
  const h = setup(); await h.run(); assert.ok(h.store.row.completed_at); assert.equal(h.acks.length, 0)
  const value = await lock.withCommerceCartLock(h.container, 'cart', () => ack.readMarketplaceCaptureAckUnderLock(h.container, 'cart', 'pay'))
  assert.equal(value, null); assert.equal(h.validationRuns, 0)
})
for (const [label, mutate] of [
  ['untagged', (h,e) => { delete e.metadata }],
  ['wrong event', (h,e) => { e.metadata.marketplace_capture_event_id = 'other' }],
  ['wrong capture', (h,e) => { e.metadata.marketplace_capture_id = 'other' }],
  ['wrong payment', (h,e) => { e.data.id = 'other' }],
  ['wrong named event', (h,e) => { e.name = 'payment.authorized' }],
  ['wrong snapshot', h => { h.store.row.snapshot.intent_id = 'other' }],
  ['pending accounting', h => { h.store.row.accounting_at = null }],
  ['pending enqueue', h => { h.store.row.event_enqueued_at = null }],
  ['pending completed', h => { h.store.row.completed_at = null }],
  ['missing capture', h => { h.store.row.capture_id = null }],
  ['wrong native capture', h => { h.payment.captures[0].id = 'other' }],
  ['wrong current refund', h => { h.collection.refunded_amount = '1' }]
]) test(`fail closed without receipt: ${label}`, async () => {
  const h = setup(); await h.run(); const e = h.event(); mutate(h,e)
  const before = h.financial(); await assert.rejects(h.consume(e)); assert.equal(h.acks.length, 0); assert.equal(h.financial(), before)
})
test('factory rejects subscriber mismatch and externally supplied validation boolean', () => {
  assert.throws(() => ack.createMarketplaceCaptureAckConsumer({ subscriberId: 'other', validateUnderLock: async () => {} }))
  assert.throws(() => ack.createMarketplaceCaptureAckConsumer({ subscriberId: ack.MARKETPLACE_CAPTURE_ACK_SUBSCRIBER, validateUnderLock: true }))
  const { config } = require(path.join(root, 'packages/modules/b2c-core/src/subscribers/split-payment-payment-captured.ts'))
  assert.equal(config.context.subscriberId, ack.MARKETPLACE_CAPTURE_ACK_SUBSCRIBER, 'bind actual subscriber configuration')
})
test('validator rejection or fabricated success value cannot issue receipt', async () => {
  for (const validateUnderLock of [async () => { throw Error('current validation rejected') }, async () => true]) {
    const h = setup(); await h.run()
    const consume = ack.createMarketplaceCaptureAckConsumer({ subscriberId: ack.MARKETPLACE_CAPTURE_ACK_SUBSCRIBER, validateUnderLock })
    await assert.rejects(lock.withCommerceCartLock(h.container, 'cart', () => consume(h.container, 'cart', h.event())))
    assert.equal(h.acks.length, 0)
  }
})
test('no live cart capability, wrong container/cart or ambient transaction cannot write', async () => {
  const h = setup(); await h.run(); await assert.rejects(h.consumeUnlocked())
  await lock.withCommerceCartLock(h.container, 'cart', async () => {
    await assert.rejects(ack.readMarketplaceCaptureAckUnderLock({}, 'cart', 'pay'))
    await assert.rejects(ack.readMarketplaceCaptureAckUnderLock(h.container, 'other', 'pay'))
  })
  h.knex.isTransaction = true; await assert.rejects(h.consume()); assert.equal(h.acks.length, 0)
})
test('busy lock fails fast without validation or receipt', async () => {
  const h = setup(); await h.run(); let ready, finish
  const entered = new Promise(r => { ready = r }), done = new Promise(r => { finish = r })
  const owner = lock.withCommerceCartLock(h.container, 'cart', async () => { ready(); await done })
  await entered; try { await assert.rejects(h.consume(), /busy/); assert.equal(h.validationRuns, 0); assert.equal(h.acks.length, 0) } finally { finish(); await owner }
})
for (const [label, afterValidation] of [
  ['validation lock loss', h => h.clients.at(-1).emit('end')],
  ['snapshot changes during validation', h => { h.store.row.snapshot.intent_id = 'changed' }],
  ['completion changes during validation', h => { h.store.row.completed_at = null }]
]) test(`${label} denies insertion`, async () => {
  const h = setup({ afterValidation }); await h.run(); await assert.rejects(h.consume()); assert.equal(h.acks.length, 0)
  assert.equal(h.held.size, 0)
})
for (const failure of ['insert', 'readback']) test(`ACK ${failure} failure propagates; retry validates durable synthetic row`, async () => {
  const h = setup(); await h.run(); const before = h.financial(); h.failAck = failure
  await assert.rejects(h.consume(), /storage failed/)
  assert.equal(h.acks.length, failure === 'insert' ? 0 : 1)
  await h.consume(); assert.equal(h.acks.length, 1); assert.equal(h.validationRuns, 2); assert.equal(h.financial(), before)
  // A SQL error revokes the real capability. Healthy unlock/release can retain
  // the socket; only physical loss/uncertain unlock requires destruction.
  assert.ok(h.clients.every(c => c.released)); assert.equal(h.held.size, 0)
})
for (const mode of ['missing', 'wrong', 'duplicate']) test(`mandatory readback rejects ${mode}`, async () => {
  const h = setup(); await h.run(); h.readback = mode; await assert.rejects(h.consume()); assert.equal(h.acks.length, 1)
})
test('physical loss after insert denies successful return; replay retains one synthetic receipt', async () => {
  const h = setup(); await h.run(); h.loseAfterInsert = true
  await assert.rejects(h.consume(), /lock/); assert.equal(h.acks.length, 1)
  assert.ok(h.clients.at(-1).destroyed); assert.equal(h.held.size, 0)
  h.loseAfterInsert = false; await h.consume(); assert.equal(h.acks.length, 1); assert.equal(h.validationRuns, 2)
})
for (const field of ['capture_id', 'event_id', 'snapshot_sha256', 'subscriber_id', 'protocol_version', 'cart_id', 'acked_at']) test(`existing conflicting receipt never accepted: ${field}`, async () => {
  const h = setup(); await h.run(); await h.consume(); h.acks[0][field] = field === 'protocol_version' ? 2 : field === 'acked_at' ? null : 'other'
  await assert.rejects(h.consume()); assert.equal(h.acks.length, 1); assert.equal(h.validationRuns, 2)
})
test('crash after receipt before queue return: retry still validates before idempotent acceptance', async () => {
  const h = setup(); await h.run()
  await assert.rejects((async () => { await h.consume(); throw Error('synthetic worker crash before queue return') })())
  assert.equal(h.acks.length, 1); await h.consume(); assert.equal(h.validationRuns, 2); assert.equal(h.acks.length, 1)
  h.payment.captures[0].id = 'other'; await assert.rejects(h.consume()); assert.equal(h.acks.length, 1)
})
test('diagnostic read requires exact identity but is never financial closure', async () => {
  const h = setup(); await h.run(); const saved = await h.consume()
  const read = () => lock.withCommerceCartLock(h.container, 'cart', () => ack.readMarketplaceCaptureAckUnderLock(h.container, 'cart', 'pay'))
  assert.deepEqual(await read(), saved)
  h.collection.refunded_amount = '1' // identity read is not current financial validation
  assert.deepEqual(await read(), saved); await assert.rejects(h.consume())
  h.acks[0].subscriber_id = 'other'; await assert.rejects(read())
})
test('actual emitted migration: append-only ALWAYS guards, tail FK/ready binding, uniqueness, zero backfill', async () => {
  const { Migration20261006113000: Migration } = require(migrationPath)
  const m = Object.create(Migration.prototype), statements = []; m.addSql = sql => statements.push(sql)
  await m.up(); const ddl = statements.join('\n')
  assert.match(ddl, /CREATE TABLE marketplace_capture_consumer_ack/)
  assert.match(ddl, /payment_id text PRIMARY KEY/)
  assert.match(ddl, /FOREIGN KEY \(payment_id, cart_id, capture_id, event_id\)[\s\S]*REFERENCES marketplace_capture_tail \(payment_id, cart_id, capture_id, event_id\)/)
  assert.match(ddl, /UNIQUE \(payment_id, cart_id, capture_id, event_id\)/)
  assert.match(ddl, /ON DELETE RESTRICT ON UPDATE RESTRICT/)
  assert.match(ddl, /event_id = 'marketplace-captured-' \|\| snapshot_sha256/)
  assert.match(ddl, /subscriber_id = 'split-payment-payment-captured-handler'/)
  assert.match(ddl, /protocol_version = 1/)
  assert.match(ddl, /BEFORE UPDATE OR DELETE/); assert.match(ddl, /BEFORE TRUNCATE/)
  assert.match(ddl, /FOR EACH STATEMENT EXECUTE FUNCTION marketplace_capture_ack_immutable/)
  assert.match(ddl, /RAISE EXCEPTION 'marketplace capture ACK is append-only'/)
  for (const guard of ['marketplace_capture_ack_immutable_row', 'marketplace_capture_ack_immutable_truncate', 'marketplace_capture_ack_insert']) assert.match(ddl, new RegExp(`ENABLE ALWAYS TRIGGER ${guard}`))
  for (const marker of ['accounting_at', 'event_enqueued_at', 'completed_at']) assert.match(ddl, new RegExp(`t\\.${marker} IS NOT NULL`))
  assert.match(ddl, /pg_catalog\.sha256\(convert_to\(canonical, 'UTF8'\)\)/)
  assert.match(ddl, /marketplace_capture_ack_canonical\(tail.snapshot\)/)
  assert.match(ddl, /FOR SHARE/)
  assert.match(ddl, /COLLATE "C"/)
  assert.match(ddl, /9007199254740991/)
  assert.match(ddl, /allocations must be nonempty/)
  assert.match(ddl, /tail.completed_at <= NEW.acked_at/)
  assert.match(ddl, /NEW.acked_at <= clock_timestamp\(\)/)
  assert.ok(!/CREATE EXTENSION/i.test(ddl))
  assert.ok(!/INSERT INTO|UPDATE marketplace_capture_tail SET|DROP TABLE/i.test(ddl), 'migration cannot manufacture/backfill receipts')
  statements.length = 0; await m.down(); const down = statements.join('\n')
  assert.match(down, /IF EXISTS \(SELECT 1 FROM marketplace_capture_consumer_ack\)/)
  assert.match(down, /RAISE EXCEPTION 'refusing rollback with durable capture ACK evidence'/)
  assert.ok(down.indexOf('RAISE EXCEPTION') < down.indexOf('DROP TABLE'))
  assert.ok(!/CASCADE/i.test(down))
  const sha256 = text => require('node:crypto').createHash('sha256').update(text).digest('hex')
  console.log(`actual_migration_up_sha256=${sha256(ddl)}`)
  console.log(`actual_migration_down_sha256=${sha256(down)}`)
})
