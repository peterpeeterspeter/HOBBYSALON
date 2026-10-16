// Synthetic, offline behavioral tests: actual TypeScript and captured framework JS.
// No database, provider, server, or network is used.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
let framework = process.env.BACKEND_AUDIT_FRAMEWORK
if (!framework) {
  try {
    framework = dirname(require.resolve('@medusajs/framework/http'))
  } catch (cause) {
    throw new Error('Install project dependencies or set BACKEND_AUDIT_FRAMEWORK to the installed framework dist/http directory.', { cause })
  }
}
const utilities = { ContainerRegistrationKeys: { QUERY: 'query' }, MedusaError: { Types: { NOT_FOUND: 'not_found', NOT_ALLOWED: 'not_allowed' } } }
function synthetic(exports) {
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
  })
}
async function loadTS(relative, dependencies = {}) {
  const path = root + relative
  const module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8')), { identifier: path })
  await module.link(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
    return dependencies[name] instanceof vm.Module ? dependencies[name] : synthetic(dependencies[name])
  })
  await module.evaluate()
  return module
}
function loadFramework(relative, dependencies) {
  const path = framework + '/' + relative
  const exports = {}
  vm.runInNewContext(readFileSync(path, 'utf8'), { exports, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected framework dependency: ${name}`)
    return dependencies[name]
  } }, { filename: path })
  return exports
}
const ownership = (await loadTS('packages/modules/b2c-core/src/shared/infra/http/middlewares/check-ownership.ts', {
  express: { NextFunction: undefined },
  '@medusajs/framework': { AuthenticatedMedusaRequest: undefined, MedusaResponse: undefined },
  '@medusajs/framework/types': { LinkMethodRequest: undefined },
  '@medusajs/framework/utils': utilities
})).namespace
const own = id => ({ product_id: id, seller_id: 'seller-own' })
async function batch({ body = { add: ['own-a'], remove: [] }, member = { data: [{ seller: { id: 'seller-own' } }] }, resources, auth = { actor_id: 'member-own' }, graphError, options = {} } = {}) {
  const calls = []
  let effects = 0, status, response
  const req = { validatedBody: structuredClone(body), auth_context: auth, scope: { resolve(key) {
    assert.equal(key, 'query')
    return { graph: async (input, settings) => {
      calls.push({ input, settings })
      if (graphError) throw graphError
      if (input.entity === 'member') return member
      return resources === undefined ? { data: input.filters.product_id.filter(id => id.startsWith('own-')).map(own) } : resources
    } }
  } } }
  const original = structuredClone(req.validatedBody)
  const res = { status(code) { status = code; return this }, json(value) { response = value; return this } }
  await ownership.checkResourcesOwnershipByResourceBatch({ entryPoint: 'seller_product', filterField: 'product_id', ...options })(req, res, () => { effects++ })
  assert.deepEqual(req.validatedBody, original, 'ownership must not partially rewrite a batch')
  return { calls, effects, status, response }
}
for (const [name, body, allowed] of [
  ['all owned add', { add: ['own-a', 'own-b'], remove: [] }, true],
  ['all owned remove', { add: [], remove: ['own-a', 'own-b'] }, true],
  ['owned add and remove', { add: ['own-a'], remove: ['own-b'] }, true],
  ['foreign only', { add: ['foreign'], remove: [] }, false],
  ['mixed add', { add: ['own-a', 'foreign'], remove: [] }, false],
  ['mixed remove', { add: [], remove: ['own-a', 'foreign'] }, false],
  ['foreign remove after owned add', { add: ['own-a'], remove: ['foreign'] }, false],
  ['foreign add before owned remove', { add: ['foreign'], remove: ['own-a'] }, false],
  ['duplicates across add and remove', { add: ['own-a', 'own-a'], remove: ['own-a'] }, true],
  ['empty authenticated no-op', { add: [], remove: [] }, true],
  ['omitted arrays authenticated no-op', {}, true]
]) test(`B04 ${name}`, async () => {
  const result = await batch({ body })
  assert.equal(result.effects, allowed ? 1 : 0, 'downstream mutation must run only for an entirely owned batch')
  if (!allowed) assert.ok([403, 404].includes(result.status))
  if (name.startsWith('empty') || name.startsWith('omitted')) assert.equal(result.calls.length, 1, 'no-op still verifies membership but performs no resource query')
  if (name.startsWith('duplicates')) assert.deepEqual(Array.from(result.calls[1].input.filters.product_id), ['own-a'])
})
for (const [name, member] of [
  ['missing member', { data: [] }], ['missing seller', { data: [{}] }],
  ['null seller', { data: [{ seller: null }] }], ['empty seller id', { data: [{ seller: { id: '' } }] }],
  ['malformed member result', { data: null }], ['ambiguous member result', { data: [{ seller: { id: 'seller-own' } }, { seller: { id: 'seller-other' } }] }]
]) test(`B04 rejects ${name} including no-op`, async () => {
  for (const body of [{ add: ['own-a'], remove: [] }, { add: [], remove: [] }]) {
    const result = await batch({ member, body })
    assert.equal(result.effects, 0)
    assert.equal(result.status, 403)
    assert.equal(result.calls.length, 1)
  }
})
for (const auth of [null, {}, { actor_id: '' }]) test(`B04 missing authentication ${JSON.stringify(auth)}`, async () => {
  const result = await batch({ auth })
  assert.equal(result.effects, 0)
  assert.equal(result.status, 403)
  assert.equal(result.calls.length, 0)
})
for (const [name, resources] of [
  ['missing requested ID', { data: [own('own-a')] }],
  ['duplicate rows cannot prove missing ID', { data: [own('own-a'), own('own-a')] }],
  ['foreign seller row', { data: [own('own-a'), { product_id: 'own-b', seller_id: 'seller-other' }] }],
  ['unproved seller', { data: [own('own-a'), { product_id: 'own-b' }] }],
  ['unrequested row', { data: [own('own-a'), own('own-b'), own('own-extra')] }],
  ['null row', { data: [own('own-a'), null] }],
  ['non-array result', { data: {} }], ['missing data', {}]
]) test(`B04 rejects ${name}`, async () => {
  const result = await batch({ body: { add: ['own-a'], remove: ['own-b'] }, resources })
  assert.equal(result.effects, 0)
  assert.equal(result.status, 403)
})
for (const body of [{ add: 'own-a', remove: [] }, { add: [''], remove: [] }, { add: [null], remove: [] }, { add: [], remove: null }]) test(`B04 malformed IDs ${JSON.stringify(body)}`, async () => {
  const result = await batch({ body })
  assert.equal(result.effects, 0)
  assert.equal(result.status, 403)
})
test('B04 query failure propagates without executing mutation', async () => {
  const error = new Error('synthetic query failure')
  await assert.rejects(batch({ graphError: error }), error)
})
test('B04 graph query retains authenticated seller scope', async () => {
  const result = await batch()
  assert.equal(result.calls[0].input.filters.id, 'member-own')
  assert.equal(result.calls[0].settings.throwIfKeyNotFound, true)
  assert.equal(result.calls[1].input.filters.seller_id, 'seller-own')
  assert.deepEqual(Array.from(result.calls[1].input.fields), ['seller_id', 'product_id'])
})

const groups = Object.fromEntries(['store', 'admin', 'vendor'].map(name => [name, [{ matcher: `/${name}/*`, middlewares: [() => {}] }]]))
const hooks = await loadTS('packages/modules/b2c-core/src/api/hooks/middlewares.ts', { '@medusajs/framework': { MiddlewareRoute: undefined } })
const rootConfig = (await loadTS('packages/modules/b2c-core/src/api/middlewares.ts', {
  '@medusajs/medusa': { defineMiddlewares: config => config },
  './store/middlewares': { storeMiddlewares: groups.store },
  './admin/middlewares': { adminMiddlewares: groups.admin },
  './vendor/middlewares': { vendorMiddlewares: groups.vendor },
  './hooks/middlewares': hooks
})).namespace.default

test('B07 root keeps store/admin/vendor middleware unchanged and ordered', () => {
  assert.deepEqual(Array.from(rootConfig.routes.slice(0, 3)), [...groups.store, ...groups.admin, ...groups.vendor])
})
const { MiddlewareFileLoader } = loadFramework('middleware-file-loader.js', {
  '@medusajs/utils': { FileSystem: class { async exists(name) { return name === 'middlewares.ts' } }, dynamicImport: async () => ({ default: rootConfig }), isFileSkipped: () => false },
  path: { join: (...parts) => parts.join('/') }, zod: {},
  '../logger': { logger: { debug() {}, warn() {} } },
  './types': { HTTP_METHODS: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] }
})
const loader = new MiddlewareFileLoader()
await loader.scanDir('/synthetic/api')
const configs = loader.getBodyParserConfigRoutes()
const parser = options => (req, res, next) => {
  options?.verify?.(req, res, req.wireBytes)
  req.body = JSON.parse(req.wireBytes.toString('utf8'))
  next()
}
const { createBodyParserMiddlewaresStack } = loadFramework('middlewares/bodyparser.js', {
  'lodash.memoize': fn => fn,
  '@medusajs/cli/dist/reporter': { debug() {} },
  express: { json: parser, text: () => (req, res, next) => next(), urlencoded: () => (req, res, next) => next() }
})
for (const path of ['/hooks/payouts', '/hooks/payment/stripe-connect']) test(`B07 actual framework loader/parser retains exact POST bytes for ${path}`, () => {
  const finder = { find(path, method) { return configs.find(route => route.matcher === path && route.methods.includes(method)) } }
  const wireBytes = Buffer.from('{ "event": "synthetic", "nested": {"id": "local-only"} }\n')
  const req = { path, method: 'POST', wireBytes }
  let nextCalls = 0
  for (const middleware of createBodyParserMiddlewaresStack('/', finder)) middleware(req, {}, () => nextCalls++)
  assert.equal(nextCalls, 3)
  assert.deepEqual(req.body, JSON.parse(wireBytes.toString()))
  assert.ok(Buffer.isBuffer(req.rawBody), 'root registration must activate framework raw-body verify callback')
  assert.equal(req.rawBody, wireBytes, 'exact original buffer, not reserialized JSON')
})
test('B07 unrelated store request does not gain raw-body capture', () => {
  const req = { path: '/store/synthetic', method: 'POST', wireBytes: Buffer.from('{}') }
  const finder = { find: () => undefined }
  createBodyParserMiddlewaresStack('/', finder)[0](req, {}, () => {})
  assert.equal(req.rawBody, undefined)
})
