import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import test from 'node:test'
const root = new URL('../../packages/modules/requests/src/', import.meta.url)
export async function source(relative, bindings) {
  const context = vm.createContext({})
  const mod = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL(relative, root), 'utf8'), { mode: 'strip' }), { context })
  await mod.link(name => {
    assert.ok(Object.hasOwn(bindings, name), `Unstubbed import ${name}`)
    const values = bindings[name]
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value)
    }, { context })
  })
  await mod.evaluate()
  return mod.namespace
}
export const planFixture = () => ({ request_id: 'request-a', order_id: 'order-a', location_id: 'location-a', items: [
  { id: 'line-a', quantity: 1, reason_id: 'reason-a' }, { id: 'line-b', quantity: 2, reason_id: null },
] })
export async function adapterHarness({ effects = { calls: [], payloads: {} }, fail, badRun, mutate, sdk } = {}) {
  const core = await source('utils/native-return-lifecycle.ts', { 'node:crypto': { createHash } })
  let record, ret, change, config, compensator, invoke
  const store = { async withOrderLock(_id, work) { return work({
    async getRequest() { return record && structuredClone(record) }, async findUnfinished() { return null },
    async create(r) { record = structuredClone(r) },
    async transition(_id, from, to, identity) { assert.equal(record.phase, from); record.phase = to; if (identity) record.identity = structuredClone(identity) },
  }) } }
  const preview = () => ({ id: 'order-a', order_change: structuredClone(change) })
  const native = (name, run) => () => ({ async run(payload) {
    effects.calls.push(name); effects.payloads[name] = structuredClone(payload)
    assert.equal(payload.throwOnError, true)
    const phase = { 'begin-return': 'begin_started', 'request-items': 'items_started', 'confirm-return': 'confirm_started' }[name]
    assert.equal(record.phase, phase, 'started must persist before native mutation')
    if (fail === name) throw new Error(`${name} failed`)
    const result = run(payload.input)
    return badRun?.name === name ? badRun.value(result) : { result, errors: [], transaction: { getState: () => 'done' } }
  } })
  const flows = {
    beginReturnOrderWorkflow: native('begin-return', input => {
      ret = { id: 'return-a', order_id: input.order_id, location_id: input.location_id, status: 'open', metadata: input.metadata, items: [] }
      change = { id: 'change-a', return_id: ret.id, order_id: ret.order_id, change_type: 'return_request', status: 'pending', actions: [] }
      return structuredClone(change)
    }),
    requestItemReturnWorkflow: native('request-items', input => {
      change.actions = input.items.map((item, index) => ({ id: `action-${index}`, order_id: ret.order_id, return_id: ret.id,
        order_change_id: change.id, action: 'RETURN_ITEM', reference: 'return', reference_id: ret.id,
        details: { reference_id: item.id, quantity: item.quantity, reason_id: item.reason_id } }))
      return preview()
    }),
    confirmReturnRequestWorkflow: native('confirm-return', () => {
      const before = preview()
      ret.items = change.actions.map(a => ({ item_id: a.details.reference_id, return_id: ret.id, quantity: a.details.quantity, reason_id: a.details.reason_id }))
      ret.status = 'requested'; change.status = 'confirmed'
      return before
    }),
  }
  const service = {
    async retrieveReturn(id, config) { assert.equal(id, record.identity.return_id); assert.deepEqual(structuredClone(config), { relations: ['items'] }); const r = structuredClone(ret); mutate?.(r, null, record); return r },
    async retrieveOrderChange(id, config) { assert.equal(id, record.identity.order_change_id); assert.deepEqual(structuredClone(config), { relations: ['actions'] }); const c = structuredClone(change); mutate?.(null, c, record); return c },
  }
  const container = { resolve(key) { if (key === 'pg_connection') return store; assert.equal(key, 'order'); return service } }
  class StepResponse { constructor(value) { this.value = value } }
  const module = await source('workflows/order-return-request/steps/prepare-native-return.ts', {
    '@medusajs/framework/utils': { ContainerRegistrationKeys: { PG_CONNECTION: 'pg_connection' }, Modules: { ORDER: 'order' },
      MathBN: { eq: (a, b) => Number(a) === Number(b) }, ReturnStatus: { OPEN: 'open', REQUESTED: 'requested', RECEIVED: 'received', PARTIALLY_RECEIVED: 'partially_received' },
      OrderChangeStatus: { PENDING: 'pending', CONFIRMED: 'confirmed' }, OrderChangeType: { RETURN_REQUEST: 'return_request' }, ChangeActionType: { RETURN_ITEM: 'RETURN_ITEM' } },
    '@medusajs/framework/workflows-sdk': { StepResponse: sdk?.StepResponse ?? StepResponse,
      createStep(options, body, compensation) { config = options; compensator = compensation;
        invoke = async data => (await body(data, { container })).value
        return sdk ? sdk.createStep(options.name, data => body(data, { container })) : invoke },
    },
    '@medusajs/medusa/core-flows': flows,
    '../../../utils/native-return-lifecycle': core,
    '../../../utils/native-return-store': { createPostgresNativeReturnStore: value => { assert.equal(value, store); return store } },
  })
  return { step: module.prepareNativeReturnStep, invoke, effects, record: () => record, ret: () => ret, change: () => change, config, compensator }
}
if (process.argv[1]?.endsWith('commerce-native-return-adapter.test.mjs')) {
  test('actual adapter completes native chain, verifies persisted state and replays without native effects', async () => {
    const h = await adapterHarness(); const first = await h.step(planFixture())
    assert.deepEqual(structuredClone(first), { plan: planFixture(), identity: { return_id: 'return-a', order_change_id: 'change-a' } })
    assert.equal(h.record().phase, 'confirmed')
    assert.ok(Object.isFrozen(first) && Object.isFrozen(first.plan) && Object.isFrozen(first.plan.items))
    assert.ok(first.plan.items.every(Object.isFrozen))
    assert.ok(Object.isFrozen(first.identity))
    assert.deepEqual(h.effects.calls, ['begin-return', 'request-items', 'confirm-return'])
    assert.equal(h.ret().metadata.hobbysalon_return_request_id, 'request-a')
    assert.match(h.ret().metadata.hobbysalon_return_fingerprint, /^[a-f0-9]{64}$/)
    assert.deepEqual(structuredClone(await h.step(planFixture())), structuredClone(first))
    assert.equal(h.effects.calls.length, 3)
    assert.equal(h.config.noCompensation, true); assert.equal(h.compensator, undefined)
  })
  for (const name of ['begin-return', 'request-items', 'confirm-return']) {
    test(`${name} failure stays uncertain and retry dispatches nothing`, async () => {
      const h = await adapterHarness({ fail: name })
      await assert.rejects(h.step(planFixture()), /native_failure/)
      const before = h.effects.calls.length
      await assert.rejects(h.step(planFixture()), /reconciliation_required/)
      assert.equal(h.effects.calls.length, before)
    })
    for (const [label, value] of Object.entries({ errors: r => ({ result: r, errors: ['bad'], transaction: { getState: () => 'done' } }),
      thrown: r => ({ result: r, errors: [], thrownError: new Error(), transaction: { getState: () => 'done' } }),
      unknown: r => ({ result: r, errors: [], transaction: { getState: () => 'running' } }),
      shape: () => ({ result: { id: 'wrong' }, errors: [], transaction: { getState: () => 'done' } }),
    })) test(`${name} rejects ${label} result`, async () => {
      const h = await adapterHarness({ badRun: { name, value } }); await assert.rejects(h.step(planFixture()), /native_failure/)
    })
  }
  for (const [label, mutate] of Object.entries({
    marker: r => { if (r) r.metadata.hobbysalon_return_request_id = 'other' },
    fingerprint: r => { if (r) r.metadata.hobbysalon_return_fingerprint = 'other' },
    order: r => { if (r) r.order_id = 'other' },
    return: r => { if (r) r.id = 'other' },
    location: r => { if (r) r.location_id = 'other' },
    change: (_, c) => { if (c) c.id = 'other' },
    changeReturn: (_, c) => { if (c) c.return_id = 'other' },
    state: r => { if (r) r.status = 'received' },
    quantity: r => { if (r?.items.length) r.items[0].quantity++ },
    reason: r => { if (r?.items.length) r.items[0].reason_id = 'other' },
    duplicateItem: r => { if (r?.items.length) r.items.push(r.items[0]) },
    extraAction: (_, c) => { if (c?.actions.length) c.actions.push(c.actions[0]) },
    wrongAction: (_, c) => { if (c?.actions.length) c.actions[0].action = 'SHIPPING_ADD' },
    actionQuantity: (_, c) => { if (c?.actions.length) c.actions[0].details.quantity++ },
  })) test(`persisted ${label} mismatch fails closed`, async () => {
    const h = await adapterHarness({ mutate }); await assert.rejects(h.step(planFixture()), /verification_failure/)
  })
  for (const status of ['received', 'partially_received']) test(`confirmed replay after native ${status} preserves exact original proof`, async () => {
    const h = await adapterHarness(); const first = await h.step(planFixture())
    h.ret().status = status
    assert.deepEqual(structuredClone(await h.step(planFixture())), structuredClone(first))
    assert.equal(h.effects.calls.length, 3)
    h.ret().items[0].quantity++
    await assert.rejects(h.step(planFixture()), /verification_failure/)
    assert.equal(h.effects.calls.length, 3)
  })
  test('completed replay validates saved native state again', async () => {
    const h = await adapterHarness(); await h.step(planFixture()); h.change().status = 'canceled'
    await assert.rejects(h.step(planFixture()), /verification_failure/); assert.equal(h.effects.calls.length, 3)
  })
}
