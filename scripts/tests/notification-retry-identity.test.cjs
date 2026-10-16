const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const NativeModule = require('@medusajs/notification').default
assert.equal(require('@medusajs/notification/package.json').version, '2.11.3')

// Run with candidate dependencies, never substitute a handwritten native service.
const root = path.resolve(__dirname, '../..')
const base = path.join(root, 'apps/backend/src/modules/notification-retry-identity')
function loadSource(name, service) {
  const filename = path.join(base, name + '.ts')
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true }
  }).outputText
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = module.paths
  const originalRequire = mod.require.bind(mod)
  mod.require = (specifier) => specifier === './service'
    ? { __esModule: true, default: service }
    : originalRequire(specifier)
  mod._compile(output, filename)
  return mod.exports.default
}
const FixedService = loadSource('service')
const FixedModule = loadSource('index', FixedService)
const ctx = { manager: {} }
const entry = (key, extra = {}) => ({ to: 'offline@example.invalid', channel: 'email', template: 'offline', idempotency_key: key, ...extra })
function harness(Service = FixedService, options = {}) {
  const records = (options.records || []).map((record) => ({ ...record }))
  const sends = [], updates = [], lists = [], creates = []
  // Bypass application/container boot; exercise the actual inherited decorated
  // native createNotifications_ using only strict in-memory persistence/provider.
  const service = Object.create(Service.prototype)
  let fail = !!options.failFirst
  service.baseRepository_ = {
    transaction: async (fn) => fn({}),
    serialize: async (value) => value
  }
  service.notificationService_ = {
    list: async (filters, config, context) => {
      lists.push({ filters, config, context })
      if (options.listFailure) throw new Error('offline list unavailable')
      const rows = records.filter((record) => filters.idempotency_key.includes(record.idempotency_key))
      return config.take ? rows.slice(0, config.take) : rows
    },
    create: async (rows) => {
      creates.push(...rows)
      for (const row of rows) {
        if (records.some((record) => record.id === row.id)) throw new Error('duplicate id')
        records.push({ ...row, status: 'pending' })
      }
      return rows
    },
    update: async (rows) => rows.map((row) => {
      updates.push(row.id)
      const existing = records.find((record) => record.id === row.id)
      if (!existing) throw new Error(`NOT_FOUND: notification ${row.id}`)
      Object.assign(existing, row)
      return existing
    })
  }
  const provider = { id: 'offline', channels: ['email'], is_enabled: true }
  service.notificationProviderService_ = {
    getProviderForChannels: async () => [provider],
    send: async (_, notification) => {
      sends.push({ ...notification })
      if (fail) { fail = false; throw new Error('offline first send failed') }
      return { id: 'offline-receipt' }
    }
  }
  return { service, records, sends, updates, lists, creates, run: (data) => service.createNotifications_(data, ctx) }
}

test('module extends actual native service and preserves native loaders/linkable', () => {
  assert.equal(Object.getPrototypeOf(FixedService.prototype), NativeModule.service.prototype)
  assert.equal(FixedModule.service, FixedService)
  assert.notEqual(FixedModule.loaders, NativeModule.loaders)
  assert.equal(FixedModule.linkable, NativeModule.linkable)
  assert.deepEqual(FixedModule.loaders.map((loader) => loader.name), ['connectionLoader', 'containerLoader', ...NativeModule.loaders.map((loader) => loader.name)])
  assert.equal(typeof FixedModule.runMigrations, 'function')
  assert.equal(typeof FixedModule.revertMigration, 'function')
  assert.equal(typeof FixedModule.generateMigration, 'function')
})
test('real native discovery retains fixed service and explicit connection/container/provider loaders', async () => {
  const { loadResources, resolveModuleExports } = require('@medusajs/modules-sdk/dist/loaders/utils/load-internal')
  const { createMedusaContainer, Modules } = require('@medusajs/framework/utils')
  const filename = path.join(base, 'index.ts')
  const previous = Module._extensions['.ts']
  Module._extensions['.ts'] = (mod, file) => {
    assert.ok(file.startsWith(base), 'only the reviewed wrapper may be transpiled')
    mod.paths = [...module.paths, ...mod.paths]
    mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true }
    }).outputText, file)
  }
  try {
    const resolution = { resolutionPath: filename, definition: { key: Modules.NOTIFICATION }, moduleDeclaration: {} }
    const exported = await resolveModuleExports({ resolution })
    const resources = await loadResources({
      container: createMedusaContainer(), moduleResolution: resolution,
      discoveryPath: exported.discoveryPath, loadedModuleLoaders: exported.loaders
    })
    assert.equal(resources.moduleService, require(path.join(base, 'service.ts')).default)
    assert.deepEqual(resources.loaders.map((loader) => loader.name), ['connectionLoader', 'containerLoader', ...NativeModule.loaders.map((loader) => loader.name)])
    // Execute only the standard container registration loader, never its DB
    // connection, migrations, providers or sending. Native repositories remain
    // lazy registrations here; this is DI evidence, not a DB delivery test.
    const container = createMedusaContainer()
    await resources.loaders.find((loader) => loader.name === 'containerLoader')({ container, options: {} })
    for (const key of ['notificationService', 'notificationProviderService', 'notificationRepository', 'notificationProviderRepository']) {
      assert.equal(container.hasRegistration(key), true, `native ${key} registration missing`)
    }
  } finally {
    if (previous) Module._extensions['.ts'] = previous
    else delete Module._extensions['.ts']
    delete require.cache[filename]
    delete require.cache[path.join(base, 'service.ts')]
  }
})

test('backend config selects identity service while retaining native provider options', () => {
  const filename = path.join(root, 'apps/backend/medusa-config.ts')
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true }
  }).outputText
  const mod = new Module(filename, module)
  mod.require = (specifier) => {
    if (specifier === '@medusajs/framework/utils') return {
      defineConfig: (config) => config, loadEnv: () => {}, Modules: { NOTIFICATION: 'notification' }
    }
    if (specifier === './src/utils/signing-secrets') return {
      resolveSigningSecrets: () => ({ jwtSecret: 'offline-valid-jwt', cookieSecret: 'offline-valid-cookie' })
    }
    throw new Error(`Unexpected config dependency: ${specifier}`)
  }
  mod._compile(output, filename)
  const notification = mod.exports.modules.filter((entry) => entry.key === 'notification')
  assert.equal(notification.length, 1)
  assert.equal(notification[0].resolve, './src/modules/notification-retry-identity')
  assert.deepEqual(notification[0].options.providers.map(({ id, options }) => ({ id, channels: options.channels })), [
    { id: 'resend', channels: ['email'] }, { id: 'local', channels: ['feed', 'seller_feed'] }
  ])
})
test('unpatched native: retry sends generated unknown ID, strict update rejects, failure stays failure', async () => {
  const h = harness(NativeModule.service, { failFirst: true })
  await assert.rejects(h.run([entry('old-native')]), /offline first send failed/)
  const id = h.records[0].id
  await assert.rejects(h.run([entry('old-native')]), /NOT_FOUND/)
  assert.notEqual(h.sends[1].id, id)
  assert.equal(h.records[0].status, 'failure')
  assert.equal(h.records.length, 1)
})
test('fixed: initial fail -> same persisted ID retry success -> third invocation no send', async () => {
  const h = harness(FixedService, { failFirst: true })
  const input = entry('fixed-retry')
  await assert.rejects(h.run([input]), /offline first send failed/)
  const id = h.records[0].id
  assert.equal(h.records[0].status, 'failure')
  await h.run([input])
  assert.equal(h.records[0].status, 'success')
  assert.equal(h.records[0].external_id, 'offline-receipt')
  assert.deepEqual(h.sends.map((send) => send.id), [id, id])
  assert.deepEqual(h.updates, [id, id])
  assert.equal(h.creates.length, 1)
  assert.equal(h.records.length, 1)
  await h.run([input])
  assert.equal(h.sends.length, 2)
  assert.equal(h.updates.length, 2)
  assert.ok(!Object.hasOwn(input, 'id'), 'DTO must not be mutated')
  console.log('IDENTITY_SEQUENCE: rows=1 sends=2 updateIds=same persisted status=success thirdSend=0')
})
test('no keys and empty batches retain native creation semantics', async () => {
  const h = harness()
  assert.deepEqual(await h.run([]), [])
  assert.equal(h.lists.length, 0)
  await h.run([entry(undefined), entry(null), entry('')])
  await h.run([entry(undefined)])
  assert.equal(h.creates.length, 4)
  assert.equal(h.sends.length, 4)
  assert.equal(h.lists.length, 2, 'only native list; workaround must bypass no-key batches')
})
for (const status of ['pending', 'success']) {
  test(`${status} row passes through to native skip, no provider send/update/create`, async () => {
    const h = harness(FixedService, { records: [entry('skip', { id: 'persisted', status })] })
    await h.run([entry('skip')])
    assert.equal(h.sends.length, 0)
    assert.equal(h.updates.length, 0)
    assert.equal(h.creates.length, 0)
    assert.equal(h.lists.length, 2, 'native skip must still execute')
  })
}
test('mixed batch keeps fresh/no-key/success/failure semantics and overwrites stale retry ID', async () => {
  const h = harness(FixedService, { records: [entry('failed', { id: 'persisted-failure', status: 'failure' }), entry('done', { id: 'persisted-success', status: 'success' })] })
  await h.run([entry('fresh'), entry(undefined), entry('done'), entry('failed', { id: 'stale-generated-id' })])
  assert.equal(h.sends.length, 3)
  assert.equal(h.creates.length, 2)
  assert.equal(h.records.length, 4)
  assert.equal(h.sends[2].id, 'persisted-failure')
  assert.equal(h.records[0].status, 'success')
  assert.equal(h.lists[0].context, ctx)
  assert.equal(h.lists[0].config.take, 4)
})
for (const [name, data, options, pattern] of [
  ['duplicate input keys', [entry('dup'), entry('dup')], {}, /duplicate input/],
  ['duplicate persisted rows', [entry('dup')], { records: [entry('dup', { id: 'a', status: 'failure' }), entry('dup', { id: 'b', status: 'success' })] }, /duplicate persisted/],
  ['persisted failure missing ID', [entry('missing')], { records: [entry('missing', { status: 'failure' })] }, /missing or invalid/],
  ['explicit retry ID missing row', [entry('missing', { id: 'gone' })], {}, /no persisted record/],
  ['lookup error', [entry('lookup')], { listFailure: true }, /list unavailable/]
]) {
  test(`${name}: fail closed before send/create/update`, async () => {
    const h = harness(FixedService, options)
    await assert.rejects(h.run(data), pattern)
    assert.equal(h.sends.length, 0)
    assert.equal(h.creates.length, 0)
    assert.equal(h.updates.length, 0)
  })
}
test('identity lookup explicitly raises page cap for batches above default page size', async () => {
  const records = Array.from({ length: 20 }, (_, index) => entry(`key-${index}`, { id: `persisted-${index}`, status: 'failure' }))
  const h = harness(FixedService, { records })
  await h.run(records.map(({ idempotency_key }) => entry(idempotency_key)))
  assert.equal(h.lists[0].config.take, 21)
  assert.deepEqual(h.sends.map((send) => send.id), records.map((record) => record.id))
  assert.equal(h.creates.length, 0)
})
