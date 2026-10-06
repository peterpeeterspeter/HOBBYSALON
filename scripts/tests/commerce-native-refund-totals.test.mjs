import assert from 'node:assert/strict'
import test from 'node:test'
import { run, orderFixture } from './commerce-settlement-wiring.test.mjs'

// Model the pinned Medusa 2.11.3 contract: item total fields alone do not
// activate order totals. The native contract check separately exercises the
// installed OrderModuleService.shouldIncludeTotals with candidate query fields.
test('return planning requests native order totals before allocating paid merchandise', async () => {
  const effects = {}
  const order = orderFixture({
    items: [{ id: 'line-a', quantity: 3, total: 54.45, subtotal: 45, unit_price: 20 }],
    split_order_payment: { id: 'payment-test', captured_amount: 75, refunded_amount: 0 },
    payouts: [],
  })
  const result = await run('return', {
    order, effects, lines: [],
    queryOverride(query) {
      if (query.entity !== 'orders') return
      const projected = structuredClone(order)
      if (!query.fields.includes('total') || !query.fields.includes('items.detail.quantity')) {
        for (const item of projected.items) { delete item.total; delete item.subtotal; delete item.quantity }
      }
      return { data: [projected] }
    },
  })
  assert.equal(result.result.customer_refund, 18.15)
  assert.equal(effects.refunds[0].amount, 18.15)
  assert.equal(effects.reversals.length, 0)
  assert.ok(effects.queries.some(query => query.entity === 'orders' && query.locked &&
    query.fields.includes('total') && query.fields.includes('items.total') && query.fields.includes('items.detail.quantity')))
})

for (const missing of ['total', 'items.detail.quantity']) {
  test(`missing native projection ${missing} fails without financial effects`, async () => {
    const effects = {}
    await assert.rejects(run('return', {
      effects, order: orderFixture({ payouts: [] }),
      queryOverride(query) {
        if (query.entity !== 'orders') return
        const projected = orderFixture({ payouts: [] })
        if (query.fields.includes(missing)) {
          for (const item of projected.items) {
            if (missing === 'total') delete item.total
            else delete item.quantity
          }
        }
        return { data: [projected] }
      },
    }), /plan_failed/)
    assert.equal(effects.refunds.length, 0)
    assert.equal(effects.reversals.length, 0)
    assert.equal(effects.ledgerWrites.length, 0)
  })
}

test('native decimal paid totals keep precision until minor-unit rounding', async () => {
  const effects = {}
  const result = await run('return', {
    effects, lines: [],
    order: orderFixture({
      items: [{ id: 'line-a', quantity: 2, total: '36.289999999999999999' }],
      split_order_payment: { id: 'payment-test', captured_amount: 50, refunded_amount: 0 }, payouts: [],
    }),
  })
  assert.equal(result.result.customer_refund, 18.14)
  assert.equal(effects.refunds[0].amount, 18.14)
})


test('missing native paid totals still fail closed despite positive unit price and capture', async () => {
  const effects = {}
  await assert.rejects(run('return', {
    effects,
    order: orderFixture({ items: [{ id: 'line-a', quantity: 3, unit_price: 20, subtotal: 45 }], payouts: [] }),
  }), /plan_failed/)
  assert.equal(effects.refunds.length, 0)
  assert.equal(effects.reversals.length, 0)
  assert.equal(effects.ledgerWrites.length, 0)
})
