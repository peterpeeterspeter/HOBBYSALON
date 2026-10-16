'use strict'
// OFFLINE VM wiring: real installed Medusa service/decorators/dispatcher/numerics,
// real source ALS, native fencing and quarantine. Only persistence/provider I/O
// is synthetic; no guard or quarantine import is stubbed or bypassed.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const dir = __dirname
const filename = path.join(dir, 'payment-refund-cancel-serialization.test.cjs')
let source = fs.readFileSync(filename, 'utf8').split("for (const method of ['refund', 'cancel', 'session']) {")[0]
source = source.replace('rows: [], reads:', 'rows: options.nativeRows || [], reads:')
source = source.replace("h.providers.push({ name, input }); await h.boundary('provider:' + name)", `
      h.providers.push({ name, input })
      h.providerActive = (h.providerActive || 0) + 1
      h.maxProviderActive = Math.max(h.maxProviderActive || 0, h.providerActive)
      try { await h.boundary('provider:' + name) } finally { h.providerActive-- }
`)
source = source.replace("assert.fail('Unexpected synthetic SQL: ' + sql)", `
      assertCommerceFinancialLock()
      h.events.push('quarantine:' + sql.split(' ')[0])
      const ledger = options.ledger || (options.ledger = [])
      const settlements = options.engineRows ? [...options.engineRows.values()].map(r => ({ ...r, ...r.input })) : (options.settlements || [])
      if (sql.includes('FROM payment_collection pc')) return { rows: [{ cart_id: cart, scope_id: payment.payment_collection_id, currency_code: payment.currency_code }] }
      if (sql.includes('FROM refund_settlement')) return { rows: settlements.filter(r => r.scope_id === bindings[0] && r.phase !== 'completed') }
      if (sql.includes('INSERT INTO commerce_refund_dispatch')) {
        const [operation_id, refund_id, payment_id, scope_id, provider_id, provider_payment_id, amount, currency_code] = bindings
        const native = h.rows.find(r => r.id === refund_id)
        assert.ok(native, 'dispatch identity must already be a committed native row')
        assert.ok(h.events.includes('transaction-commit'), 'native reservation commits before dispatch insert')
        assert.equal(native.payment_id, payment_id); assert.equal(payment.id, payment_id)
        assert.equal(payment.payment_collection_id, scope_id); assert.equal(payment.provider_id, provider_id)
        assert.equal(payment.data.id, provider_payment_id); assert.equal(payment.currency_code, currency_code)
        assert.ok(MathBN.eq(native.raw_amount.value, amount))
        if (ledger.some(r => r.refund_id === refund_id || (r.scope_id === scope_id && r.state === 'started'))) return { rows: [], rowCount: 0 }
        const row = { operation_id, refund_id, payment_id, scope_id, provider_id, provider_payment_id, amount, currency_code, idempotency_key: refund_id, state: 'started' }
        ledger.push(row); return { rows: [{ ...row }], rowCount: 1 }
      }
      if (sql.includes('UPDATE commerce_refund_dispatch')) {
        const row = ledger.find(r => r.refund_id === bindings[0] && r.scope_id === bindings[1] && r.state === 'started')
        assert.ok(h.events.includes('collection-update'), 'full accounting precedes completion')
        if (!row) return { rows: [], rowCount: 0 }
        row.state = 'completed'; return { rows: [{ ...row }], rowCount: 1 }
      }
      if (sql.includes('FROM commerce_refund_dispatch')) return { rows: ledger.filter(r => sql.includes('WHERE refund_id=') ? r.refund_id === bindings[0] : r.scope_id === bindings[0] && r.state === 'started').map(r => ({ ...r })) }
      if (sql.includes('FROM refund r JOIN payment p')) {
        const row = h.rows.find(r => r.id === bindings[0])
        return { rows: row ? [{ refund_id: row.id, payment_id: payment.id, scope_id: payment.payment_collection_id, cart_id: cart, provider_id: payment.provider_id, provider_payment_id: payment.data.id, amount: row.raw_amount.value, currency_code: payment.currency_code }] : [] }
      }
      assert.fail('Unexpected quarantine SQL: ' + sql)
`)
const loaded = { exports: {}, paths: module.paths }
vm.runInThisContext(`(function(require,module,__dirname){${source}\nmodule.exports={harness,utils,BigNumber,cartLock,assertCommerceOrderCancellation};})`, { filename })(require, loaded, dir)
const { harness, utils, BigNumber, cartLock, assertCommerceOrderCancellation } = loaded.exports
const { withCommerceRefundIntent: intent, withCommerceRefundDispatchContext: dispatchContext,
  finishCommerceRefundDispatch: finish, prepareCommerceRefundDispatch: prepare } = require(path.join(utils, 'commerce-refund-quarantine.ts'))
const { executeSettlement } = require(path.join(utils, 'refund-settlement.ts'))
const plan = { operation_id: 'cancel:order_fixture', order_id: 'order_fixture', scope_id: 'paycol_fixture', payment_id: 'pay_fixture', split_order_payment_id: null, payout_id: null, customerRefund: 3.21, sellerReversal: 0, currency_code: 'eur' }
const settlement = phase => ({ operation_id: plan.operation_id, scope_id: plan.scope_id, phase, plan })
const capture = h => h.run(() => h.service.capturePayment({ payment_id: h.payment.id }))
function noCaptureIO(h) {
  let statuses = 0, captures = 0
  h.dependencies.paymentProviderService.getStatus = async () => { statuses++; throw new Error('forbidden status read') }
  h.dependencies.paymentProviderService.capturePayment = async () => { captures++; throw new Error('forbidden capture') }
  return () => { assert.equal(statuses, 0); assert.equal(captures, 0); assert.equal(h.writes.length, 0) }
}
for (const phase of ['refund_started', 'reversal_started']) test('capture quarantine before status, reservation and accounting: ' + phase, async () => {
  const h = harness({ uncaptured: true, settlements: [settlement(phase)] }); const check = noCaptureIO(h)
  await assert.rejects(capture(h), /quarantine/); check()
})
test('own initial refund allowance never authorizes capture', async () => {
  const h = harness({ uncaptured: true, settlements: [settlement('refund_started')] }); const check = noCaptureIO(h)
  await assert.rejects(h.run(() => intent(plan, () => h.service.capturePayment({ payment_id: h.payment.id }))), /quarantine/); check()
})
test('direct admin public refund completes only after all native accounting', async () => {
  const ledger = []; const h = harness({ ledger }); const result = await h.refund()
  assert.equal(result.id, plan.payment_id); assert.equal(ledger.length, 1)
  assert.equal(ledger[0].operation_id, ledger[0].refund_id); assert.equal(ledger[0].state, 'completed')
  assert.ok(h.reads[0].config.select.includes('currency_code'))
  assert.equal(h.providers.length, 1); assert.ok(h.writes.some(w => w.name === 'collection'))
})
test('normal same-scope concurrent public refund batch completes two unique refunds and synthetic effects', async () => {
  const ledger = [], h = harness({ ledger })
  const results = await h.run(() => Promise.all([
    h.service.refundPayment({ payment_id: h.payment.id, amount: new BigNumber('3.21') }),
    h.service.refundPayment({ payment_id: h.payment.id, amount: new BigNumber('3.21') })
  ]))
  assert.equal(results.length, 2); assert.ok(results.every(r => r.id === h.payment.id))
  assert.equal(h.rows.length, 2); assert.equal(new Set(h.rows.map(r => r.id)).size, 2)
  assert.equal(ledger.length, 2); assert.ok(ledger.every(r => r.state === 'completed'))
  assert.deepEqual(ledger.map(r => r.refund_id), h.rows.map(r => r.id))
  const keys = h.providers.map(p => p.input.context.idempotency_key)
  assert.equal(new Set(keys).size, 2); assert.deepEqual(keys, h.rows.map(r => r.id))
  assert.equal(h.providers.length, 2, 'exactly two synthetic provider effects, not live provider evidence')
  assert.equal(h.maxProviderActive, 1); assert.equal(h.providerActive, 0)
  assert.equal(h.transactions.length, 2)
  assert.deepEqual(h.writes.map(w => w.name), ['refund-create', 'payment', 'collection', 'refund-create', 'payment', 'collection'])
  const collections = h.writes.filter(w => w.name === 'collection')
  assert.ok(new BigNumber(collections[1].data.refunded_amount).bigNumber.eq('6.42'))
  assert.equal(h.unlocks, 1); assert.equal(h.releases, 1)
})
for (const failAt of ['provider:refundPayment', 'payment-update', 'collection-update']) test('queued public refund sibling never reserves after swallowed native batch failure: ' + failAt, async () => {
  const { createWorkflow, WorkflowResponse } = require('@medusajs/framework/workflows-sdk')
  const { refundPaymentsStep } = require('@medusajs/core-flows')
  const { createMedusaContainer } = require('@medusajs/framework/utils')
  const { asValue } = require('@medusajs/framework/awilix')
  const ledger = [], h = harness({ ledger, failAt }), errors = []
  const container = createMedusaContainer()
  container.register({ payment: asValue(h.service), logger: asValue({ error: error => errors.push(error) }) })
  const batch = createWorkflow('offline-queued-refund-failure-' + failAt.replace(/:/g, '-'), function (input) {
    return new WorkflowResponse(refundPaymentsStep(input))
  })
  const lockError = /lock.*lost/i
  await assert.rejects(h.run(async () => {
    await assertCommerceOrderCancellation('order_fixture')
    assert.equal(h.receiptReads, 1, 'old completed receipt is readable before the failure only')
    const result = await batch(container).run({ input: [
      { payment_id: h.payment.id, amount: 1 }, { payment_id: h.payment.id, amount: 1 }
    ] })
    assert.equal(result.errors.length, 0); assert.deepEqual(result.result, [])
    assert.equal(errors.length, 2, 'real native batch swallowed both public refund rejections')
    assert.ok(h.events.includes(failAt), 'requested first-refund boundary was reached')
    assert.equal(h.counts['payment-retrieve'], 4, 'queued sibling performs no fresh read')
    assert.equal(h.transactions.length, 1); assert.equal(h.rows.length, 1)
    assert.equal(h.providers.length, 1, 'only first refund entered the synthetic provider')
    assert.equal(h.maxProviderActive, 1); assert.equal(ledger.length, 1); assert.equal(ledger[0].state, 'started')
    assert.deepEqual({ writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length }, h.atFailure)
    assert.equal(h.physicalHeld, true); assert.equal(h.unlocks, 0)
    const effects = { writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length, events: h.events.length }
    assert.throws(cartLock.assertCommerceFinancialLock, lockError)
    await assert.rejects(assertCommerceOrderCancellation('order_fixture'), lockError)
    await assert.rejects(h.orderService.cancel('order_fixture'), lockError)
    await assert.rejects(h.orderService.cancel_('order_fixture'), lockError)
    await assert.rejects(h.service.cancelPayment(h.payment.id), lockError)
    assert.deepEqual({ writes: h.writes.length, providers: h.providers.length, transactions: h.transactions.length, events: h.events.length }, effects)
    assert.equal(h.cancellationWrites.length, 0); assert.equal(h.receiptReads, 1)
    assert.ok(!h.writes.some(w => w.name === 'refund-delete'))
  }), lockError)
  assert.equal(h.physicalHeld, false); assert.equal(h.unlocks, 1); assert.equal(h.releases, 1)
})
for (const boundary of ['provider:refundPayment', 'payment-update', 'collection-update', 'serialize']) test('uncertainty retains native refund, blocks later dispatch and capture: ' + boundary, async () => {
  const ledger = [], nativeRows = []; const h = harness({ ledger, nativeRows, failAt: boundary })
  await assert.rejects(h.refund()); assert.equal(h.providers.length, 1)
  assert.equal(ledger.length, 1); assert.equal(ledger[0].state, 'started'); assert.equal(nativeRows.length, 1)
  assert.ok(!h.writes.some(w => w.name === 'refund-delete'))
  const later = harness({ ledger, nativeRows }); await assert.rejects(later.refund(), /quarantine/)
  assert.equal(later.providers.length, 0); assert.equal(later.writes.length, 0)
  await assert.rejects(later.run(() => dispatchContext(() => finish(ledger[0].refund_id))), /quarantine/)
  const check = noCaptureIO(later); await assert.rejects(capture(later), /quarantine/); check()
})
for (const method of ['cancel', 'session']) test(method + ' quarantine prevents provider and accounting', async () => {
  const h = harness({ uncaptured: true, settlements: [settlement('reversal_started')] })
  await assert.rejects(h[method](), /quarantine/); assert.equal(h.providers.length, 0); assert.equal(h.writes.length, 0)
})
test('protected direct dispatch has no completion receipt and stays quarantined', async () => {
  const ledger = []; const h = harness({ ledger })
  const row = await h.run(() => h.service.refundPayment_(h.payment, { payment_id: h.payment.id, amount: new BigNumber('3.21') }))
  await h.run(() => dispatchContext(async () => {
    await h.service.refundPaymentFromProvider_(h.payment, row)
    await assert.rejects(finish(row.id), /quarantine/)
  }))
  assert.equal(h.providers.length, 1); assert.equal(ledger[0].state, 'started')
  await assert.rejects(h.refund(), /quarantine/); assert.equal(h.providers.length, 1)
})
test('prepare direct native mode requires an actual live dispatch context', async () => {
  const h = harness(); await assert.rejects(h.run(() => prepare({ refund_id: 'r', payment_id: h.payment.id, scope_id: plan.scope_id, provider_id: h.payment.provider_id, provider_payment_id: h.payment.data.id, amount: '3.21', currency_code: 'eur' })), /quarantine/)
  assert.equal(h.providers.length, 0)
})
function store(rows) {
  return { withScopeLock: async (_scope, work) => work({
    getOperation: async id => rows.get(id) || null,
    findUnfinished: async except => [...rows.values()].find(r => r.input.operation_id !== except && r.phase !== 'completed') || null,
    create: async record => rows.set(record.input.operation_id, structuredClone(record)),
    transition: async (id, expected, next) => { const row = rows.get(id); assert.equal(row.phase, expected); row.phase = next }
  }) }
}
for (const fail of [false, true]) test('executeSettlement grants exact own refund intent; crash never retries (' + fail + ')', async () => {
  const engineRows = new Map(), ledger = []; const h = harness({ ledger, engineRows, ...(fail ? { failAt: 'provider:refundPayment' } : {}) })
  const input = { operation_id: plan.operation_id, order_id: plan.order_id, scope_id: plan.scope_id, fingerprint: 'fixed-request' }
  const effects = { plan: async () => plan, refund: async saved => h.service.refundPayment({ payment_id: saved.payment_id, amount: new BigNumber(saved.customerRefund) }), reverse: async () => assert.fail('no reversal expected') }
  const run = () => h.run(() => executeSettlement(store(engineRows), input, effects))
  if (fail) {
    await assert.rejects(run(), error => error.code === 'reconciliation_required')
    await assert.rejects(run(), error => error.code === 'reconciliation_required')
    assert.equal(engineRows.get(plan.operation_id).phase, 'refund_started'); assert.equal(ledger[0].state, 'started')
  } else {
    const result = await run(); assert.equal(result.receipt.phase, 'completed'); assert.equal(ledger[0].state, 'completed')
    await run()
  }
  assert.equal(h.providers.length, 1); assert.equal(ledger[0].operation_id, plan.operation_id)
})
