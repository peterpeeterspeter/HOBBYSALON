// Native installed Medusa/Awilix + LocalWorkflow acceptance; ONLY the lock's
// PostgreSQL client is synthetic. No network, database writes or package patches.
// Run with installed dependencies (or pinned image, repo mounted read-only at /accept):
// NODE_PATH=/app/node_modules node --test /accept/scripts/tests/commerce-lock-native-scope.test.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const ts = require('typescript')
const { createMedusaContainer, ContainerRegistrationKeys: K } = require('@medusajs/framework/utils')
const { asValue } = require('@medusajs/framework/awilix')
const { createWorkflow, createStep, StepResponse, WorkflowResponse } = require('@medusajs/framework/workflows-sdk')
const filename = process.env.COMMERCE_LOCK_SOURCE || path.resolve(__dirname, '../../packages/modules/b2c-core/src/utils/commerce-cart-lock.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
})
assert.deepEqual(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error), [])
const loaded = new Module(filename, module)
loaded.filename = filename
loaded.paths = [...module.paths, ...Module._nodeModulePaths(path.dirname(filename))]
loaded._compile(compiled.outputText, filename)
const lock = loaded.exports
const cart = 'cart-native-scope'
const tick = () => new Promise(resolve => setImmediate(resolve))
function fakePG(options = {}) {
  const connection = new EventEmitter(), calls = [], stats = { acquired: 0, released: 0, destroyed: 0 }
  const knex = {
    client: {
      async acquireConnection() { stats.acquired++; if (options.acquireFails) throw Error('synthetic acquire'); return connection },
      async releaseConnection(c) { assert.equal(c, connection); stats.released++ },
      async destroyRawConnection(c) { assert.equal(c, connection); stats.destroyed++ }
    },
    raw(sql, bindings) {
      return { async connection(c) {
        assert.equal(c, connection, 'every statement stays on the owning physical session')
        calls.push({ sql, bindings, connection: c })
        if (sql === 'SET SESSION synchronous_commit = on' && options.lossDuringSetup) c.emit(options.lossDuringSetup, Error('synthetic acquisition session loss'))
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: options.locked === undefined ? true : options.locked }] }
        if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: options.unlocked === undefined ? true : options.unlocked }] }
        if (sql === 'SELECT synthetic_tail' && options.tailFails) throw Error('synthetic tail failure')
        return { rows: [{ synthetic: true }] }
      } }
    }
  }
  return { knex, connection, calls, stats }
}
function native(pg, parent) {
  const container = parent ? createMedusaContainer({}, parent) : createMedusaContainer()
  if (pg) container.register(K.PG_CONNECTION, asValue(pg.knex))
  return container
}
function familySymbol(container) {
  const symbols = Object.getOwnPropertySymbols(container).filter(s => {
    const d = Object.getOwnPropertyDescriptor(container, s)
    return Array.isArray(d?.value) && d.value[0] === container
  })
  assert.equal(symbols.length, 1)
  return symbols[0]
}
function denied(container, id = cart) {
  assert.throws(() => lock.assertCommerceCartLock(container, id), /not held|refusing/)
}

test('installed native LocalWorkflow step retains descendant authority across await', async () => {
  const pg = fakePG(), root = native(pg), owner = native(null, root)
  let observed
  const step = createStep('commerce-lock-native-scope-step', async (input, { container }) => {
    observed = container
    assert.notEqual(container, owner, 'must exercise the real native child, not the ALS owner')
    lock.assertCommerceCartLock(container, input.cartId)
    await tick()
    lock.assertCommerceCartLock(container, input.cartId)
    lock.assertCommerceFinancialLock()
    denied(container, 'cart-other')
    await lock.withCommerceCartLock(container, input.cartId, async () => {
      await tick()
      await lock.commerceCartLockQuery(container, input.cartId, 'SELECT synthetic_tail', ['native-workflow'])
    })
    return new StepResponse('native-step-held-after-await')
  })
  const workflow = createWorkflow('commerce-lock-native-scope-workflow', function (input) {
    return new WorkflowResponse(step(input))
  })
  await lock.withCommerceCartLock(owner, cart, async () => {
    const { result } = await workflow(owner).run({ input: { cartId: cart } })
    assert.equal(result, 'native-step-held-after-await')
  })
  assert.ok(observed)
  denied(observed)
  assert.deepEqual(pg.stats, { acquired: 1, released: 1, destroyed: 0 })
  assert.deepEqual(pg.calls.map(c => c.sql), [
    'SELECT pg_try_advisory_lock(?::bigint) AS locked', 'SET SESSION synchronous_commit = on',
    'SELECT synthetic_tail', 'SELECT pg_advisory_unlock(?::bigint) AS unlocked'
  ])
})

test('native descendants/createScope accepted; ancestors, siblings, unrelated same Knex and copies denied', async () => {
  const pg = fakePG(), root = native(pg), owner = native(null, root)
  const child = native(null, owner), grandchild = native(null, child), scoped = child.createScope()
  const sibling = native(null, root), unrelated = native(pg)
  const copies = [Object.assign({}, child), { ...child }, Object.create(child), Object.create(owner),
    Object.defineProperties({}, Object.getOwnPropertyDescriptors(child))]
  await lock.withCommerceCartLock(owner, cart, async () => {
    await tick()
    for (const c of [owner, child, grandchild, scoped]) {
      lock.assertCommerceCartLock(c, cart)
      await lock.withCommerceCartLock(c, cart, async () => lock.assertCommerceFinancialLock())
    }
    for (const c of [root, sibling, unrelated, ...copies]) {
      denied(c)
      await assert.rejects(lock.withCommerceCartLock(c, cart, async () => assert.fail('foreign work ran')), /not held|refusing/)
      await assert.rejects(lock.commerceCartLockQuery(c, cart, 'SELECT synthetic_tail'), /not held|refusing/)
    }
    denied(child, 'cart-other')
    await assert.rejects(lock.withCommerceCartLock(child, 'cart-other', async () => assert.fail('wrong cart ran')), /not held|refusing/)
  })
  assert.equal(pg.stats.acquired, 1)
  assert.equal(pg.calls.filter(c => c.sql === 'SELECT synthetic_tail').length, 0)
})

test('child PG overrides refused including same-Knex registration and an overridden intermediate ancestor', async () => {
  const pg = fakePG(), owner = native(pg), same = native(null, owner), different = native(fakePG(), owner)
  same.register(K.PG_CONNECTION, asValue(pg.knex))
  const grandchild = native(null, same)
  const concealed = native(null, same)
  concealed.register(K.PG_CONNECTION, owner.getRegistration(K.PG_CONNECTION))
  await lock.withCommerceCartLock(owner, cart, async () => {
    for (const c of [same, different, grandchild, concealed]) denied(c)
    const throwing = native(null, owner)
    throwing.resolve = () => { throw Error('synthetic resolver failure') }
    denied(throwing)
  })
})

test('own descriptor ancestry suffix required and owner origin snapshot cannot be rewritten', async () => {
  const pg = fakePG(), root = native(pg), owner = native(null, root), child = native(null, owner)
  const symbol = familySymbol(owner), original = owner[symbol]
  await lock.withCommerceCartLock(owner, cart, async () => {
    const malformed = native(null, owner)
    malformed[symbol] = [malformed, owner] // omits the root suffix
    denied(malformed)
    const getter = native(null, owner)
    Object.defineProperty(getter, symbol, { get: () => [getter, owner, root] })
    denied(getter)
    const mismatch = native(null, owner), middle = native(null, owner)
    mismatch[symbol] = [mismatch, middle, owner, root]
    middle[symbol] = [middle, root] // contradictory ancestry must now fail
    denied(mismatch)
    const unrelated = native(pg)
    owner[symbol] = [owner, unrelated]
    const rewritten = native(null, owner)
    denied(rewritten)
    denied(child)
    owner[symbol] = [owner, ,] // sparse suffix must not bypass element comparisons
    denied(child)
    owner[symbol] = original
    lock.assertCommerceCartLock(child, cart)
  })
})

test('private ALS is unavailable outside owner even while active; delayed inherited callbacks lose authority after release', async () => {
  const pg = fakePG(), owner = native(pg), child = native(null, owner)
  denied(owner)
  assert.throws(() => lock.assertCommerceFinancialLock(), /not held/)
  let finish, entered
  const liveGate = new Promise(resolve => { finish = resolve })
  const liveSignal = new Promise(resolve => { entered = resolve })
  const holding = lock.withCommerceCartLock(owner, cart, async () => { entered(); await liveGate })
  await liveSignal
  denied(owner); denied(child)
  assert.throws(() => lock.assertCommerceFinancialLock(), /not held/)
  finish()
  await holding
  let release, stale
  const gate = new Promise(resolve => { release = resolve })
  await lock.withCommerceCartLock(owner, cart, async () => {
    stale = (async () => {
      await gate
      denied(owner); denied(child)
      assert.throws(() => lock.assertCommerceFinancialLock(), /not held|refusing/)
      await assert.rejects(lock.commerceCartLockQuery(child, cart, 'SELECT synthetic_tail'), /not held|refusing/)
      await assert.rejects(lock.withCommerceCartLock(child, cart, async () => assert.fail('stale work ran')), /not held|refusing/)
    })()
  })
  release()
  await stale
  assert.equal(pg.calls.filter(c => c.sql === 'SELECT synthetic_tail').length, 0)
})

for (const mode of ['__knex__disposed', '_ending', '_ended', 'error', 'end']) {
  test(`native child fails closed after physical session ${mode}`, async () => {
    const pg = fakePG(), owner = native(pg), child = native(null, owner)
    await assert.rejects(lock.withCommerceCartLock(owner, cart, async () => {
      await tick()
      if (mode === 'error' || mode === 'end') pg.connection.emit(mode, Error('synthetic session lost'))
      else pg.connection[mode] = true
      denied(child)
      assert.throws(() => lock.assertCommerceFinancialLock(), /not held|refusing/)
      await assert.rejects(lock.commerceCartLockQuery(child, cart, 'SELECT synthetic_tail'), /not held|refusing/)
    }), /ownership lost/)
    assert.equal(pg.calls.filter(c => c.sql === 'SELECT synthetic_tail').length, 0)
    if (mode === 'error' || mode === 'end') assert.equal(pg.stats.destroyed, 1)
  })
}

test('session tail failure invalidates both exact owner and native child before subsequent effects', async () => {
  const pg = fakePG({ tailFails: true }), owner = native(pg), child = native(null, owner)
  await assert.rejects(lock.withCommerceCartLock(owner, cart, async () => {
    await assert.rejects(lock.commerceCartLockQuery(child, cart, 'SELECT synthetic_tail'), /storage failed/)
    denied(owner); denied(child)
    await assert.rejects(lock.commerceCartLockQuery(child, cart, 'SELECT synthetic_tail'), /not held|refusing/)
  }), /ownership lost/)
  assert.equal(pg.calls.filter(c => c.sql === 'SELECT synthetic_tail').length, 1)
})

test('busy, uncertain acquisition and uncertain unlock preserve fail-closed session handling', async () => {
  for (const [options, pattern, destroyed] of [
    [{ locked: false }, /busy/, 0], [{ locked: null }, /unavailable/, 1],
    [{ acquireFails: true }, /unavailable/, 0], [{ unlocked: false }, /unlock failed/, 1]
  ]) {
    const pg = fakePG(options), owner = native(pg)
    let entered = false
    await assert.rejects(lock.withCommerceCartLock(owner, cart, async () => { entered = true }), pattern)
    assert.equal(entered, options.unlocked === false)
    assert.equal(pg.stats.destroyed, destroyed)
    denied(owner)
  }
})

for (const mode of ['error', 'end']) {
  test(`session loss during acquisition ${mode} cannot reactivate financial authority`, async () => {
    const pg = fakePG({ lossDuringSetup: mode }), owner = native(pg)
    let entered = false
    await assert.rejects(lock.withCommerceCartLock(owner, cart, async () => {
      entered = true
      lock.assertCommerceFinancialLock()
    }), /ownership lost|unavailable|not held/)
    assert.equal(entered, false)
    assert.equal(pg.stats.destroyed, 1)
    denied(owner)
  })
}

test('non-native exact container remains supported, without granting same-Knex wrapper authority', async () => {
  const pg = fakePG(), owner = { resolve: () => pg.knex }, other = { resolve: () => pg.knex }
  await lock.withCommerceCartLock(owner, cart, async () => {
    await tick()
    lock.assertCommerceCartLock(owner, cart)
    denied(other); denied(Object.create(owner))
  })
})
