import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createHash } from 'node:crypto'

// Source-only execution of the actual helpers, no app/container/provider/DB startup.
const root = new URL('../../', import.meta.url)
const utils = 'packages/modules/b2c-core/src/utils/'
async function load(name, replacements = []) {
  const url = new URL(utils + name, root)
  if (!existsSync(url)) return {}
  let source = stripTypeScriptTypes(readFileSync(url, 'utf8'), { mode: 'strip' })
  for (const [from, to] of replacements) source = source.replace(from, to)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}
const engine = await load('refund-settlement.ts')
const { executeSettlement } = engine
const clone = (value) => JSON.parse(JSON.stringify(value))
const input = (overrides = {}) => ({ operation_id: 'return_a', order_id: 'order_a', scope_id: 'collection_a', fingerprint: 'request-v1:items:one', ...overrides })
const plan = (request = input(), overrides = {}) => ({
  operation_id: request.operation_id, order_id: request.order_id, scope_id: request.scope_id,
  payment_id: 'pay_a', split_order_payment_id: 'split_a', payout_id: 'payout_a', currency_code: 'eur',
  customerRefund: 20, sellerReversal: 18, ...overrides,
})
function memoryStore() {
  const rows = new Map(), locks = new Set(), history = []
  let failure = null
  const fault = (event, after = false) => { failure = { event, after } }
  const check = (event, after) => {
    if (failure?.event === event && failure.after === after) { failure = null; throw new Error('private-db-secret') }
  }
  return {
    rows, locks, history, fault,
    async withScopeLock(scope, work) {
      if (locks.has(scope)) throw new engine.SettlementError('lock_unavailable')
      locks.add(scope)
      const write = (event, fn) => { check(event, false); fn(); history.push(event); check(event, true) }
      try {
        return await work({
          getOperation: async id => clone(rows.get(id) ?? null),
          findUnfinished: async except => clone([...rows.values()].find(r => r.input.scope_id === scope && r.input.operation_id !== except && r.phase !== 'completed') ?? null),
          create: async record => write('create', () => {
            assert(!rows.has(record.input.operation_id)); rows.set(record.input.operation_id, clone(record))
          }),
          transition: async (id, expected, next, receiptId = null) => write(next, () => {
            const row = rows.get(id); assert.equal(row.phase, expected)
            rows.set(id, { ...row, phase: next, reversal_receipt_id: receiptId })
          }),
        })
      } finally { locks.delete(scope) }
    },
  }
}
function effectsFor(store, request = input(), overrides = {}) {
  const calls = []
  const effects = {
    plan: async () => { calls.push('plan'); assert(store.locks.has(request.scope_id)); return plan(request) },
    refund: async p => { calls.push('refund'); assert.equal(store.rows.get(p.operation_id).phase, 'refund_started'); return { id: 'native_refund' } },
    reverse: async p => { calls.push('reverse'); assert.equal(store.rows.get(p.operation_id).phase, 'reversal_started'); return evidence(p) },
    ...overrides,
  }
  return { calls, effects }
}

test('API: exports executeSettlement and persists each phase before external dispatch', async () => {
  assert.equal(typeof executeSettlement, 'function')
  const store = memoryStore(), { calls, effects } = effectsFor(store)
  const result = await executeSettlement(store, input(), effects)
  assert.deepEqual(calls, ['plan', 'refund', 'reverse'])
  assert.deepEqual(store.history, ['create', 'refund_started', 'refund_completed', 'reversal_started', 'completed'])
  assert.equal(result.receipt.phase, 'completed')
  assert.deepEqual(result.plan, plan())
  assert(Object.isFrozen(result) && Object.isFrozen(result.plan) && Object.isFrozen(result.receipt))
})

const rejectsCode = (promise, code) => assert.rejects(promise, error => {
  assert.equal(error.code, code)
  assert(!String(error.stack).includes('private-'))
  assert.equal(error.cause, undefined)
  return true
})
function seed(store, phase, request = input(), overrides = {}) {
  store.rows.set(request.operation_id, { input: clone(request), plan: plan(request, overrides), phase, reversal_receipt_id: null })
}
const evidence = (p = plan(), overrides = {}) => ({
  operation_id: p.operation_id, payout_id: p.payout_id, currency_code: p.currency_code,
  amount: p.sellerReversal, receipt_id: 'saved_reversal_a', ...overrides,
})
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

test('completed replay never replans changed balances or redispatches either leg', async () => {
  const store = memoryStore(), { effects } = effectsFor(store)
  const first = await executeSettlement(store, input(), effects)
  const replay = await executeSettlement(store, input(), {
    plan: async () => { throw new Error('balance changed') },
    refund: async () => { throw new Error('must not refund twice') },
    reverse: async () => { throw new Error('must not reverse twice') },
    recoverReversal: async () => { throw new Error('must not recover completed') },
  })
  assert.deepEqual(replay, first)
  assert.notEqual(replay.plan, first.plan)
})
for (const changed of [{ fingerprint: 'changed' }, { order_id: 'order_b' }, { scope_id: 'collection_b' }]) {
  test(`existing operation rejects ${Object.keys(changed)[0]} conflict before any callback`, async () => {
    const store = memoryStore(); seed(store, 'completed')
    const { calls, effects } = effectsFor(store, input(changed))
    await rejectsCode(executeSettlement(store, input(changed), effects), 'identity_conflict')
    assert.deepEqual(calls, [])
  })
}
test('distinct completed operations with equal amounts remain distinct', async () => {
  const store = memoryStore(), second = input({ operation_id: 'return_b' })
  const a = effectsFor(store), b = effectsFor(store, second)
  await executeSettlement(store, input(), a.effects)
  await executeSettlement(store, second, b.effects)
  assert.equal(store.rows.size, 2)
  assert.deepEqual(b.calls, ['plan', 'refund', 'reverse'])
})
for (const phase of ['pending', 'refund_started', 'refund_completed', 'reversal_started']) {
  test(`other unfinished ${phase} operation blocks the scope before planning`, async () => {
    const store = memoryStore(); seed(store, phase)
    const request = input({ operation_id: 'return_b' }), { calls, effects } = effectsFor(store, request)
    await rejectsCode(executeSettlement(store, request, effects), 'scope_blocked')
    assert.deepEqual(calls, [])
  })
}
for (const after of [false, true]) {
  test(`first persist failure (${after ? 'after' : 'before'} commit) never dispatches effects`, async () => {
    const store = memoryStore(), { calls, effects } = effectsFor(store)
    store.fault('create', after)
    await rejectsCode(executeSettlement(store, input(), effects), 'storage_failure')
    assert.deepEqual(calls, ['plan'])
    calls.length = 0
    await executeSettlement(store, input(), effects)
    assert.deepEqual(calls, after ? ['refund', 'reverse'] : ['plan', 'refund', 'reverse'])
  })
}
for (const [phase, after, expectedPhase, firstEffects, replayEffects] of [
  ['refund_started', false, 'pending', [], ['refund', 'reverse']],
  ['refund_started', true, 'refund_started', [], null],
  ['refund_completed', false, 'refund_started', ['refund'], null],
  ['refund_completed', true, 'refund_completed', ['refund'], ['reverse']],
  ['reversal_started', false, 'refund_completed', ['refund'], ['reverse']],
  ['reversal_started', true, 'reversal_started', ['refund'], null],
  ['completed', false, 'reversal_started', ['refund', 'reverse'], null],
  ['completed', true, 'completed', ['refund', 'reverse'], []],
]) {
  test(`crash at ${phase} ${after ? 'after' : 'before'} commit preserves safe restart`, async () => {
    const store = memoryStore(), { calls, effects } = effectsFor(store)
    store.fault(phase, after)
    await assert.rejects(executeSettlement(store, input(), effects))
    assert.deepEqual(calls, ['plan', ...firstEffects])
    assert.equal(store.rows.get(input().operation_id).phase, expectedPhase)
    calls.length = 0
    if (replayEffects === null) await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
    else await executeSettlement(store, input(), effects)
    assert.deepEqual(calls, replayEffects ?? [])
  })
}
for (const leg of ['refund', 'reverse']) test(`${leg} success followed by local error stays unknown with no automatic retry`, async () => {
  const store = memoryStore(); let externalSuccesses = 0
  const { effects } = effectsFor(store, input(), { [leg]: async () => { externalSuccesses++; throw new Error('private-provider-key') } })
  await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
  await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
  assert.equal(externalSuccesses, 1)
  assert.equal(store.rows.get(input().operation_id).phase, leg === 'refund' ? 'refund_started' : 'reversal_started')
})
for (const response of [{ err: true }, { errors: [new Error('private-workflow-error')] }]) test(`explicit workflow failure flags are not completion (${Object.keys(response)[0]})`, async () => {
  const store = memoryStore(), { effects } = effectsFor(store, input(), { refund: async () => response })
  await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
  assert.equal(store.rows.get(input().operation_id).phase, 'refund_started')
})
test('known customer completion resumes only seller reversal using immutable saved amounts', async () => {
  const store = memoryStore(); seed(store, 'refund_completed', input(), { customerRefund: 12, sellerReversal: 9 })
  const { calls, effects } = effectsFor(store)
  const result = await executeSettlement(store, input(), effects)
  assert.deepEqual(calls, ['reverse'])
  assert.equal(result.plan.sellerReversal, 9)
})
test('started reversal uses matching positive saved receipt only; no money effect or plan callback', async () => {
  const store = memoryStore(); seed(store, 'reversal_started')
  let reads = 0
  const { calls, effects } = effectsFor(store, input(), { recoverReversal: async p => { reads++; return evidence(p) } })
  const result = await executeSettlement(store, input(), effects)
  assert.equal(reads, 1); assert.deepEqual(calls, [])
  assert.equal(result.receipt.reversal_receipt_id, 'saved_reversal_a')
  assert.equal(result.receipt.phase, 'completed')
})
for (const recovered of [null, true, {}, { id: 'only-id' }, evidence(plan(), { amount: 17 }), evidence(plan(), { payout_id: 'other' }), evidence(plan(), { operation_id: 'other' }), evidence(plan(), { currency_code: 'usd' }), evidence(plan(), { receipt_id: '' })]) {
  test(`missing/mismatched recovery evidence blocks indefinitely: ${JSON.stringify(recovered)}`, async () => {
    const store = memoryStore(); seed(store, 'reversal_started')
    const { calls, effects } = effectsFor(store, input(), { recoverReversal: async () => recovered })
    await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
    await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
    assert.deepEqual(calls, []); assert.equal(store.rows.get(input().operation_id).phase, 'reversal_started')
  })
}
test('started customer is never recovered by seller evidence', async () => {
  const store = memoryStore(); seed(store, 'refund_started'); let reads = 0
  const { calls, effects } = effectsFor(store, input(), { recoverReversal: async () => { reads++; return evidence() } })
  await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
  assert.equal(reads, 0); assert.deepEqual(calls, [])
})
test('zero legs complete without provider calls and require no missing payment or payout identity', async () => {
  const store = memoryStore(), { calls, effects } = effectsFor(store, input(), { plan: async () => plan(input(), { customerRefund: 0, sellerReversal: 0, payment_id: null, payout_id: null, split_order_payment_id: null }) })
  const result = await executeSettlement(store, input(), effects)
  assert.equal(result.receipt.phase, 'completed'); assert.deepEqual(calls, [])
  assert.deepEqual(store.history, ['create', 'refund_completed', 'completed'])
})
test('concurrent same scope fails closed while a different scope can finish', async () => {
  const store = memoryStore(), entered = deferred(), release = deferred()
  const { effects } = effectsFor(store, input(), { refund: async () => { entered.resolve(); await release.promise } })
  const running = executeSettlement(store, input(), effects); await entered.promise
  const same = effectsFor(store)
  await rejectsCode(executeSettlement(store, input(), same.effects), 'lock_unavailable')
  const otherRequest = input({ operation_id: 'return_b', scope_id: 'collection_b' }), other = effectsFor(store, otherRequest)
  const completed = await executeSettlement(store, otherRequest, other.effects)
  assert.equal(completed.receipt.phase, 'completed'); assert.deepEqual(same.calls, [])
  release.resolve(); await running
  assert.equal(store.locks.size, 0)
})
for (const changed of [{ operation_id: '' }, { order_id: ' padded ' }, { scope_id: '\u0000scope' }, { fingerprint: '' }, { operation_id: 42 }, { fingerprint: 'x'.repeat(4097) }]) {
  test(`unsafe request rejected before store access: ${Object.keys(changed)[0]} ${typeof Object.values(changed)[0]}`, async () => {
    let touched = 0
    await rejectsCode(executeSettlement({ withScopeLock: async () => { touched++ } }, input(changed), {}), 'invalid_input')
    assert.equal(touched, 0)
  })
}
for (const changed of [{ customerRefund: -1 }, { sellerReversal: NaN }, { customerRefund: Infinity }, { customerRefund: Number.MAX_SAFE_INTEGER + 1 }, { customerRefund: '20' }, { currency_code: 'EUR' }, { operation_id: 'other' }, { payment_id: null }, { payout_id: null }]) {
  test(`unsafe plan rejected before durable creation: ${JSON.stringify(changed)}`, async () => {
    const store = memoryStore(), { calls, effects } = effectsFor(store, input(), { plan: async () => plan(input(), changed) })
    await rejectsCode(executeSettlement(store, input(), effects), 'invalid_input')
    assert.equal(store.rows.size, 0); assert.deepEqual(calls, [])
  })
}
test('callbacks receive detached frozen snapshots and caller mutation while acquiring lock cannot change identity', async () => {
  const store = memoryStore(), gate = deferred(), source = input(), originalPlan = plan()
  const wrapped = { withScopeLock: async (scope, work) => { await gate.promise; return store.withScopeLock(scope, work) } }
  const { effects } = effectsFor(store, input(), {
    plan: async () => originalPlan,
    refund: async p => { assert(Object.isFrozen(p)); originalPlan.customerRefund = 999; assert.equal(p.customerRefund, 20) },
  })
  const promise = executeSettlement(wrapped, source, effects)
  source.operation_id = 'mutated'; source.scope_id = 'mutated'; source.fingerprint = 'mutated'; gate.resolve()
  const result = await promise
  assert.deepEqual(result.receipt, { ...input(), phase: 'completed', reversal_receipt_id: 'saved_reversal_a' })
  assert.equal(result.plan.customerRefund, 20)
})

const engineUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(readFileSync(new URL(utils + 'refund-settlement.ts', root), 'utf8'), { mode: 'strip' })).toString('base64')}`
const { createPostgresSettlementStore } = await load('refund-settlement-store.ts', [[/(['"])\.\/refund-settlement\1/g, JSON.stringify(engineUrl)]])

// Narrow PostgreSQL protocol stand-in: actual adapter SQL + dedicated connections are exercised,
// while PostgreSQL parsing/DDL execution/server restart durability remain separate integration gates.
function sqlHarness() {
  const rows = new Map(), locks = new Map(), statements = [], released = [], destroyed = [], connections = []
  let failures = {}
  function execute(sql, values, connection) {
    statements.push({ sql, values, connection })
    const normalized = sql.trim().toLowerCase()
    if (connection.ended) throw new Error('private-ended-connection')
    if (/pg_try_advisory_lock/.test(normalized)) {
      if (failures.lock) throw new Error('private-lock-error')
      const key = values[0], existing = locks.get(key), locked = !existing || existing === connection
      if (locked) locks.set(key, connection)
      return { rows: [{ locked }] }
    }
    if (/pg_advisory_unlock/.test(normalized)) {
      if (failures.unlock) throw new Error('private-unlock-error')
      const key = values[0], unlocked = locks.get(key) === connection
      if (unlocked) locks.delete(key)
      return { rows: [{ unlocked }] }
    }
    if (/^set\s+(session\s+)?synchronous_commit/.test(normalized)) return { rows: [] }
    assert(!/\b(begin|commit|rollback)\b/.test(normalized), 'no ambient transaction around effects')
    assert([...locks.values()].includes(connection), 'every ledger query uses its session lock connection')
    if (normalized.startsWith('select')) {
      if (failures.read) throw new Error('private-read-error')
      let selected
      if (normalized.includes('phase <>')) selected = [...rows.values()].filter(r => r.scope_id === values[0] && r.operation_id !== values[1] && r.phase !== 'completed')
      else selected = [rows.get(values[0])].filter(Boolean)
      return { rows: clone(selected.slice(0, 1)) }
    }
    if (normalized.startsWith('insert')) {
      if (failures.insert) throw new Error('private-insert-error')
      const [operation_id, order_id, scope_id, fingerprint, snapshot] = values
      if (rows.has(operation_id) || [...rows.values()].some(r => r.scope_id === scope_id && r.phase !== 'completed')) throw new Error('private-unique-error')
      rows.set(operation_id, { operation_id, order_id, scope_id, fingerprint, plan: JSON.parse(snapshot), phase: 'pending', reversal_receipt_id: null })
      return { rows: [{ operation_id }], rowCount: 1 }
    }
    if (normalized.startsWith('update')) {
      const [phase, reversal_receipt_id, operation_id, scope_id, previous] = values
      if (failures.transition === phase) throw new Error('private-transition-error')
      const row = rows.get(operation_id)
      if (!row || row.scope_id !== scope_id || row.phase !== previous) return { rows: [], rowCount: 0 }
      rows.set(operation_id, { ...row, phase, reversal_receipt_id })
      return { rows: [{ operation_id }], rowCount: 1 }
    }
    throw new Error(`unhandled SQL ${sql}`)
  }
  const knex = {
    isTransaction: false,
    client: {
      async acquireConnection() { if (failures.acquire) throw new Error('private-acquire-error'); const c = { id: connections.length + 1 }; connections.push(c); return c },
      async releaseConnection(c) { if (failures.release) { failures.release = false; throw new Error('private-release-error') }; released.push(c) },
      async destroyRawConnection(c) { c.ended = true; destroyed.push(c); for (const [key, holder] of locks) if (holder === c) locks.delete(key) },
    },
    raw(sql, values = []) { return { connection: async c => execute(sql, values, c) } },
  }
  return { knex, rows, locks, statements, released, destroyed, connections, fail: (kind, value = true) => { failures[kind] = value } }
}
function sqlEffects(harness, request = input(), overrides = {}) {
  const calls = []
  return { calls, effects: {
    plan: async () => { calls.push('plan'); assert(harness.locks.size > 0); return plan(request) },
    refund: async p => { calls.push('refund'); assert.equal(harness.rows.get(p.operation_id).phase, 'refund_started') },
    reverse: async p => { calls.push('reverse'); assert.equal(harness.rows.get(p.operation_id).phase, 'reversal_started'); return evidence(p) },
    ...overrides,
  } }
}
test('SQL store: dedicated connection, session lock and autocommit durable ledger precede effects; replay via another store', async () => {
  assert.equal(typeof createPostgresSettlementStore, 'function')
  const h = sqlHarness(), { calls, effects } = sqlEffects(h)
  const first = await executeSettlement(createPostgresSettlementStore(h.knex), input(), effects)
  const replay = await executeSettlement(createPostgresSettlementStore(h.knex), input(), effects)
  assert.deepEqual(first, replay); assert.deepEqual(calls, ['plan', 'refund', 'reverse'])
  assert.equal(h.connections.length, 2); assert.equal(h.released.length, 2); assert.equal(h.locks.size, 0)
  const lock = h.statements.find(s => s.sql.includes('pg_try_advisory_lock'))
  assert.equal(lock.values[0], createHash('sha256').update('hobbysalon:refund-settlement:v1:' + input().scope_id).digest().readBigInt64BE(0).toString())
  const firstConnection = h.statements.filter(s => s.connection === h.connections[0])
  assert(firstConnection.some(s => /synchronous_commit/.test(s.sql)))
  assert(firstConnection.at(-1).sql.includes('pg_advisory_unlock'))
})
for (const kind of ['acquire', 'lock', 'read', 'insert']) test(`SQL store ${kind} error fails closed without money effects and leaks no secrets`, async () => {
  const h = sqlHarness(); h.fail(kind)
  const { calls, effects } = sqlEffects(h)
  await rejectsCode(executeSettlement(createPostgresSettlementStore(h.knex), input(), effects), kind === 'acquire' || kind === 'lock' ? 'lock_unavailable' : 'storage_failure')
  assert(!calls.includes('refund') && !calls.includes('reverse'))
  assert.equal(h.locks.size, 0)
  if (kind !== 'acquire') assert.equal(h.released.length, 1)
})
test('SQL stores on shared backend reject concurrent same-scope operation and allow independent scope', async () => {
  const h = sqlHarness(), entered = deferred(), release = deferred()
  const storeA = createPostgresSettlementStore(h.knex), storeB = createPostgresSettlementStore(h.knex)
  const a = sqlEffects(h, input(), { refund: async () => { entered.resolve(); await release.promise } })
  const running = executeSettlement(storeA, input(), a.effects); await entered.promise
  const b = sqlEffects(h)
  await rejectsCode(executeSettlement(storeB, input(), b.effects), 'lock_unavailable')
  assert.deepEqual(b.calls, [])
  const request = input({ operation_id: 'return_b', scope_id: 'collection_b' }), c = sqlEffects(h, request)
  await executeSettlement(storeB, request, c.effects)
  release.resolve(); await running
  assert.equal(h.rows.size, 2); assert.equal(h.locks.size, 0)
})
for (const kind of ['unlock', 'release']) test(`SQL cleanup ${kind} failure discards poisoned connection, preserves completed row, and remains safely replayable`, async () => {
  const h = sqlHarness(); h.fail(kind)
  const { calls, effects } = sqlEffects(h)
  await rejectsCode(executeSettlement(createPostgresSettlementStore(h.knex), input(), effects), 'storage_failure')
  assert.equal(h.rows.get(input().operation_id).phase, 'completed')
  assert.equal(h.destroyed.length, 1); assert(h.destroyed[0].__knex__disposed)
  assert.equal(h.locks.size, 0)
  h.fail(kind, false)
  const result = await executeSettlement(createPostgresSettlementStore(h.knex), input(), effects)
  assert.equal(result.receipt.phase, 'completed'); assert.deepEqual(calls, ['plan', 'refund', 'reverse'])
})
test('SQL session cannot escape the lock lifetime or update another scope', async () => {
  const h = sqlHarness(), store = createPostgresSettlementStore(h.knex); let escaped
  await store.withScopeLock(input().scope_id, async session => {
    escaped = session
    await rejectsCode(session.create({ input: input({ scope_id: 'other' }), plan: plan(), phase: 'pending', reversal_receipt_id: null }), 'invalid_input')
    await rejectsCode(session.transition('missing', 'pending', 'refund_started'), 'storage_failure')
  })
  const before = h.statements.length
  await rejectsCode(escaped.getOperation(input().operation_id), 'lock_unavailable')
  assert.equal(h.statements.length, before)
})
test('SQL factory rejects transaction-scoped Knex before acquiring a connection', () => {
  for (const mode of ['isTransaction', 'transacting']) {
    const h = sqlHarness()
    if (mode === 'isTransaction') h.knex.isTransaction = true
    else h.knex.client.transacting = true
    assert.throws(() => createPostgresSettlementStore(h.knex), error => error.code === 'invalid_input')
    assert.equal(h.connections.length, 0)
  }
})

test('resuming an existing pending row is blocked if another unfinished row occupies its scope', async () => {
  const store = memoryStore(); seed(store, 'pending'); seed(store, 'refund_started', input({ operation_id: 'other' }))
  const { calls, effects } = effectsFor(store)
  await rejectsCode(executeSettlement(store, input(), effects), 'scope_blocked')
  assert.deepEqual(calls, [])
})
for (const changed of [{ phase: 'unexpected' }, { plan: { ...plan(), customerRefund: -1 } }, { reversal_receipt_id: {} }]) {
  test(`corrupt persisted ${Object.keys(changed)[0]} fails before any callback`, async () => {
    const store = memoryStore(); seed(store, 'completed')
    Object.assign(store.rows.get(input().operation_id), changed)
    const { calls, effects } = effectsFor(store)
    await rejectsCode(executeSettlement(store, input(), effects), 'storage_failure')
    assert.deepEqual(calls, [])
  })
}
test('planning errors are sanitized, persist nothing and release scope lock', async () => {
  const store = memoryStore(), { calls, effects } = effectsFor(store, input(), { plan: async () => { throw new Error('private-plan-data') } })
  await rejectsCode(executeSettlement(store, input(), effects), 'plan_failed')
  assert.equal(store.rows.size, 0); assert.equal(store.locks.size, 0); assert.deepEqual(calls, [])
})
test('throwing read-only recovery cannot mark completion or retry the provider', async () => {
  const store = memoryStore(); seed(store, 'reversal_started')
  const { calls, effects } = effectsFor(store, input(), { recoverReversal: async () => { throw new Error('private-read-data') } })
  await rejectsCode(executeSettlement(store, input(), effects), 'reconciliation_required')
  assert.equal(store.rows.get(input().operation_id).phase, 'reversal_started'); assert.deepEqual(calls, [])
})

test('migration emits a permanent unique operation key, unfinished-scope uniqueness and immutable-state safeguards', async () => {
  const path = 'packages/modules/b2c-core/src/modules/split-order-payment/migrations/Migration20261002152627.ts'
  assert(existsSync(new URL(path, root)), 'durable settlement migration is missing')
  let source = stripTypeScriptTypes(readFileSync(new URL(path, root), 'utf8'), { mode: 'strip' })
  source = source.replace(/^import .*Migration.*$/m, 'class Migration { sql = []; addSql(sql) { this.sql.push(sql) } }')
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  const migration = new module.Migration20261002152627()
  await migration.up()
  const sql = migration.sql.join('\n')
  assert.match(sql, /primary key\s*\("operation_id"\)/i)
  assert.match(sql, /unique index[\s\S]*scope_id[\s\S]*phase[^;]*<>[^;]*completed/i)
  assert(!sql.includes('deleted_at'), 'no soft-delete condition can release operation uniqueness')
  assert.match(sql, /create[\s\S]*trigger/i)
  assert.match(sql, /plan[\s\S]*is distinct from[\s\S]*plan/i)
  assert.match(sql, /refund_started/); assert.match(sql, /reversal_started/)
  assert.match(sql, /TG_OP = 'DELETE'/i)
  await migration.down()
  assert.match(migration.sql.at(-1), /drop function/i)
})
