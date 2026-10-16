'use strict'
// Offline source execution. Real installed Medusa decorators/repositories below;
// only connections/EM/provider transport are synthetic, with explicit fault injection.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const { EventEmitter } = require('node:events')
const { test, before, after } = require('node:test')
const swc = require('@swc/core')
const root = path.resolve(__dirname, '../..')
Module._extensions['.ts'] = (m, f) => {
  m.paths = [...module.paths, ...m.paths]
  m._compile(swc.transformSync(fs.readFileSync(f, 'utf8'), { filename: f,
    jsc: { parser: { syntax: 'typescript', decorators: true }, target: 'es2022',
      transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' } }).code, f)
}
const source = name => require(path.join(root, 'packages/modules/b2c-core/src', name))
const { createPostgresSettlementStore } = source('utils/refund-settlement-store.ts')
const { executeSettlement } = source('utils/refund-settlement.ts')
const { withCommerceCartLock, assertCommerceFinancialLock } = source('utils/commerce-cart-lock.ts')
// Standalone engine tests have no marketplace mapper. Acquire real source ALS
// using local fake root Knex/session transport, not an import/guard stub.
function withLocalCart(work) {
  const connection = new EventEmitter()
  const knex = { client: { acquireConnection: async () => connection,
    releaseConnection: async () => {}, destroyRawConnection: async () => {} },
    raw(sql) { return { connection: async c => {
      assert.equal(c, connection)
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] }
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: true }] }
      if (sql.startsWith('SET SESSION')) return { rows: [] }
      assert.fail(`Unexpected cart SQL: ${sql}`)
    } } } }
  return withCommerceCartLock({ resolve: () => knex }, 'standalone-cart', async () => {
    assertCommerceFinancialLock()
    return work()
  })
}
const input = { operation_id: 'operation', order_id: 'order', scope_id: 'scope', fingerprint: 'fixed' }
const plan = { ...input, payment_id: 'payment', split_order_payment_id: 'split', payout_id: 'payout',
  currency_code: 'eur', customerRefund: 1, sellerReversal: 1 }
test('standalone initial refund requires real cart authority, not a supplied check', async () => {
  const callbacks = [], writes = []
  const store = { withScopeLock: (_, work) => work({
    getOperation: async () => null, findUnfinished: async () => null,
    create: async () => { writes.push('create') }, transition: async (_, _before, next) => { writes.push(next) },
  }) }
  const effects = { assertActive: () => {}, plan: async () => ({ ...plan, sellerReversal: 0, payout_id: null }),
    refund: async () => { callbacks.push('refund'); assertCommerceFinancialLock() },
    reverse: async () => { callbacks.push('reverse') } }
  await assert.rejects(executeSettlement(store, input, effects), /reconciliation_required/)
  assert.deepEqual(callbacks, []); assert.deepEqual(writes, ['create', 'refund_started'])
  writes.length = 0
  const result = await withLocalCart(() => executeSettlement(store, input, effects))
  assert.equal(result.receipt.phase, 'completed'); assert.deepEqual(callbacks, ['refund'])
  assert.deepEqual(writes, ['create', 'refund_started', 'refund_completed', 'completed'])
  assert.throws(assertCommerceFinancialLock, /lock.*not held/i)
})
function pg(loseAt, event = 'end', owner = 'scope') {
  const h = { writes: [], effects: [], statements: [], alive: true, destroyed: 0, reads: 0 }
  h.connection = new EventEmitter()
  h.check = () => { if (!h.alive) throw new Error('cart owner lost') }
  h.lose = () => { h.lost = true; if (owner === 'cart') h.alive = false; else h.connection.emit(event, new Error('synthetic loss')) }
  h.knex = { client: {
    acquireConnection: async () => { if (loseAt === 'acquire') h.alive = false; return h.connection },
    releaseConnection: async () => {}, destroyRawConnection: async () => { h.destroyed++ },
  }, raw(sql) { return { connection: async connection => {
    assert.equal(connection, h.connection); h.statements.push(sql)
    await Promise.resolve()
    if (sql.startsWith('INSERT') || sql.startsWith('UPDATE')) h.writes.push(sql)
    let boundary = sql.includes('pg_try_advisory_lock') ? 'lock' : sql.startsWith('SET ') ? 'sync' :
      sql.startsWith('SELECT operation_id') ? `read${++h.reads}` : sql.startsWith('INSERT') ? 'create' : sql.startsWith('UPDATE') ? 'transition' : 'unlock'
    if (boundary === loseAt) h.lose()
    return boundary === 'lock' ? { rows: [{ locked: true }] } : boundary === 'unlock' ? { rows: [{ unlocked: true }] } : { rows: [], rowCount: 1 }
  } } } }
  h.run = () => withLocalCart(() => executeSettlement(createPostgresSettlementStore(h.knex, h.check), input, {
    assertActive: h.check, plan: async () => { h.effects.push('plan'); return plan },
    refund: async () => { h.effects.push('refund') }, reverse: async () => { h.effects.push('reverse'); return {} },
  }))
  return h
}
for (const event of ['error', 'end']) for (const boundary of ['lock', 'sync', 'read1', 'read2']) {
  test(`scope ${event} during ${boundary} irreversibly prevents callbacks and SQL writes`, async () => {
    const h = pg(boundary, event)
    await assert.rejects(h.run()); assert.equal(h.lost, true)
    assert.deepEqual(h.effects, []); assert.deepEqual(h.writes, []); assert.equal(h.destroyed, 1)
  })
}
for (const boundary of ['acquire', 'lock', 'sync', 'read1', 'read2']) test(`cart loss during ${boundary} prevents callbacks and SQL writes`, async () => {
  const h = pg(boundary, 'end', 'cart')
  await assert.rejects(h.run()); assert.deepEqual(h.effects, []); assert.deepEqual(h.writes, [])
})
test('scope lost during durable started transition never dispatches refund or later write', async () => {
  const h = pg('transition'); await assert.rejects(h.run())
  assert.deepEqual(h.effects, ['plan']); assert.equal(h.writes.length, 2)
})
for (const boundary of ['get', 'unfinished', 'plan', 'create', 'transition', 'refund', 'recover']) {
  test(`engine checks synthetic live session after ${boundary} await`, async () => {
    let alive = true, writes = [], effects = []
    const check = () => { if (!alive) throw new Error('scope lost') }
    const wait = async name => { await Promise.resolve(); if (boundary === name) alive = false }
    const saved = boundary === 'recover' ? { input, plan, phase: 'reversal_started', reversal_receipt_id: null } : null
    const session = { assertActive: check,
      getOperation: async () => { await wait('get'); return saved },
      findUnfinished: async () => { await wait('unfinished'); return null },
      create: async () => { writes.push('create'); await wait('create') },
      transition: async () => { writes.push('transition'); await wait('transition') },
    }
    await assert.rejects(withLocalCart(() => executeSettlement({ withScopeLock: (_, work) => work(session) }, input, {
      plan: async () => { effects.push('plan'); await wait('plan'); return plan },
      refund: async () => { effects.push('refund'); await wait('refund') },
      reverse: async () => { effects.push('reverse'); return {} },
      recoverReversal: async () => { effects.push('recover'); await wait('recover'); return {
        operation_id: input.operation_id, payout_id: plan.payout_id, currency_code: 'eur', amount: 1, receipt_id: 'receipt' } },
    })))
    assert.equal(alive, false, 'injected awaited boundary reached')
    assert.equal(effects.includes('reverse'), false)
    if (['get', 'unfinished'].includes(boundary)) { assert.deepEqual(effects, []); assert.deepEqual(writes, []) }
    if (boundary === 'plan') assert.deepEqual(writes, [])
    if (boundary === 'create') { assert.deepEqual(writes, ['create']); assert.deepEqual(effects, ['plan']) }
    if (boundary === 'transition') { assert.deepEqual(writes, ['create', 'transition']); assert.deepEqual(effects, ['plan']) }
    if (boundary === 'refund') { assert.deepEqual(writes, ['create', 'transition']); assert.deepEqual(effects, ['plan', 'refund']) }
    if (boundary === 'recover') assert.deepEqual(writes, [])
  })
}
// Native payout module, REAL generated internal services and base repositories.
const utils = require('@medusajs/framework/utils')
assert.equal(require('@medusajs/order/package.json').version, '2.11.3')
const PayoutService = source('modules/payout/service.ts').default
const models = source('modules/payout/models/index.ts')
const { withRefundEffectFence, checkRefundEffectFence } = source('utils/refund-effect-fence.ts')
let orm
before(async () => {
  const { MikroORM } = require('@medusajs/framework/mikro-orm/postgresql')
  orm = await MikroORM.init({ entities: utils.toMikroOrmEntities(Object.values(models)),
    dbName: 'offline_never_connect', connect: false, discovery: { disableDynamicFileAccess: true }, metadataCache: { enabled: false } })
  assert.equal(await orm.isConnected(), false)
})
after(async () => { if (orm) await orm.close() })
function nativePayout(loseAt, owner = 'scope') {
  const h = pg(undefined)
  h.nativeWrites = []; h.dispatches = []; h.events = []; h.transactions = 0; h.rows = []; h.transactionManagers = []
  h.boundary = async name => { h.events.push(name); await Promise.resolve(); if (loseAt === name) {
    if (owner === 'cart') h.alive = false; else h.connection.emit('end')
    h.nativeLost = name
  } }
  class Events {
    #subscribers = []
    registerSubscriber(s) { this.#subscribers.push(s) }
    async dispatchEvent(name) { for (const s of this.#subscribers) await s[name]?.({}) }
    get subscribers() { return this.#subscribers }
  }
  class EM {
    #events = new Events()
    getEventManager() { return this.#events }
    fork() { return new EM() }
    async transactional(task) {
      const tx = this.fork(); h.transactions++; h.transactionManagers.push(tx)
      await h.boundary('transaction-acquisition')
      const result = await task(tx)
      await h.boundary('implicit-flush'); await tx.flush(); return result
    }
    async findOne() { this.#events; await h.boundary('retrieve'); return { id: 'payout', amount: 10,
      currency_code: 'eur', data: { id: 'transfer' } } }
    async find(entity, filter, config) {
      this.#events
      if ((typeof entity === 'string' ? entity : entity.name) === 'Payout') {
        await h.boundary('retrieve'); return [{ id: 'payout', amount: 10, currency_code: 'eur', data: { id: 'transfer' } }]
      }
      await h.boundary(`page${config?.offset ? 2 : 1}`)
      return config?.offset ? [] : Array.from({ length: 100 }, (_, i) => ({ id: `old${i}`, data: {} }))
    }
    create(_entity, data) { this.#events; h.nativeWrites.push('create'); h.rows.push(data); return data }
    persist() { this.#events; h.nativeWrites.push('persist'); return this }
    async flush() { await this.#events.dispatchEvent('beforeFlush'); h.nativeWrites.push('flush') }
  }
  h.manager = new EM()
  const Base = utils.mikroOrmBaseRepositoryFactory(models.Payout)
  const base = new Base({ manager: h.manager })
  // DTO serialization is an explicit offline collaborator, not a persistence stub.
  base.serialize = async value => value
  const container = { baseRepository: base, payoutProvider: {
    reversePayout: async data => { h.dispatches.push(data); await h.boundary('provider'); return {
      id: 'receipt', transfer: data.transfer_id, amount: 100, currency: 'eur' } },
  } }
  for (const [name, model] of Object.entries(models)) {
    const Repository = utils.mikroOrmBaseRepositoryFactory(model), Internal = utils.MedusaInternalService(model)
    const key = name[0].toLowerCase() + name.slice(1)
    container[`${key}Service`] = new Internal({ [`${key}Repository`]: new Repository({ manager: h.manager }) })
  }
  h.service = new PayoutService(container)
  h.run = () => createPostgresSettlementStore(h.knex, h.check).withScopeLock('scope', session =>
    withRefundEffectFence(() => { session.assertActive(); h.check() }, () => h.service.createPayoutReversal({
      payout_id: 'payout', operation_id: 'operation', amount: 1, currency_code: 'eur' })))
  return h
}
for (const owner of ['scope', 'cart']) for (const boundary of ['transaction-acquisition', 'retrieve', 'page1', 'page2']) {
  test(`native reversal ${owner} loss at ${boundary}: zero provider dispatch/repository writes`, async () => {
    const h = nativePayout(boundary, owner); await assert.rejects(h.run())
    assert.equal(h.nativeLost, boundary); assert.deepEqual(h.dispatches, []); assert.deepEqual(h.nativeWrites, [])
  })
}
for (const owner of ['scope', 'cart']) test(`native reversal ${owner} loss during provider: no subsequent persistence`, async () => {
  const h = nativePayout('provider', owner); await assert.rejects(h.run())
  assert.equal(h.dispatches.length, 1); assert.deepEqual(h.nativeWrites, [])
})
test('native reversal live owners retain genuine private EM, native transactions and event subscriber', async () => {
  const h = nativePayout(); const keys = Reflect.ownKeys(h.service)
  const row = await h.run(); assert.equal(row.id, 'receipt'); assert.equal(h.dispatches.length, 1)
  assert.deepEqual(h.nativeWrites, ['create', 'persist', 'flush'])
  assert.equal(h.transactions, 1); assert.deepEqual(Reflect.ownKeys(h.service), keys)
  assert.ok(h.transactionManagers[0].getEventManager().subscribers.length >= 2, 'native original subscriber and local flush fence coexist')
  assert.equal(h.manager.getEventManager().subscribers.length, 0)
})
test('native own reversal entry rejects forged context before transaction acquisition', async () => {
  const h = nativePayout(); await assert.rejects(h.service.createPayoutReversal({
    payout_id: 'payout', operation_id: 'operation', amount: 1, currency_code: 'eur' }, { active: true, refundEffectFence: () => {} }))
  assert.equal(h.transactions, 0); assert.deepEqual(h.dispatches, []); assert.deepEqual(h.nativeWrites, [])
})
test('unrelated generated createPayouts remains usable without refund/cart authority', async () => {
  const h = nativePayout(); const row = await h.service.createPayouts({ id: 'ordinary', amount: 1,
    currency_code: 'eur', data: {}, payout_account: 'account' })
  assert.equal(row.id, 'ordinary'); assert.ok(h.nativeWrites.includes('create'))
})
test('direct generated reversal persistence checks transaction acquisition before create', async () => {
  const h = nativePayout('transaction-acquisition')
  await assert.rejects(createPostgresSettlementStore(h.knex).withScopeLock('scope', session =>
    withRefundEffectFence(() => session.assertActive(), () => h.service.createPayoutReversals({
      id: 'receipt', payout: 'payout', amount: 1, currency_code: 'eur', data: {} }))))
  assert.equal(h.nativeLost, 'transaction-acquisition'); assert.deepEqual(h.nativeWrites, [])
})
test('native implicit flush loss blocks flush without pretending to undo staged writes', async () => {
  const h = nativePayout('implicit-flush'); await assert.rejects(h.run())
  assert.deepEqual(h.nativeWrites, ['create', 'persist']); assert.equal(h.dispatches.length, 1)
})
test('captured native authority cannot be reused by another live invocation', async () => {
  const { captureRefundEffectFence } = source('utils/refund-effect-fence.ts')
  let stale
  await withRefundEffectFence(() => {}, async () => { stale = captureRefundEffectFence() })
  await withRefundEffectFence(() => {}, async () => { assert.throws(stale, /mismatch/) })
})
test('refund invocation authority is private, revoked after exit, and ignores supplied context', async () => {
  const { withRefundEffectFence, checkRefundEffectFence } = source('utils/refund-effect-fence.ts')
  assert.throws(() => checkRefundEffectFence({ active: true }))
  let escaped
  await withRefundEffectFence(() => {}, async () => {
    checkRefundEffectFence(); escaped = new Promise(resolve => { setImmediate(() => resolve(() => checkRefundEffectFence())) })
  })
  assert.throws(await escaped)
})
