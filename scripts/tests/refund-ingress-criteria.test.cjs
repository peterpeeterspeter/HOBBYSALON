'use strict'
// Offline criteria acceptance: candidate TS + installed pinned SWC/Medusa imports.
// HTTP, query and session transports are explicit test doubles; no DB/provider calls.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const ROOT = path.resolve(__dirname, '../..')
const NATIVE = process.env.MEDUSA_NATIVE_ROOT || '/app/node_modules/@medusajs/core-flows/dist'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

// Resolve source literals, including compiled exports.X = "id" and config.name.
// No basename-derived IDs: unresolved dynamic registrations are explicitly reported.
function registrations(text) {
  const definitions = new Map()
  for (const m of text.matchAll(/(?:\b(?:const|let|var)\s+|\bexports\.)(\w+)\s*=\s*(["'])([^"']+)\2/g)) definitions.set(m[1], m[3])
  const found = [], unresolved = []
  for (const m of text.matchAll(/(?:\bcreateWorkflow|\.createWorkflow\))\s*\(\s*(?:\{\s*name\s*:\s*)?(?:(["'])([^"']+)\1|([\w.]+))/g)) {
    const id = m[2] || definitions.get(m[3]?.split('.').pop())
    if (id) found.push(id)
    else unresolved.push(m[3])
  }
  return { ids: [...new Set(found)], unresolved }
}
function inventory() {
  const result = { node: process.version, roots: [], files: 0, workflows: [], ingresses: [], unresolved: [], errors: [], limitations: [
    'Filesystem inventory, not live application bootstrap or deployed routing acceptance.',
    'Framework scheduled workflow IDs are derived from its inspected job-${config.name} registration, never guessed from filenames.',
    'Nonliteral runtime registrations remain listed as unresolved; no claim about external plugins or runtime-generated customer workflows.'
  ] }
  const scan = (root, origin) => {
    result.roots.push({ root, origin })
    const todo = [root]
    while (todo.length) {
      const dir = todo.pop()
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (error) { result.errors.push({ file: dir, error: error.message }); continue }
      for (const entry of entries) {
        const file = path.join(dir, entry.name)
        if (entry.isSymbolicLink()) continue // Workspace symlinks are covered by /app/packages.
        if (entry.isDirectory()) {
          if (['.git', '.next', '.cache'].includes(entry.name) || (origin === 'source' && entry.name === 'node_modules')) continue
          todo.push(file); continue
        }
        if (!/\.(?:js|ts|cjs|mjs)$/.test(file) || /\.d\.ts$/.test(file)) continue
        result.files++
        let text
        try { text = fs.readFileSync(file, 'utf8') } catch (error) { result.errors.push({ file, error: error.message }); continue }
        const reg = registrations(text)
        const refs = [...new Set([...text.matchAll(/\b([A-Za-z_$][\w$]*(?:Workflow|WorkflowId|Step))\b/g)].map(m => m[1]))]
        const details = { origin, file, sha256: sha(text), references: refs }
        for (const id of reg.ids) result.workflows.push({ ...details, id })
        for (const expression of reg.unresolved) result.unresolved.push({ ...details, expression })
        const kind = /\/api\/admin\//.test(file) && /\/route\.(?:js|ts)$/.test(file) ? 'admin' :
          /\/subscribers\//.test(file) ? 'subscriber' : /\/jobs\//.test(file) ? 'job' :
          /(?:\/batch[^/]*\/|\/batch[^/]*\.(?:js|ts)$)/.test(file) ? 'batch' : undefined
        if (kind) {
          const names = [...text.matchAll(/\bname\s*:\s*(["'])([^"']+)\1/g)].map(m => m[2])
          result.ingresses.push({ ...details, kind, names,
            methods: [...text.matchAll(/(?:export\s+(?:const|async\s+function|function)\s+|exports\.)(GET|POST|PUT|DELETE|PATCH)\b/g)].map(m => m[1]),
            events: [...text.matchAll(/\bevent\s*:\s*(\[[\s\S]*?\]|[^,}\n]+)/g)].map(m => m[1].trim()),
            financialReferences: /refund|cancel|payment|payout|settlement|commerce.*lock/i.test(text) })
          if (kind === 'job') for (const name of names) result.workflows.push({ ...details, id: `job-${name}`, derivedFrom: 'installed framework JobLoader.register' })
        }
      }
    }
  }
  scan('/app', 'installed')
  scan(path.join(ROOT, 'apps/backend/src'), 'source')
  scan(path.join(ROOT, 'packages/modules'), 'source')
  return result
}
if (process.argv.includes('--inventory')) {
  console.log(JSON.stringify(inventory(), null, 2))
} else {
  const swc = require('@swc/core')
  const oldExtension = Module._extensions['.ts']
  const oldResolve = Module._resolveFilename
  Module._extensions['.ts'] = (mod, file) => {
    mod.paths = [...module.paths, ...mod.paths]
    mod._compile(swc.transformSync(fs.readFileSync(file, 'utf8'), {
      filename: file, jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true } }, module: { type: 'commonjs' }
    }).code, file)
  }
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request.startsWith('@mercurjs/b2c-core/')) request = path.join(ROOT, 'packages/modules/b2c-core/src', request.slice('@mercurjs/b2c-core/'.length))
    if (request === '@mercurjs/framework') request = path.join(ROOT, 'packages/framework/src/index.ts')
    return oldResolve.call(this, request, parent, ...rest)
  }
  const boundaryFile = path.join(ROOT, 'apps/backend/src/api/middlewares/commerce-financial-boundary.ts')
  const boundary = require(boundaryFile)
  const cart = require(path.join(ROOT, 'packages/modules/b2c-core/src/utils/commerce-cart-lock.ts'))
  const financial = require(path.join(ROOT, 'packages/modules/b2c-core/src/utils/commerce-financial-lock.ts'))
  const { createPostgresSettlementStore } = require(path.join(ROOT, 'packages/modules/b2c-core/src/utils/refund-settlement-store.ts'))
  Module._extensions['.ts'] = oldExtension
  Module._resolveFilename = oldResolve

  const added = [
    ['cancel-single-order-under-lock', path.join(ROOT, 'packages/modules/b2c-core/src/workflows/order/workflows/cancel-order.ts')],
    ['cancel-payment-collection', path.join(NATIVE, 'payment-collection/workflows/cancel-payment-collection.js')],
    ['delete-payment-sessions', path.join(NATIVE, 'payment-collection/workflows/delete-payment-sessions.js')],
    ['create-order-refund-credit-lines', path.join(NATIVE, 'order/workflows/payments/create-order-refund-credit-lines.js')],
  ]
  const nonfinancial = [
    ['update-products', 'product/workflows/update-products.js'],
    ['create-refund-reasons-workflow', 'payment-collection/workflows/create-refund-reasons.js'],
    ['delete-refund-reasons-workflow', 'payment-collection/workflows/delete-refund-reasons.js'],
    ['update-refund-reasons', 'payment-collection/workflows/update-refund-reasons.js'],
    ['cancel-order-change', 'order/workflows/cancel-order-change.js'],
    ['cancel-transfer-order-request', 'order/workflows/transfer/cancel-order-transfer.js'],
    ['cancel-fulfillment-workflow', 'fulfillment/workflows/cancel-fulfillment.js'],
  ]
  const api = '/app/node_modules/@medusajs/medusa/dist/api/admin/workflows-executions/[workflow_id]'
  const configText = fs.readFileSync(path.join(ROOT, 'apps/backend/src/api/middlewares.ts'), 'utf8')
  const spoof = { marketplace: false, financialLock: true, cartLock: true, commerce_lock: true,
    skip_lock: true, bypass: true, cart_id: 'spoof-cart', transaction_id: 'spoof-tx' }
  async function dispatch(id, suffix, handler) {
    let next = 0, status = 200, response
    const req = { params: { workflow_id: id }, body: { input: { ...spoof, context: spoof }, context: spoof },
      validatedBody: { input: { ...spoof, context: spoof }, context: spoof, transaction_id: 'spoof-tx', step_id: 'spoof-step', response: spoof },
      query: spoof, headers: { 'x-commerce-bypass': 'true', 'x-financial-lock': 'true' },
      scope: { resolve() { throw new Error('Entry guard must not consult services or caller context') } } }
    const res = { status(value) { status = value; return this }, json(value) { response = value; return this } }
    await boundary.guardFinancialWorkflow(req, res, async () => { next++; if (handler) await handler(req, res) })
    return { next, status, response }
  }
  for (const [id, file] of added) {
    test(`actual registration literal ${id}`, () => assert.ok(registrations(fs.readFileSync(file, 'utf8')).ids.includes(id), file))
    for (const suffix of ['run', 'steps/success', 'steps/failure']) test(`${id}/${suffix}: spoofed context cannot cross real entry guard`, async () => {
      assert.ok(configText.includes(`matcher: "/admin/workflows-executions/:workflow_id/${suffix}"`))
      const r = await dispatch(id, suffix)
      assert.equal(r.next, 0); assert.equal(r.status, 409)
      assert.equal(r.response.type, 'commerce_financial_boundary')
      assert.match(r.response.message, /g[eë]co[oö]rdineerde commerce/)
    })
  }
  for (const [id, file] of nonfinancial) test(`${id}: real nonfinancial registration remains accessible`, async () => {
    assert.ok(registrations(fs.readFileSync(path.join(NATIVE, file), 'utf8')).ids.includes(id))
    const r = await dispatch(id, 'run'); assert.equal(r.next, 1); assert.equal(r.status, 200)
  })
  for (const [id] of added) for (const suffix of ['run', 'steps/success', 'steps/failure']) test(`${id}/${suffix}: installed native handler has zero engine effects`, async () => {
    const handler = require(path.join(api, suffix, 'route.js')).POST
    let effects = 0
    // Any unexpected next invokes the installed handler and fails on its scope lookup.
    const r = await dispatch(id, suffix, async (req, res) => { effects++; await handler(req, res) })
    assert.equal(r.next, 0); assert.equal(r.status, 409); assert.equal(effects, 0)
  })
  for (const suffix of ['run', 'steps/success', 'steps/failure']) test(`update-products/${suffix}: installed native handler remains reachable`, async () => {
    const handler = require(path.join(api, suffix, 'route.js')).POST
    let effects = 0
    const engine = { run: async () => { effects++; return { acknowledgement: true } },
      setStepSuccess: async () => { effects++ }, setStepFailure: async () => { effects++ } }
    const r = await dispatch('update-products', suffix, async (req, res) => {
      req.scope = { resolve: () => engine } // Explicit engine collaborator, not native workflow execution.
      await handler(req, res)
    })
    assert.equal(r.next, 1); assert.equal(r.status, 200); assert.equal(effects, 1)
  })
  function fixture({ busySettlement = false } = {}) {
    let sequence = 0
    const events = [], sessions = [], held = new Set()
    const identities = { 'order-a': { cart_id: 'cart-a', payment_collection_id: 'pc-a' },
      'order-b': { cart_id: 'cart-b', payment_collection_id: 'pc-b' },
      'order-a-sibling': { cart_id: 'cart-a', payment_collection_id: 'pc-a' } }
    const knex = {
      client: {
        async acquireConnection() { const connection = new EventEmitter(); connection.session = ++sequence; sessions.push(connection); return connection },
        async releaseConnection(connection) { events.push({ kind: 'release', session: connection.session }) },
        async destroyRawConnection(connection) { events.push({ kind: 'destroy', session: connection.session }) },
      },
      raw(sql, bindings = []) {
        const run = async connection => {
          events.push({ sql, bindings, session: connection?.session })
          if (sql.includes('pg_try_advisory_lock')) {
            if (held.has(bindings[0]) || (busySettlement && connection.session === 2)) return { rows: [{ locked: false }] }
            held.add(bindings[0]); return { rows: [{ locked: true }] }
          }
          if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: held.delete(bindings[0]) }] }
          if (sql.startsWith('SET SESSION')) return { rows: [] }
          if (sql.startsWith('SELECT s.cart_id')) return { rows: identities[bindings[0]] ? [{ ...identities[bindings[0]] }] : [] }
          if (sql.startsWith('SELECT c.cart_id,pc.id AS scope_id')) {
            const link = Object.values(identities).find(row => row.payment_collection_id === bindings[0])
            return { rows: link ? [{ cart_id: link.cart_id, scope_id: link.payment_collection_id, currency_code: 'eur' }] : [] }
          }
          if (sql.startsWith('SELECT operation_id,scope_id,phase,plan FROM refund_settlement') ||
              sql.startsWith('SELECT * FROM commerce_refund_dispatch')) return { rows: [] }
          if (sql.startsWith('SELECT 1')) return { rows: [{ bound: 1 }] }
          assert.fail(`Unexpected SQL in transport double: ${sql}`)
        }
        return { connection: run, then: (yes, no) => run(undefined).then(yes, no) }
      },
    }
    return { container: { resolve: () => knex }, knex, events, sessions, held }
  }
  test('order mapping uses exact shared cart key; cart then settlement try-lock; reverse release', async () => {
    const f = fixture()
    await financial.withCommerceOrderLock(f.container, 'order-a', async () => {
      cart.assertCommerceCartLock(f.container, 'cart-a')
      const store = createPostgresSettlementStore(f.knex, cart.assertCommerceFinancialLock)
      await store.withScopeLock('pc-a', async session => {
        session.assertActive()
        await financial.withCommerceOrderLock(f.container, 'order-a-sibling', async () => cart.assertCommerceCartLock(f.container, 'cart-a'))
      })
    })
    const locks = f.events.filter(e => e.sql?.includes('pg_try_advisory_lock'))
    assert.deepEqual(locks.map(e => e.bindings[0]), [cart.commerceCartLockKey('cart-a'),
      crypto.createHash('sha256').update('hobbysalon:refund-settlement:v1:pc-a').digest().readBigInt64BE(0).toString()])
    assert.deepEqual(locks.map(e => e.session), [1, 2])
    assert.deepEqual(f.events.filter(e => e.sql?.includes('pg_advisory_unlock')).map(e => e.session), [2, 1])
    assert.equal(f.held.size, 0)
    assert.equal(f.events.some(e => /pg_advisory_lock\(/.test(e.sql || '')), false, 'No blocking advisory acquisition')
  })
  test('inherited different cart rejects before second checkout/lock or nested work', async () => {
    const f = fixture(); let effects = 0
    await financial.withCommerceOrderLock(f.container, 'order-a', async () => {
      const store = createPostgresSettlementStore(f.knex, cart.assertCommerceFinancialLock)
      await store.withScopeLock('pc-a', async () => {
        await assert.rejects(financial.withCommerceOrderLock(f.container, 'order-b', async () => { effects++ }), /lock.*not held/i)
        await assert.rejects(cart.withCommerceCartLock(f.container, 'cart-b', async () => { effects++ }), /lock.*not held/i)
        cart.assertCommerceCartLock(f.container, 'cart-a')
      })
    })
    assert.equal(effects, 0); assert.equal(f.sessions.length, 2)
    assert.equal(f.events.filter(e => e.sql?.includes('pg_try_advisory_lock')).length, 2)
    assert.equal(f.held.size, 0)
  })
  test('busy nested settlement fails nonblocking and releases outer cart without callback', async () => {
    const f = fixture({ busySettlement: true }); let effects = 0
    await assert.rejects(financial.withCommerceOrderLock(f.container, 'order-a', async () => {
      const store = createPostgresSettlementStore(f.knex, cart.assertCommerceFinancialLock)
      await store.withScopeLock('pc-a', async () => { effects++ })
    }), /lock_unavailable/)
    assert.equal(effects, 0); assert.equal(f.held.size, 0)
    assert.deepEqual(f.events.filter(e => e.sql?.includes('pg_advisory_unlock')).map(e => e.session), [1])
  })
}
