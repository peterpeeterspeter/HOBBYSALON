'use strict'
// OFFLINE: installed Medusa 2.11.3 classes/decorators/loaders; synthetic storage.
// Only the not-yet-integrated shared order-authority helper is stubbed. These
// cases verify the service's gate contract, not production SQL/DB correctness.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { AsyncLocalStorage } = require('node:async_hooks')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const swc = require('@swc/core')
const Native = require('@medusajs/order').default
const { createMedusaContainer, Modules, ModulesSdkUtils, toMikroOrmEntities } = require('@medusajs/framework/utils')
const { asValue } = require('@medusajs/framework/awilix')
assert.equal(require('@medusajs/order/package.json').version, '2.11.3')
const root = path.resolve(__dirname, '../..')
const base = path.join(root, 'apps/backend/src/modules/order-commerce-serialization')
const lockFile = path.join(root, 'packages/modules/b2c-core/src/utils/commerce-cart-lock.ts')
const oldTs = Module._extensions['.ts']
Module._extensions['.ts'] = (mod, filename) => {
  mod.paths = [...module.paths, ...mod.paths]
  mod._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'typescript', decorators: true }, target: 'es2022', transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' }
  }).code, filename)
}
const oldResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return oldResolve.call(this, request === '@mercurjs/b2c-core/utils/commerce-cart-lock' ? lockFile : request, ...args)
}
const { withCommerceCartLock, commerceCartLockKey, assertCommerceFinancialLock } = require(lockFile)
const fixtureScope = new AsyncLocalStorage()
const authority = {
  async assertCommerceOrderLock(id) {
    assertCommerceFinancialLock()
    const h = fixtureScope.getStore()
    h.events.push(`order-lock:${id}`)
    await h.boundary('order-lock')
    if (h.orders.get(id)?.cart !== h.cartId) throw new Error('Order does not belong to locked cart')
    // No post-await recheck here: service must recheck even a resolving helper.
  },
  async assertCommerceOrderCancellation(id) {
    assertCommerceFinancialLock()
    const h = fixtureScope.getStore()
    h.events.push(`settlement:${id}`)
    await h.boundary('settlement')
    if (h.options.helperFailure) throw new Error('authoritative ledger storage failed')
    const rows = h.settlements.filter(row => row.operation_id === `cancel:${id}` && row.order_id === id)
    const order = h.orders.get(id)
    const expectedScope = order.collection || `order:${id}`
    if (rows.length !== 1 || rows[0].phase !== 'completed' || rows[0].scope_id !== expectedScope) {
      throw new Error('Completed authoritative cancel settlement is required')
    }
  }
}
const oldLoad = Module._load
Module._load = function (request, ...args) {
  if (request === '@mercurjs/b2c-core/utils/commerce-financial-lock') return authority
  return oldLoad.call(this, request, ...args)
}
const Service = require(path.join(base, 'service.ts')).default
const factoryCalls = {}
const instrumentedSdk = { ...ModulesSdkUtils }
for (const name of ['mikroOrmConnectionLoaderFactory', 'moduleContainerLoaderFactory', 'buildMigrationScript', 'buildRevertMigrationScript', 'buildGenerateMigrationScript']) {
  const original = ModulesSdkUtils[name]
  instrumentedSdk[name] = function (options) { factoryCalls[name] = options; return original(options) }
}
const helperLoad = Module._load
Module._load = function (request, parent, ...args) {
  if (request === '@medusajs/framework/utils' && parent?.filename === path.join(base, 'index.ts')) {
    return { ...oldLoad.call(this, request, parent, ...args), ModulesSdkUtils: instrumentedSdk }
  }
  return helperLoad.call(this, request, parent, ...args)
}
const Wrapped = require(path.join(base, 'index.ts')).default
// Restore discovery hooks; the loaded subclass holds its helper references.
Module._load = oldLoad
Module._resolveFilename = oldResolve
Module._extensions['.ts'] = oldTs

const settlement = (id = 'order_fixture', extra = {}) => ({
  operation_id: `cancel:${id}`, order_id: id, phase: 'completed',
  scope_id: 'paycol_fixture', ...extra
})
function harness(options = {}) {
  const connection = new EventEmitter()
  const h = {
    options, cartId: options.cartId || 'cart_fixture', events: [], transactions: [], reads: [], writes: [], serializations: [], managers: [],
    orders: new Map(['order_fixture', 'order_second'].map(id => [id, { id, cart: 'cart_fixture', collection: 'paycol_fixture', status: 'pending' }])),
    settlements: options.settlements === undefined ? [settlement(), settlement('order_second')] : options.settlements,
    async boundary(name) {
      const n = (h.counts[name] = (h.counts[name] || 0) + 1)
      await Promise.resolve()
      if (options.mutateAt === name && n === 1) options.mutate()
      if (options.loseAt === name && n === (options.loseNth || 1)) { h.lostAt = name; connection.emit('end') }
    }, counts: {},
  }
  const knex = {
    client: { acquireConnection: async () => connection, releaseConnection: async () => {}, destroyRawConnection: async () => {} },
    raw: (sql, bindings = []) => ({ connection: async actual => {
      assert.equal(actual, connection)
      if (sql === 'SET SESSION synchronous_commit = on') return { rows: [] }
      assert.deepEqual(bindings, [commerceCartLockKey(h.cartId)])
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] }
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: true }] }
      assert.fail(`Unexpected SQL in offline lock fixture: ${sql}`)
    } })
  }
  const container = { resolve: () => knex }
  const dependencies = {
    baseRepository: {
      getFreshManager: context => { h.managers.push(context); return {} },
      transaction: async (fn, context) => {
        h.events.push('transaction'); h.transactions.push(context)
        await h.boundary('transaction')
        return fn({ fixtureTransaction: true })
      },
      serialize: async value => { h.serializations.push(value); await h.boundary('serialize'); return value }
    },
    orderService: {
      update: async (values, context) => {
        h.events.push('status-write')
        h.writes.push({ values, context })
        if (options.writeFailure) throw new Error('native order storage failed')
        for (const value of values) Object.assign(h.orders.get(value.id), value)
        await h.boundary('write')
        return values
      }
    }
  }
  // Use the real constructor, including the own cancel_ guard and native base.
  h.service = new Service(dependencies, { key: Modules.ORDER })
  h.service.listOrders_ = async (filter, config, context) => {
    h.events.push('native-list'); h.reads.push({ filter, config, context })
    await h.boundary('native-list')
    return filter.id.map(id => ({ ...h.orders.get(id) }))
  }
  h.run = (...args) => {
    const ids = args.length ? args[0] : 'order_fixture'
    const context = args[1], method = args[2] || 'cancel'
    return fixtureScope.run(h, () => withCommerceCartLock(container, h.cartId, () => h.service[method](ids, context)))
  }
  return h
}
function noEffects(h) {
  assert.equal(h.writes.length, 0)
  assert.equal(h.orders.get('order_fixture').status, 'pending')
  assert.equal(h.serializations.length, 0)
}

for (const method of ['cancel', 'cancel_']) {
  test(`${method}: absent private lock fails before manager, helper, transaction or effects`, async () => {
    const h = harness()
    await assert.rejects(h.service[method]('order_fixture', { cart_id: 'cart_fixture', financialLock: true }), /lock.*not held/i)
    assert.deepEqual(h.events, []); assert.equal(h.managers.length, 0); assert.equal(h.transactions.length, 0); noEffects(h)
  })
  test(`${method}: an escaped async callback cannot reuse a released private lock`, async () => {
    const h = harness()
    let release, pending
    const resumed = new Promise(resolve => { release = resolve })
    // Start another native scope, let its owner unlock, then resume its child.
    // The AsyncLocalStorage store still exists but the real owner is revoked.
    const connection = new EventEmitter()
    const knex = {
      client: { acquireConnection: async () => connection, releaseConnection: async () => {}, destroyRawConnection: async () => {} },
      raw: sql => ({ connection: async () => ({ rows: [sql.includes('pg_try_advisory_lock') ? { locked: true } : { unlocked: true }] }) })
    }
    await fixtureScope.run(h, () => withCommerceCartLock({ resolve: () => knex }, 'cart_fixture', async () => {
      pending = resumed.then(() => h.service[method]('order_fixture'))
    }))
    release()
    await assert.rejects(pending, /lock.*not held|lock.*lost/i)
    assert.deepEqual(h.events, []); assert.equal(h.managers.length, 0); assert.equal(h.writes.length, 0)
  })
  for (const [label, options] of [
    ['wrong locked cart', { cartId: 'cart_other' }],
    ['missing persisted settlement (native cancelPayment failure swallowed)', { settlements: [] }],
    ...['planned', 'reserved', 'refund_pending', 'failed', 'unknown', null, undefined].map(phase => [`noncompleted phase ${phase}`, { settlements: [settlement('order_fixture', { phase })] }]),
    ['wrong operation identity', { settlements: [settlement('order_fixture', { operation_id: 'cancel:order_other' })] }],
    ['wrong ledger order identity', { settlements: [settlement('order_fixture', { order_id: 'order_other' })] }],
    ['wrong authoritative order scope', { settlements: [settlement('order_fixture', { scope_id: 'order:order_other' })] }],
    ['wrong authoritative collection scope', { settlements: [settlement('order_fixture', { scope_id: 'paycol_other' })] }],
    ['missing authoritative scope', { settlements: [settlement('order_fixture', { scope_id: undefined })] }],
    ['ambiguous completed ledger', { settlements: [settlement(), settlement()] }],
    ['ledger read fails', { helperFailure: true }],
  ]) test(`${method}: ${label} blocks before native effects`, async () => {
    const h = harness(options)
    await assert.rejects(h.run('order_fixture', { scope_id: 'paycol_fixture' }, method), /locked cart|settlement|ledger storage/)
    assert.equal(h.transactions.length, 0); assert.equal(h.reads.length, 0); noEffects(h)
  })
  for (const [label, ids] of [
    ['undefined', undefined], ['null', null], ['number', 1], ['object', {}], ['empty string', ''], ['whitespace', ' order_fixture'],
    ['control character', 'order_\nfixture'], ['oversize', 'o'.repeat(256)], ['empty batch', []], ['duplicate batch', ['order_fixture', 'order_fixture']],
    ['mixed batch', ['order_fixture', null]], ['sparse batch', Array(1)], ['nested batch', [['order_fixture']]]
  ]) test(`${method}: malformed identities ${label} are rejected before authority reads`, async () => {
    const h = harness()
    await assert.rejects(h.run(ids, undefined, method), /distinct valid order identities/)
    assert.deepEqual(h.events, []); assert.equal(h.transactions.length, 0); noEffects(h)
  })
  test(`${method}: entire batch is settled before the first native effect`, async () => {
    const h = harness({ settlements: [settlement()] })
    await assert.rejects(h.run(['order_fixture', 'order_second'], undefined, method), /settlement/)
    assert.ok(h.events.includes('settlement:order_second')); assert.equal(h.transactions.length, 0); noEffects(h)
  })
  for (const boundary of ['order-lock', 'settlement', 'transaction', 'native-list']) {
    test(`${method}: lock loss while ${boundary} resolves fences status updates`, async () => {
      const h = harness({ loseAt: boundary })
      await assert.rejects(h.run('order_fixture', undefined, method), /lock.*not held|lock.*lost/i)
      assert.equal(h.lostAt, boundary, 'the injected await must actually be reached'); noEffects(h)
    })
  }
  test(`${method}: lock loss during native write reports failure (cannot undo dispatched write)`, async () => {
    const h = harness({ loseAt: 'write' })
    await assert.rejects(h.run('order_fixture', undefined, method), /lock.*not held|lock.*lost/i)
    assert.equal(h.lostAt, 'write'); assert.equal(h.writes.length, 1); assert.equal(h.serializations.length, 0)
  })
  test(`${method}: completed matching settlement preserves native status write and transaction`, async () => {
    const h = harness()
    const result = await h.run('order_fixture', undefined, method)
    const order = method === 'cancel_' ? result[0] : result
    assert.ok(h.service instanceof Native.service)
    assert.equal(order.id, 'order_fixture'); assert.equal(order.status, 'canceled'); assert.ok(order.canceled_at instanceof Date)
    assert.equal(h.transactions.length, 1); assert.equal(h.reads.length, 1); assert.equal(h.writes.length, 1)
    assert.equal(h.writes[0].context.transactionManager.fixtureTransaction, true)
    assert.ok(h.events.indexOf('settlement:order_fixture') < h.events.indexOf('transaction'))
  })
}
test('public cancellation checks authority again at the runtime private delegate', async () => {
  const h = harness({ loseAt: 'settlement', loseNth: 2 })
  await assert.rejects(h.run(), /lock.*not held|lock.*lost/i)
  assert.equal(h.counts.settlement, 2); assert.equal(h.transactions.length, 0); noEffects(h)
})
test('batch is copied before await and preserves native array return shape', async () => {
  const ids = ['order_fixture', 'order_second']
  const h = harness({ mutateAt: 'order-lock', mutate: () => { ids[0] = 'order_other'; ids.push('order_third') } })
  const result = await h.run(ids)
  assert.deepEqual(result.map(order => order.id), ['order_fixture', 'order_second'])
  assert.deepEqual(h.writes[0].values.map(order => order.id), ['order_fixture', 'order_second'])
})
test('private wrapper is an immutable own property, not an exposed unguarded override', () => {
  const h = harness()
  const descriptor = Object.getOwnPropertyDescriptor(h.service, 'cancel_')
  assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, false)
  assert.throws(() => { h.service.cancel_ = Native.service.prototype.cancel_ }, TypeError)
  const nativeDts = fs.readFileSync(path.join(path.dirname(require.resolve('@medusajs/order')), 'services/order-module-service.d.ts'), 'utf8')
  assert.match(nativeDts, /private cancel_;/)
})
test('native update failures propagate without a fabricated cancellation response', async () => {
  const h = harness({ writeFailure: true })
  await assert.rejects(h.run(), /native order storage failed/)
  assert.equal(h.writes.length, 1); assert.equal(h.serializations.length, 0)
  assert.equal(h.orders.get('order_fixture').status, 'pending')
})
test('lock loss during public serialization is not reported as successful cancellation', async () => {
  const h = harness({ loseAt: 'serialize' })
  await assert.rejects(h.run(), /lock.*not held|lock.*lost/i)
  assert.equal(h.lostAt, 'serialize'); assert.equal(h.writes.length, 1)
})
test('order wrapper retains native linkable, every model, custom repositories and migration path', () => {
  assert.equal(Wrapped.service, Service); assert.equal(Wrapped.linkable, Native.linkable)
  const models = toMikroOrmEntities(Object.values(require('@medusajs/order/dist/models')))
  const nativeDirectory = path.dirname(require.resolve('@medusajs/order'))
  const connection = factoryCalls.mikroOrmConnectionLoaderFactory
  assert.equal(connection.moduleName, Modules.ORDER)
  assert.deepEqual(connection.moduleModels, models)
  assert.equal(connection.migrationsPath, path.join(nativeDirectory, 'migrations'))
  assert.ok(fs.readdirSync(connection.migrationsPath).some(file => /^Migration.*\.js$/.test(file)))
  const wiring = factoryCalls.moduleContainerLoaderFactory
  assert.deepEqual(Object.keys(wiring.moduleModels).sort(), models.map(model => model.name).sort())
  assert.equal(wiring.moduleServices.OrderService, require('@medusajs/order/dist/services').OrderService)
  for (const name of ['BaseRepository', 'OrderRepository', 'OrderClaimRepository', 'ReturnRepository']) {
    assert.equal(wiring.moduleRepositories[name], require('@medusajs/order/dist/repositories')[name])
  }
  for (const name of ['buildMigrationScript', 'buildRevertMigrationScript', 'buildGenerateMigrationScript']) {
    assert.equal(factoryCalls[name].moduleName, Modules.ORDER)
    assert.equal(factoryCalls[name].pathToMigrations, connection.migrationsPath)
  }
  assert.deepEqual(factoryCalls.buildGenerateMigrationScript.models, models)
  for (const name of ['runMigrations', 'revertMigration', 'generateMigration']) assert.equal(typeof Wrapped[name], 'function')
  assert.equal(Wrapped.loaders.length, 2 + (Native.loaders?.length || 0))
})
test('real native container loader registers actual OrderService and custom repositories offline', async () => {
  const { MikroORM } = require('@medusajs/framework/mikro-orm/postgresql')
  // Real metadata discovery, without establishing any database connection.
  const orm = await MikroORM.init({
    entities: factoryCalls.mikroOrmConnectionLoaderFactory.moduleModels,
    dbName: 'offline_order_audit', connect: false, metadataCache: { enabled: false }
  })
  const container = createMedusaContainer()
  container.register({ manager: asValue(orm.em), config: asValue({}) })
  try {
    await Wrapped.loaders[1]({ container, options: {} })
    const { OrderService } = require('@medusajs/order/dist/services')
    const repos = require('@medusajs/order/dist/repositories')
    assert.ok(container.resolve('orderService') instanceof OrderService)
    assert.ok(container.resolve('orderRepository') instanceof repos.OrderRepository)
    assert.ok(container.resolve('orderClaimRepository') instanceof repos.OrderClaimRepository)
    assert.ok(container.resolve('returnRepository') instanceof repos.ReturnRepository)
    assert.ok(container.resolve('baseRepository') instanceof repos.BaseRepository)
    for (const name of ['orderAddressService', 'orderCreditLineService', 'orderExchangeService', 'returnItemService']) {
      assert.ok(container.hasRegistration(name), `native service registration ${name}`)
    }
  } finally { await orm.close(true) }
})
