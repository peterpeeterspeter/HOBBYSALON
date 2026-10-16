'use strict'
// Established native TS/SWC fixture pattern; real source ALS, Medusa numeric /
// migration APIs and runtime engine/store/quarantine. SQL double is explicitly
// synthetic; optional PG test must target a NEW disposable network-none server.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const swc = require('@swc/core')
const root = path.resolve(__dirname, '../..')
const utils = path.join(root, 'packages/modules/b2c-core/src/utils')
Module._extensions['.ts'] = (mod, filename) => {
  mod.paths = [...module.paths, ...mod.paths]
  mod._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2022' },
    module: { type: 'commonjs' }
  }).code, filename)
}
const cart = require(path.join(utils, 'commerce-cart-lock.ts'))
const engine = require(path.join(utils, 'refund-settlement.ts'))
const { createPostgresSettlementStore } = require(path.join(utils, 'refund-settlement-store.ts'))
const quarantine = require(path.join(utils, 'commerce-refund-quarantine.ts'))
const request = { operation_id: 'cancel:order_noeffect', order_id: 'order_noeffect', scope_id: 'pc_noeffect', fingerprint: 'fixture-v1' }
const plan = { ...request, payment_id: 'pay_noeffect', split_order_payment_id: 'split_noeffect', payout_id: null,
  currency_code: 'eur', customerRefund: 3.21, sellerReversal: 0 }
delete plan.fingerprint
const seed = (changes = {}) => ({ ...request, plan: { ...plan }, phase: 'refund_started', reversal_receipt_id: null, ...changes })
const clone = x => JSON.parse(JSON.stringify(x))
function fixture(record = seed(), options = {}) {
  const state = { rows: record ? [clone(record)] : [], calls: [], effects: [], connections: [], fail: false }
  const knex = {
    client: {
      acquireConnection: async () => { const c = new EventEmitter(); state.connections.push(c); return c },
      releaseConnection: async () => {}, destroyRawConnection: async () => {},
    },
    raw: (sql, bindings = []) => ({ connection: async connection => {
      assert(state.connections.includes(connection), 'SQL uses a checked-out physical owner')
      state.calls.push({ sql, bindings: [...bindings], connection })
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] }
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: true }] }
      if (sql === 'SET SESSION synchronous_commit = on') return { rows: [] }
      if (options.loseAt && sql.includes(options.loseAt)) connection.emit('end')
      if (state.fail) throw new Error('PRIVATE synthetic storage failure')
      if (sql.includes('FROM payment_collection pc')) return { rows: [{
        cart_id: options.cart || 'cart_noeffect', scope_id: request.scope_id, currency_code: 'eur'
      }] }
      if (sql.includes('FROM refund_settlement')) {
        if (sql.includes('WHERE operation_id = ?')) return { rows: clone(state.rows.filter(r => r.operation_id === bindings[0])) }
        if (sql.includes('operation_id <> ?')) return { rows: clone(state.rows.filter(r => r.scope_id === bindings[0] && r.operation_id !== bindings[1] && (r.phase !== 'completed' || r.no_effect_receipt_id != null)).slice(0, 1)) }
        return { rows: clone(state.rows.filter(r => r.scope_id === bindings[0] && (r.phase !== 'completed' || r.no_effect_receipt_id != null))) }
      }
      if (sql.includes('FROM commerce_refund_dispatch')) return { rows: [] }
      // Inspection/refusal tests MUST never reach writes, native provider prep,
      // native accounting or arbitrary SQL. This is a transport trap, not a
      // copied closure validator. All business decisions run in actual TS.
      assert.fail('Forbidden/unexpected fixture SQL: ' + sql)
    } })
  }
  const container = { resolve: () => knex }
  state.store = createPostgresSettlementStore(knex, cart.assertCommerceFinancialLock)
  state.run = fn => cart.withCommerceCartLock(container, 'cart_noeffect', fn)
  state.effectsApi = { plan: async () => { state.effects.push('plan'); return plan },
    refund: async () => { state.effects.push('refund') }, reverse: async () => { state.effects.push('reverse') } }
  return state
}
const noWrites = h => {
  assert.deepEqual(h.effects, [])
  assert(!h.calls.some(c => /\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/.test(c.sql)))
}
for (const marker of [undefined, null, 'forged_receipt']) test('engine/store same NO-EFFECT operation never dispatches: ' + marker, async () => {
  const h = fixture(seed({ phase: 'refund_no_effect', no_effect_receipt_id: marker }))
  const before = clone(h.rows)
  for (let i = 0; i < 2; i++) await assert.rejects(h.run(() => engine.executeSettlement(h.store, request, h.effectsApi)), e => e.code === 'reconciliation_required')
  assert.deepEqual(h.rows, before); noWrites(h)
})
test('real engine also rejects a custom store returning NO-EFFECT, not a successful workflow tail', async () => {
  const h = fixture()
  let tails = 0
  const store = { withScopeLock: (_, work) => work({
    getOperation: async () => ({ input: request, plan, phase: 'refund_no_effect', reversal_receipt_id: null, no_effect_receipt_id: 'forged' }),
    findUnfinished: async () => assert.fail('Terminal must not continue'),
    create: async () => assert.fail('No create'), transition: async () => assert.fail('No transition')
  }) }
  await assert.rejects(h.run(async () => { await engine.executeSettlement(store, request, h.effectsApi); tails++ }), e => e.code === 'reconciliation_required')
  assert.equal(tails, 0); noWrites(h)
})
for (const mode of [undefined, 'refund', 'capture', 'cancel']) test('real quarantine rejects NO-EFFECT with forged/missing receipt and own intent: ' + mode, async () => {
  for (const marker of [null, 'forged']) {
    const h = fixture(seed({ phase: 'refund_no_effect', no_effect_receipt_id: marker }))
    await assert.rejects(h.run(() => quarantine.withCommerceRefundIntent(plan,
      () => quarantine.assertCommerceRefundQuarantineClear(request.scope_id, mode))), /quarantine|reconciliation/)
    noWrites(h)
  }
})
test('other operation is blocked; a receipt marker on tampered completed is not completion', async () => {
  for (const phase of ['refund_no_effect', 'completed']) {
    const h = fixture(seed({ phase, no_effect_receipt_id: 'forged' }))
    await assert.rejects(h.run(() => engine.executeSettlement(h.store, { ...request, operation_id: 'other' }, h.effectsApi)))
    await assert.rejects(h.run(() => quarantine.assertCommerceRefundQuarantineClear(request.scope_id)))
    noWrites(h)
  }
})
test('ordinary CAS refuses direct closure, reset, terminal update before operational SQL', async () => {
  const h = fixture()
  await h.run(() => h.store.withScopeLock(request.scope_id, async session => {
    for (const [expected, next] of [['refund_started', 'refund_no_effect'], ['refund_no_effect', 'completed'],
      ['refund_no_effect', 'pending'], ['completed', 'pending'], ['completed', 'completed']]) {
      await assert.rejects(session.transition(request.operation_id, expected, next), e => e.code === 'invalid_input')
    }
  }))
  noWrites(h)
})
test('candidate is deeply detached BLOCKED NO-EFFECT, genuine cart -> scope ownership, no fake receipt/accounting', async () => {
  const h = fixture(); const before = clone(h.rows)
  const candidate = await h.run(() => engine.inspectRefundNoEffectCloseCandidate(h.store, request))
  assert.equal(candidate.status, 'BLOCKED'); assert.equal(candidate.executable, false)
  assert.equal(candidate.intended_terminal_result, 'NO-EFFECT'); assert.equal(candidate.intended_terminal_phase, 'refund_no_effect')
  assert.equal(candidate.financial_obligation, 'unchanged_unresolved')
  assert.equal(candidate.protocol, engine.REFUND_NO_EFFECT_PROTOCOL)
  assert.match(candidate.snapshot_sha256, /^[0-9a-f]{64}$/)
  for (const part of [candidate, candidate.input, candidate.plan, candidate.blockers]) assert(Object.isFrozen(part))
  assert(candidate.blockers.includes('retained_local_predispatch_boundary_missing'))
  assert(candidate.blockers.includes('independent_complete_provider_inventory_verifier_missing'))
  assert(candidate.blockers.includes('atomic_audited_close_and_authenticated_readback_missing'))
  assert(!Object.hasOwn(candidate, 'receipt_id'))
  h.rows[0].plan.customerRefund = 99
  assert.equal(candidate.plan.customerRefund, before[0].plan.customerRefund)
  const lockCalls = h.calls.filter(c => c.sql.includes('pg_try_advisory_lock'))
  assert.equal(lockCalls.length, 2); assert.notEqual(lockCalls[0].connection, lockCalls[1].connection)
  assert.equal(lockCalls[0].bindings[0], cart.commerceCartLockKey('cart_noeffect'))
  const scopes = h.calls.filter(c => c.sql.includes('FROM payment_collection pc'))
  assert.equal(scopes.length, 4, 'native scope bound before and inside scope lock')
  noWrites(h)
})
test('candidate refuses missing cart owner, wrong cart, lost cart, lost scope, unsupported financial leg', async () => {
  const h = fixture()
  await assert.rejects(engine.inspectRefundNoEffectCloseCandidate(h.store, request))
  for (const options of [{ cart: 'different_cart' }, { loseAt: 'FROM payment_collection pc' }, { loseAt: 'WHERE operation_id = ?' }]) {
    const blocked = fixture(seed(), options)
    await assert.rejects(blocked.run(() => engine.inspectRefundNoEffectCloseCandidate(blocked.store, request)))
    noWrites(blocked)
  }
  const unsupported = fixture(seed({ plan: { ...plan, sellerReversal: 1, payout_id: 'payout_fixture' } }))
  await assert.rejects(unsupported.run(() => engine.inspectRefundNoEffectCloseCandidate(unsupported.store, request)))
  noWrites(unsupported)
})
test('scope capability is mandatory, caller verified flags cannot enable inspection or closure', async () => {
  const h = fixture()
  const custom = { withScopeLock: (_, work) => work({ getOperation: async () => assert.fail('No authority') }) }
  await assert.rejects(h.run(() => engine.inspectRefundNoEffectCloseCandidate(custom,
    { ...request, verified: true, complete_inventory: true, writer_fence: true })), e => e.code === 'lock_unavailable')
  noWrites(h)
})
test('storage failure is sanitized and never grants terminal permission', async () => {
  const h = fixture(); h.fail = true
  await assert.rejects(h.run(() => engine.inspectRefundNoEffectCloseCandidate(h.store, request)), e => !/PRIVATE/.test(e.message))
  noWrites(h)
})
const migrations = path.join(root, 'packages/modules/b2c-core/src/modules/split-order-payment/migrations')
async function migrationSql(name) {
  const Cls = require(path.join(migrations, name + '.ts'))[name]
  const m = new Cls({}, {}), sql = []; m.addSql = statement => sql.push(statement)
  await m.up(); return { m, sql }
}
test('real native migration is sealed, preserves legacy guard/index and cannot rollback', async () => {
  const { m, sql } = await migrationSql('Migration20261006100000')
  const text = sql.join('\n')
  assert.match(text, /terminal_result='NO-EFFECT'/)
  assert.match(text, /BEFORE INSERT OR UPDATE OR DELETE ON refund_no_effect_closure/)
  assert.match(text, /BEFORE TRUNCATE ON refund_no_effect_closure/)
  assert.match(text, /ENABLE ALWAYS TRIGGER/)
  assert.match(text, /NO-EFFECT closure protocol unavailable/)
  assert(!/DROP (INDEX|TRIGGER)|UPDATE refund_settlement SET|INSERT INTO refund_no_effect_closure/.test(text))
  for (const field of ['provider_inventory', 'retained_predispatch_boundary', 'writer_fence', 'operator_authorization', 'actual_before', 'actual_after', 'immutable_plan']) assert(text.includes(field))
  await assert.rejects(m.down(), /append-only|forbidden/)
})

// Never default to an existing DB / credential config. The test socket is an
// explicit disposable server created for this suite, not a sandbox/production.
test('isolated PostgreSQL: actual migrations + real runtime consumers + DB denial + unchanged ledgers',
  { skip: !process.env.NOEFFECT_DISPOSABLE_PG_SOCKET }, async () => {
    assert.equal(process.env.NOEFFECT_DISPOSABLE_PG_ACK, 'new-network-none-tmpfs-server')
    const knex = require('knex')({ client: 'pg', connection: {
      host: process.env.NOEFFECT_DISPOSABLE_PG_SOCKET, user: 'postgres', database: 'postgres'
    }, pool: { min: 0, max: 4 } })
    try {
      await knex.raw(`CREATE TABLE payment_collection (id text PRIMARY KEY,currency_code text,deleted_at timestamptz);
        CREATE TABLE cart_payment_collection (cart_id text,payment_collection_id text,deleted_at timestamptz);
        CREATE TABLE payment (id text PRIMARY KEY,payment_collection_id text,provider_id text,data jsonb,currency_code text,deleted_at timestamptz);
        CREATE TABLE refund (id text PRIMARY KEY,payment_id text,raw_amount jsonb,amount numeric,deleted_at timestamptz);
        CREATE TABLE financial_fixture (captured numeric,refunded numeric,signed_transactions numeric);
        INSERT INTO financial_fixture VALUES (10,0,10);
        INSERT INTO payment_collection VALUES ('pc_noeffect','eur',NULL);
        INSERT INTO cart_payment_collection VALUES ('cart_noeffect','pc_noeffect',NULL);`)
      for (const name of ['Migration20261002152627', 'Migration20261005193000', 'Migration20261006100000']) {
        for (const sql of (await migrationSql(name)).sql) await knex.raw(sql)
      }
      await knex.raw(`INSERT INTO refund_settlement(operation_id,order_id,scope_id,fingerprint,plan)
        VALUES (?,?,?,?,?::jsonb)`, [request.operation_id, request.order_id, request.scope_id, request.fingerprint, JSON.stringify(plan)])
      await knex.raw(`UPDATE refund_settlement SET phase='refund_started' WHERE operation_id=?`, [request.operation_id])
      const before = (await knex.raw('SELECT * FROM refund_settlement')).rows
      const finance = (await knex.raw('SELECT * FROM financial_fixture')).rows
      const container = { resolve: () => knex }
      const store = createPostgresSettlementStore(knex, cart.assertCommerceFinancialLock)
      const candidate = await cart.withCommerceCartLock(container, 'cart_noeffect', () => engine.inspectRefundNoEffectCloseCandidate(store, request))
      assert.equal(candidate.status, 'BLOCKED')
      const effects = []
      await assert.rejects(cart.withCommerceCartLock(container, 'cart_noeffect', () =>
        engine.executeSettlement(store, request, {
          plan: async () => { effects.push('plan'); return plan },
          refund: async () => { effects.push('refund') },
          reverse: async () => { effects.push('reverse') },
        })), error => error.code === 'reconciliation_required')
      assert.deepEqual(effects, [])
      await assert.rejects(cart.withCommerceCartLock(container, 'cart_noeffect', () => quarantine.assertCommerceRefundQuarantineClear(request.scope_id)))
      for (const sql of [
        `UPDATE refund_settlement SET phase='refund_no_effect' WHERE operation_id='cancel:order_noeffect'`,
        `INSERT INTO refund_settlement(operation_id,order_id,scope_id,fingerprint,plan,phase) SELECT 'forged',order_id,scope_id,fingerprint,plan,'refund_no_effect' FROM refund_settlement`,
        `DELETE FROM refund_settlement`, `TRUNCATE refund_settlement`,
        `INSERT INTO refund_no_effect_closure DEFAULT VALUES`,
        `UPDATE refund_no_effect_closure SET terminal_result='NO-EFFECT'`,
        `DELETE FROM refund_no_effect_closure`, `TRUNCATE refund_no_effect_closure`,
      ]) await assert.rejects(knex.raw(sql))
      assert.deepEqual((await knex.raw('SELECT * FROM refund_settlement')).rows, before)
      assert.deepEqual((await knex.raw('SELECT * FROM financial_fixture')).rows, finance)
      for (const table of ['refund_no_effect_closure', 'commerce_refund_dispatch', 'refund']) assert.equal((await knex.raw(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0)
      const indexes = (await knex.raw(`SELECT indexdef FROM pg_indexes WHERE indexname='refund_settlement_unfinished_scope'`)).rows
      assert.match(indexes[0].indexdef, /phase <> 'completed'/, 'legacy runtime stays blocked, not silent success')
      // Failed operational SQL and read-only candidate leave no held ownership.
      assert.equal((await knex.raw(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`)).rows[0].n, 0)
    } finally { await knex.destroy() }
  })
