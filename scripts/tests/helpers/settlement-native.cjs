'use strict'
// Offline native Medusa 2.11.3 wiring audit. All product source mounts are read-only.
// Modes run in separate capped containers to bound memory; no real DB/provider calls.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const Module = require('node:module')
const ROOT = '/app/apps/backend/audit-src'
const REQUESTS = '/app/apps/backend/audit-requests'
const FRAMEWORK = '/app/apps/backend/audit-framework'
const mode = process.argv[2] || 'graphs'
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const output = { mode, node: process.version, sources: {}, resolutions: {}, checks: [], evidence: {}, limitations: [
  'Disposable read-only/network-none runtime; no live database/provider operations or installations.',
  'Candidate local imports use SWC; Medusa and third-party runtime imports are installed image packages.',
] }
const emit = (name, status, evidence) => { output.checks.push({ name, status, evidence }); console.log(JSON.stringify({ check: name, status, evidence })) }
function source(relative) { const file = path.join(ROOT, relative); output.sources[relative] = sha(file); return file }
function installHook() {
  const swc = require('@swc/core')
  require.extensions['.ts'] = (mod, file) => {
    if (file.startsWith(ROOT + '/')) output.sources[path.relative(ROOT, file)] = sha(file)
    if (file.startsWith(REQUESTS + '/')) output.sources['requests/' + path.relative(REQUESTS, file)] = sha(file)
    const text = fs.readFileSync(file, 'utf8')
    const compiled = swc.transformSync(text, { filename: file, jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' }, sourceMaps: false })
    mod._compile(compiled.code, file)
  }
  const resolve = Module._resolveFilename
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request === '@mercurjs/b2c-core/workflows' && parent?.filename.startsWith(REQUESTS)) {
      output.resolutions[request] = 'candidate narrow workflow export: refund-seller-order-for-return.ts'
      return path.join(ROOT, 'workflows/order/workflows/refund-seller-order-for-return.ts')
    }
    const resolved = resolve.call(this, request, parent, ...rest)
    if (request.startsWith('@medusajs/') || request.startsWith('@mercurjs/')) output.resolutions[request] = resolved
    return resolved
  }
}
async function graphs() {
  installHook()
  const names = [
    ['workflows/order/workflows/refund-seller-order-for-return.ts', 'refundSellerOrderForReturnWorkflow'],
    ['workflows/order/workflows/cancel-order.ts', 'cancelOrderWorkflow'],
    ['workflows/order/workflows/process-payout-for-order.ts', 'processPayoutForOrderWorkflow'],
    ['workflows/split-order-payment/workflows/partial-payment-refund.ts', 'partialPaymentRefundWorkflow'],
    ['workflows/split-order-payment/workflows/refund-split-order-payment.ts', 'refundSplitOrderPaymentWorkflow'],
  ]
  const { WorkflowManager } = require('@medusajs/orchestration')
  const { ReturnStatus, OrderChangeStatus, ChangeActionType } = require('@medusajs/framework/utils')
  assert.equal(ReturnStatus.OPEN, 'open'); assert.equal(ReturnStatus.REQUESTED, 'requested')
  assert.equal(ReturnStatus.PARTIALLY_RECEIVED, 'partially_received'); assert.equal(ReturnStatus.RECEIVED, 'received')
  assert.equal(OrderChangeStatus.PENDING, 'pending'); assert.equal(OrderChangeStatus.CONFIRMED, 'confirmed')
  assert.equal(ChangeActionType.RETURN_ITEM, 'RETURN_ITEM')
  emit('native adapter enum values', 'PASS', { ReturnStatus, OrderChangeStatus, returnItem: ChangeActionType.RETURN_ITEM })
  for (const [file, exp] of names) {
    const flow = require(source(file))[exp]
    const registered = WorkflowManager.getWorkflow(flow.getName())
    output.evidence[flow.getName()] = registered
    emit(`native graph ${exp}`, 'PASS', { name: flow.getName(), registryKeys: Object.keys(registered || {}) })
  }
  // Reflect actual candidate links/generated service methods; keep native imports intact.
  const payoutSource = fs.readFileSync(source('workflows/order/steps/settle-order-payout.ts'), 'utf8')
  const payoutService = require(source('modules/payout/service.ts')).default
  for (const method of ['retrievePayoutAccount', 'createPayout', 'retrievePayout']) {
    assert.ok(payoutSource.includes(`service.${method}(`), `Candidate must use ${method}`)
    assert.equal(typeof payoutService.prototype[method], 'function', `Native service supplies ${method}`)
  }
  for (const file of ['links/order-payout.ts', 'links/seller-payout-account.ts']) {
    const link = require(source(file)).default
    // defineLink leaves entryPoint empty until application link bootstrap. This
    // source/reflection check is not bootstrapped query-graph schema acceptance.
    assert.equal(typeof link.entryPoint, 'string')
    const linkSource = fs.readFileSync(source(file), 'utf8')
    assert.match(linkSource, /defineLink\(/)
    assert.match(linkSource, file === 'links/order-payout.ts' ? /PayoutModule\.linkable\.payout/ : /PayoutModule\.linkable\.payoutAccount/)
    output.evidence[file] = { entryPoint: link.entryPoint, bootstrapped: false }
  }
  assert.match(payoutSource, /entity: orderPayoutLink\.entryPoint/)
  assert.match(payoutSource, /ContainerRegistrationKeys\.LINK\)\.create/)
  emit('native payout link and service reflection', 'PASS', { methods: ['retrievePayoutAccount', 'createPayout', 'retrievePayout'] })
  const expected = {
    'refund-seller-order-for-return': ['settle-order-refund'],
    'process-payout-for-order': ['settle-order-payout'],
    'cancel-single-order': ['get-cart', 'cancel-validate-order', 'settle-order-refund', 'cancel-orders', 'delete-reservations-by-line-items', 'emit-event-step'],
    'partial-payment-refund': ['select-and-validate-payment-refund-step', 'refund-payments-step', 'add-order-transaction'],
    'refund-split-order-payment': ['validate-refund-split-order-payments', 'update-split-order-payments', 'partial-payment-refund-as-step'],
  }
  for (const [name, actions] of Object.entries(expected)) {
    const flow = WorkflowManager.getWorkflow(name).flow_
    assert.deepEqual(linear(flow).map(node => node.action), actions)
    if (name === 'refund-seller-order-for-return' || name === 'process-payout-for-order') assert.equal(flow.noCompensation, true)
    emit(`native dependency chain ${name}`, 'PASS', actions)
  }
  assert.ok(fs.existsSync(REQUESTS), 'Candidate requests source mount is required')
  {
    const prepare = require(path.join(REQUESTS, 'workflows/order-return-request/steps/prepare-native-return.ts')).prepareNativeReturnStep
    assert.equal(typeof prepare, 'function')
    emit('native prepareNativeReturnStep imported', 'PASS', { type: typeof prepare })
    for (const [filename, exported] of [
      ['proceed-return-request.ts', 'proceedReturnRequestWorkflow'],
      ['update-return-request.ts', 'updateOrderReturnRequestWorkflow'],
    ]) {
      const file = path.join(REQUESTS, 'workflows/order-return-request/workflows', filename)
      output.sources[`requests/${filename}`] = sha(file)
      const flow = require(file)[exported]
      output.evidence[flow.getName()] = WorkflowManager.getWorkflow(flow.getName())
      emit(`native graph ${exported}`, 'PASS', { name: flow.getName() })
    }
    const chain = linear(WorkflowManager.getWorkflow('proceed-return-request').flow_).map(node => node.action)
    assert.deepEqual(chain, ['retrieve-order-from-return-request', 'prepare-native-return', 'refund-seller-order-for-return-as-step'])
    const preparation = WorkflowManager.getWorkflow('proceed-return-request').flow_.next
    assert.equal(preparation.noCompensation, true)
    emit('native durable preparation-before-refund dependency and noncompensation', 'PASS', { chain, noCompensation: preparation.noCompensation })
    const parent = WorkflowManager.getWorkflow('update-order-return-request').flow_
    assert.equal(parent.action, 'proceed-return-request-as-step')
    assert.equal(parent.next.action, 'update-order-return-request')
    emit('native parent refund-before-status dependency', 'PASS', { first: parent.action, second: parent.next.action })
  }
}
function linear(flow) {
  const result = []
  for (let node = flow; node; node = node.next) {
    assert.ok(!Array.isArray(node), 'Expected serial native graph')
    result.push({ action: node.action, noCompensation: node.noCompensation })
  }
  return result
}
async function contracts() {
  installHook()
  const { createWorkflow, createStep, when, transform, WorkflowResponse, StepResponse } = require('@medusajs/framework/workflows-sdk')
  const { createMedusaContainer } = require('@medusajs/framework/utils')
  const container = createMedusaContainer()
  const called = []
  const conditionalStep = createStep('audit-conditional', async (v) => { called.push('conditional'); return new StepResponse(v) })
  const after = createStep('audit-after', async ({ token }) => { called.push('after'); return new StepResponse(token ?? 'skipped') })
  let returned
  const conditional = createWorkflow('audit-when-contract', (input) => {
    returned = when({ input }, ({ input }) => input.run).then(() => conditionalStep(input.value))
    return new WorkflowResponse(after(transform({ token: returned }, ({ token }) => ({ token }))))
  })
  assert.ok(returned && returned.__step__ === 'audit-conditional')
  const yes = await conditional(container).run({ input: { run: true, value: 'settled' } })
  assert.equal(yes.result, 'settled'); assert.deepEqual(called, ['conditional', 'after'])
  assert.ok(Array.isArray(yes.errors) && yes.errors.length === 0)
  assert.ok(!yes.thrownError)
  assert.equal(yes.transaction.getState(), 'done')
  emit('native successful .run contract accepted by return adapter', 'PASS', { state: yes.transaction.getState(), errors: yes.errors, result: yes.result })
  called.length = 0
  const no = await conditional(container).run({ input: { run: false, value: 'settled' } })
  assert.equal(no.result, 'skipped'); assert.deepEqual(called, ['after'])
  emit('when.then returns dependency; skipped condition still permits descendant', 'PASS', { yes: yes.result, no: no.result, returnedStep: returned.__step__ })
  const boom = createStep('audit-failure', async () => { throw new Error('native-error-canary') })
  const child = createWorkflow('audit-child-failure', () => new WorkflowResponse(boom()))
  const parentStep = createStep('audit-parent-step', async (_, { container }) => {
    const response = await child(container).run({ input: {}, throwOnError: true })
    throw new Error(`Should never return: ${response.result}`)
  })
  const parent = createWorkflow('audit-parent-failure', () => new WorkflowResponse(parentStep()))
  let thrown
  await assert.rejects(parent(container).run({ input: {}, throwOnError: true }), (error) => {
    thrown = error
    return error?.message === 'native-error-canary'
  })
  const caught = await child(container).run({ input: {}, throwOnError: false })
  assert.ok(caught.errors.length); assert.equal(caught.errors[0].error.message, 'native-error-canary')
  assert.equal(caught.thrownError.message, 'native-error-canary')
  emit('native nested .run failure shape', 'PASS', { thrownKeys: Object.keys(thrown), thrownIsError: thrown instanceof Error, keys: Object.keys(caught), errors: caught.errors.map(e => ({ action: e.action, handlerType: e.handlerType, message: e.error.message })), thrownError: caught.thrownError.message })
  const candidate = require(source('workflows/split-order-payment/workflows/partial-payment-refund.ts')).partialPaymentRefundWorkflow
  await assert.rejects(candidate(container).run({ input: { id: 'audit-split', amount: -1 }, throwOnError: true }), (error) => error?.message === 'Invalid refund amount')
  emit('candidate partial refund native run rejects before any service access', 'PASS', 'Invalid refund amount propagated as a serialized native failure, not a successful result')
  const returnFlow = require(source('workflows/order/workflows/refund-seller-order-for-return.ts')).refundSellerOrderForReturnWorkflow
  await assert.rejects(returnFlow(container).run({ input: { order_id: 'audit-order', return_lines: [{ line_item_id: 'audit-item', quantity: 1 }] }, throwOnError: true }), (error) => error?.message === 'Return refund requires a stable operation identity')
  emit('candidate return settlement native run validates before DB access', 'PASS', 'Missing stable operation identity rejected by actual candidate settlement step')
}
async function serialization() {
  installHook()
  const utils = require('@medusajs/framework/utils')
  const { MikroORM } = require('@medusajs/framework/mikro-orm/postgresql')
  const models = require(source('modules/payout/models/index.ts'))
  const entities = utils.toMikroOrmEntities(Object.values(models))
  const orm = await MikroORM.init({ entities, dbName: 'audit_never_connect', connect: false, discovery: { disableDynamicFileAccess: true }, metadataCache: { enabled: false } })
  try {
    const em = orm.em.fork()
    const model = entities.find(e => e.name === 'PayoutReversal')
    assert.ok(model)
    const entity = em.create(model, { id: 'audit-reversal', payout: 'audit-payout', amount: 2.5, currency_code: 'eur', data: { id: 'audit-reversal' } }, { persist: false })
    const serialized = await utils.mikroOrmSerializer(entity)
    assert.equal(serialized.payout_id, 'audit-payout')
    assert.equal(serialized.id, 'audit-reversal')
    emit('real DML + ORM reversal serialization includes payout_id', 'PASS', serialized)
    output.evidence.orm = { connected: orm.isConnected(), model: model.name, properties: Object.keys(orm.getMetadata().get(model.name).properties) }
  } finally { await orm.close() }
}
async function inspect() {
  const base = '/app/node_modules/@medusajs'
  const files = [
    `${base}/workflows-sdk/dist/utils/composer/when.js`,
    `${base}/workflows-sdk/dist/utils/composer/when.d.ts`,
    `${base}/workflows-sdk/dist/helper.js`,
    `${base}/utils/dist/modules-sdk/medusa-service.js`,
  ]
  for (const file of files) if (fs.existsSync(file)) output.evidence[file] = { sha256: sha(file), text: fs.readFileSync(file, 'utf8') }
}
async function main() {
  if (mode === 'graphs') await graphs()
  else if (mode === 'contracts') await contracts()
  else if (mode === 'serialization') await serialization()
  else if (mode === 'inspect') await inspect()
  else throw new Error(`Unknown audit mode ${mode}`)
}
console.log(JSON.stringify({ start: mode, pid: process.pid }))
const deadline = setTimeout(() => { emit('bounded execution deadline', 'FAIL', 'Audit exceeded 30 seconds'); process.exit(2) }, 30000)
main().catch((error) => { emit('audit execution', 'FAIL', { message: error.message, stack: error.stack }); process.exitCode = 1 }).finally(() => {
  clearTimeout(deadline)
  output.memory = process.memoryUsage()
  console.log('NATIVE_AUDIT_JSON=' + JSON.stringify(output, (_key, value) => value instanceof Map ? { map: [...value.keys()] } : typeof value === 'function' ? `[Function ${value.name}]` : value))
})
