'use strict'
/** Actual engine/store, real Knex/pg and installed MikroORM Migration. Synthetic native-effect
 * callbacks only: this is NOT actual Medusa lifecycle or host-power-loss acceptance. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const dependencies = require('node:module').createRequire('/app/apps/backend/package.json')
const swc = dependencies('@swc/core'), knexFactory = dependencies('knex')
const { Client } = dependencies('pg')
const { Migration } = dependencies('@medusajs/framework/mikro-orm/migrations')
const source = '/app/apps/backend/audit-src'
assert.equal(process.env.NATIVE_RETURN_ISOLATED_FIXTURE, '1')
require.extensions['.ts'] = (module, filename) => {
  assert(filename.startsWith(source + '/'))
  module._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'commonjs' },
  }).code, filename)
}
const files = ['utils/native-return-lifecycle.ts', 'utils/native-return-store.ts', 'modules/order-return-request/migrations/Migration20261002163000.ts']
const { executeNativeReturn: execute, fingerprintNativeReturnPlan: fingerprint } = require(source + '/' + files[0])
const { createPostgresNativeReturnStore: store } = require(source + '/' + files[1])
const { Migration20261002163000: CandidateMigration } = require(source + '/' + files[2])
const connection = { host: '127.0.0.1', user: 'postgres', database: 'native_return_acceptance', connectionTimeoutMillis: 4000, statement_timeout: 5000 }
const observer = new Client(connection), pools = new Set(), children = new Set()
function pool() { const k = knexFactory({ client: 'pg', connection, pool: { min: 0, max: 1 }, acquireConnectionTimeout: 5000 }); pools.add(k); return k }
async function fresh(work) { const k = pool(); try { return await work(store(k), k) } finally { await k.destroy(); pools.delete(k) } }
const emit = (tag, value) => console.log(`${tag} ${JSON.stringify(value)}`)
const plan = (id, order = `order_${id}`) => ({ request_id: id, order_id: order, location_id: null, items: [{ id: 'item_a', quantity: 1, reason_id: null }] })
const identity = p => ({ return_id: `return_${p.request_id}`, order_change_id: `change_${p.request_id}` })
const row = async p => (await observer.query('SELECT * FROM native_return_execution WHERE request_id=$1', [p.request_id])).rows[0]
const effectsFor = async p => (await observer.query('SELECT leg FROM fixture_effects WHERE request_id=$1 ORDER BY id', [p.request_id])).rows.map(r => r.leg)
const key = p => crypto.createHash('sha256').update(`hobbysalon:native-return:v1:${p.order_id}`).digest().readBigInt64BE().toString()
async function visible(p, phase) {
  assert.equal((await row(p)).phase, phase, 'started checkpoint must be committed before effect')
  const locks = (await observer.query(`SELECT l.pid,a.state,a.xact_start FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
    WHERE l.locktype='advisory' AND l.granted AND l.objsubid=1
    AND l.classid::bigint=(($1::bigint >> 32) & 4294967295) AND l.objid::bigint=($1::bigint & 4294967295)`, [key(p)])).rows
  assert.equal(locks.length, 1); assert.notEqual(locks[0].pid, observer.processID)
  assert.equal(locks[0].state, 'idle'); assert.equal(locks[0].xact_start, null)
  return locks[0].pid
}
async function effect(p, leg) {
  const pid = await visible(p, `${leg}_started`)
  await observer.query('INSERT INTO fixture_effects(request_id,leg) VALUES($1,$2)', [p.request_id, leg])
  return pid
}
function callbacks(p, overrides = {}) {
  const calls = []
  return { calls, effects: {
    begin: async saved => { calls.push('begin'); assert.deepEqual(saved, p); await effect(p, 'begin'); return identity(p) },
    items: async (saved, ids) => { calls.push('items'); assert.deepEqual(saved, p); assert.deepEqual(ids, identity(p)); await effect(p, 'items') },
    confirm: async (saved, ids) => { calls.push('confirm'); assert.deepEqual(saved, p); assert.deepEqual(ids, identity(p)); await effect(p, 'confirm') },
    verify: async (saved, ids, phase) => { calls.push(`verify:${phase}`); assert.deepEqual(saved, p); assert.deepEqual(ids, identity(p)) },
    ...overrides,
  } }
}
async function rejects(promise, code) {
  await assert.rejects(promise, e => { assert.equal(e.code, code); assert.equal(e.message, `Native return: ${code}`); assert.equal(e.cause, undefined); assert(!String(e.stack).includes('fixture-private-secret')); return true })
}
async function sqlReject(sql, args, code, message) {
  await assert.rejects(observer.query(sql, args), e => { assert.equal(e.code, code); if (message) assert.equal(e.message, message); return true })
}
async function seed(p, phase = 'pending', ids = identity(p)) {
  await fresh(s => s.withOrderLock(p.order_id, async session => {
    await session.create({ plan: p, fingerprint: fingerprint(p), identity: null, phase: 'pending' })
    let current = 'pending'
    for (const next of ['begin_started', 'begun', 'items_started', 'items_done', 'confirm_started', 'confirmed']) {
      if (current === phase) break
      await session.transition(p.request_id, current, next, next === 'begun' ? ids : null); current = next
    }
    assert.equal(current, phase)
  }))
}
async function bounded(p, ms = 12000) { let timer; try { return await Promise.race([p, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('fixture timeout')), ms) })]) } finally { clearTimeout(timer) } }
function worker(mode, p) {
  const child = spawn(process.execPath, ['--max-old-space-size=48', __filename, mode, JSON.stringify(p)], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_OPTIONS: '' } })
  children.add(child)
  let output = '', errors = ''
  child.stdout.on('data', x => { output += x }); child.stderr.on('data', x => { errors += x })
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => { children.delete(child); resolve({ code, signal, output, errors }) }) })
  const ready = new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); child.once('close', () => reject(new Error('worker exited before barrier: ' + errors))) })
  ready.catch(() => {})
  return { child, ready, exited }
}
async function workerMain() {
  const mode = process.argv[2], p = JSON.parse(process.argv[3]); await observer.connect()
  const f = callbacks(p), original = f.effects.begin
  if (mode === '--execute') {
    const result = await fresh(s => execute(s, p, f.effects))
    process.send({ result, calls: f.calls })
    await observer.end(); process.disconnect(); return
  }
  f.effects.begin = async saved => {
    const ids = await original(saved), pid = await visible(p, 'begin_started')
    if (mode === '--crash') { fs.writeSync(1, `CRASH_POINT ${JSON.stringify({ request_id: p.request_id, pid })}\n`); process.kill(process.pid, 'SIGKILL'); await new Promise(() => {}) }
    process.send({ request_id: p.request_id, pid })
    await bounded(new Promise(resolve => process.once('message', resolve)))
    return ids
  }
  await fresh(s => execute(s, p, f.effects)); await observer.end(); if (process.connected) process.disconnect()
}
const cases = [], test = (name, run) => cases.push({ name, run })
test('actual_migration_up', async () => {
  assert.deepEqual((await observer.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows, [])
  const migration = new CandidateMigration(undefined, undefined); assert(migration instanceof Migration)
  await migration.up(); const queries = [...migration.getQueries()]; assert.equal(queries.length, 5)
  assert(queries.every(q => typeof q === 'string' && q.length > 0)); emit('MIGRATION_SQL', { direction: 'up', queries })
  await observer.query('BEGIN')
  try { for (const q of queries) await observer.query(q); await observer.query('COMMIT') } catch (e) { await observer.query('ROLLBACK'); throw e }
  assert.equal((await observer.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='native_return_execution'::regclass AND NOT tgisinternal")).rows[0].n, 2)
  await observer.query('CREATE TABLE fixture_effects(id bigserial PRIMARY KEY, request_id text NOT NULL, leg text NOT NULL)')
})
test('committed_started_independent_connection_before_effects', async () => {
  const p = plan('visible'), f = callbacks(p); const result = await fresh(s => execute(s, p, f.effects))
  assert.deepEqual(result, { identity: identity(p), plan: p }); assert.equal((await row(p)).phase, 'confirmed')
  assert.deepEqual(await effectsFor(p), ['begin', 'items', 'confirm'])
  assert.deepEqual(f.calls, ['begin', 'verify:begun', 'items', 'verify:items_done', 'confirm', 'verify:confirmed'])
})
test('confirmed_restart_saved_identity_no_native_writes', async () => {
  const p = plan('visible'), before = await row(p), f = callbacks(p)
  const result = await fresh(s => execute(s, p, f.effects))
  assert.deepEqual(result.identity, { return_id: before.native_return_id, order_change_id: before.order_change_id })
  assert.deepEqual(f.calls, ['verify:confirmed']); assert.deepEqual(await row(p), before); assert.deepEqual(await effectsFor(p), ['begin', 'items', 'confirm'])
  const w = worker('--execute', p), replay = await bounded(w.ready), exited = await bounded(w.exited)
  assert.equal(exited.code, 0, exited.errors); assert.equal(exited.signal, null)
  assert.deepEqual(replay.result.identity, result.identity); assert.deepEqual(replay.calls, ['verify:confirmed'])
  assert.deepEqual(await row(p), before); assert.deepEqual(await effectsFor(p), ['begin', 'items', 'confirm'])
})
test('cross_process_same_order_one_winner', async () => {
  const p = plan('race_winner'), w = worker('--hold', p); const barrier = await bounded(w.ready)
  assert.notEqual(barrier.pid, observer.processID)
  for (const contender of [p, plan('race_loser', p.order_id)]) {
    const f = callbacks(contender); await rejects(fresh(s => execute(s, contender, f.effects)), 'lock_unavailable'); assert.deepEqual(f.calls, [])
  }
  w.child.send('release'); const result = await bounded(w.exited); assert.equal(result.code, 0, result.errors); assert.equal(result.signal, null)
  assert.deepEqual(await effectsFor(p), ['begin', 'items', 'confirm']); assert.equal(await row(plan('race_loser')), undefined)
  emit('PROCESS_CONCURRENCY', { ...barrier, exit_code: result.code, rejected_contenders: 2 })
})
test('different_orders_progress_while_other_process_holds_lock', async () => {
  const p = plan('parallel_a'), w = worker('--hold', p); await bounded(w.ready)
  const other = plan('parallel_b'); await fresh(s => execute(s, other, callbacks(other).effects))
  assert.equal((await row(p)).phase, 'begin_started'); assert.equal((await row(other)).phase, 'confirmed')
  w.child.send('release'); const result = await bounded(w.exited); assert.equal(result.code, 0, result.errors)
})
test('crash_after_begin_before_checkpoint_blocks_second_begin', async () => {
  const p = plan('crash'), w = worker('--crash', p), result = await bounded(w.exited)
  assert.equal(result.signal, 'SIGKILL', result.errors); assert.equal(result.code, null)
  const points = result.output.split('\n').filter(x => x.startsWith('CRASH_POINT ')); assert.equal(points.length, 1)
  const point = JSON.parse(points[0].slice(12)); assert.equal(point.request_id, p.request_id)
  emit('CRASH_OBSERVED', { ...point, signal: result.signal, code: result.code })
  assert.equal((await row(p)).phase, 'begin_started'); assert.deepEqual(await effectsFor(p), ['begin'])
  const f = callbacks(p)
  await fresh(async (s, k) => { const pid = (await k.raw('SELECT pg_backend_pid() pid')).rows[0].pid; assert.notEqual(pid, point.pid); await rejects(execute(s, p, f.effects), 'reconciliation_required') })
  assert.deepEqual(f.calls, []); assert.deepEqual(await effectsFor(p), ['begin'])
  const other = plan('after_crash', p.order_id); await rejects(fresh(s => execute(s, other, callbacks(other).effects)), 'order_blocked')
})
for (const phase of ['begun', 'items_done']) test(`${phase}_restart_resumes_saved_identity`, async () => {
  const p = plan(`resume_${phase}`); await seed(p, phase)
  const w = worker('--execute', p), resumed = await bounded(w.ready), exited = await bounded(w.exited)
  assert.equal(exited.code, 0, exited.errors); assert.equal(exited.signal, null)
  assert.deepEqual(resumed.result.identity, identity(p))
  assert.deepEqual(await effectsFor(p), phase === 'begun' ? ['items', 'confirm'] : ['confirm'])
  assert.equal((await row(p)).phase, 'confirmed'); assert(!resumed.calls.includes('begin')); assert.equal(resumed.calls[0], `verify:${phase}`)
})
for (const phase of ['items_started', 'confirm_started']) test(`${phase}_unknown_blocks`, async () => {
  const p = plan(`unknown_${phase}`); await seed(p, phase); const before = await row(p), f = callbacks(p)
  await rejects(fresh(s => execute(s, p, f.effects)), 'reconciliation_required'); assert.deepEqual(f.calls, []); assert.deepEqual(await row(p), before)
})
for (const field of ['request_id', 'order_id', 'fingerprint', 'plan', 'created_at']) test(`immutable_${field}`, async () => {
  const p = plan(`immutable_${field}`); await seed(p); const before = await row(p)
  const value = field === 'plan' ? JSON.stringify({ ...p, location_id: 'different' }) : field === 'created_at' ? '2000-01-01T00:00:00Z' : field === 'fingerprint' ? 'a'.repeat(64) : 'changed'
  await sqlReject(`UPDATE native_return_execution SET ${field}=$2,phase='begin_started' WHERE request_id=$1`, [p.request_id, value], 'P0001', 'native return plan is immutable')
  assert.deepEqual(await row(p), before)
})
for (const field of ['native_return_id', 'order_change_id']) test(`immutable_${field}`, async () => {
  const p = plan(`immutable_${field}`); await seed(p, 'begun'); const before = await row(p)
  await sqlReject(`UPDATE native_return_execution SET ${field}='changed',phase='items_started' WHERE request_id=$1`, [p.request_id], 'P0001', 'native return identity is immutable')
  assert.deepEqual(await row(p), before)
})
test('phase_rewind_refused', async () => {
  const p = plan('rewind'); await seed(p, 'items_done'); const before = await row(p)
  await sqlReject("UPDATE native_return_execution SET phase='begun' WHERE request_id=$1", [p.request_id], 'P0001', 'illegal native return phase transition'); assert.deepEqual(await row(p), before)
})
test('delete_refused', async () => {
  const p = plan('delete'); await seed(p); const before = await row(p)
  await sqlReject('DELETE FROM native_return_execution WHERE request_id=$1', [p.request_id], 'P0001', 'native return evidence is permanent'); assert.deepEqual(await row(p), before)
})
test('truncate_refused', async () => {
  const before = (await observer.query('SELECT * FROM native_return_execution ORDER BY request_id')).rows
  await sqlReject('TRUNCATE native_return_execution', [], 'P0001', 'native return evidence is permanent')
  assert.deepEqual((await observer.query('SELECT * FROM native_return_execution ORDER BY request_id')).rows, before)
})
for (const field of ['native_return_id', 'order_change_id']) test(`unique_${field}`, async () => {
  const p = plan(`unique_${field}`), q = plan(`duplicate_${field}`); await seed(p, 'begun'); await seed(q, 'begin_started')
  const ids = identity(q); ids[field === 'native_return_id' ? 'return_id' : 'order_change_id'] = identity(p)[field === 'native_return_id' ? 'return_id' : 'order_change_id']
  await sqlReject("UPDATE native_return_execution SET phase='begun',native_return_id=$2,order_change_id=$3 WHERE request_id=$1", [q.request_id, ids.return_id, ids.order_change_id], '23505')
  assert.equal((await row(q)).phase, 'begin_started')
})
test('unique_unfinished_order_and_new_request_after_confirmed', async () => {
  const p = plan('unfinished'); await seed(p); const q = plan('duplicate_order', p.order_id)
  await sqlReject("INSERT INTO native_return_execution(request_id,order_id,fingerprint,plan,phase) VALUES($1,$2,$3,$4::jsonb,'pending')", [q.request_id, q.order_id, fingerprint(q), JSON.stringify(q)], '23505')
  await fresh(s => execute(s, p, callbacks(p).effects)); await seed(q)
  const f = callbacks(p); await fresh(s => execute(s, p, f.effects)); assert.deepEqual(f.calls, ['verify:confirmed'])
})
test('native_and_verification_failures_sanitized', async () => {
  const p = plan('failure'), f = callbacks(p, { begin: async () => { throw new Error('fixture-private-secret') } })
  await rejects(fresh(s => execute(s, p, f.effects)), 'native_failure'); assert.equal((await row(p)).phase, 'begin_started')
  const q = plan('verification'); await seed(q, 'begun')
  await rejects(fresh(s => execute(s, q, callbacks(q, { verify: async () => { throw new Error('fixture-private-secret') } }).effects)), 'verification_failure')
  assert.equal((await row(q)).phase, 'begun'); assert.deepEqual(await effectsFor(q), [])
})
test('storage_checkpoint_failure_sanitized_no_effect', async () => {
  const p = plan('checkpoint_failure')
  await observer.query(`CREATE FUNCTION fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='checkpoint_failure' AND NEW.phase='begin_started' THEN RAISE EXCEPTION 'fixture-private-secret'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_failure BEFORE UPDATE ON native_return_execution FOR EACH ROW EXECUTE FUNCTION fixture_fail()`)
  try { const f = callbacks(p); await rejects(fresh(s => execute(s, p, f.effects)), 'storage_failure'); assert.deepEqual(f.calls, []); assert.equal((await row(p)).phase, 'pending') }
  finally { await observer.query('DROP TRIGGER fixture_failure ON native_return_execution; DROP FUNCTION fixture_fail()') }
})
test('real_knex_transaction_rejected', async () => {
  await fresh(async (_s, k) => { await k.transaction(async tx => { assert.throws(() => store(tx), e => e.code === 'invalid_input') }) })
})
test('migration_down_refused_preserves_all_evidence', async () => {
  const before = (await observer.query('SELECT * FROM native_return_execution ORDER BY request_id')).rows
  const migration = new CandidateMigration(undefined, undefined); assert(migration instanceof Migration)
  await assert.rejects(migration.down(), { message: 'native_return_execution is permanent; rollback requires explicit reconciliation' })
  assert.deepEqual(migration.getQueries(), []); emit('MIGRATION_DOWN_REFUSED', { emitted_queries: 0, preserved_rows: before.length })
  assert.deepEqual((await observer.query('SELECT * FROM native_return_execution ORDER BY request_id')).rows, before)
})
async function main() {
  await observer.connect()
  emit('RUNTIME_METADATA', { boundary: 'synthetic native-effect callbacks; NOT actual Medusa lifecycle', expected_tests: cases.length, node: process.version,
    postgres: (await observer.query('SELECT version() version')).rows[0].version, knex: dependencies('knex/package.json').version, pg: dependencies('pg/package.json').version, swc: dependencies('@swc/core/package.json').version,
    source_hashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(source + '/' + f)).digest('hex')])) })
  assert.equal(cases.length, 27)
  const results = []
  for (const t of cases) { try { await t.run(); results.push({ name: t.name, status: 'passed' }) } catch (e) { results.push({ name: t.name, status: 'failed', error: String(e.stack) }); process.exitCode = 1 } emit('TEST_RESULT', results.at(-1)) }
  emit('NATIVE_RETURN_RESULT', { expected: 27, passed: results.filter(x => x.status === 'passed').length, failed: results.filter(x => x.status === 'failed').length, skipped: 0, results })
}
;(process.argv[2] ? workerMain() : main()).catch(e => { emit('FATAL_ERROR', String(e.stack)); process.exitCode = 1 }).finally(async () => {
  for (const child of children) child.kill('SIGKILL')
  await Promise.all([...pools].map(k => k.destroy()))
  await observer.end().catch(e => { emit('CLEANUP_ERROR', String(e)); process.exitCode = 1 })
})
