'use strict'
/** Actual candidate TS, real MikroORM Migration base, real Knex/pg, disposable PostgreSQL.
 * Only money-effect callbacks are synthetic; neither engine, SQL nor store is replaced.
 * Run through ../run-settlement-postgres.py, never against an existing database.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { createRequire } = require('node:module')
const dependencies = createRequire('/app/apps/backend/package.json')
const swc = dependencies('@swc/core')
const knexFactory = dependencies('knex')
const { Client } = dependencies('pg')
const { Migration } = dependencies('@medusajs/framework/mikro-orm/migrations')
const source = '/app/apps/backend/audit-src'
assert.equal(process.env.SETTLEMENT_ISOLATED_FIXTURE, '1', 'use the isolated Python launcher')
require.extensions['.ts'] = (module, filename) => {
  assert(filename.startsWith(source + '/'), `unexpected TypeScript import: ${filename}`)
  const { code } = swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
    module: { type: 'commonjs' }, sourceMaps: false,
  })
  module._compile(code, filename)
}
const { executeSettlement } = require(source + '/utils/refund-settlement.ts')
const { createPostgresSettlementStore } = require(source + '/utils/refund-settlement-store.ts')
const { Migration20261002152627: CandidateMigration } = require(source + '/modules/split-order-payment/migrations/Migration20261002152627.ts')
const connection = { host: '127.0.0.1', port: 5432, user: 'postgres', database: 'settlement_acceptance', connectionTimeoutMillis: 4000, statement_timeout: 5000 }
const pools = new Set()
function pool(user = 'postgres') {
  const k = knexFactory({ client: 'pg', connection: { ...connection, user }, pool: { min: 0, max: 1 }, acquireConnectionTimeout: 5000 })
  pools.add(k)
  return k
}
async function dispose(k) { try { await k.destroy() } finally { pools.delete(k) } }
const input = (id, scope = `scope_${id}`) => ({ operation_id: id, order_id: `order_${scope}`, scope_id: scope, fingerprint: `request-v1:${id}` })
const plan = (r, extra = {}) => ({ operation_id: r.operation_id, order_id: r.order_id, scope_id: r.scope_id, payment_id: `pay_${r.scope_id}`, split_order_payment_id: `split_${r.scope_id}`, payout_id: `payout_${r.scope_id}`, currency_code: 'eur', customerRefund: 20, sellerReversal: 18, ...extra })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function bounded(promise, label, ms = 5000) {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms) })]) }
  finally { clearTimeout(timer) }
}
const observer = new Client({ ...connection, application_name: 'settlement_observer' })
let storeA, storeB, knexA, knexB
const emit = (tag, value) => console.log(`${tag} ${JSON.stringify(value)}`)
const key = scope => crypto.createHash('sha256').update(`hobbysalon:refund-settlement:v1:${scope}`).digest().readBigInt64BE().toString()
async function row(r) { return (await observer.query('SELECT * FROM refund_settlement WHERE operation_id=$1', [r.operation_id])).rows[0] }
async function effectRows(r) { return (await observer.query('SELECT leg FROM fixture_effects WHERE operation_id=$1 ORDER BY id', [r.operation_id])).rows.map(x => x.leg) }
async function assertVisible(r, phase) {
  const saved = await row(r)
  assert(saved, 'independent connection must see committed row before effect')
  assert.equal(saved.phase, phase)
  const locks = (await observer.query(`SELECT l.pid, a.state, a.xact_start FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
    WHERE l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid::bigint=(($1::bigint >> 32) & 4294967295) AND l.objid::bigint=($1::bigint & 4294967295)`, [key(r.scope_id)])).rows
  assert.equal(locks.length, 1, 'effect must be inside the actual PostgreSQL session advisory lock')
  assert.notEqual(locks[0].pid, observer.processID, 'observer must use another physical connection')
  assert.equal(locks[0].state, 'idle', 'no transaction around external effect')
  assert.equal(locks[0].xact_start, null, 'started write must already be autocommitted')
  return locks[0].pid
}
async function recordEffect(r, leg) {
  await assertVisible(r, leg === 'refund' ? 'refund_started' : 'reversal_started')
  await observer.query('INSERT INTO fixture_effects(operation_id,leg) VALUES($1,$2)', [r.operation_id, leg])
}
function effects(r, changes = {}) {
  const calls = []
  return { calls, callbacks: {
    plan: async () => { calls.push('plan'); return plan(r) },
    refund: async () => { calls.push('refund'); await recordEffect(r, 'refund'); return { id: 'synthetic_refund' } },
    reverse: async p => { calls.push('reverse'); await recordEffect(r, 'reverse'); return {operation_id:p.operation_id,payout_id:p.payout_id,currency_code:p.currency_code,amount:p.sellerReversal,receipt_id:`receipt_${p.operation_id}`} },
    ...changes,
  } }
}
function noCallbacks() {
  const calls = []
  const callbacks = Object.fromEntries(['plan', 'refund', 'reverse', 'recoverReversal'].map(name => [name, async () => { calls.push(name); throw new Error(`unexpected callback ${name}`) }]))
  return { calls, callbacks }
}
async function rejectsCode(promise, code) {
  await assert.rejects(promise, error => {
    assert.equal(error.code, code)
    assert.equal(error.message, `Settlement ${code}`)
    assert.equal(error.cause, undefined)
    assert(!String(error.stack).includes('fixture-private-'))
    return true
  })
}
async function sqlReject(sql, bindings, code) {
  await assert.rejects(observer.query(sql, bindings), error => { assert.equal(error.code, code); return true })
}
async function seed(r, phase = 'pending', extra = {}) {
  const p = plan(r, extra)
  await storeA.withScopeLock(r.scope_id, async session => {
    await session.create({ input: r, plan: p, phase: 'pending', reversal_receipt_id: null })
    let current = 'pending'
    const route = p.customerRefund > 0 ? ['refund_started', 'refund_completed'] : ['refund_completed']
    if (p.sellerReversal > 0) route.push('reversal_started')
    route.push('completed')
    for (const next of route) {
      if (current === phase) break
      await session.transition(r.operation_id, current, next)
      current = next
    }
    assert.equal(current, phase)
  })
  return p
}
async function migration(direction) {
  // Undefined driver/config is sufficient for this addSql-only migration. No base class stub,
  // addSql override, SQL extraction regex, source replacement, ORM or application startup.
  const instance = new CandidateMigration(undefined, undefined)
  assert(instance instanceof Migration)
  await instance[direction]()
  const queries = [...instance.getQueries()]
  assert.equal(queries.length, direction === 'up' ? 4 : 2)
  assert(queries.every(sql => typeof sql === 'string' && sql.trim().length > 0))
  emit('MIGRATION_SQL', { direction, queries })
  await observer.query('BEGIN')
  try { for (const sql of queries) await observer.query(sql); await observer.query('COMMIT') }
  catch (error) { await observer.query('ROLLBACK'); throw error }
  return queries
}
async function freshStore(fn) {
  const k = pool()
  try { return await fn(createPostgresSettlementStore(k), k) } finally { await dispose(k) }
}
async function failTransition(r, phase, fn) {
  // Fixture-only PostgreSQL fault injection; the actual store and all product guards stay intact.
  assert(/^[a-z_]+$/.test(r.operation_id) && /^[a-z_]+$/.test(phase))
  await observer.query(`CREATE FUNCTION fixture_fail_transition() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.operation_id='${r.operation_id}' AND NEW.phase='${phase}' THEN
      RAISE EXCEPTION 'fixture-private-checkpoint-fault'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_fail_transition BEFORE UPDATE ON refund_settlement FOR EACH ROW EXECUTE FUNCTION fixture_fail_transition()`)
  try { await fn() } finally {
    await observer.query('DROP TRIGGER fixture_fail_transition ON refund_settlement; DROP FUNCTION fixture_fail_transition()')
  }
}
async function waitDisconnected(scope) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const result = await observer.query(`SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND granted
      AND classid::bigint=(($1::bigint >> 32) & 4294967295) AND objid::bigint=($1::bigint & 4294967295)`, [key(scope)])
    if (result.rows[0].n === 0) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('crashed process left session advisory lock behind')
}
async function crash(r, leg, receipt = false) {
  const child = spawn(process.execPath, ['--max-old-space-size=48', __filename, '--crash-worker', JSON.stringify(r), leg, String(receipt)], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_OPTIONS: '' },
  })
  let stdout = '', stderr = ''
  child.stdout.on('data', data => { stdout += data; assert(stdout.length < 65536) })
  child.stderr.on('data', data => { stderr += data; assert(stderr.length < 65536) })
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })) })
  try {
    const status = await bounded(exited, 'crash subprocess', 15000)
    assert.equal(status.code, null, stderr)
    assert.equal(status.signal, 'SIGKILL', stderr)
    const points = stdout.split('\n').filter(line => line.startsWith('CRASH_POINT '))
    assert.equal(points.length, 1, stdout + stderr)
    const point = JSON.parse(points[0].slice('CRASH_POINT '.length))
    assert.equal(point.leg, leg)
    assert.equal(point.operation_id, r.operation_id)
    await waitDisconnected(r.scope_id)
    emit('CRASH_OBSERVED', { ...point, ...status })
    return point
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await bounded(exited, 'crash subprocess cleanup', 3000)
  }
}
async function crashWorker() {
  const r = JSON.parse(process.argv[3]), leg = process.argv[4], saveReceipt = process.argv[5] === 'true'
  await observer.connect()
  const k = pool(), store = createPostgresSettlementStore(k)
  const f = effects(r)
  const original = f.callbacks[leg]
  f.callbacks[leg] = async p => {
    await original(p)
    const pid = await assertVisible(r, leg === 'refund' ? 'refund_started' : 'reversal_started')
    if (saveReceipt) {
      assert.equal(leg, 'reverse')
      await observer.query('INSERT INTO fixture_receipts(operation_id,evidence) VALUES($1,$2::jsonb)', [r.operation_id, JSON.stringify({ operation_id: r.operation_id, payout_id: p.payout_id, currency_code: p.currency_code, amount: p.sellerReversal, receipt_id: `receipt_${r.operation_id}` })])
    }
    // Real process death after the synthetic external effect commits but BEFORE returning to the
    // engine, so its finally/unlock and completion checkpoint cannot run.
    fs.writeSync(1, `CRASH_POINT ${JSON.stringify({ operation_id: r.operation_id, leg, pid, receipt: saveReceipt })}\n`)
    process.kill(process.pid, 'SIGKILL')
    await new Promise(() => {})
  }
  await executeSettlement(store, r, f.callbacks)
  throw new Error('crash worker unexpectedly survived')
}
const cases = []
const test = (name, run) => cases.push({ name, run })
test('migration_up_fresh', async () => {
  const tables = await observer.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")
  assert.deepEqual(tables.rows, [])
  await migration('up')
  const objects = (await observer.query(`SELECT to_regclass('refund_settlement')::text AS ledger,
    to_regclass('refund_settlement_unfinished_scope')::text AS scope_index,
    to_regprocedure('refund_settlement_guard()')::text AS guard`)).rows[0]
  assert.deepEqual(objects, { ledger: 'refund_settlement', scope_index: 'refund_settlement_unfinished_scope', guard: 'refund_settlement_guard()' })
  assert.equal((await observer.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='refund_settlement'::regclass AND NOT tgisinternal")).rows[0].n, 1)
})
test('migration_down', async () => {
  await migration('down')
  const objects = (await observer.query("SELECT to_regclass('refund_settlement') AS ledger, to_regclass('refund_settlement_unfinished_scope') AS scope_index, to_regprocedure('refund_settlement_guard()') AS guard")).rows[0]
  assert.deepEqual(objects, { ledger: null, scope_index: null, guard: null })
})
test('migration_reapply', async () => {
  await migration('up')
  assert.equal((await observer.query('SELECT count(*)::int n FROM refund_settlement')).rows[0].n, 0)
  await observer.query('CREATE TABLE fixture_effects(id bigserial PRIMARY KEY, operation_id text NOT NULL, leg text NOT NULL); CREATE TABLE fixture_receipts(operation_id text PRIMARY KEY, evidence jsonb NOT NULL)')
})
for (const field of ['operation_id', 'order_id', 'scope_id', 'fingerprint', 'plan', 'created_at']) test(`immutable_${field}`, async () => {
  const r = input(`immutable_${field}`)
  await seed(r)
  const before = await row(r)
  // Include an otherwise LEGAL phase advance: a no-op phase would be rejected even if the
  // immutability guard were missing, making the mutation test a false positive.
  const sql = `UPDATE refund_settlement SET ${field}=$2, phase='refund_started' WHERE operation_id=$1`
  let value = `changed_${field}`
  if (field === 'plan') value = JSON.stringify({ ...before.plan, customerRefund: 21 })
  if (field === 'created_at') value = '2000-01-01T00:00:00Z'
  await sqlReject(sql, [r.operation_id, value], 'P0001')
  assert.deepEqual(await row(r), before)
})
test('delete_forbidden', async () => {
  const r = input('delete_forbidden'); await seed(r)
  await sqlReject('DELETE FROM refund_settlement WHERE operation_id=$1', [r.operation_id], 'P0001')
  assert.equal((await row(r)).phase, 'pending')
})
test('initial_phase_and_receipt_guard', async () => {
  for (const [phase, receipt] of [['completed', null], ['refund_started', null], ['pending', 'unearned']]) {
    const r = input('bad_initial_' + phase + (receipt || ''))
    await sqlReject('INSERT INTO refund_settlement(operation_id,order_id,scope_id,fingerprint,plan,phase,reversal_receipt_id) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)', [r.operation_id, r.order_id, r.scope_id, r.fingerprint, JSON.stringify(plan(r)), phase, receipt], 'P0001')
    assert.equal(await row(r), undefined)
  }
})
test('phase_graph_all_positive_leg_pairs', async () => {
  const phases = ['pending', 'refund_started', 'refund_completed', 'reversal_started', 'completed']
  for (let i = 0; i < phases.length; i++) for (let j = 0; j < phases.length; j++) {
    const r = input(`graph_${i}_${j}`); await seed(r, phases[i])
    const query = 'UPDATE refund_settlement SET phase=$2 WHERE operation_id=$1', args = [r.operation_id, phases[j]]
    if (j === i + 1) await observer.query(query, args)
    else await sqlReject(query, args, 'P0001')
    assert.equal((await row(r)).phase, j === i + 1 ? phases[j] : phases[i])
  }
})
test('zero_legs_follow_only_legal_skips', async () => {
  const r = input('zero_legs'), p = plan(r, { customerRefund: 0, sellerReversal: 0, payment_id: null, payout_id: null })
  const f = noCallbacks(); f.callbacks.plan = async () => p
  const result = await executeSettlement(storeA, r, f.callbacks)
  assert.equal(result.receipt.phase, 'completed'); assert.deepEqual(f.calls, [])
  const blocked = input('zero_blocked'); await seed(blocked, 'pending', { customerRefund: 0, sellerReversal: 0 })
  await sqlReject("UPDATE refund_settlement SET phase='refund_started' WHERE operation_id=$1", [blocked.operation_id], 'P0001')
})
test('plan_identity_and_phase_constraints', async () => {
  for (const [label, change] of [['identity', { operation_id: 'other' }], ['amount', { customerRefund: -1 }], ['currency', { currency_code: 'EUR' }], ['missing', { currency_code: undefined }]]) {
    const r = input(`bad_plan_${label}`)
    await sqlReject('INSERT INTO refund_settlement(operation_id,order_id,scope_id,fingerprint,plan) VALUES($1,$2,$3,$4,$5::jsonb)', [r.operation_id, r.order_id, r.scope_id, r.fingerprint, JSON.stringify(plan(r, change))], '23514')
  }
})
test('autocommit_started_visible_before_each_effect', async () => {
  const r = input('autocommit'), f = effects(r), statements = []
  const onQuery = q => statements.push(q.sql)
  knexA.on('query', onQuery)
  try {
    const result = await executeSettlement(storeA, r, f.callbacks)
    assert.equal(result.receipt.phase, 'completed')
    assert.deepEqual(await effectRows(r), ['refund', 'reverse'])
    assert.deepEqual(f.calls, ['plan', 'refund', 'reverse'])
    assert(statements.some(sql => /^SET SESSION synchronous_commit = on$/i.test(sql)))
    assert(!statements.some(sql => /^(BEGIN|START TRANSACTION|COMMIT|ROLLBACK)\b/i.test(sql)))
  } finally { knexA.off('query', onQuery) }
})
test('competing_same_scope_never_double_effect', async () => {
  const r = input('competing'), entered = deferred(), release = deferred()
  const a = effects(r, { refund: async () => { await recordEffect(r, 'refund'); entered.resolve(); await release.promise } })
  const active = executeSettlement(storeA, r, a.callbacks); active.catch(() => {})
  try {
    await bounded(Promise.race([entered.promise, active.then(() => { throw new Error('not held') })]), 'first refund')
    for (const request of [r, input('competitor_distinct', r.scope_id)]) {
      const other = noCallbacks()
      await rejectsCode(executeSettlement(storeB, request, other.callbacks), 'lock_unavailable')
      assert.deepEqual(other.calls, [])
    }
    assert.deepEqual(await effectRows(r), ['refund'])
  } finally { release.resolve(); await active }
  assert.deepEqual(await effectRows(r), ['refund', 'reverse'])
})
test('equal_amount_independent_operations_after_completed', async () => {
  const a = input('equal_a', 'equal_scope'), b = input('equal_b', 'equal_scope')
  for (const [store, r] of [[storeA, a], [storeB, b]]) {
    const f = effects(r); assert.equal((await executeSettlement(store, r, f.callbacks)).receipt.phase, 'completed')
    assert.deepEqual(f.calls, ['plan', 'refund', 'reverse']); assert.deepEqual(await effectRows(r), ['refund', 'reverse'])
  }
  assert.equal((await row(a)).plan.customerRefund, (await row(b)).plan.customerRefund)
  assert.notEqual((await row(a)).operation_id, (await row(b)).operation_id)
})
test('different_scopes_progress_concurrently', async () => {
  const a = input('parallel_a'), b = input('parallel_b'), enteredA = deferred(), enteredB = deferred(), release = deferred()
  const held = (r, entered) => effects(r, { refund: async () => { await recordEffect(r, 'refund'); entered.resolve(); await release.promise } }).callbacks
  const activeA = executeSettlement(storeA, a, held(a, enteredA)); activeA.catch(() => {})
  let activeB
  try {
    await bounded(Promise.race([enteredA.promise, activeA]), 'scope A entered')
    activeB = executeSettlement(storeB, b, held(b, enteredB)); activeB.catch(() => {})
    await bounded(Promise.race([enteredB.promise, activeB]), 'scope B entered while A held')
    const pidA = await assertVisible(a, 'refund_started'), pidB = await assertVisible(b, 'refund_started')
    assert.notEqual(pidA, pidB)
  } finally { release.resolve(); await Promise.all([activeA, activeB]) }
  assert.deepEqual(await effectRows(a), ['refund', 'reverse']); assert.deepEqual(await effectRows(b), ['refund', 'reverse'])
})
for (const leg of ['refund', 'reverse']) test(`crash_${leg}_new_connection_no_retry`, async () => {
  const r = input(`crash_${leg}`), point = await crash(r, leg)
  assert.equal((await row(r)).phase, leg === 'refund' ? 'refund_started' : 'reversal_started')
  const before = await effectRows(r), f = noCallbacks()
  // No recovery evidence is available; even arbitrary TTL/new connection cannot retry money.
  delete f.callbacks.recoverReversal
  await freshStore(async (store, k) => {
    const pid = (await k.raw('SELECT pg_backend_pid() AS pid')).rows[0].pid
    assert.notEqual(pid, point.pid)
    for (let attempt = 0; attempt < 2; attempt++) await rejectsCode(executeSettlement(store, r, f.callbacks), 'reconciliation_required')
    const competing = noCallbacks()
    await rejectsCode(executeSettlement(store, input(r.operation_id + '_other', r.scope_id), competing.callbacks), 'scope_blocked')
    assert.deepEqual(competing.calls, [])
  })
  assert.deepEqual(f.calls, []); assert.deepEqual(await effectRows(r), before)
})
test('completed_replay_new_pool_no_replan_or_effect', async () => {
  const r = input('replay'), f = effects(r)
  const result = await executeSettlement(storeA, r, f.callbacks), never = noCallbacks()
  await freshStore(async store => {
    assert.deepEqual(await executeSettlement(store, r, never.callbacks), result)
    for (const change of [{ fingerprint: 'changed' }, { order_id: 'changed' }, { scope_id: 'changed' }]) {
      await rejectsCode(executeSettlement(store, { ...r, ...change }, never.callbacks), 'identity_conflict')
    }
  })
  assert.deepEqual(never.calls, []); assert.deepEqual(await effectRows(r), ['refund', 'reverse'])
})
test('customer_completed_resumes_reversal_only', async () => {
  // Actual API spelling is refund_completed, not customer_completed.
  const r = input('resume_customer'), savedPlan = plan(r, { customerRefund: 12, sellerReversal: 9 })
  const first = effects(r, { plan: async () => savedPlan })
  await failTransition(r, 'reversal_started', async () => {
    await rejectsCode(executeSettlement(storeA, r, first.callbacks), 'storage_failure')
  })
  assert.equal((await row(r)).phase, 'refund_completed'); assert.deepEqual(await effectRows(r), ['refund'])
  const never = noCallbacks(); let reversals = 0
  never.callbacks.reverse = async p => { reversals++; assert.deepEqual(p, savedPlan); await recordEffect(r, 'reverse'); return {operation_id:p.operation_id,payout_id:p.payout_id,currency_code:p.currency_code,amount:p.sellerReversal,receipt_id:`receipt_${p.operation_id}`} }
  await freshStore(async store => {
    const result = await executeSettlement(store, r, never.callbacks)
    assert.equal(result.receipt.phase, 'completed')
    assert.equal(result.receipt.reversal_receipt_id, `receipt_${r.operation_id}`)
    assert.equal((await row(r)).reversal_receipt_id, result.receipt.reversal_receipt_id)
  })
  assert.deepEqual(never.calls, []); assert.equal(reversals, 1); assert.deepEqual(await effectRows(r), ['refund', 'reverse'])
})
test('saved_reversal_receipt_recovers_crashed_started', async () => {
  const r = input('saved_receipt'); await crash(r, 'reverse', true)
  assert.equal((await row(r)).phase, 'reversal_started')
  const never = noCallbacks(); let reads = 0
  never.callbacks.recoverReversal = async p => {
    reads++
    const proof = (await observer.query('SELECT evidence FROM fixture_receipts WHERE operation_id=$1', [p.operation_id])).rows[0].evidence
    assert.equal(proof.amount, p.sellerReversal)
    return proof
  }
  await freshStore(async store => {
    const result = await executeSettlement(store, r, never.callbacks)
    assert.equal(result.receipt.phase, 'completed'); assert.equal(result.receipt.reversal_receipt_id, `receipt_${r.operation_id}`)
    assert.deepEqual(await executeSettlement(store, r, never.callbacks), result)
  })
  assert.equal(reads, 1); assert.deepEqual(never.calls, []); assert.deepEqual(await effectRows(r), ['refund', 'reverse'])
  await sqlReject('UPDATE refund_settlement SET reversal_receipt_id=$2 WHERE operation_id=$1', [r.operation_id, 'changed'], 'P0001')
})
test('first_write_permission_failure_no_effect', async () => {
  await observer.query('CREATE ROLE fixture_noinsert LOGIN; GRANT USAGE ON SCHEMA public TO fixture_noinsert; GRANT SELECT, UPDATE ON refund_settlement TO fixture_noinsert')
  const k = pool('fixture_noinsert'), r = input('first_write_failure'), f = effects(r)
  try {
    const store = createPostgresSettlementStore(k)
    await rejectsCode(executeSettlement(store, r, f.callbacks), 'storage_failure')
    assert.deepEqual(f.calls, ['plan']); assert.equal(await row(r), undefined); assert.deepEqual(await effectRows(r), [])
    await observer.query('GRANT INSERT ON refund_settlement TO fixture_noinsert')
    assert.equal((await executeSettlement(store, r, f.callbacks)).receipt.phase, 'completed')
    assert.deepEqual(f.calls, ['plan', 'plan', 'refund', 'reverse'])
  } finally { await dispose(k) }
})
test('started_checkpoint_failure_no_effect', async () => {
  const r = input('started_write_failure'), f = effects(r)
  await failTransition(r, 'refund_started', async () => {
    await rejectsCode(executeSettlement(storeA, r, f.callbacks), 'storage_failure')
  })
  assert.equal((await row(r)).phase, 'pending'); assert.deepEqual(f.calls, ['plan']); assert.deepEqual(await effectRows(r), [])
  const never = noCallbacks(), resume = effects(r); resume.callbacks.plan = never.callbacks.plan
  await executeSettlement(storeB, r, resume.callbacks)
  assert.deepEqual(never.calls, []); assert.deepEqual(await effectRows(r), ['refund', 'reverse'])
})
test('unique_unfinished_scope_and_duplicate_operation', async () => {
  const a = input('unique_a', 'unique_scope'), b = input('unique_b', 'unique_scope')
  await seed(a)
  for (const r of [a, b]) await sqlReject('INSERT INTO refund_settlement(operation_id,order_id,scope_id,fingerprint,plan) VALUES($1,$2,$3,$4,$5::jsonb)', [r.operation_id, r.order_id, r.scope_id, r.fingerprint, JSON.stringify(plan(r))], '23505')
  assert.equal(await row(b), undefined)
})
test('store_transition_compare_and_swap_and_scope_bound', async () => {
  const r = input('cas'); await seed(r)
  await storeA.withScopeLock(r.scope_id, async session => {
    await rejectsCode(session.transition(r.operation_id, 'refund_completed', 'reversal_started'), 'storage_failure')
    assert.equal((await session.getOperation(r.operation_id)).phase, 'pending')
  })
  await storeB.withScopeLock('wrong_scope', async session => {
    await rejectsCode(session.transition(r.operation_id, 'pending', 'refund_started'), 'storage_failure')
  })
  assert.equal((await row(r)).phase, 'pending')
})
test('real_knex_transaction_rejected', async () => {
  await knexA.transaction(async trx => {
    assert.throws(() => createPostgresSettlementStore(trx), error => error.code === 'invalid_input')
  })
})
const EXPECTED_TESTS = 28
async function main() {
  assert.equal(cases.length, EXPECTED_TESTS, 'test inventory changed: update both helper and launcher deliberately')
  assert.equal(new Set(cases.map(t => t.name)).size, EXPECTED_TESTS)
  await observer.connect()
  assert.equal((await observer.query('SELECT current_database() AS name')).rows[0].name, 'settlement_acceptance')
  const version = (await observer.query('SELECT version() AS version, current_setting(\'server_version\') AS server_version, current_setting(\'fsync\') AS fsync, current_setting(\'synchronous_commit\') AS synchronous_commit')).rows[0]
  assert.equal(version.fsync, 'on'); assert.equal(version.synchronous_commit, 'on')
  const hashes = Object.fromEntries(['utils/refund-settlement.ts', 'utils/refund-settlement-store.ts', 'modules/split-order-payment/migrations/Migration20261002152627.ts'].map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(source, name))).digest('hex')]))
  emit('RUNTIME_METADATA', { node: process.version, postgres: version, knex: dependencies('knex/package.json').version, pg: dependencies('pg/package.json').version, swc: dependencies('@swc/core/package.json').version, source_hashes: hashes, expected_tests: EXPECTED_TESTS })
  knexA = pool(); knexB = pool()
  storeA = createPostgresSettlementStore(knexA); storeB = createPostgresSettlementStore(knexB)
  const results = []
  for (const t of cases) {
    const start = Date.now()
    try { await t.run(); results.push({ name: t.name, status: 'passed', ms: Date.now() - start }) }
    catch (error) { results.push({ name: t.name, status: 'failed', ms: Date.now() - start, error: String(error.stack || error) }) }
    emit('TEST_RESULT', results.at(-1))
    // Migration failure makes downstream results meaningless: emit explicit skipped entries, never
    // a green reduced suite, while still permitting fixture teardown and full evidence collection.
    if (results.at(-1).status === 'failed' && t.name.startsWith('migration_')) {
      for (const rest of cases.slice(results.length)) { const skipped = { name: rest.name, status: 'skipped', reason: 'migration prerequisite failed' }; results.push(skipped); emit('TEST_RESULT', skipped) }
      break
    }
  }
  const summary = { expected: EXPECTED_TESTS, passed: results.filter(x => x.status === 'passed').length, failed: results.filter(x => x.status === 'failed').length, skipped: results.filter(x => x.status === 'skipped').length, results }
  emit('SETTLEMENT_RESULT', summary)
  process.exitCode = summary.passed === EXPECTED_TESTS && summary.failed === 0 && summary.skipped === 0 ? 0 : 1
}
async function cleanup() {
  const errors = []
  for (const k of [...pools]) { try { await dispose(k) } catch (error) { errors.push(String(error)) } }
  try { await observer.end() } catch (error) { errors.push(String(error)) }
  if (errors.length) { emit('CLEANUP_ERROR', errors); process.exitCode = 1 }
}
;(process.argv[2] === '--crash-worker' ? crashWorker() : main())
  .catch(error => { emit('FATAL_ERROR', { error: String(error.stack || error) }); process.exitCode = 1 })
  .finally(cleanup)
