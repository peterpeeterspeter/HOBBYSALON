import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'

// Actual middleware source/config and webhook validation/projections; no network.
// Only graph/HTTP and unexercised financial effects are explicit collaborators.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const { ContainerRegistrationKeys, MathBN, MedusaError, Modules, PaymentActions } = require('@medusajs/framework/utils')
const root = new URL('../../apps/backend/src/api/', import.meta.url)
const b2cRoot = new URL('../../packages/modules/b2c-core/src/', import.meta.url)
const unexpectedFinancialEffect = name => () => { throw new Error(`Unexpected financial dependency invocation: ${name}`) }
const dependencies = new Map([
  ['@medusajs/medusa', { defineMiddlewares: x => x }],
  ['@medusajs/framework/utils', { ContainerRegistrationKeys, MathBN, MedusaError, Modules, PaymentActions }],
  ['@mercurjs/b2c-core/links/seller-order', { default: { entryPoint: 'seller_order_link' } }],
  ['@mercurjs/b2c-core/links/order-split-order-payment', { default: { entryPoint: 'order_split_link' } }],
  ['@mercurjs/b2c-core/utils/commerce-cart-lock', {
    withCommerceCartLock: unexpectedFinancialEffect('withCommerceCartLock'),
  }],
  ['@mercurjs/b2c-core/utils/marketplace-capture', {
    completeMarketplaceCartUnderLock: unexpectedFinancialEffect('completeMarketplaceCartUnderLock'),
    captureMarketplacePaymentUnderLock: unexpectedFinancialEffect('captureMarketplacePaymentUnderLock'),
  }],
  ['node:crypto', await import('node:crypto')],
])
const cache = new Map()
async function load(url) {
  if (cache.has(url.href)) return cache.get(url.href)
  // Real TS emission elides type-only bindings in transitive repository imports.
  const source = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: url.pathname,
  }).outputText
  const mod = new vm.SourceTextModule(source, { identifier: url.href })
  cache.set(url.href, mod)
  await mod.link(async (name, parent) => {
    if (name.startsWith('.')) return load(new URL(name + '.ts', parent.identifier))
    const exports = dependencies.get(name)
    if (!exports && name === '@mercurjs/b2c-core/utils/completed-cart-order-set') {
      return load(new URL('utils/completed-cart-order-set.ts', b2cRoot))
    }
    assert.ok(exports, `unexpected import ${name}`)
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v) })
  })
  return mod
}
const config = await load(new URL('middlewares.ts', root)); await config.evaluate()
const routes = config.namespace.default.routes
const requestWorkflowNames = ['proceed-return-request', 'update-return-request'].map(file => {
  const source = readFileSync(new URL(`../../packages/modules/requests/src/workflows/order-return-request/workflows/${file}.ts`, import.meta.url), 'utf8')
  const name = source.match(/createWorkflow\(\s*['"]([^'"]+)['"]/)?.[1]
  assert.ok(name, `Actual registered workflow name missing in ${file}`)
  return name
})
const money = [...requestWorkflowNames, 'cancel-single-order', 'refund-seller-order-for-return', 'refund-payment-workflow', 'refund-payments-workflow', 'refund-captured-payments-workflow', 'refund-payment-and-recreate-payment-session', 'cancel-order', 'partial-payment-refund', 'refund-split-order-payment', 'process-payout-for-order']
// Exact newly protected IDs in the actual middleware boundary set.
const newMoney = ['cancel-single-order-under-lock', 'cancel-payment-collection', 'delete-payment-sessions', 'create-order-refund-credit-lines']
const boundary = await load(new URL('middlewares/commerce-financial-boundary.ts', root))
for (const id of newMoney) assert.ok(boundary.namespace.PROTECTED_FINANCIAL_WORKFLOWS.has(id), `Actual boundary is missing ${id}`)
assert.deepEqual(new Set([...money, ...newMoney]), boundary.namespace.PROTECTED_FINANCIAL_WORKFLOWS)
const fixtures = () => ({
  payment: [{ id: 'pay_1', payment_collection_id: 'paycol_1' }],
  payment_collection: [{ id: 'paycol_1' }],
  order: [{ id: 'order_1' }],
  split_order_payment: [], seller_order_link: [], order_split_link: [],
  order_payment_collection: [{ order_id: 'order_1', payment_collection_id: 'paycol_1' }],
})
async function dispatch(path, data = fixtures(), method = 'POST', override = {}) {
  let executed = 0; let status = 200; let body; const calls = []
  const matches = routes.filter(r => r.method.includes(method) && new RegExp('^' + r.matcher.replace(/:[^/]+/g, '([^/]+)') + '/?$').test(path))
  const req = { params: {}, query: { marketplace: 'false' }, body: { input: { marketplace: false } }, headers: { 'x-commerce-bypass': 'true' }, scope: { resolve(key) {
    if (override.services && key in override.services) return override.services[key]
    assert.equal(key, 'query')
    return { graph: async query => { calls.push(query); if (data instanceof Error) throw data; const value = data[query.entity]; if (typeof value === 'function') return value(query); return { data: value } } }
  } }, ...override }
  const res = { status(n) { status = n; return this }, json(value) { body = value; return this } }
  async function run(i) {
    if (i === matches.length) { executed++; if (override.handler) await override.handler(req, res); return }
    const route = matches[i]
    const values = new RegExp('^' + route.matcher.replace(/:[^/]+/g, '([^/]+)') + '/?$').exec(path).slice(1)
    req.params = Object.fromEntries([...route.matcher.matchAll(/:([^/]+)/g)].map((m, j) => [m[1], decodeURIComponent(values[j])]))
    await route.middlewares[0](req, res, () => run(i + 1))
  }
  await run(0)
  return { executed, status, body, calls }
}
for (const id of [...money, ...newMoney]) for (const suffix of ['run', 'steps/success', 'steps/failure']) test(`protected workflow ${id}/${suffix}`, async () => {
  const r = await dispatch(`/admin/workflows-executions/${id}/${suffix}`, new Error('must not resolve'))
  assert.equal(r.executed, 0); assert.equal(r.status, 409); assert.equal(r.calls.length, 0)
})
for (const suffix of ['run', 'steps/success', 'steps/failure']) test(`nonfinancial preserved ${suffix}`, async () => {
  assert.equal((await dispatch(`/admin/workflows-executions/update-products/${suffix}`, new Error('no lookup'))).executed, 1)
})
for (const [path, kind] of [['/admin/payments/pay_1/refund', 'payment'], ['/admin/orders/order_1/cancel', 'order']]) {
  test(`${kind}: positive nonmarketplace`, async () => assert.equal((await dispatch(path)).executed, 1))
  for (const marker of ['seller_order_link', 'order_split_link', 'split_order_payment']) test(`${kind}: marketplace ${marker} no handler`, async () => {
    const data = fixtures(); data[marker] = [{ id: 'marketplace_link' }]
    const r = await dispatch(path, data); assert.equal(r.status, 409); assert.equal(r.executed, 0); assert.match(r.body.message, /commerce|annuler|retour/i)
  })
  for (const invalid of [[], undefined, [{ id: 'wrong' }], [{ id: `${kind}_1` }, { id: `${kind}_1` }]]) test(`${kind}: missing malformed or ambiguous target ${JSON.stringify(invalid)}`, async () => {
    const data = fixtures(); data[kind] = invalid
    assert.equal((await dispatch(path, data)).executed, 0)
  })
  test(`${kind}: failed lookup sanitized`, async () => { const r = await dispatch(path, new Error('secret database address')); assert.equal(r.executed, 0); assert.equal(r.status, 409); assert.doesNotMatch(JSON.stringify(r.body), /secret/) })
  test(`${kind}: unknown link result`, async () => { const data = fixtures(); delete data.seller_order_link; assert.equal((await dispatch(path, data)).executed, 0) })
}
test('unlinked payment unknown, not nonmarketplace', async () => { const data = fixtures(); data.order_payment_collection = []; assert.equal((await dispatch('/admin/payments/pay_1/refund', data)).executed, 0) })
test('existing nonmarketplace order without payment collections allowed', async () => { const data = fixtures(); data.order_payment_collection = []; assert.equal((await dispatch('/admin/orders/order_1/cancel', data)).executed, 1) })
for (const bad of [undefined, [{ order_id: 'wrong', payment_collection_id: 'paycol_1' }], [{ order_id: 'order_1' }], [{ order_id: 'order_1', payment_collection_id: 'paycol_1' }, { order_id: 'order_1', payment_collection_id: 'paycol_1' }]]) test(`inconsistent collection edges ${JSON.stringify(bad)}`, async () => {
  const data = fixtures(); data.order_payment_collection = bad
  for (const path of ['/admin/payments/pay_1/refund', '/admin/orders/order_1/cancel']) assert.equal((await dispatch(path, data)).executed, 0)
})
test('payment-enable policy still executes independently', async () => {
  const before = process.env.COMMERCE_PAYMENTS_ENABLED
  try { process.env.COMMERCE_PAYMENTS_ENABLED = 'false'; assert.equal((await dispatch('/store/payment-collections/paycol_1/payment-sessions')).status, 503); assert.equal((await dispatch('/admin/payments/pay_1/refund')).executed, 1) }
  finally { if (before === undefined) delete process.env.COMMERCE_PAYMENTS_ENABLED; else process.env.COMMERCE_PAYMENTS_ENABLED = before }
})
// Optional installed-native handler test; dependencies are stand-ins, not the SDK
// engine or auth middleware. Set MEDUSA_API_SOURCE to the installed dist/api dir.
for (const suffix of ['run', 'steps/success', 'steps/failure']) test(`installed native handler ${suffix}`, { skip: !process.env.MEDUSA_API_SOURCE }, async () => {
  let effects = 0
  const engine = { run: async () => { effects++; return { acknowledgement: true } }, setStepSuccess: async () => { effects++ }, setStepFailure: async () => { effects++ } }
  const exports = {}
  vm.runInNewContext(readFileSync(`${process.env.MEDUSA_API_SOURCE}/admin/workflows-executions/[workflow_id]/${suffix}/route.js`, 'utf8'), { exports, require(name) {
    if (name === '@medusajs/framework/utils') return { Modules: { WORKFLOW_ENGINE: 'engine' }, isDefined: x => x !== undefined, TransactionHandlerType: { INVOKE: 'invoke' } }
    if (name === '@medusajs/framework/workflows-sdk') return { StepResponse: class {} }
    throw new Error(name)
  } })
  const override = { handler: exports.POST, scope: { resolve: () => engine }, validatedBody: { transaction_id: 'tx_1', step_id: 'step_1', input: {} } }
  await dispatch(`/admin/workflows-executions/cancel-order/${suffix}`, fixtures(), 'POST', override); assert.equal(effects, 0)
  await dispatch(`/admin/workflows-executions/update-products/${suffix}`, fixtures(), 'POST', override); assert.equal(effects, 1)
})
for (const [route, path] of [['payments/[id]/refund', '/admin/payments/pay_1/refund'], ['orders/[id]/cancel', '/admin/orders/order_1/cancel']]) test(`installed native direct ${route}`, { skip: !process.env.MEDUSA_API_SOURCE }, async () => {
  let effects = 0
  const workflow = () => ({ run: async () => { effects++ } })
  const exports = {}
  vm.runInNewContext(readFileSync(`${process.env.MEDUSA_API_SOURCE}/admin/${route}/route.js`, 'utf8'), { exports, require(name) {
    if (name === '@medusajs/core-flows') return { refundPaymentWorkflow: workflow, cancelOrderWorkflow: workflow }
    if (name === '@medusajs/framework/utils') return { ContainerRegistrationKeys: { REMOTE_QUERY: 'remoteQuery' }, remoteQueryObjectFromString: x => x }
    if (name === '../../helpers') return { refetchPayment: async () => ({ id: 'pay_1' }) }
    throw new Error(name)
  } })
  const override = { handler: exports.POST, services: { remoteQuery: async () => [{ id: 'order_1' }] }, auth_context: { actor_id: 'admin_fixture' }, validatedBody: {}, queryConfig: { fields: ['id'] } }
  const commerce = fixtures(); commerce.seller_order_link = [{ order_id: 'order_1', seller_id: 'seller_1' }]
  assert.equal((await dispatch(path, commerce, 'POST', override)).executed, 0); assert.equal(effects, 0)
  assert.equal((await dispatch(path, fixtures(), 'POST', override)).executed, 1); assert.equal(effects, 1)
})
test('missing collection unknown', async () => { const data = fixtures(); data.payment_collection = []; assert.equal((await dispatch('/admin/payments/pay_1/refund', data)).executed, 0) })
for (const id of ['%20', '%2F', '..', '%25', 'bad%20id']) for (const path of [`/admin/payments/${id}/refund`, `/admin/orders/${id}/cancel`, `/admin/workflows-executions/${id}/run`]) test(`malformed ${path}`, async () => { const r = await dispatch(path); assert.equal(r.executed, 0); assert.equal(r.calls.length, 0) })
test('exact POST matchers, reads and unrelated routes untouched', async () => {
  const expected = ['/admin/payments/:id/refund', '/admin/orders/:id/cancel', ...['run', 'steps/success', 'steps/failure'].map(x => `/admin/workflows-executions/:workflow_id/${x}`)]
  for (const path of expected) { const r = routes.find(r => r.matcher === path); assert.ok(r, path); assert.deepEqual(Array.from(r.method), ['POST']) }
  for (const path of ['/admin/payments/pay_1/refund', '/admin/orders/order_1/cancel']) assert.equal((await dispatch(path, new Error('no lookup'), 'GET')).executed, 1)
  assert.equal((await dispatch('/admin/products', new Error('no lookup'))).executed, 1)
  assert.ok(routes.find(r => r.matcher === '/store/payment-collections/:id/payment-sessions'))
})
