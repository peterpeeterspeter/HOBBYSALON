'use strict'
// OFFLINE installed Medusa/MikroORM regression. Synthetic entities/adapters only;
// ORM connect:false, real lock capability/decorators/native creation/accounting.
// Run in the pinned image with read-only source mounts and --network none.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { test, before, after } = require('node:test')
const swc = require('@swc/core')
const Native = require('@medusajs/payment').default
const utils = require('@medusajs/framework/utils')
const { Collection } = require('@medusajs/framework/mikro-orm/core')
const { MikroORM } = require('@medusajs/framework/mikro-orm/postgresql')
const { BigNumber, MathBN, PaymentSessionStatus } = utils
assert.equal(require('@medusajs/payment/package.json').version, '2.11.3')
assert.equal(Collection, require('@mikro-orm/core').Collection)
const root = path.resolve(__dirname, '../..')
const lockFile = path.join(root, 'packages/modules/b2c-core/src/utils/commerce-cart-lock.ts')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if(request === '@mercurjs/b2c-core/utils/commerce-financial-lock') request = path.join(root,'packages/modules/b2c-core/src/utils/commerce-financial-lock.ts')
  return originalResolve.call(this, request === '@mercurjs/b2c-core/utils/commerce-cart-lock' ? lockFile : request, ...args)
}
Module._extensions['.ts'] = (mod, filename) => {
  mod.paths = [...module.paths, ...mod.paths]
  mod._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'typescript', decorators: true }, target: 'es2021', transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' }
  }).code, filename)
}
const { withCommerceCartLock, commerceCartLockKey } = require(lockFile)
const Service = require(process.env.CAPTURE_SERVICE_SOURCE || path.join(root, 'apps/backend/src/modules/payment-capture-recovery/service.ts')).default
const models = require(path.join(path.dirname(require.resolve('@medusajs/payment')), 'models'))
const entities = utils.toMikroOrmEntities(Object.values(models))
const Payment = entities.find(entity => entity.name === 'Payment')
const Capture = entities.find(entity => entity.name === 'Capture')
let orm
before(async () => {
  orm = await MikroORM.init({ entities, dbName: 'offline_never_connect', connect: false, discovery: { disableDynamicFileAccess: true }, metadataCache: { enabled: false } })
  assert.equal(await orm.isConnected(), false)
})
after(async () => { if (orm) await orm.close() })
const intent = (status = 'succeeded') => ({ id: 'pi_orm_fixture', currency: 'eur', amount: 1234, amount_received: status === 'succeeded' ? 1234 : 0, amount_capturable: status === 'requires_capture' ? 1234 : 0, status })
const paymentLinkSQL = 'SELECT p.id AS payment_id,p.payment_collection_id,c.cart_id FROM payment p JOIN cart_payment_collection c ON c.payment_collection_id=p.payment_collection_id WHERE p.id=? AND p.deleted_at IS NULL AND c.deleted_at IS NULL'
function harness(options = {}) {
  const em = orm.em.fork()
  const payment = em.create(Payment, {
    id: 'pay_orm_fixture', payment_collection: 'paycol_orm_fixture', payment_session: 'payses_orm_fixture', provider_id: 'pp_fixture',
    amount: '12.34', currency_code: 'eur', captured_at: options.captured ? new Date() : null, canceled_at: null, data: intent(options.status)
  }, { persist: false })
  const rows = []
  const fullRow = (extra = {}) => em.create(Capture, { id: 'capt_orm_fixture', amount: '12.34', payment, ...extra }, { persist: false })
  for (const row of options.rows || []) { const entity = fullRow(row); rows.push(entity); payment.captures.add(entity) }
  if (options.shape) payment.captures = options.shape({ payment, em, fullRow })
  const originalCollection = payment.captures
  const service = Object.create(Service.prototype)
  const reads = [], dispatches = [], writes = [], accounting = [], transactions = [], nativeCalls = [], order = []
  const linkQueries = [], retrievals = [], quarantineQueries = []
  const cartId = options.lockCartId || 'cart_orm_fixture'
  const linkRows = Object.hasOwn(options, 'linkRows') ? options.linkRows
    : [{ payment_id: payment.id, payment_collection_id: payment.payment_collection_id, cart_id: 'cart_orm_fixture' }]
  let inTransaction = false
  let current = intent(options.status)
  let connection
  let failUpdate = !!options.failUpdate
  const knex = { client: {
    acquireConnection: async () => (connection = new EventEmitter()), releaseConnection: async () => {}, destroyRawConnection: async () => {}
  }, raw: (sql, bindings = []) => ({ connection: async actual => {
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
      if (options.loseOnLinkQuery) connection.emit('end')
      return { rows: linkRows }
    }
    const query = sql.replace(/\s+/g, ' ').trim()
    if (query === 'SELECT c.cart_id,pc.id AS scope_id,pc.currency_code FROM payment_collection pc JOIN cart_payment_collection c ON c.payment_collection_id=pc.id WHERE pc.id=? AND pc.deleted_at IS NULL AND c.deleted_at IS NULL') {
      assert.deepEqual(bindings, ['paycol_orm_fixture'])
      quarantineQueries.push('scope')
      return { rows: [{ cart_id: 'cart_orm_fixture', scope_id: 'paycol_orm_fixture', currency_code: 'eur' }] }
    }
    if (query === "SELECT operation_id,scope_id,phase,plan, to_jsonb(refund_settlement)->>'no_effect_receipt_id' AS no_effect_receipt_id FROM refund_settlement WHERE scope_id=? AND (phase <> 'completed' OR to_jsonb(refund_settlement)->>'no_effect_receipt_id' IS NOT NULL)" ||
        query === "SELECT * FROM commerce_refund_dispatch WHERE scope_id=? AND state = 'started'") {
      assert.deepEqual(bindings, ['paycol_orm_fixture'])
      quarantineQueries.push(query.includes('refund_settlement') ? 'settlements' : 'dispatches')
      return { rows: [] }
    }
    assert.fail(`Unrecognized offline SQL: ${sql}`)
  } }) }
  service.baseRepository_ = {
    getFreshManager: () => em,
    transaction: async fn => {
      const manager = em.fork(); transactions.push(manager); inTransaction = true; order.push('transaction-start')
      try { const result = await fn(manager); order.push('transaction-commit'); return result }
      finally { inTransaction = false }
    },
    serialize: value => utils.mikroOrmSerializer(value)
  }
  service.paymentService_ = {
    retrieve: async id => { retrievals.push(id); return payment },
    update: async data => {
      writes.push(data)
      if (failUpdate) { failUpdate = false; throw new Error('synthetic update failure') }
      Object.assign(payment, data); return payment
    }
  }
  service.captureService_ = {
    create: async (data, context) => {
      assert.ok(inTransaction)
      assert.equal(context.transactionManager, transactions.at(-1))
      assert.equal(data.payment, payment.id)
      assert.equal(rows.length, 0)
      const capture = fullRow({ amount: data.amount })
      rows.push(capture); payment.captures.add(capture); order.push('capture-create')
      return capture
    },
    delete: async () => { assert.fail('capture identity must never be deleted') }
  }
  service.capturePayment_ = async (input, entity, context) => {
    assert.equal(entity, payment, 'native capture receives the exact retrieved entity')
    assert.equal(entity.captures, originalCollection, 'normalization must not replace native relation')
    assert.ok(entity instanceof Payment)
    assert.ok(entity.captures instanceof Collection)
    nativeCalls.push(entity)
    return Native.service.prototype.capturePayment_.call(service, input, entity, context)
  }
  service.paymentProviderService_ = {
    getStatus: async (_, input) => { reads.push(input); return { data: { ...current } } },
    capturePayment: async (_, input) => {
      assert.equal(inTransaction, false, 'dispatch follows native committed creation')
      assert.equal(input.context.idempotency_key, rows[0].id)
      dispatches.push(input); order.push('provider-capture'); current = intent('succeeded'); return { data: { ...current } }
    }
  }
  service.paymentCollectionService_ = {
    retrieve: async () => ({ id: payment.payment_collection_id, amount: payment.amount, currency_code: payment.currency_code,
      payment_sessions: [{ status: PaymentSessionStatus.AUTHORIZED, amount: payment.amount }], payments: [payment] }),
    update: async data => { accounting.push(data); return data }
  }
  service.__container__ = { paymentService: service.paymentService_, captureService: service.captureService_ }
  return { payment, rows, fullRow, originalCollection, reads, dispatches, writes, accounting, transactions, nativeCalls, order, linkQueries, retrievals, quarantineQueries,
    run: (input = {}) => withCommerceCartLock({ resolve: () => knex }, cartId, () => service.capturePayment({ payment_id: payment.id, ...input }, { manager: em })) }
}
for (const captured of [false, true]) {
  test(`native retrieved identity mismatch fences link SQL and financial adapters (captured=${captured})`, async () => {
    const h = harness({ captured, rows: captured ? [{}] : [], status: 'requires_capture' })
    await assert.rejects(h.run({ payment_id: 'pay_other_fixture' }), /retrieved payment identity mismatch/)
    assert.deepEqual(h.retrievals, ['pay_other_fixture'])
    assert.equal(h.linkQueries.length, 0)
    assert.equal(h.reads.length, 0)
    assert.equal(h.nativeCalls.length, 0)
    assert.equal(h.dispatches.length, 0)
    assert.equal(h.writes.length, 0)
    assert.equal(h.accounting.length, 0)
    assert.equal(h.transactions.length, 0)
  })
  for (const [label, options] of [
    ['wrong lock cart despite caller cart', { lockCartId: 'cart_other_fixture' }],
    ['missing live link', { linkRows: [] }],
    ['ambiguous live links', { linkRows: [
      { payment_id: 'pay_orm_fixture', payment_collection_id: 'paycol_orm_fixture', cart_id: 'cart_orm_fixture' },
      { payment_id: 'pay_orm_fixture', payment_collection_id: 'paycol_orm_fixture', cart_id: 'cart_other_fixture' }
    ] }],
    ['wrong native collection', { linkRows: [{ payment_id: 'pay_orm_fixture', payment_collection_id: 'paycol_other_fixture', cart_id: 'cart_orm_fixture' }] }],
    ['lock loss during matching link query', { loseOnLinkQuery: true }]
  ]) test(`native payment link fences financial adapters: ${label} (captured=${captured})`, async () => {
    const h = harness({ captured, rows: captured ? [{}] : [], status: 'requires_capture', ...options })
    await assert.rejects(h.run({ cart_id: 'cart_orm_fixture' }), options.loseOnLinkQuery ? /lock.*not held|lock.*lost/i
      : /does not belong to the locked cart and collection/)
    assert.equal(h.linkQueries.length, 1)
    assert.ok(h.payment instanceof Payment)
    assert.equal(h.payment.captures, h.originalCollection)
    assert.equal(h.reads.length, 0)
    assert.equal(h.nativeCalls.length, 0)
    assert.equal(h.dispatches.length, 0)
    assert.equal(h.writes.length, 0)
    assert.equal(h.accounting.length, 0)
    assert.equal(h.transactions.length, 0)
    assert.equal(h.rows.length, captured ? 1 : 0)
  })
}
test('installed model has native Collection, numeric amount and exact JSON raw_amount/BigNumber roundtrip', async () => {
  const h = harness({ rows: [{}] })
  assert.ok(h.payment instanceof Payment)
  assert.ok(h.rows[0] instanceof Capture)
  assert.equal(Array.isArray(h.payment.captures), false)
  assert.ok(h.payment.captures instanceof Collection)
  assert.equal(h.payment.captures.isInitialized(true), true)
  assert.equal(typeof h.payment.captures.reduce, 'function')
  assert.equal(typeof h.payment.amount, 'number')
  assert.deepEqual(h.payment.raw_amount, { value: '12.34', precision: 20 })
  assert.equal(h.payment.payment_collection_id, 'paycol_orm_fixture', 'link validation uses the actual native relation identity')
  assert.deepEqual(h.rows[0].raw_amount, { value: '12.34', precision: 20 })
  assert.equal(h.rows[0].payment_id, h.payment.id)
  assert.ok(MathBN.eq(new BigNumber(h.payment.raw_amount), new BigNumber(h.payment.raw_amount.value)))
  const dto = await utils.mikroOrmSerializer(h.payment)
  assert.ok(Array.isArray(dto.captures))
  assert.deepEqual(dto.captures[0].raw_amount, h.rows[0].raw_amount)
})
test('succeeded provider with initialized empty native relation creates one full capture without redispatch', async () => {
  const h = harness()
  const result = await h.run()
  assert.equal(h.rows.length, 1)
  assert.equal(h.nativeCalls.length, 1)
  assert.equal(h.payment.captures, h.originalCollection)
  assert.equal(h.dispatches.length, 0)
  assert.ok(result.captured_at)
  assert.ok(Array.isArray(result.captures))
  assert.equal(result.captures[0].id, h.rows[0].id)
  assert.equal(h.accounting.at(-1).status, 'completed')
  assert.deepEqual(h.order, ['transaction-start', 'capture-create', 'transaction-commit'])
  assert.equal(h.linkQueries.length, 1)
  assert.deepEqual(h.quarantineQueries, ['scope', 'settlements', 'dispatches'])
})
test('authorized empty native relation commits before dispatch; full request unchanged', async () => {
  const h = harness({ status: 'requires_capture' })
  const input = { amount: { value: '12.340', precision: 20 } }
  const before = JSON.stringify(input)
  await h.run(input)
  assert.equal(JSON.stringify(input), before)
  assert.equal(h.nativeCalls.length, 1)
  assert.equal(h.dispatches.length, 1)
  assert.deepEqual(h.order, ['transaction-start', 'capture-create', 'transaction-commit', 'provider-capture'])
})
for (const status of ['requires_capture', 'succeeded']) test(`single full native capture reuses stable identity (${status})`, async () => {
  const h = harness({ rows: [{}], status })
  const originalRow = h.rows[0]
  await h.run(); await h.run()
  assert.equal(h.rows.length, 1)
  assert.equal(h.rows[0], originalRow)
  assert.equal(h.nativeCalls.length, 0)
  assert.equal(h.transactions.length, 0)
  assert.equal(h.dispatches.length, status === 'requires_capture' ? 1 : 0)
  if (h.dispatches.length) assert.equal(h.dispatches[0].context.idempotency_key, originalRow.id)
})
test('captured native payment repairs accounting without provider GET or creation', async () => {
  const h = harness({ captured: true, rows: [{}] })
  const result = await h.run()
  assert.ok(result.captured_at)
  assert.equal(h.reads.length, 0)
  assert.equal(h.nativeCalls.length, 0)
  assert.equal(h.accounting.at(-1).status, 'completed')
})
test('native reservation survives update failure; fresh succeeded retry reconciles without redispatch', async () => {
  const h = harness({ status: 'requires_capture', failUpdate: true })
  await assert.rejects(h.run(), /synthetic update failure/)
  assert.equal(h.rows.length, 1)
  const originalRow = h.rows[0]
  const result = await h.run()
  assert.equal(h.rows[0], originalRow)
  assert.equal(h.nativeCalls.length, 1)
  assert.equal(h.dispatches.length, 1)
  assert.ok(result.captured_at)
})
const dtoRow = extra => ({ id: 'capt_dto_fixture', payment_id: 'pay_orm_fixture', amount: 12.34, raw_amount: { value: '12.34', precision: 20 }, ...extra })
const invalidShapes = [
  ['uninitialized native relation', ({ payment }) => new Collection(payment, undefined, false)],
  ['uninitialized native member', ({ payment, em }) => new Collection(payment, [em.getReference(Capture, 'capt_reference_fixture')], true)],
  ['missing relation', () => undefined], ['null relation', () => null],
  ['duck typed collection', () => ({ isInitialized: () => true, getItems: () => [], reduce: Array.prototype.reduce })],
  ['malformed native items', ({ payment }) => { const c = new Collection(payment, [], true); c.getItems = () => null; return c }],
  ['two native rows', ({ payment, fullRow }) => new Collection(payment, [fullRow(), fullRow({ id: 'capt_other_fixture' })], true)],
  ['partial native row', ({ payment, fullRow }) => new Collection(payment, [fullRow({ amount: '6' })], true)],
  ['blank native identity', ({ payment, fullRow }) => new Collection(payment, [fullRow({ id: ' ' })], true)],
  ['wrong native payment', ({ payment, fullRow }) => new Collection(payment, [fullRow({ payment: 'pay_other_fixture' })], true)],
  ['null row', () => [null]], ['undefined row', () => [undefined]], ['sparse row', () => new Array(1)],
  ['primitive row', () => [false]], ['missing identity', () => [dtoRow({ id: undefined })]],
  ['wrong DTO payment', () => [dtoRow({ payment_id: 'pay_other_fixture' })]],
  ['missing raw amount', () => [dtoRow({ raw_amount: undefined })]],
  ['malformed raw amount', () => [dtoRow({ raw_amount: { value: {} } })]],
  ['inconsistent numeric amount', () => [dtoRow({ amount: 6 })]],
  ['partial raw amount', () => [dtoRow({ raw_amount: { value: '6', precision: 20 } })]]
]
for (const [label, shape] of invalidShapes) test(`fails closed before financial adapters: ${label}`, async () => {
  const h = harness({ shape })
  await assert.rejects(h.run())
  assert.equal(h.reads.length, 0)
  assert.equal(h.nativeCalls.length, 0)
  assert.equal(h.dispatches.length, 0)
  assert.equal(h.writes.length, 0)
  assert.equal(h.accounting.length, 0)
  assert.equal(h.transactions.length, 0)
})
test('captured native payment missing capture accounting fails closed', async () => {
  const h = harness({ captured: true })
  await assert.rejects(h.run(), /missing full capture accounting/)
  assert.equal(h.reads.length, 0)
  assert.equal(h.accounting.length, 0)
})
test('serialized DTO capture adapter remains compatible', async () => {
  const h = harness({ captured: true, shape: () => [dtoRow()] })
  const result = await h.run()
  assert.ok(result.captured_at)
  assert.equal(h.reads.length, 0)
  assert.equal(h.accounting.at(-1).status, 'completed')
})
