'use strict'
// OFFLINE unit tests: installed Medusa numeric/container/migration APIs and real
// source ALS/lock/query helpers; explicit synthetic SQL persistence, no DB/provider.
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
    filename, jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'commonjs' }
  }).code, filename)
}
const { withCommerceCartLock, assertCommerceFinancialLock } = require(path.join(utils, 'commerce-cart-lock.ts'))
const { assertCommerceRefundQuarantineClear: clear, withCommerceRefundIntent: intent,
  prepareCommerceRefundDispatch: prepare, finishCommerceRefundDispatch: finish,
  withCommerceRefundDispatchContext: dispatchContext } = require(path.join(utils, 'commerce-refund-quarantine.ts'))
const migrationFile = path.join(root, 'packages/modules/b2c-core/src/modules/split-order-payment/migrations/Migration20261005193000.ts')
const plan = { operation_id: 'cancel:order_unit', scope_id: 'pc_unit', payment_id: 'pay_unit', customerRefund: 3.21, currency_code: 'eur' }
const input = { refund_id: 'ref_unit', payment_id: 'pay_unit', scope_id: 'pc_unit', provider_id: 'pp_unit', provider_payment_id: 'pi_unit', amount: '3.2100', currency_code: 'eur' }
const settlement = (changes = {}) => ({ operation_id: plan.operation_id, scope_id: plan.scope_id, phase: 'refund_started', plan: { ...plan }, ...changes })
function fixture(options = {}, persistent = { dispatch: [], settlements: [] }) {
  const connection = new EventEmitter()
  const h = { connection, persistent, calls: [], nativeVisible: true, link: [{ cart_id: 'cart_unit', scope_id: 'pc_unit', currency_code: 'eur' }], failures: {} }
  h.native = { refund_id: input.refund_id, payment_id: input.payment_id, scope_id: input.scope_id, cart_id: 'cart_unit', provider_id: input.provider_id, provider_payment_id: input.provider_payment_id, amount: '3.21', currency_code: 'eur' }
  const knex = {
    client: { acquireConnection: async () => connection, releaseConnection: async () => {}, destroyRawConnection: async () => {} },
    raw: (sql, bindings = []) => ({ connection: async actual => {
      assert.equal(actual, connection, 'every statement uses the physical lock owner')
      if (/pg_try_advisory_lock/.test(sql)) return { rows: [{ locked: true }] }
      if (/pg_advisory_unlock/.test(sql)) return { rows: [{ unlocked: true }] }
      if (sql === 'SET SESSION synchronous_commit = on') return { rows: [] }
      assertCommerceFinancialLock()
      h.calls.push({ sql, bindings: [...bindings] })
      if (options.loseAt && sql.includes(options.loseAt)) connection.emit('end')
      const key = /INSERT INTO commerce_refund_dispatch/.test(sql) ? 'insert' : /UPDATE commerce_refund_dispatch/.test(sql) ? 'update' : /FROM refund r JOIN payment p/.test(sql) ? 'native' : /FROM refund_settlement/.test(sql) ? 'settlement' : /FROM commerce_refund_dispatch/.test(sql) ? 'dispatch' : 'link'
      if (options.failAt === key) throw new Error('SECRET storage details')
      if (Object.hasOwn(h.failures, key)) return h.failures[key]
      if (key === 'link') { assert.match(sql, /payment_collection/); assert.match(sql, /cart_payment_collection/); return { rows: h.link } }
      if (key === 'native') return { rows: h.nativeVisible ? [h.native] : [] }
      if (key === 'settlement') { assert.match(sql, /phase\s*<>\s*'completed'/); return { rows: persistent.settlements.filter(x => x.scope_id === bindings[0] && x.phase !== 'completed') } }
      if (key === 'dispatch') {
        const rows = /refund_id\s*=\s*\?/.test(sql) ? persistent.dispatch.filter(x => x.refund_id === bindings[0]) : persistent.dispatch.filter(x => x.scope_id === bindings[0] && x.state === 'started')
        return { rows: rows.map(x => ({ ...x })) }
      }
      if (key === 'insert') {
        assert.match(sql, /SELECT/); assert.match(sql, /FROM refund r JOIN payment p/); assert.match(sql, /RETURNING/)
        assert.match(sql, /ON CONFLICT \(refund_id\) DO NOTHING/)
        // Bind order is part of this explicit test double, not actual SQL execution.
        const [operation_id, refund_id, payment_id, scope_id, provider_id, provider_payment_id, amount, currency_code] = bindings
        if (!h.nativeVisible || persistent.dispatch.some(x => x.refund_id === refund_id)) return { rows: [], rowCount: 0 }
        const row = { operation_id, refund_id, idempotency_key: refund_id, payment_id, scope_id, provider_id, provider_payment_id, amount, currency_code, state: 'started' }
        persistent.dispatch.push(row); return { rows: [{ ...row }], rowCount: 1 }
      }
      if (key === 'update') {
        assert.match(sql, /state\s*=\s*'completed'/); assert.match(sql, /RETURNING/)
        const row = persistent.dispatch.find(x => x.refund_id === bindings[0] && x.scope_id === bindings[1] && x.state === 'started')
        if (!row) return { rows: [], rowCount: 0 }
        row.state = 'completed'; return { rows: [{ ...row }], rowCount: 1 }
      }
      assert.fail('Unexpected SQL')
    } })
  }
  h.run = fn => withCommerceCartLock({ resolve: () => knex }, options.cart || 'cart_unit',
    () => dispatchContext(async nativeAccounting => { h.complete = () => nativeAccounting(async () => ({
      id: input.payment_id, refunds: [{ id: input.refund_id, raw_amount: { value: input.amount } }]
    })); return fn() }))
  h.own = fn => h.run(() => intent(plan, fn))
  return h
}
test('exports and clear scope use real owner-bound SQL with both ledgers', async () => {
  const h = fixture(); await h.run(() => clear(plan.scope_id)); assert.equal(h.calls.length, 3)
  assert.match(h.calls[1].sql, /refund_settlement/); assert.match(h.calls[2].sql, /commerce_refund_dispatch/)
})
for (const fn of [() => clear(plan.scope_id), () => intent(plan, async () => {}), () => prepare(input), () => finish(input.refund_id)]) {
  test('no caller-supplied capability substitutes for private owner', async () => { await assert.rejects(fn, /lock.*not held/i) })
}
for (const mode of [undefined, 'capture', 'cancel', 'refund']) test('unfinished settlement blocks outside intent: ' + mode, async () => {
  const h = fixture(); h.persistent.settlements.push(settlement()); await assert.rejects(h.run(() => clear(plan.scope_id, mode)), /quarantine|reconciliation/i)
})
test('own initial refund_started is permitted only in refund mode; capture and cancel remain blocked', async () => {
  const h = fixture(); h.persistent.settlements.push(settlement())
  await h.own(async () => { await clear(plan.scope_id, 'refund'); for (const mode of ['capture', 'cancel', undefined]) await assert.rejects(clear(plan.scope_id, mode), /quarantine|reconciliation/i) })
})
for (const changes of [{ operation_id: 'other' }, { plan: { ...plan, payment_id: 'pay_other' } }, { plan: { ...plan, customerRefund: 9 } }, { plan: { ...plan, currency_code: 'usd' } }, { phase: 'reversal_started' }, { plan: null }]) {
  test('own exception refuses different or malformed settlement identity: ' + JSON.stringify(changes), async () => {
    const h = fixture(); h.persistent.settlements.push(settlement(changes)); await assert.rejects(h.own(() => clear(plan.scope_id, 'refund')))
  })
}
test('prepared native identity commits before work; same active intent alone allows its exact dispatch', async () => {
  const h = fixture(); h.persistent.settlements.push(settlement())
  await h.own(async () => { await prepare(input); assert.equal(h.persistent.dispatch.length, 1); const saved = h.persistent.dispatch[0]
    assert.equal(saved.idempotency_key, input.refund_id); assert.equal(saved.operation_id, plan.operation_id); await clear(plan.scope_id, 'refund')
    await assert.rejects(clear(plan.scope_id, 'capture')); await assert.rejects(prepare(input), /quarantine|reconciliation/i)
    await h.complete(); await finish(input.refund_id); assert.equal(saved.state, 'completed'); await assert.rejects(clear(plan.scope_id, 'cancel'))
  })
  await assert.rejects(h.run(() => clear(plan.scope_id, 'refund')))
  h.persistent.settlements[0].phase = 'completed'; await h.run(() => clear(plan.scope_id))
})
test('native direct dispatch uses refund id fallback; caller cannot spoof operation authority', async () => {
  const h = fixture(); await h.run(() => prepare(input)); assert.equal(h.persistent.dispatch[0].operation_id, input.refund_id)
  const other = fixture(); await assert.rejects(other.run(() => prepare({ ...input, operation_id: plan.operation_id }))); assert.equal(other.persistent.dispatch.length, 0)
})
test('started dispatch survives new invocation/process model, including unrelated payment in same scope', async () => {
  const h = fixture(); await h.run(() => prepare(input))
  const restarted = fixture({}, h.persistent); await assert.rejects(restarted.run(() => clear(plan.scope_id, 'refund')))
  await assert.rejects(restarted.own(() => clear(plan.scope_id, 'refund')), /quarantine|reconciliation/i)
  await assert.rejects(restarted.run(() => prepare({ ...input, refund_id: 'ref_other', payment_id: 'pay_other' })))
  assert.equal(h.persistent.dispatch.length, 1)
})
for (const field of ['refund_id', 'payment_id', 'scope_id', 'provider_id', 'provider_payment_id', 'amount', 'currency_code']) test('committed native SELECT must match ' + field + ' before INSERT', async () => {
  const h = fixture(); h.native[field] = field === 'amount' ? '3.22' : 'different'; await assert.rejects(h.run(() => prepare(input))); assert.equal(h.persistent.dispatch.length, 0)
})
test('uncommitted/missing native refund cannot be fabricated by INSERT', async () => {
  const h = fixture(); h.nativeVisible = false; await assert.rejects(h.run(() => prepare(input))); assert.equal(h.persistent.dispatch.length, 0)
})
for (const rows of [[], null, [{ cart_id: 'cart_other', scope_id: plan.scope_id, currency_code: 'eur' }], [{ cart_id: 'cart_unit', scope_id: 'pc_other', currency_code: 'eur' }], [{}, {}]]) test('missing/ambiguous/wrong native scope refuses effects: ' + JSON.stringify(rows), async () => {
  const h = fixture(); h.link = rows; await assert.rejects(h.run(() => clear(plan.scope_id))); assert.equal(h.persistent.dispatch.length, 0)
})
for (const key of ['link', 'settlement', 'dispatch', 'native', 'insert', 'update']) test('SQL failure is sanitized and fails closed: ' + key, async () => {
  const h = fixture({ failAt: key })
  await assert.rejects(h.run(async () => { if (key === 'update') { await prepare(input); await h.complete(); await finish(input.refund_id) } else if (['native', 'insert'].includes(key)) await prepare(input); else await clear(plan.scope_id) }), err => !/SECRET/.test(err.message))
  if (key === 'update') assert.equal(h.persistent.dispatch[0].state, 'started')
})
for (const response of [{}, { rows: [] }, { rows: [{}], rowCount: 1 }, { rows: [], rowCount: 1 }, { rows: [{}], rowCount: 0 }]) test('INSERT RETURNING must prove exact committed row: ' + JSON.stringify(response), async () => {
  const h = fixture(); h.failures.insert = response; await assert.rejects(h.run(() => prepare(input)))
})
test('later invocation cannot finish; same invocation still validates native binding and UPDATE RETURNING', async () => {
  const later = fixture(); await later.run(() => prepare(input))
  await assert.rejects(later.run(() => finish(input.refund_id))); assert.equal(later.persistent.dispatch[0].state, 'started')
  const h = fixture(); await h.run(async () => {
    await prepare(input); await h.complete(); h.native.amount = '5'
    await assert.rejects(finish(input.refund_id)); assert.equal(h.persistent.dispatch[0].state, 'started')
    h.native.amount = '3.210'; h.failures.update = { rows: [], rowCount: 1 }; await assert.rejects(finish(input.refund_id))
  })
})
test('completed receipt is idempotent, but does not remove unfinished settlement quarantine', async () => {
  const h = fixture(); await h.run(async () => { await prepare(input); await h.complete(); await finish(input.refund_id); await finish(input.refund_id) })
  h.persistent.settlements.push(settlement()); await assert.rejects(h.run(() => clear(plan.scope_id))); assert.equal(h.persistent.dispatch.length, 1)
})
test('intent snapshot rejects mutation, nesting, and detached async authority after work ends', async () => {
  const h = fixture(); const mutable = { ...plan }; let release, escaped
  await h.run(async () => { await intent(mutable, async () => {
    mutable.operation_id = 'spoof'; h.persistent.settlements.push(settlement()); await clear(plan.scope_id, 'refund')
    await assert.rejects(intent({ ...plan, operation_id: 'other' }, async () => {}))
    escaped = new Promise(resolve => { release = resolve }).then(() => clear(plan.scope_id, 'refund'))
  }); release(); await assert.rejects(escaped) })
})
test('parallel intent branches cannot borrow another branch allowance', async () => {
  const h = fixture(); h.persistent.settlements.push(settlement())
  await h.run(() => Promise.all([intent(plan, () => clear(plan.scope_id, 'refund')), assert.rejects(clear(plan.scope_id, 'refund'))]))
})
for (const boundary of ['FROM payment_collection', 'FROM refund r JOIN payment p', 'INSERT INTO commerce_refund_dispatch', 'UPDATE commerce_refund_dispatch']) test('owner loss after await fences further work: ' + boundary, async () => {
  const h = fixture({ loseAt: boundary }); await assert.rejects(h.run(async () => { await prepare(input); await h.complete(); await finish(input.refund_id) }), /lock.*lost|lock.*not held/i)
})
test('migration produces append-only immutable identity, native binding, started/completed and no destructive rollback', async () => {
  const { Migration20261005193000 } = require(migrationFile)
  const statements = []; const m = new Migration20261005193000({}, {}); m.addSql = sql => statements.push(sql)
  await m.up(); const sql = statements.join('\n')
  assert.match(sql, /CREATE TABLE "commerce_refund_dispatch"/); assert.match(sql, /idempotency_key\s*=\s*refund_id/)
  assert.match(sql, /PRIMARY KEY/); assert.match(sql, /UNIQUE INDEX[\s\S]*scope_id[\s\S]*state = 'started'/)
  assert.match(sql, /TG_OP = 'DELETE'/); assert.match(sql, /TG_OP = 'INSERT'/); assert.match(sql, /OLD.state = 'started' AND NEW.state = 'completed'/)
  for (const field of ['refund_id', 'idempotency_key', 'operation_id', 'scope_id', 'payment_id', 'provider_id', 'provider_payment_id', 'amount', 'currency_code', 'created_at']) assert.match(sql, new RegExp('NEW\\.' + field + ' IS DISTINCT FROM OLD\\.' + field))
  assert.match(sql, /FROM refund r JOIN payment p/); assert.match(sql, /BEFORE INSERT OR UPDATE OR DELETE/)
  await assert.rejects(m.down(), /quarantine|reconciliation|append-only/i)
})
