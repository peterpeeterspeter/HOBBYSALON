'use strict'
/** Real candidate engine/store/migrations + PostgreSQL. Synthetic transfer/link only.
 * Run via run-payout-execution-postgres.py; never point at an existing database. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { fork } = require('node:child_process')
const dependencies = require('node:module').createRequire('/app/apps/backend/package.json')
const swc = dependencies('@swc/core'), knexFactory = dependencies('knex')
const { Client } = dependencies('pg')
const { Migration } = dependencies('@medusajs/framework/mikro-orm/migrations')
const source = '/app/apps/backend/audit-src'
const FILES = ['utils/payout-execution.ts', 'utils/refund-settlement.ts', 'utils/refund-settlement-store.ts', 'modules/payout/migrations/Migration20261002170000.ts', 'modules/split-order-payment/migrations/Migration20261002152627.ts']
const EXTRA = {
  'apps/backend/src/utils/commerce-recovery-report.ts': '/app/apps/backend/audit-recovery-report.ts',
  'packages/modules/requests/src/modules/order-return-request/migrations/Migration20261002163000.ts': '/app/apps/backend/audit-native-return-migration.ts',
}
const sourcePaths = { ...Object.fromEntries(FILES.map(f => [f, source + '/' + f])), ...EXTRA }
assert.equal(process.env.PAYOUT_ISOLATED_FIXTURE, '1')
require.extensions['.ts'] = (module, filename) => {
  assert(filename.startsWith(source + '/') || Object.values(EXTRA).includes(filename))
  module._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'commonjs' } }).code, filename)
}
const { executePayout, createPostgresPayoutExecutionStore } = require(source + '/' + FILES[0])
const { executeSettlement } = require(source + '/' + FILES[1])
const { createPostgresSettlementStore } = require(source + '/' + FILES[2])
const { Migration20261002170000: PayoutMigration } = require(source + '/' + FILES[3])
const { Migration20261002152627: RefundMigration } = require(source + '/' + FILES[4])
const { Migration20261002163000: NativeMigration } = require(EXTRA['packages/modules/requests/src/modules/order-return-request/migrations/Migration20261002163000.ts'])
const { readCommerceRecoveryReport, parseRecoveryFilters, RecoveryFilterError } = require(EXTRA['apps/backend/src/utils/commerce-recovery-report.ts'])
const connection = { host: '127.0.0.1', user: 'postgres', database: 'payout_execution_acceptance', connectionTimeoutMillis: 4000, statement_timeout: 5000 }
const observer = new Client(connection), pools = new Set(), children = new Set()
const emit = (tag, data) => console.log(tag + ' ' + JSON.stringify(data))
const input = (id, scope = 'collection_' + id) => ({ order_id: id, scope_id: scope })
const plan = (r, amount = 18) => ({ amount, currency: 'eur', account_id: 'acct_fixture', account_reference_id: 'connect_fixture', source_transaction: 'charge_' + r.scope_id, transaction_id: r.order_id })
const refundInput = r => ({ ...r, operation_id: 'refund_' + r.order_id, fingerprint: 'v1:' + r.order_id })
const refundPlan = r => ({ operation_id: r.operation_id, order_id: r.order_id, scope_id: r.scope_id, payment_id: 'payment_fixture', split_order_payment_id: 'split_fixture', payout_id: null, currency_code: 'eur', customerRefund: 2, sellerReversal: 0 })
const key = scope => crypto.createHash('sha256').update('hobbysalon:refund-settlement:v1:' + scope).digest().readBigInt64BE().toString()
async function bounded(promise, ms = 12000) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('fixture timeout')), ms) })]) } finally { clearTimeout(timer) } }
function pool() { const k = knexFactory({ client: 'pg', connection, pool: { min: 0, max: 1 }, acquireConnectionTimeout: 5000 }); pools.add(k); return k }
async function fresh(fn) {
  // Separate physical root pools: the session lock stays held while short ledger transactions commit.
  const lockPool = pool(), writePool = pool()
  try { return await fn(createPostgresSettlementStore(lockPool), createPostgresPayoutExecutionStore(writePool), writePool) }
  finally { for (const k of [lockPool, writePool]) { await k.destroy(); pools.delete(k) } }
}
async function row(r) { return (await observer.query('SELECT * FROM payout_execution WHERE order_id=$1', [r.order_id])).rows[0] }
async function effects(r) { return (await observer.query('SELECT leg FROM fixture_effects WHERE identity=$1 ORDER BY id', [r.order_id])).rows.map(x => x.leg) }
async function visible(r, refund = false) {
  const saved = refund ? (await observer.query('SELECT phase FROM refund_settlement WHERE operation_id=$1', [r.operation_id])).rows[0] : await row(r)
  assert.equal(saved?.phase, refund ? 'refund_started' : 'started', 'started commit independently visible BEFORE effect')
  const locks = (await observer.query(`SELECT l.pid,a.state,a.xact_start FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND l.granted AND l.objsubid=1 AND l.classid::bigint=(($1::bigint >> 32)&4294967295) AND l.objid::bigint=($1::bigint&4294967295)`, [key(r.scope_id)])).rows
  assert.equal(locks.length, 1); assert.notEqual(locks[0].pid, observer.processID)
  assert.equal(locks[0].state, 'idle'); assert.equal(locks[0].xact_start, null)
  const active = (await observer.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND xact_start IS NOT NULL")).rows
  assert.deepEqual(active, [], 'no ambient transaction around external dispatch')
  return locks[0].pid
}
function callbacks(r, changes = {}) {
  const calls = []
  return { calls, callbacks: {
    plan: async () => { calls.push('plan'); return plan(r) },
    transfer: async p => { calls.push('transfer'); assert.deepEqual(p, plan(r)); await visible(r); await observer.query('INSERT INTO fixture_effects(identity,leg) VALUES($1,$2)', [r.order_id, 'transfer']); return { payout_id: 'payout_' + r.order_id, transfer_id: 'transfer_' + r.order_id } },
    link: async id => { calls.push('link'); assert.equal(id, 'payout_' + r.order_id); await observer.query('INSERT INTO fixture_effects(identity,leg) VALUES($1,$2)', [r.order_id, 'link']) },
    verify: async saved => { calls.push('verify'); assert.equal(saved.order_id, r.order_id); assert.deepEqual(saved.plan, plan(r)); assert.deepEqual(await effects(r), ['transfer', 'link']) },
    ...changes,
  } }
}
const runPayout = (r, f) => fresh((locks, store) => executePayout(locks, store, r, f.callbacks))
async function blocked(r) {
  const f = callbacks(r)
  // A surviving advisory lock or a pool acquisition timeout is NOT durable reconciliation proof.
  await assert.rejects(runPayout(r, f), e => e.code === 'storage_failure')
  assert.deepEqual(f.calls, []); return f
}
async function waitUnlocked(scope) {
  const deadline = Date.now() + 5000
  do {
    const locks = (await observer.query(`SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND granted AND objsubid=1 AND classid::bigint=(($1::bigint >> 32)&4294967295) AND objid::bigint=($1::bigint&4294967295)`, [key(scope)])).rows[0].n
    if (locks === 0) return
    await new Promise(resolve => setTimeout(resolve, 25))
  } while (Date.now() < deadline)
  throw new Error('crash session did not release its advisory lock')
}
async function seed(r, amount = 18) { await fresh((_, store) => store.start({ ...r, plan: plan(r, amount), phase: 'started', payout_id: null, transfer_id: null })) }
async function complete(r) { await fresh((_, store) => store.complete(r.order_id, r.scope_id, 'payout_' + r.order_id, 'transfer_' + r.order_id)) }
async function sqlReject(sql, args, code, message) { await assert.rejects(observer.query(sql, args), e => { assert.equal(e.code, code); if (message) assert.match(e.message, message); return true }) }
function worker(mode, r) {
  const child = fork(__filename, [mode, JSON.stringify(r)], { execArgv: ['--max-old-space-size=48'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_OPTIONS: '' } }); children.add(child)
  let output = '', errors = ''
  child.stdout.on('data', b => { output += b; if (output.length > 65536) child.kill('SIGKILL') })
  child.stderr.on('data', b => { errors += b; if (errors.length > 65536) child.kill('SIGKILL') })
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => { children.delete(child); resolve({ code, signal, output, errors }) }) })
  const ready = Promise.race([new Promise(resolve => child.once('message', resolve)), exited.then(result => { throw new Error('worker exited before ready: ' + JSON.stringify(result)) })]); ready.catch(() => {})
  return { child, exited, ready }
}
async function release(w) { if (w.child.connected) w.child.send('release'); const end = await bounded(w.exited); assert.equal(end.code, 0, end.errors); assert.equal(end.signal, null); return end }
async function workerMain() {
  await observer.connect(); const mode = process.argv[2], r = JSON.parse(process.argv[3])
  if (mode === '--retry') {
    await blocked(r); process.send({ blocked: true }); return
  }
  const hold = async refund => {
    const pid = await visible(r, refund)
    if (mode === '--crash') { fs.writeSync(1, 'CRASH_POINT ' + JSON.stringify({ order_id: r.order_id, pid }) + '\n'); process.kill(process.pid, 'SIGKILL'); await new Promise(() => {}) }
    process.send({ pid, order_id: r.order_id }); await bounded(new Promise(resolve => process.once('message', resolve)))
  }
  if (mode === '--hold-refund') {
    await fresh((locks, store) => executeSettlement(locks, r, { plan: async () => { await store.assertScopeResolved(r.scope_id); return refundPlan(r) }, refund: async () => { await hold(true) }, reverse: async () => { throw new Error('unexpected reversal') } })); return
  }
  const f = callbacks(r), transfer = f.callbacks.transfer
  if (mode !== '--replay') f.callbacks.transfer = async p => { const result = await transfer(p); await hold(false); return result }
  const result = await runPayout(r, f)
  if (mode === '--replay') process.send({ result, calls: f.calls })
}
const cases = [], test = (name, run) => cases.push({ name, run })
test('actual_refund_and_payout_migrations', async () => {
  assert.deepEqual((await observer.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows, [])
  for (const [name, Candidate] of [['refund', RefundMigration], ['payout', PayoutMigration], ['native_return', NativeMigration]]) {
    const m = new Candidate(undefined, undefined); assert(m instanceof Migration); await m.up(); const queries = [...m.getQueries()]
    assert(queries.length > 0 && queries.every(q => typeof q === 'string' && q.trim()))
    emit('MIGRATION_SQL', { name, direction: 'up', queries })
    await observer.query('BEGIN'); try { for (const q of queries) await observer.query(q); await observer.query('COMMIT') } catch (e) { await observer.query('ROLLBACK'); throw e }
  }
  assert.deepEqual((await observer.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename), ['native_return_execution', 'payout_execution', 'refund_settlement'])
  await observer.query('CREATE TABLE fixture_effects(id bigserial PRIMARY KEY, identity text NOT NULL, leg text NOT NULL)')
})
test('started_committed_independent_connection_before_transfer_no_ambient_transaction', async () => {
  const r = input('visible'), f = callbacks(r), queries = []
  await fresh(async (locks, store, k) => { k.on('query', q => queries.push(q.sql)); assert.equal((await executePayout(locks, store, r, f.callbacks)).phase, 'completed') })
  assert(queries.some(q => /SET LOCAL synchronous_commit = on/i.test(q)))
  assert(queries.some(q => /^COMMIT/i.test(q))); assert.deepEqual(f.calls, ['plan', 'transfer', 'link', 'verify'])
  assert.deepEqual(await effects(r), ['transfer', 'link'])
})
test('completed_replay_fresh_process_no_financial_dispatch', async () => {
  const r = input('visible'), before = await row(r), w = worker('--replay', r)
  const message = await bounded(w.ready), end = await bounded(w.exited)
  assert.equal(end.code, 0, end.errors); assert.deepEqual(message.calls, ['verify']); assert.equal(message.result.phase, 'completed')
  assert.deepEqual(await row(r), before); assert.deepEqual(await effects(r), ['transfer', 'link'])
})
test('crash_after_transfer_before_checkpoint_fresh_process_retry_blocked', async () => {
  const r = input('crash'), w = worker('--crash', r), end = await bounded(w.exited)
  assert.equal(end.code, null, end.errors); assert.equal(end.signal, 'SIGKILL')
  const points = end.output.split('\n').filter(l => l.startsWith('CRASH_POINT ')); assert.equal(points.length, 1)
  emit('CRASH_OBSERVED', { ...JSON.parse(points[0].slice(12)), code: end.code, signal: end.signal })
  assert.equal((await row(r)).phase, 'started'); assert.deepEqual(await effects(r), ['transfer'])
  await waitUnlocked(r.scope_id)
  const retry = worker('--retry', r); assert.deepEqual(await bounded(retry.ready), { blocked: true }); assert.equal((await bounded(retry.exited)).code, 0)
  await blocked(input('crash_competitor', r.scope_id)); assert.deepEqual(await effects(r), ['transfer'])
})
for (const kind of ['link', 'checkpoint']) test(kind + '_failure_remains_blocked', async () => {
  const r = input('failure_' + kind), f = callbacks(r, kind === 'link' ? { link: async () => { throw new Error('fixture link failure') } } : {})
  if (kind === 'checkpoint') await observer.query(`CREATE FUNCTION fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.order_id='failure_checkpoint' THEN RAISE EXCEPTION 'fixture checkpoint failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fixture_fail BEFORE UPDATE ON payout_execution FOR EACH ROW EXECUTE FUNCTION fixture_fail()`)
  try { await assert.rejects(runPayout(r, f)) } finally { if (kind === 'checkpoint') await observer.query('DROP TRIGGER fixture_fail ON payout_execution; DROP FUNCTION fixture_fail()') }
  const before = await row(r); assert.equal(before.phase, 'started'); await blocked(r); assert.deepEqual(await row(r), before)
  assert.deepEqual(await effects(r), kind === 'link' ? ['transfer'] : ['transfer', 'link'])
})
for (const direction of ['payout_holds_refund', 'refund_holds_payout']) test('cross_process_same_collection_' + direction, async () => {
  const r = input(direction), refund = refundInput(input('contender_' + direction, r.scope_id)), w = worker(direction === 'payout_holds_refund' ? '--hold' : '--hold-refund', direction === 'payout_holds_refund' ? r : refund)
  try {
    const barrier = await bounded(w.ready); assert.notEqual(barrier.pid, observer.processID)
    if (direction === 'payout_holds_refund') {
      const calls = []; await assert.rejects(fresh(locks => executeSettlement(locks, refund, { plan: async () => { calls.push('plan'); return refundPlan(refund) }, refund: async () => calls.push('refund'), reverse: async () => calls.push('reverse') })), e => e.code === 'lock_unavailable'); assert.deepEqual(calls, [])
    } else { const f = callbacks(r); await assert.rejects(runPayout(r, f), e => e.code === 'lock_unavailable'); assert.deepEqual(f.calls, []) }
    emit('PROCESS_CONCURRENCY', { direction, ...barrier })
  } finally { await release(w) }
})
test('different_collections_progress_while_child_holds_lock', async () => {
  const a = input('parallel_a'), b = input('parallel_b'), w = worker('--hold', a)
  try { await bounded(w.ready); await runPayout(b, callbacks(b)); assert.equal((await row(a)).phase, 'started'); assert.equal((await row(b)).phase, 'completed') } finally { await release(w) }
})
test('unfinished_refund_blocks_payout_including_same_identity', async () => {
  for (const same of [false, true]) {
    const r = input('unfinished_' + same), f = refundInput(r); if (same) f.operation_id = r.order_id
    await fresh(locks => locks.withScopeLock(r.scope_id, s => s.create({ input: f, plan: refundPlan(f), phase: 'pending', reversal_receipt_id: null })))
    await blocked(r); assert.equal(await row(r), undefined)
  }
})
test('pending_payout_blocks_refund_guard', async () => {
  const r = input('pending_guard'); await seed(r); const f = refundInput(r), calls = []
  await fresh(async (locks, store) => {
    await assert.rejects(store.assertScopeResolved(r.scope_id), /reconciliation/)
    await assert.rejects(executeSettlement(locks, f, { plan: async () => { await store.assertScopeResolved(r.scope_id); calls.push('plan'); return refundPlan(f) }, refund: async () => calls.push('refund'), reverse: async () => calls.push('reverse') }))
  })
  assert.deepEqual(calls, []); assert.equal((await observer.query('SELECT count(*)::int n FROM refund_settlement WHERE operation_id=$1', [f.operation_id])).rows[0].n, 0)
})
for (const field of ['order_id', 'scope_id', 'plan', 'created_at']) test('immutable_' + field, async () => {
  const r = input('immutable_' + field); await seed(r); const before = await row(r)
  const value = field === 'plan' ? JSON.stringify({ ...before.plan, amount: 19 }) : field === 'created_at' ? '2000-01-01T00:00:00Z' : 'changed_' + field
  // Otherwise legal advance, and exact immutability error, not a phase/constraint false positive.
  await sqlReject(`UPDATE payout_execution SET ${field}=$2,phase='completed',payout_id=$3,transfer_id=$4 WHERE order_id=$1`, [r.order_id, value, 'payout_' + r.order_id, 'transfer_' + r.order_id], 'P0001', /immutable/i)
  assert.deepEqual(await row(r), before)
})
for (const field of ['payout_id', 'transfer_id']) test('immutable_' + field, async () => {
  const r = input('immutable_' + field); await seed(r); await complete(r); const before = await row(r)
  await sqlReject(`UPDATE payout_execution SET ${field}='changed' WHERE order_id=$1`, [r.order_id], 'P0001'); assert.deepEqual(await row(r), before)
})
test('phase_rewind_refused', async () => {
  const r = input('rewind'); await seed(r); await complete(r); const before = await row(r)
  await sqlReject("UPDATE payout_execution SET phase='started',payout_id=NULL,transfer_id=NULL WHERE order_id=$1", [r.order_id], 'P0001'); assert.deepEqual(await row(r), before)
})
test('delete_refused', async () => { const r = input('delete'); await seed(r); const before = await row(r); await sqlReject('DELETE FROM payout_execution WHERE order_id=$1', [r.order_id], 'P0001'); assert.deepEqual(await row(r), before) })
test('truncate_refused_preserves_evidence', async () => {
  const before = (await observer.query('SELECT * FROM payout_execution ORDER BY order_id')).rows
  // Roll back the attempt even if the guard is missing: later cases must retain their evidence.
  await observer.query('BEGIN'); try { await sqlReject('TRUNCATE payout_execution', [], 'P0001') } finally { await observer.query('ROLLBACK') }
  assert.deepEqual((await observer.query('SELECT * FROM payout_execution ORDER BY order_id')).rows, before)
})
for (const field of ['payout_id', 'transfer_id']) test('unique_' + field, async () => {
  const a = input('unique_' + field), b = input('duplicate_' + field); await seed(a); await complete(a); await seed(b)
  const ids = { payout_id: 'payout_' + b.order_id, transfer_id: 'transfer_' + b.order_id }; ids[field] = (await row(a))[field]
  await sqlReject("UPDATE payout_execution SET phase='completed',payout_id=$2,transfer_id=$3 WHERE order_id=$1", [b.order_id, ids.payout_id, ids.transfer_id], '23505'); assert.equal((await row(b)).phase, 'started')
})
test('same_row_identity_conflict_and_unique_unfinished_scope', async () => {
  const r = input('identity'); await seed(r); await complete(r); const before = await row(r)
  await blocked(input(r.order_id, 'other_collection')); assert.deepEqual(await row(r), before)
  await assert.rejects(seed(r), e => e.code === '23505')
  const a = input('unique_scope_a'); await seed(a); await assert.rejects(seed(input('unique_scope_b', a.scope_id)), e => e.code === '23505')
})
test('zero_amount_completes_without_effects', async () => {
  const r = input('zero'), f = callbacks(r, { plan: async () => plan(r, 0), verify: async saved => { assert.deepEqual(saved.plan, plan(r, 0)); assert.equal(saved.payout_id, null); assert.equal(saved.transfer_id, null) } })
  assert.equal((await runPayout(r, f)).phase, 'completed'); assert.deepEqual(f.calls, []); assert.deepEqual(await effects(r), []); assert.equal((await row(r)).phase, 'completed')
})
test('real_knex_ambient_transaction_rejected', async () => {
  await fresh(async (_, __, k) => k.transaction(async tx => { assert.throws(() => createPostgresPayoutExecutionStore(tx), /Root database/); assert.throws(() => createPostgresSettlementStore(tx), e => e.code === 'invalid_input') }))
})
test('payout_migration_down_refuses_preserves_evidence', async () => {
  const before = (await observer.query('SELECT * FROM payout_execution ORDER BY order_id')).rows, m = new PayoutMigration(undefined, undefined)
  await assert.rejects(m.down(), /Permanent payout evidence/); assert.deepEqual([...m.getQueries()], []); assert.deepEqual((await observer.query('SELECT * FROM payout_execution ORDER BY order_id')).rows, before)
  emit('MIGRATION_DOWN_REFUSED', { emitted_queries: 0, preserved_rows: before.length })
})
// Recovery inspection executes the actual SELECT through real Knex, never reconstructed SQL.
async function report(query, expectedBindings) {
  const k = pool(), calls = []
  try {
    const result = await readCommerceRecoveryReport({ raw: (sql, bindings) => { calls.push({ sql, bindings }); return k.raw(sql, bindings) } }, query)
    assert.equal(calls.length, 1); assert.match(calls[0].sql, /^SELECT\s/)
    assert(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|FOR UPDATE|pg_advisory)\b/i.test(calls[0].sql))
    if (expectedBindings) assert.deepEqual(calls[0].bindings, expectedBindings)
    assert.equal(result.read_only, true); assert.equal(result.money_repair_authorized, false)
    return result
  } finally { await k.destroy(); pools.delete(k) }
}
async function ledgerSnapshot() {
  const snapshot = {}
  for (const [table, id] of [['payout_execution', 'order_id'], ['refund_settlement', 'operation_id'], ['native_return_execution', 'request_id'], ['fixture_effects', 'id']]) snapshot[table] = (await observer.query(`SELECT * FROM ${table} ORDER BY ${id}`)).rows
  return snapshot
}
test('recovery_report_lists_payout_native_refund_checkpoints', async () => {
  const r = input('report_shared'), f = refundInput(r), created = '2001-01-01T00:00:00Z'
  // Synthetic records, valid DML under all three actual migrations, deliberately tied timestamps.
  await observer.query("INSERT INTO payout_execution(order_id,scope_id,plan,phase,created_at) VALUES($1,$2,$3,'started',$4)", [r.order_id, r.scope_id, JSON.stringify(plan(r)), created])
  await observer.query("INSERT INTO native_return_execution(request_id,order_id,fingerprint,plan,phase,created_at) VALUES($1,$2,$3,$4,'pending',$5)", ['request_report', r.order_id, 'a'.repeat(64), JSON.stringify({ request_id: 'request_report', order_id: r.order_id, secret_plan: 'PRIVATE_NATIVE_PLAN' }), created])
  await fresh(locks => locks.withScopeLock(r.scope_id, s => s.create({ input: f, plan: refundPlan(f), phase: 'pending', reversal_receipt_id: null })))
  const result = await report({ order_id: r.order_id })
  assert.deepEqual(result.items.map(x => [x.type, x.phase]), [['native_return_execution', 'pending'], ['payout_execution', 'started'], ['refund_settlement', 'pending']])
  assert.equal(result.items[0].request_id, 'request_report'); assert.equal(result.items[1].operation_id, r.order_id); assert.equal(result.items[2].operation_id, f.operation_id)
  assert.equal(result.has_more, false)
})
test('recovery_report_filters_order_pagination_real_pg_binding', async () => {
  const order_id = 'report_shared', all = await report({ order_id }, [order_id, 26, 0]), pages = []
  for (let offset = 0; offset < 3; offset++) {
    const page = await report({ order_id, limit: '1', offset: String(offset) }, [order_id, 2, offset])
    assert.equal(page.has_more, offset < 2); assert.equal(page.next_offset, offset < 2 ? offset + 1 : null); pages.push(...page.items)
  }
  assert.deepEqual(pages, all.items)
  assert.deepEqual((await report({ order_id, phase: 'pending' }, ['pending', order_id, 26, 0])).items.map(x => x.type), ['native_return_execution', 'refund_settlement'])
  assert.deepEqual((await report({ type: 'payout_execution', phase: 'started', order_id }, ['payout_execution', 'started', order_id, 26, 0])).items, [all.items[1]])
  const injection = "report_shared' OR 1=1 --"
  assert.deepEqual((await report({ order_id: injection }, [injection, 26, 0])).items, [])
})
test('recovery_report_no_leaked_plans_or_database_mutations', async () => {
  const before = await ledgerSnapshot(), result = await report({ order_id: 'report_shared' })
  const keys = ['type', 'operation_id', 'request_id', 'order_id', 'phase', 'created_at', 'updated_at', 'action_classification', 'evidence_required'].sort()
  for (const item of result.items) assert.deepEqual(Object.keys(item).sort(), keys)
  assert(!/PRIVATE_NATIVE_PLAN|acct_fixture|connect_fixture|charge_collection_|payment_fixture|split_fixture|"plan"|"fingerprint"|"scope_id"/.test(JSON.stringify(result)))
  assert.deepEqual(await ledgerSnapshot(), before)
})
test('recovery_report_started_payout_requires_manual_reconciliation', async () => {
  const result = await report({ order_id: 'crash', type: 'payout_execution' })
  assert.equal(result.items.length, 1); assert.equal(result.items[0].phase, 'started')
  assert.equal(result.items[0].action_classification, 'manual_reconciliation_required')
  assert.deepEqual(result.items[0].evidence_required, ['provider_transfer_and_local_payout_proof', 'immutable_plan_amount_currency_destination_proof', 'raw_order_payout_linkage_proof'])
  assert.deepEqual(await effects(input('crash')), ['transfer'])
})
test('recovery_report_completed_payout_updated_at_nonstale', async () => {
  const r = input('report_timestamp'); await seed(r); const before = await row(r)
  await observer.query('SELECT pg_sleep(0.02)'); await complete(r)
  const after = await row(r), result = await report({ order_id: r.order_id, type: 'payout_execution' })
  assert.equal(result.items.length, 1); assert.equal(result.items[0].phase, 'completed')
  assert.equal(result.items[0].action_classification, 'recorded_terminal_verify_evidence')
  assert.equal(result.items[0].created_at, before.created_at.toISOString())
  assert.equal(result.items[0].updated_at, after.updated_at.toISOString())
  assert(after.updated_at.getTime() > before.updated_at.getTime(), 'completion must advance persisted updated_at')
})
test('recovery_report_mutated_filters_rejected_without_db_effects', async () => {
  const before = await ledgerSnapshot(), k = pool(); let calls = 0
  try {
    const db = { raw: (sql, bindings) => { calls++; return k.raw(sql, bindings) } }
    for (const mutation of [{ type: 'payout_execution; DROP TABLE payout_execution' }, { phase: 'refund_started' }, { limit: '51' }, { offset: '10001' }, { order_id: ['report_shared'] }, { repair: 'true' }]) {
      const query = { type: 'payout_execution', phase: 'started', limit: '1' }; parseRecoveryFilters(query)
      Object.assign(query, mutation)
      await assert.rejects(readCommerceRecoveryReport(db, query), RecoveryFilterError)
    }
    assert.equal(calls, 0); assert.deepEqual(await ledgerSnapshot(), before)
  } finally { await k.destroy(); pools.delete(k) }
})
async function main() {
  await observer.connect(); assert.equal((await observer.query('SELECT current_database() d')).rows[0].d, connection.database)
  const postgres = (await observer.query("SELECT version(),current_setting('fsync') fsync,current_setting('synchronous_commit') synchronous_commit")).rows[0]
  assert.equal(postgres.fsync, 'on'); assert.equal(postgres.synchronous_commit, 'on')
  assert.equal(new Set(cases.map(t => t.name)).size, cases.length)
  emit('RUNTIME_METADATA', { node: process.version, postgres, knex: dependencies('knex/package.json').version, pg: dependencies('pg/package.json').version, swc: dependencies('@swc/core/package.json').version, source_hashes: Object.fromEntries(Object.entries(sourcePaths).map(([f, path]) => [f, crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')])), migration_count: 3, expected_tests: cases.length })
  const results = []; let prerequisites = true
  for (const t of cases) {
    const start = Date.now(); let result
    if (!prerequisites) result = { name: t.name, status: 'skipped', reason: 'migration prerequisite failed' }
    else try { await t.run(); result = { name: t.name, status: 'passed', ms: Date.now() - start } } catch (e) { result = { name: t.name, status: 'failed', error: String(e.stack || e), ms: Date.now() - start }; if (t.name === 'actual_refund_and_payout_migrations') prerequisites = false }
    results.push(result); emit('TEST_RESULT', result)
  }
  const summary = { expected: cases.length, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, skipped: results.filter(r => r.status === 'skipped').length, results }
  emit('PAYOUT_RESULT', summary); process.exitCode = summary.failed || summary.skipped ? 1 : 0
}
async function cleanup() {
  for (const child of children) child.kill('SIGKILL')
  for (const k of pools) { try { await k.destroy() } catch (e) { emit('CLEANUP_ERROR', String(e)); process.exitCode = 1 } }
  try { await observer.end() } catch (e) { emit('CLEANUP_ERROR', String(e)); process.exitCode = 1 }
  if (process.connected) process.disconnect()
}
;(process.argv[2] ? workerMain() : main()).catch(e => { emit('FATAL_ERROR', String(e.stack || e)); process.exitCode = 1 }).finally(cleanup)
