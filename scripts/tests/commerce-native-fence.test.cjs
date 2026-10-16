'use strict'
// REAL installed Medusa 2.11.3 internal service, decorators AND repositories.
// Synthetic private-field EM only: no database, provider, network or DI stubs.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test, before, after } = require('node:test')
const swc = require('@swc/core')
const utils = require('@medusajs/framework/utils')
const { MedusaInternalService, model, mikroOrmBaseRepositoryFactory } = utils
assert.equal(require('@medusajs/order/package.json').version, '2.11.3')
assert.equal(typeof mikroOrmBaseRepositoryFactory, 'function')
const file = path.resolve(__dirname, '../../packages/modules/b2c-core/src/utils/commerce-native-fence.ts')
const loaded = new Module(file, module)
loaded.filename = file
loaded.paths = module.paths
loaded._compile(swc.transformSync(fs.readFileSync(file, 'utf8'), {
  filename: file, jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'commonjs' }
}).code, file)
const { commerceNativeFence } = loaded.exports
const Entity = model.define('fence_probe', { id: model.id().primaryKey(), status: model.text() })
const Internal = MedusaInternalService(Entity)
const Repository = mikroOrmBaseRepositoryFactory(Entity)
const { ReferenceKind } = require('@medusajs/deps/mikro-orm/core')
const { MikroORM } = require('@medusajs/framework/mikro-orm/postgresql')
let orm
before(async () => {
  orm = await MikroORM.init({
    entities: utils.toMikroOrmEntities([Entity]), dbName: 'offline_never_connect', connect: false,
    discovery: { disableDynamicFileAccess: true }, metadataCache: { enabled: false },
  })
  assert.equal(await orm.isConnected(), false)
})
after(async () => { if (orm) await orm.close() })

function harness(loseAt) {
  const h = { alive: true, events: [], writes: [], loseAt, transactions: [], entity: { id: 'probe_1', status: 'pending' } }
  h.check = () => { if (!h.alive) throw new Error('financial capability lost') }
  h.boundary = async name => {
    h.events.push(name)
    await Promise.resolve()
    if (h.loseAt === name) { h.alive = false; h.lostAt = name }
  }
  class Events {
    #subscribers = []
    get subscribers() { return this.#subscribers }
    registerSubscriber(subscriber) { this.#subscribers.push(subscriber) }
    async dispatchEvent(name, args = {}) {
      for (const subscriber of this.#subscribers) await subscriber[name]?.(args)
    }
  }
  class EM {
    #events = new Events()
    getEventManager() { return this.#events }
    fork() { return new EM() }
    getDriver() { return { getMetadata: () => ({ get: () => ({ relations: [{ name: 'children', kind: ReferenceKind.MANY_TO_MANY }] }) }) } }
    async transactional(task, options) {
      const transaction = this.fork()
      h.transactions.push({ manager: transaction, options })
      await h.boundary('transaction-acquisition')
      const result = await task(transaction)
      // Emulate REAL MikroORM's implicit flush on its real fork, not a proxy.
      await h.boundary('before-implicit-flush')
      await transaction.flush()
      return result
    }
    async find() { this.#events; await h.boundary('native-list'); return [h.entity] }
    assign(entity, input) { this.#events; h.writes.push('assign'); Object.assign(entity, input); return entity }
    create(entity, data) { this.#events; h.writes.push('create'); return { ...data } }
    persist() { this.#events; h.writes.push('persist'); return this }
    async flush() { await this.#events.dispatchEvent('beforeFlush'); h.writes.push('flush') }
    rollback() { this.#events; h.events.push('rollback') }
  }
  h.entity.children = { init: () => h.boundary('repository-relation-read') }
  h.manager = new EM()
  h.repository = new Repository({ manager: h.manager })
  h.service = new Internal({ fenceProbeRepository: h.repository })
  assert.equal(h.service.__fenceProbeRepository__, h.repository, 'actual generated constructor injection')
  class OriginalSubscriber {
    constructor(context) { this.context = context }
    afterUpdate() { h.events.push('original-subscriber') }
  }
  h.service.setEventSubscriber(OriginalSubscriber)
  h.guarded = commerceNativeFence(h.service, h.check)
  return h
}
const update = h => h.guarded.update({ id: 'probe_1', status: 'canceled' })
function blocked(h) {
  assert.equal(h.lostAt, h.loseAt, 'the REAL native await boundary was reached')
  assert.deepEqual(h.writes, [])
  assert.equal(h.entity.status, 'pending')
}

test('real native internal update + repository update + private EM retain receivers and subscriber', async () => {
  const h = harness()
  const serviceKeys = Reflect.ownKeys(h.service)
  const repositoryKeys = Reflect.ownKeys(h.repository)
  const result = await update(h)
  assert.equal(result, h.entity)
  assert.equal(result.status, 'canceled')
  assert.deepEqual(h.writes, ['assign', 'persist', 'flush'])
  assert.ok(h.transactions[0].manager.getEventManager().subscribers.some(s => s.constructor.name === 'OriginalSubscriber'))
  await h.transactions[0].manager.getEventManager().dispatchEvent('afterUpdate')
  assert.ok(h.events.includes('original-subscriber'), 'private subscriber on original service was retained')
  assert.deepEqual(Reflect.ownKeys(h.service), serviceKeys)
  assert.deepEqual(Reflect.ownKeys(h.repository), repositoryKeys)
  assert.equal(h.manager.getEventManager().subscribers.length, 0, 'shared root EM was not mutated')
})
for (const boundary of ['transaction-acquisition', 'native-list']) {
  test(`REAL native update: loss during ${boundary} prevents repository/EM writes`, async () => {
    const h = harness(boundary)
    await assert.rejects(update(h), /capability lost/)
    blocked(h)
  })
}
test('REAL native selector update list-await is fenced too', async () => {
  const h = harness('native-list')
  await assert.rejects(h.guarded.update({ selector: { id: 'probe_1' }, data: { status: 'canceled' } }), /capability lost/)
  blocked(h)
})
test('REAL repository internal many-to-many initialization await fences assign/persist', async () => {
  const h = harness('repository-relation-read')
  await assert.rejects(h.guarded.update({ id: 'probe_1', status: 'canceled', children: [] }), /capability lost/)
  blocked(h)
})
test('REAL native create transaction-acquisition loss preserves private receiver and prevents create', async () => {
  const h = harness('transaction-acquisition')
  await assert.rejects(h.guarded.create({ id: 'probe_2', status: 'pending' }), /capability lost/)
  blocked(h)
})
test('REAL native create uses original private subscriber and transaction decoration', async () => {
  const h = harness()
  const result = await h.guarded.create({ id: 'probe_2', status: 'pending' })
  assert.equal(result.id, 'probe_2')
  assert.deepEqual(h.writes, ['create', 'persist', 'flush'])
  assert.ok(h.transactions[0].manager.getEventManager().subscribers.some(s => s.constructor.name === 'OriginalSubscriber'))
})
test('loss after callback but before implicit real EM flush blocks flush, cannot undo staged mutation', async () => {
  const h = harness('before-implicit-flush')
  await assert.rejects(update(h), /capability lost/)
  assert.equal(h.lostAt, 'before-implicit-flush')
  assert.deepEqual(h.writes, ['assign', 'persist'])
  assert.equal(h.manager.getEventManager().subscribers.length, 0)
})
test('existing caller transaction is context-wrapped without new transaction or shared flush hooks', async () => {
  const h = harness('native-list')
  const caller = { transactionManager: h.manager, marker: 'context-preserved', enableNestedTransactions: true }
  await assert.rejects(h.guarded.update({ id: 'probe_1', status: 'canceled' }, caller), /capability lost/)
  blocked(h)
  assert.equal(h.transactions.length, 0)
  assert.equal(caller.transactionManager, h.manager)
  // Original native service registers its original subscriber; fence adds no hooks.
  assert.deepEqual(h.manager.getEventManager().subscribers.map(s => s.constructor.name), ['OriginalSubscriber'])
})
test('real native nested create with a supplied guarded transaction has no acquisition gap', async () => {
  const h = harness()
  const repository = commerceNativeFence(h.repository, h.check)
  await repository.transaction(async tx => {
    await h.boundary('nested-read')
    h.alive = false
    await h.guarded.create({ id: 'probe_2', status: 'pending' }, { transactionManager: tx })
  })
    .then(() => assert.fail('must reject'), error => assert.match(error.message, /capability lost/))
  assert.deepEqual(h.writes, [])
})
test('real repository transaction callback is rejected immediately after acquisition', async () => {
  const h = harness('transaction-acquisition')
  const repository = commerceNativeFence(h.repository, h.check)
  let callback = false
  await assert.rejects(repository.transaction(() => { callback = true }), /capability lost/)
  assert.equal(callback, false)
  blocked(h)
})
test('pre/post-only proxy demonstrably fails the same REAL native list loss fixture', async () => {
  const h = harness('native-list')
  const weak = async () => { h.check(); const result = await h.service.update({ id: 'probe_1', status: 'canceled' }); h.check(); return result }
  await assert.rejects(weak(), /capability lost/)
  assert.deepEqual(h.writes, ['assign', 'persist', 'flush'], 'reproduces review P1 without the new fence')
})
test('two invocation fences on one real service have independent checks; original service is untouched', async () => {
  const h = harness()
  let aliveA = true
  const a = commerceNativeFence(h.service, () => { if (!aliveA) throw new Error('A revoked') })
  const b = commerceNativeFence(h.service, () => {})
  aliveA = false
  assert.throws(() => a.update({ id: 'probe_1', status: 'canceled' }), /A revoked/)
  assert.equal((await b.update({ id: 'probe_1', status: 'canceled' })).status, 'canceled')
  assert.notEqual(a, b)
  assert.equal(h.manager.getEventManager().subscribers.length, 0)
})
test('direct REAL repository update also injects a guarded fresh manager without native context', async () => {
  const h = harness('repository-relation-read')
  const repository = commerceNativeFence(h.repository, h.check)
  await assert.rejects(repository.update([{ entity: h.entity, update: { status: 'canceled', children: [] } }]), /capability lost/)
  blocked(h)
})
test('plain private-field mock retains its genuine receiver and context without shared mutation', async () => {
  class Mock {
    #value = 3
    async update(value, context) { assert.equal(context.marker, 'kept'); return this.#value + value }
  }
  const mock = new Mock()
  const ctx = { marker: 'kept' }
  assert.equal(await commerceNativeFence(mock, () => {}).update(4, ctx), 7)
  assert.deepEqual(ctx, { marker: 'kept' })
})
test('explicit EM flush and writes after loss are fenced; rollback cleanup is still available', async () => {
  const h = harness()
  const manager = commerceNativeFence(h.manager, h.check)
  h.alive = false
  assert.throws(() => manager.persist(h.entity), /capability lost/)
  assert.throws(() => manager.flush(), /capability lost/)
  manager.rollback()
  assert.ok(h.events.includes('rollback'))
  assert.deepEqual(h.writes, [])
})
test('fluent thenable query builders preserve private receivers and fence SQL execution', async () => {
  let alive = true, executed = 0
  class Builder {
    #state = true
    insert() { assert.ok(this.#state); return this }
    then(resolve) { assert.ok(this.#state); executed++; return Promise.resolve(['row']).then(resolve) }
    execute() { assert.ok(this.#state); executed++; return Promise.resolve(['row']) }
  }
  const builder = new Builder()
  const manager = commerceNativeFence({ qb: () => builder }, () => { if (!alive) throw new Error('lost') })
  const query = manager.qb().insert({})
  assert.equal(executed, 0, 'building the query must not assimilate its thenable')
  alive = false
  assert.throws(() => query.execute(), /lost/)
  assert.equal(executed, 0)
})
