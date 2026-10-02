import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { adapterHarness } from './commerce-native-return-adapter.test.mjs'

// Offline source-bound graph tests, not Medusa scheduler/compensation acceptance.
// Run: node --experimental-vm-modules --test scripts/tests/commerce-return-status.test.mjs
// Native workflows, storage and hook dispatch are stand-ins. Both actual workflow
// bodies and the actual status step execute; dependencies are lazy, never eager.
const root = new URL('../../packages/modules/requests/src/workflows/order-return-request/', import.meta.url)
const types = {
  AdminUpdateOrderReturnRequestDTO: undefined,
  VendorUpdateOrderReturnRequestDTO: undefined,
  OrderReturnRequestDTO: undefined,
  SELLER_MODULE: 'seller',
}
class WorkflowResponse { constructor(value, options) { Object.assign(this, { value, options }) } }
class StepResponse { constructor(value) { this.value = value } }

function graphHarness(effects, container = {}) {
  const nodes = []
  let conditions = []
  class Node {
    constructor(name, input, run) {
      Object.assign(this, { name, input, run, conditions: [...conditions] })
      nodes.push(this)
    }
  }
  const dependencies = (value) => {
    if (value instanceof Node) return [value]
    if (Array.isArray(value)) return value.flatMap(dependencies)
    if (value && Object.prototype.toString.call(value) === '[object Object]') return Object.values(value).flatMap(dependencies)
    return []
  }
  const dependsOn = (value, ancestor) => dependencies(value).some((dep) => dep === ancestor ||
    dependsOn(dep.input, ancestor) || dep.conditions.some((condition) => dependsOn(condition.input, ancestor)))
  const resolved = new Map()
  async function resolve(value) {
    if (value instanceof Node) {
      if (!resolved.has(value)) resolved.set(value, (async () => {
        for (const condition of value.conditions) {
          if (!condition.predicate(await resolve(condition.input))) return undefined
        }
        const input = await resolve(value.input)
        if (value.name !== 'transform') effects.calls.push(value.name)
        const result = await value.run(input)
        return result instanceof StepResponse ? result.value : result
      })())
      return resolved.get(value)
    }
    if (Array.isArray(value)) return Promise.all(value.map(resolve))
    if (value && Object.prototype.toString.call(value) === '[object Object]') {
      return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await resolve(entry)])))
    }
    return value
  }
  const make = (name, run) => (input) => new Node(name, input, run)
  const sdk = {
    WorkflowData: undefined, WorkflowResponse, StepResponse,
    createWorkflow: (_name, body) => body,
    createStep: (name, body) => make(name, (input) => body(input, { container })),
    transform: (input, body) => new Node('transform', input, body),
    when: (...args) => {
      const [input, predicate] = args.slice(-2)
      return { then: (body) => {
        const previous = conditions
        conditions = [...conditions, { input, predicate }]
        try { return body() } finally { conditions = previous }
      } }
    },
    createHook: (name, input) => make(`hook:${name}`, (data) => { effects.hooks.push({ name, data }) })(input),
  }
  return {
    sdk, nodes, make, dependsOn, resolve,
    node: (name) => { const node = nodes.find((node) => node.name === name); assert.ok(node, `Missing graph node: ${name}`); return node },
    async execute(response) {
      // Reverse declaration order deliberately exposes effects without ancestors.
      for (const node of [...nodes].reverse()) await resolve(node)
      return resolve(response.value)
    },
  }
}

async function load(relativePath, bindings) {
  const context = vm.createContext({})
  const filename = new URL(relativePath, root)
  const source = stripTypeScriptTypes(readFileSync(filename, 'utf8'), { mode: 'strip' })
  const module = new vm.SourceTextModule(source, { context, identifier: filename.href })
  await module.link((specifier) => {
    assert.ok(Object.hasOwn(bindings, specifier), `Unstubbed import: ${specifier}`)
    const exports = bindings[specifier]
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}
const inputFixture = () => ({
  id: 'request-a', status: 'refunded', location_id: 'location-a',
  vendor_reviewer_note: 'Retour gecontroleerd',
})
const orderFixture = () => ({
  order_id: 'order-a',
  order_return_request: {
    id: 'request-a',
    line_items: [
      { line_item_id: 'line-a', quantity: 1, reason_id: 'reason-a' },
      { line_item_id: 'line-b', quantity: 2, reason_id: null },
    ],
  },
})
const effectsFixture = () => ({ calls: [], payloads: {}, updates: [], hooks: [], links: [] })
const beginResult = { id: 'change-a', return_id: 'return-a', order_id: 'order-a' }

async function proceed({ input = inputFixture(), effects = effectsFixture(), fail, order = orderFixture(), preparedOverride } = {}) {
  const harness = graphHarness(effects)
  const make = (name, result) => harness.make(name, (payload) => {
    // VM-produced objects have another realm's prototypes; record a detached
    // payload for strict structural assertions without changing execution data.
    effects.payloads[name] = structuredClone(payload)
    if (fail === name) throw new Error(`${name} failed`)
    return result
  })
  const native = await adapterHarness({ effects, fail, sdk: harness.sdk })
  const module = await load('workflows/proceed-return-request.ts', {
    '@medusajs/framework/workflows-sdk': harness.sdk,
    '@mercurjs/framework': types,
    '../steps/prepare-native-return': { prepareNativeReturnStep: preparedOverride ? make('prepare-native-return', preparedOverride) : native.step },
    '@mercurjs/b2c-core/workflows': { refundSellerOrderForReturnWorkflow: {
      runAsStep: make('refund', { order_id: 'order-a', customer_refund: 20, seller_reversal: 15, stripe_refund_applied: true }),
    } },
    '../steps': { retrieveOrderFromReturnRequestStep: make('retrieve-order', order) },
  })
  const response = module.proceedReturnRequestWorkflow(input)
  return { harness, response, effects, native, run: () => harness.execute(response) }
}

async function parent({ input = inputFixture(), effects = effectsFixture(), fail } = {}) {
  let persisted = { id: input.id, status: 'pending' }
  const harness = graphHarness(effects, { resolve: (name) => {
    assert.equal(name, 'order_return_request')
    return {
      retrieveOrderReturnRequest: async (id) => { assert.equal(id, input.id); return persisted },
      updateOrderReturnRequests: async (data) => {
        if (fail === 'update-status') throw new Error('update-status failed')
        effects.updates.push(data)
        persisted = { ...persisted, ...data }
        return persisted
      },
    }
  } })
  const step = await load('steps/update-return-request.ts', {
    '@medusajs/framework/workflows-sdk': harness.sdk,
    '@mercurjs/framework': types,
    '../../../modules/order-return-request': { ORDER_RETURN_MODULE: 'order_return_request', OrderReturnModuleService: undefined },
  })
  const module = await load('workflows/update-return-request.ts', {
    '@medusajs/framework/workflows-sdk': harness.sdk,
    '@medusajs/framework/utils': { Modules: { ORDER: 'order' } },
    '@mercurjs/framework': types,
    '../steps': step,
    './proceed-return-request': { proceedReturnRequestWorkflow: {
      // A nested workflow completes all its steps before exposing its result.
      // Its actual body executes with an independent graph, not an assumed success.
      runAsStep: harness.make('proceed-return', async ({ input }) => {
        if (fail === 'proceed-return') throw new Error('proceed-return failed')
        return (await proceed({ input, effects, fail })).run()
      }),
    } },
    '@medusajs/medusa/core-flows': {
      useQueryGraphStep: harness.make('query-returns', () => ({ data: [{
        order: { returns: input.status === 'refunded' ? [{ id: 'return-a' }] : [] },
        order_return_request: { seller: { id: 'seller-a' } },
      }] })),
      createRemoteLinkStep: harness.make('link-returns', (links) => { effects.links.push(links); return links }),
    },
    '../../../links/return-request-order': { default: { entryPoint: 'order_return_request_order' } },
  })
  const response = module.updateOrderReturnRequestWorkflow(input)
  return { harness, response, effects, persisted: () => persisted, run: () => harness.execute(response) }
}

for (const [before, after] of [
  ['begin-return', 'request-items'], ['request-items', 'confirm-return'], ['confirm-return', 'refund'],
]) {
  test(`actual proceed graph requires ${before} before ${after}`, async () => {
    const { run, effects } = await proceed()
    await run()
    assert.ok(effects.calls.indexOf(before) < effects.calls.indexOf(after), `Missing ${before} -> ${after} dependency`)
  })
}
test('native preparation is one durable boundary before refund', async () => {
  const { harness } = await proceed()
  assert.ok(harness.dependsOn(harness.node('refund'), harness.node('prepare-native-return')))
})
test('proceed response depends on the successful refund, not merely begin-return', async () => {
  const { harness, response } = await proceed()
  assert.ok(harness.dependsOn(response.value, harness.node('refund')), 'Missing refund -> response dependency')
})
test('reverse scheduling still executes the native return chain before refund and preserves payloads', async () => {
  const { effects, run } = await proceed()
  assert.deepEqual(structuredClone(await run()), beginResult)
  assert.deepEqual(effects.calls, ['retrieve-order', 'prepare-native-return', 'begin-return', 'request-items', 'confirm-return', 'refund'])
  const begin = effects.payloads['begin-return']
  assert.equal(begin.input.order_id, 'order-a')
  assert.equal(begin.input.location_id, 'location-a')
  assert.equal(begin.input.metadata.hobbysalon_return_request_id, 'request-a')
  assert.match(begin.input.metadata.hobbysalon_return_fingerprint, /^[a-f0-9]{64}$/)
  assert.deepEqual(effects.payloads['request-items'], { input: { return_id: 'return-a', items: [
    { id: 'line-a', quantity: 1, reason_id: 'reason-a' }, { id: 'line-b', quantity: 2, reason_id: undefined },
  ] }, throwOnError: true })
  assert.deepEqual(effects.payloads['confirm-return'], { input: { return_id: 'return-a' }, throwOnError: true })
  assert.deepEqual(effects.payloads.refund, { input: {
    order_id: 'order-a', operation_id: 'request-a', return_lines: [
      { line_item_id: 'line-a', quantity: 1 }, { line_item_id: 'line-b', quantity: 2 },
    ],
  } })
})
for (const fail of ['request-items', 'confirm-return', 'refund']) {
  test(`resolving proceed response cannot bypass ${fail} failure`, async () => {
    const { harness, response } = await proceed({ fail })
    await assert.rejects(harness.resolve(response.value), new RegExp(['begin-return', 'request-items', 'confirm-return'].includes(fail) ? 'native_failure' : `${fail} failed`))
  })
}
test('parent status step and updated hook have a real proceed ancestor', async () => {
  const { harness } = await parent()
  for (const name of ['update-order-return-request', 'hook:orderReturnRequestUpdated', 'link-returns']) {
    assert.ok(harness.dependsOn(harness.node(name), harness.node('proceed-return')), `Missing proceed -> ${name} dependency`)
  }
})
test('successful parent persists refunded status then exposes the updated hook', async () => {
  const input = inputFixture()
  const { effects, run, persisted } = await parent({ input })
  assert.deepEqual(await run(), input)
  assert.deepEqual(persisted(), input)
  assert.deepEqual(effects.updates, [input])
  assert.deepEqual(effects.hooks, [{ name: 'orderReturnRequestUpdated', data: { requestId: input.id } }])
  assert.ok(effects.calls.indexOf('refund') < effects.calls.indexOf('update-order-return-request'))
  assert.ok(effects.calls.indexOf('update-order-return-request') < effects.calls.indexOf('hook:orderReturnRequestUpdated'))
})
for (const fail of ['proceed-return', 'retrieve-order', 'begin-return', 'request-items', 'confirm-return', 'refund', 'update-status']) {
  test(`${fail} failure cannot persist refunded status or publish the updated hook`, async () => {
    const { run, effects, persisted } = await parent({ fail })
    await assert.rejects(run(), new RegExp(['begin-return', 'request-items', 'confirm-return'].includes(fail) ? 'native_failure' : `${fail} failed`))
    assert.equal(effects.updates.length, 0)
    assert.equal(persisted().status, 'pending')
    assert.equal(effects.hooks.length, 0)
    assert.equal(effects.links.length, 0)
    if (['retrieve-order', 'begin-return', 'request-items', 'confirm-return'].includes(fail)) {
      assert.equal(effects.payloads.refund, undefined, 'Refund must not start after a native prerequisite failure')
    }
    if (fail === 'request-items') assert.equal(effects.payloads['confirm-return'], undefined)
  })
}
test('outer refund failure leaves confirmed native evidence with no compensation registered', async () => {
  const h = await proceed({ fail: 'refund' })
  await assert.rejects(h.run(), /refund failed/)
  assert.equal(h.native.record().phase, 'confirmed')
  assert.equal(h.native.config.noCompensation, true)
  assert.equal(h.native.compensator, undefined)
  const before = h.effects.calls.length
  await h.native.invoke(h.native.record().plan)
  assert.equal(h.effects.calls.length, before)
})
test('refund and response use preparation frozen plan identities and quantities, not retrieval', async () => {
  const preparedOverride = { identity: { return_id: 'saved-return', order_change_id: 'saved-change' },
    plan: { request_id: 'saved-request', order_id: 'saved-order', location_id: null,
      items: [{ id: 'saved-line', quantity: 3, reason_id: null }] } }
  const h = await proceed({ preparedOverride })
  assert.deepEqual(structuredClone(await h.run()), { id: 'saved-change', return_id: 'saved-return', order_id: 'saved-order' })
  assert.deepEqual(h.effects.payloads.refund.input, { order_id: 'saved-order', operation_id: 'saved-request',
    return_lines: [{ line_item_id: 'saved-line', quantity: 3 }] })
})
for (const status of ['pending', 'withdrawn', 'escalated', 'canceled']) {
  test(`${status} branch still updates without running any return/refund work`, async () => {
    const input = { ...inputFixture(), status }
    const { run, effects, persisted } = await parent({ input, fail: 'proceed-return' })
    assert.deepEqual(await run(), input)
    assert.deepEqual(persisted(), input)
    assert.deepEqual(effects.updates, [input])
    assert.equal(effects.hooks.length, 1)
    assert.ok(!effects.calls.includes('proceed-return'))
    assert.equal(effects.payloads.refund, undefined)
  })
}
