import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const root = new URL('../../', import.meta.url)
const utils = 'packages/modules/requests/src/utils/'
async function load(path, replacements = []) {
  const url = new URL(path, root)
  if (!existsSync(url)) return {}
  let source = stripTypeScriptTypes(readFileSync(url, 'utf8'), { mode: 'strip' })
  for (const [from, to] of replacements) source = source.replaceAll(from, to)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}
const engine = await load(utils + 'native-return-lifecycle.ts')
const { executeNativeReturn, fingerprintNativeReturnPlan } = engine
const clone = value => JSON.parse(JSON.stringify(value))
const plan = (patch = {}) => ({ request_id: 'req_a', order_id: 'order_a', location_id: null, items: [{ id: 'item_b', quantity: 2, reason_id: null }, { id: 'item_a', quantity: 1, reason_id: 'reason_a' }], ...patch })
const identity = { return_id: 'return_a', order_change_id: 'change_a' }
function memory() {
  const rows = new Map(), locks = new Set(), history = []
  let failure
  return {
    rows, locks, history,
    fault: (phase, after = false) => { failure = { phase, after } },
    async withOrderLock(order, work) {
      if (locks.has(order)) throw new engine.NativeReturnError('lock_unavailable')
      locks.add(order)
      const write = (phase, action) => {
        if (failure?.phase === phase && !failure.after) { failure = null; throw Error('private-db') }
        action(); history.push(phase)
        if (failure?.phase === phase && failure.after) { failure = null; throw Error('private-db') }
      }
      try { return await work({
        getRequest: async id => clone(rows.get(id) ?? null),
        findUnfinished: async except => clone([...rows.values()].find(r => r.plan.order_id === order && r.plan.request_id !== except && r.phase !== 'confirmed') ?? null),
        create: async r => write('pending', () => { assert(!rows.has(r.plan.request_id)); rows.set(r.plan.request_id, clone(r)) }),
        transition: async (id, expected, next, nativeIdentity = null) => write(next, () => {
          const r = rows.get(id); assert.equal(r.phase, expected)
          rows.set(id, { ...r, phase: next, identity: nativeIdentity ?? r.identity })
        }),
      }) } finally { locks.delete(order) }
    },
  }
}
function effects(store, patch = {}) {
  const calls = []
  return { calls, effects: {
    begin: async (p, fp) => { calls.push('begin'); assert.equal(store.rows.get(p.request_id).phase, 'begin_started'); assert.match(fp, /^[a-f0-9]{64}$/); return identity },
    items: async (p, i) => { calls.push('items'); assert.equal(store.rows.get(p.request_id).phase, 'items_started'); assert.deepEqual(i, identity) },
    confirm: async (p, i) => { calls.push('confirm'); assert.equal(store.rows.get(p.request_id).phase, 'confirm_started'); assert.deepEqual(i, identity) },
    verify: async (p, i, phase) => { calls.push(`verify:${phase}`); assert.deepEqual(i, identity); assert(Object.isFrozen(p.items[0])); assert(Object.isFrozen(i)) },
    ...patch,
  } }
}
async function rejects(p, code) {
  await assert.rejects(p, e => { assert.equal(e.code, code); assert(!String(e.stack).includes('private-')); assert.equal(e.cause, undefined); return true })
}
function seed(store, phase, p = plan()) {
  const canonical = clone(p); canonical.items.sort((a, b) => a.id < b.id ? -1 : 1)
  store.rows.set(p.request_id, { plan: canonical, fingerprint: fingerprintNativeReturnPlan(p), phase, identity: ['pending', 'begin_started'].includes(phase) ? null : clone(identity) })
}
test('API, committed checkpoints, frozen detached canonical plan and exact separate identities', async () => {
  assert.equal(typeof executeNativeReturn, 'function')
  const s = memory(), e = effects(s), p = plan()
  const result = await executeNativeReturn(s, p, e.effects)
  assert.deepEqual(e.calls, ['begin', 'verify:begun', 'items', 'verify:items_done', 'confirm', 'verify:confirmed'])
  assert.deepEqual(s.history, ['pending', 'begin_started', 'begun', 'items_started', 'items_done', 'confirm_started', 'confirmed'])
  assert.deepEqual(result.identity, identity); assert(Object.isFrozen(result)); assert(Object.isFrozen(result.plan.items))
  assert.equal(p.items[0].id, 'item_b'); p.items[0].quantity = 999
  assert.equal(result.plan.items[1].quantity, 2)
})
test('confirmed replay performs verification only, uses stored plan', async () => {
  const s = memory(); seed(s, 'confirmed'); const e = effects(s)
  const result = await executeNativeReturn(s, plan(), e.effects)
  assert.deepEqual(e.calls, ['verify:confirmed']); assert.deepEqual(s.history, []); assert.deepEqual(result.identity, identity)
})
for (const [phase, expected] of [['begun', ['verify:begun', 'items', 'verify:items_done', 'confirm', 'verify:confirmed']], ['items_done', ['verify:items_done', 'confirm', 'verify:confirmed']]]) {
  test(`resumes ${phase} without completed mutations`, async () => {
    const s = memory(); seed(s, phase); const e = effects(s)
    await executeNativeReturn(s, plan(), e.effects); assert.deepEqual(e.calls, expected)
  })
}
for (const phase of ['begin_started', 'items_started', 'confirm_started', 'unknown']) {
  test(`${phase} never blindly retries any native callback`, async () => {
    const s = memory(); seed(s, phase); const e = effects(s)
    await rejects(executeNativeReturn(s, plan(), e.effects), 'reconciliation_required'); assert.deepEqual(e.calls, [])
  })
}
for (const changed of [{ order_id: 'order_b' }, { location_id: 'loc_a' }, { items: [{ id: 'item_a', quantity: 5, reason_id: null }] }]) {
  test(`changed ${Object.keys(changed)[0]} is original fingerprint mismatch`, async () => {
    const s = memory(); seed(s, 'confirmed'); const e = effects(s)
    await rejects(executeNativeReturn(s, plan(changed), e.effects), 'fingerprint_mismatch'); assert.deepEqual(e.calls, [])
  })
}
for (const patch of [{ request_id: ' ' }, { order_id: '' }, { location_id: undefined }, { location_id: 2 }, { items: [] }, { items: [{ id: 'a', quantity: 0, reason_id: null }] }, { items: [{ id: 'a', quantity: 1.5, reason_id: null }] }, { items: [{ id: 'a', quantity: Number.MAX_SAFE_INTEGER + 1, reason_id: null }] }, { items: [{ id: 'a', quantity: 1 }] }, { items: [{ id: 'a', quantity: 1, reason_id: null }, { id: 'a', quantity: 2, reason_id: null }] }]) {
  test(`rejects invalid or duplicate plan ${JSON.stringify(patch)}`, async () => {
    const s = memory(), e = effects(s); await rejects(executeNativeReturn(s, plan(patch), e.effects), 'invalid_input'); assert.deepEqual(e.calls, []); assert.equal(s.rows.size, 0)
  })
}
test('canonical fingerprint ignores item order', () => {
  const p = plan(); assert.equal(fingerprintNativeReturnPlan(p), fingerprintNativeReturnPlan({ ...p, items: [...p.items].reverse() }))
})
test('unfinished request blocks another request until confirmed', async () => {
  const s = memory(); seed(s, 'begun'); const p = plan({ request_id: 'req_b' }), e = effects(s)
  await rejects(executeNativeReturn(s, p, e.effects), 'order_blocked'); assert.deepEqual(e.calls, [])
  await executeNativeReturn(s, plan(), e.effects); await executeNativeReturn(s, p, e.effects); assert.equal(s.rows.size, 2)
})
for (const phase of ['pending', 'begin_started', 'begun', 'items_started', 'items_done', 'confirm_started', 'confirmed']) for (const after of [false, true]) {
  test(`persistence ${phase} failure ${after ? 'after' : 'before'} commit is sanitized; uncertain stages do not replay`, async () => {
    const s = memory(), e = effects(s); s.fault(phase, after)
    await rejects(executeNativeReturn(s, plan(), e.effects), 'storage_failure')
    const r = s.rows.get('req_a'), retry = effects(s)
    if (r?.phase.endsWith('_started')) {
      await rejects(executeNativeReturn(s, plan(), retry.effects), 'reconciliation_required'); assert.deepEqual(retry.calls, [])
    }
    if (phase === 'pending' || (phase === 'begin_started' && !after)) assert.deepEqual(e.calls, [])
  })
}
for (const stage of ['begin', 'items', 'confirm']) {
  test(`${stage} exception retains started, sanitized, and never replayed`, async () => {
    const s = memory(), e = effects(s, { [stage]: async () => { throw Error('private-provider') } })
    await rejects(executeNativeReturn(s, plan(), e.effects), 'native_failure')
    const retry = effects(s); await rejects(executeNativeReturn(s, plan(), retry.effects), 'reconciliation_required'); assert.deepEqual(retry.calls, [])
  })
}
for (const phase of ['begun', 'items_done', 'confirmed']) test(`verification failure at ${phase} blocks remaining mutation`, async () => {
  const s = memory(); seed(s, phase); const e = effects(s, { verify: async () => { throw Error('private-verifier') } })
  await rejects(executeNativeReturn(s, plan(), e.effects), 'verification_failure'); assert.deepEqual(e.calls, []); assert.deepEqual(s.history, [])
})
test('post-confirm verifier failure retains confirm_started', async () => {
  const s = memory(), e = effects(s, { verify: async (_p, _i, phase) => { if (phase === 'confirmed') throw Error('private-verifier') } })
  await rejects(executeNativeReturn(s, plan(), e.effects), 'verification_failure'); assert.equal(s.rows.get('req_a').phase, 'confirm_started')
})
test('verify is required even for confirmed replay', async () => {
  const s = memory(); seed(s, 'confirmed'); const e = effects(s, { verify: undefined })
  await rejects(executeNativeReturn(s, plan(), e.effects), 'invalid_input')
})
test('attempted callback mutation cannot alter frozen plan', async () => {
  const s = memory(), e = effects(s, { begin: async p => { p.items[0].quantity = 100; return identity } })
  await rejects(executeNativeReturn(s, plan(), e.effects), 'native_failure'); assert.equal(s.rows.get('req_a').plan.items[0].quantity, 1)
})
test('malformed native identity fails closed at begin_started', async () => {
  const s = memory(), e = effects(s, { begin: async () => ({ id: 'change_a', return_id: 'return_a' }) })
  await rejects(executeNativeReturn(s, plan(), e.effects), 'native_failure'); assert.equal(s.rows.get('req_a').phase, 'begin_started')
})

test('parallel same-order calls fail fast during begin', async () => {
  const s = memory(); let release, entered
  const ready = new Promise(r => { entered = r }), gate = new Promise(r => { release = r })
  const e = effects(s, { begin: async () => { entered(); await gate; return identity } })
  const first = executeNativeReturn(s, plan(), e.effects); await ready
  await rejects(executeNativeReturn(s, plan({ request_id: 'req_b' }), effects(s).effects), 'lock_unavailable')
  release(); await first
})
test('stored identity is detached from provider result and frozen for remaining mutations', async () => {
  const s = memory(), mutable = clone(identity)
  const e = effects(s, { begin: async () => mutable, items: async (_p, i) => {
    mutable.return_id = 'changed'; assert.deepEqual(i, identity); assert.throws(() => { i.return_id = 'changed' })
  } })
  const result = await executeNativeReturn(s, plan(), e.effects); assert.deepEqual(result.identity, identity)
})

const engineUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(readFileSync(new URL(utils + 'native-return-lifecycle.ts', root), 'utf8'), { mode: 'strip' })).toString('base64')}`
const postgres = await load(utils + 'native-return-store.ts', [["'./native-return-lifecycle'", JSON.stringify(engineUrl)]])
function fakeKnex({ lock = true, unlock = true, failLock = false, failRelease = false } = {}) {
  const connection = {}, statements = [], events = []
  const knex = {
    client: {
      acquireConnection: async () => { events.push('acquire'); return connection },
      releaseConnection: async c => { assert.equal(c, connection); events.push('release'); if (failRelease) throw Error('private-release') },
      destroyRawConnection: async c => { assert.equal(c, connection); events.push('destroy') },
    },
    raw: (sql, bindings) => ({ connection: async c => {
      assert.equal(c, connection); statements.push({ sql, bindings })
      if (sql.includes('pg_try_advisory_lock')) { if (failLock) throw Error('private-lock'); return { rows: [{ locked: lock }] } }
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: unlock }] }
      if (sql.startsWith('SELECT')) return { rows: [] }
      return { rowCount: 1 }
    } }),
  }
  return { knex, connection, statements, events }
}
test('Postgres store pins every statement to one root physical connection, no transaction', async () => {
  const f = fakeKnex(), store = postgres.createPostgresNativeReturnStore(f.knex)
  let captured
  await store.withOrderLock('order_a', async session => {
    captured = session; assert.equal(await session.getRequest('req_a'), null)
    assert.equal(await session.findUnfinished('req_a'), null)
    await session.create({ plan: plan(), fingerprint: fingerprintNativeReturnPlan(plan()), identity: null, phase: 'pending' })
    await session.transition('req_a', 'pending', 'begin_started')
    await session.transition('req_a', 'begin_started', 'begun', identity)
  })
  assert.deepEqual(f.events, ['acquire', 'release'])
  assert.match(f.statements[0].sql, /pg_try_advisory_lock/); assert.match(f.statements[1].sql, /SET SESSION synchronous_commit = on/)
  assert.match(f.statements.at(-1).sql, /pg_advisory_unlock/)
  assert(!f.statements.some(s => /\b(BEGIN|COMMIT|DELETE|TRANSACTION)\b/.test(s.sql)))
  const update = f.statements.find(s => s.bindings?.includes('return_a'))
  assert.deepEqual(update.bindings, ['begun', 'return_a', 'change_a', 'req_a', 'order_a', 'begin_started'])
  await rejects(captured.getRequest('req_a'), 'lock_unavailable')
})
for (const options of [{ failLock: true }, { lock: null }, { unlock: false }, { failRelease: true }]) test(`uncertain connection is discarded ${JSON.stringify(options)}`, async () => {
  const f = fakeKnex(options), store = postgres.createPostgresNativeReturnStore(f.knex)
  await rejects(store.withOrderLock('order_a', async () => true), options.failLock || options.lock === null ? 'lock_unavailable' : 'storage_failure')
  assert.equal(f.connection.__knex__disposed, true); assert(f.events.includes('destroy'))
})
test('busy lock executes no callback and safely releases known-unlocked connection', async () => {
  const f = fakeKnex({ lock: false }), store = postgres.createPostgresNativeReturnStore(f.knex)
  await rejects(store.withOrderLock('order_a', async () => { assert.fail('must not run') }), 'lock_unavailable')
  assert.deepEqual(f.events, ['acquire', 'release']); assert.equal(f.statements.length, 1)
})
test('rejects transaction wrappers', () => {
  const f = fakeKnex(); f.knex.isTransaction = true
  assert.throws(() => postgres.createPostgresNativeReturnStore(f.knex), e => e.code === 'invalid_input')
})
test('migration emits permanent uniqueness and immutable strict transition guards (synthetic collector, not database acceptance)', async () => {
  const migration = await load('packages/modules/requests/src/modules/order-return-request/migrations/Migration20261002163000.ts', [
    ["import { Migration } from '@medusajs/framework/mikro-orm/migrations'", 'class Migration { sql = []; addSql(sql) { this.sql.push(sql) } }'],
  ])
  const m = new migration.Migration20261002163000(); await m.up(); const sql = m.sql.join('\n')
  assert.match(sql, /request_id text PRIMARY KEY/); assert.match(sql, /native_return_id text UNIQUE/); assert.match(sql, /order_change_id text UNIQUE/)
  assert.match(sql, /CREATE UNIQUE INDEX.*order_id.*WHERE phase <> 'confirmed'/)
  for (const col of ['request_id', 'order_id', 'fingerprint', 'plan', 'created_at']) assert(sql.includes(`NEW.${col} IS DISTINCT FROM OLD.${col}`))
  for (const [from, to] of [['pending', 'begin_started'], ['begin_started', 'begun'], ['begun', 'items_started'], ['items_started', 'items_done'], ['items_done', 'confirm_started'], ['confirm_started', 'confirmed']]) assert(sql.includes(`OLD.phase = '${from}' AND NEW.phase = '${to}'`))
  assert.match(sql, /BEFORE INSERT OR UPDATE OR DELETE/); assert.match(sql, /BEFORE TRUNCATE/)
  await assert.rejects(m.down(), /permanent/)
})
