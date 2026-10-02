import assert from 'node:assert/strict'
import test from 'node:test'
import { run, orderFixture } from './commerce-settlement-wiring.test.mjs'

for (const kind of ['return', 'cancel']) {
  test(`${kind}: original commission comes from line records, not capture minus reduced transfer`, async () => {
    const { effects } = await run(kind)
    assert.equal(effects.allocations[0].commissionAmount, 10)
    assert.equal(effects.refunds[0].amount, kind === 'return' ? 25 : 50)
    assert.equal(effects.reversals[0].amount, kind === 'return' ? 22.5 : 45)
    const query = effects.queries.find((query) => query.entity === 'commission_line')
    assert.ok(query, 'Must query original commission records')
    assert.deepEqual(query.filters.item_line_id, ['line-a'])
    assert.ok(query.fields.includes('*') || (query.fields.includes('item_line_id') && query.fields.includes('value')))
  })

  for (const [currency, captured, commission, transferred, requested, expectedReversal] of [
    ['eur', 0.03, 0.01, 0.02, 0.01, 0.01],
    ['jpy', 3, 1, 2, 1, 1],
    ['kwd', 0.003, 0.001, 0.002, 0.001, 0.001],
  ]) {
    test(`${kind}: forwards ${currency} into the real allocator at a minor-unit boundary`, async () => {
      const { effects } = await run(kind, {
        order: orderFixture({ currency_code: currency,
          items: [{ id: 'line-a', quantity: 3, total: captured }],
          split_order_payment: { id: 'payment-test', captured_amount: captured, refunded_amount: 0 },
          payouts: [{ id: 'payout-test', amount: transferred, reversals: [] }],
        }),
        lines: [{ item_line_id: 'line-a', value: commission }],
      })
      assert.equal(effects.refunds[0]?.amount, kind === 'return' ? requested : captured)
      assert.equal(effects.reversals[0]?.amount, kind === 'return' ? expectedReversal : transferred)
      assert.equal(effects.allocations[0].currencyCode, currency)
    })
  }

  for (const [name, lines] of [
    ['missing', []],
    ['partial', [{ item_line_id: 'line-a', value: 10 }]],
    ['unrelated', [{ item_line_id: 'line-other', value: 10 }]],
  ]) {
    test(`${kind}: ${name} commission coverage blocks an existing payout before money effects`, async () => {
      const effects = {}
      await assert.rejects(run(kind, { effects, lines, order: orderFixture({ items: [
        { id: 'line-a', quantity: 4, total: 100 }, { id: 'line-b', quantity: 1, total: 10 },
      ] }) }), /plan_failed/)
      assert.deepEqual(effects.refunds, [])
      assert.deepEqual(effects.reversals, [])
      assert.deepEqual(effects.allocations, [])
    })
  }

  test(`${kind}: explicit zero commission is ready and is not inferred from a reduced payout`, async () => {
    const { effects } = await run(kind, {
      order: orderFixture({ payouts: [{ id: 'payout-test', amount: 50, reversals: [] }] }),
      lines: [{ item_line_id: 'line-a', value: 0 }],
    })
    assert.equal(effects.allocations[0].commissionAmount, 0)
    assert.equal(effects.reversals[0].amount, kind === 'return' ? 25 : 50)
  })

  test(`${kind}: sums all original commission lines, including a ready zero-fee item`, async () => {
    const { effects } = await run(kind, {
      order: orderFixture({ items: [
        { id: 'line-a', quantity: 3, total: 75 }, { id: 'line-b', quantity: 1, total: 25 },
      ] }),
      lines: [{ item_line_id: 'line-a', value: '6' }, { item_line_id: 'line-a', value: '4' },
        { item_line_id: 'line-b', value: 0 }],
    })
    assert.equal(effects.allocations[0].commissionAmount, 10)
    assert.deepEqual(effects.queries.find((query) => query.entity === 'commission_line').filters.item_line_id,
      ['line-a', 'line-b'])
  })

  test(`${kind}: a pre-transfer refund remains allowed before commission lines are ready`, async () => {
    const { effects } = await run(kind, { order: orderFixture({ payouts: [] }), lines: [] })
    assert.equal(effects.refunds[0].amount, kind === 'return' ? 25 : 50)
    assert.equal(effects.allocations[0].transferredAmount, 0)
    assert.ok(effects.reversals.every((reversal) => reversal.amount === 0))
  })

  test(`${kind}: reversal operation key is stable across retries and independent of refund amount`, async () => {
    const first = await run(kind)
    const retry = await run(kind)
    const changed = await run(kind, kind === 'return'
      ? { input: { requested_refund_amount: 10 } }
      : { order: orderFixture({ split_order_payment: {
        id: 'payment-test', captured_amount: 100, refunded_amount: 60,
      } }), input: { operation_id: 'ignored-request-id' } })
    assert.notEqual(first.effects.refunds[0].amount, changed.effects.refunds[0].amount)
    const expected = kind === 'return' ? 'return:request-test' : 'cancel:order-test'
    for (const { effects } of [first, retry, changed]) {
      assert.equal(effects.reversals[0].operation_id, expected)
      assert.equal(effects.reversals[0].payout_id, 'payout-test')
      assert.equal(effects.reversals[0].currency_code, 'eur')
    }
  })
}

for (const operation_id of [undefined, null, '', '  ', 123]) {
  for (const hasPayout of [true, false]) {
    test(`return: rejects identity ${JSON.stringify(operation_id)} with payout=${hasPayout} before refund/reversal`, async () => {
      const effects = {}
      await assert.rejects(run('return', { effects, input: { operation_id },
        order: orderFixture(hasPayout ? {} : { payouts: [] }),
      }), /operation|identity/i)
      assert.deepEqual(effects.refunds, [])
      assert.deepEqual(effects.reversals, [])
      assert.deepEqual(effects.allocations, [])
    })
  }
}

test('return: two distinct existing request identities produce distinct reversal keys for equal amounts', async () => {
  const first = await run('return', { input: { operation_id: 'request-one' } })
  const second = await run('return', { input: { operation_id: 'request-two' } })
  assert.equal(first.effects.reversals[0].amount, second.effects.reversals[0].amount)
  assert.equal(first.effects.reversals[0].operation_id, 'return:request-one')
  assert.equal(second.effects.reversals[0].operation_id, 'return:request-two')
})

test('return: reduced settlement followed by a prior reversal uses only incremental entitlement', async () => {
  const { effects } = await run('return', { order: orderFixture({
    split_order_payment: { id: 'payment-test', captured_amount: 100, refunded_amount: 60 },
    payouts: [{ id: 'payout-test', amount: 45, reversals: [{ amount: 9 }] }],
  }), input: { requested_refund_amount: 10 } })
  assert.equal(effects.refunds[0].amount, 10)
  assert.equal(effects.reversals[0].amount, 9)
})
