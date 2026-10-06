#!/usr/bin/env node
'use strict';
// Offline synthetic packaging fixtures + behavioral execution of the actual config.
// No Medusa/provider startup, build, database or network access.
// Run: node --experimental-vm-modules --test scripts/tests/release-runtime-config.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { archive } = require('../../deploy/release/archive-runtime.cjs');
const root = path.resolve(__dirname, '../..');

// Independently enumerated from read-only inspection of the installed 2.11.3 image.
const migrationless = ['file', 'locking', 'cache-inmemory', 'event-bus-local',
  'auth-emailpass', 'fulfillment-manual', 'file-local', 'file-s3',
  'notification-local', 'event-bus-redis'];
const persisted = ['api-key', 'auth', 'cart', 'currency', 'customer', 'fulfillment',
  'index', 'inventory', 'locking-postgres', 'notification', 'order', 'payment',
  'pricing', 'product', 'promotion', 'region', 'sales-channel', 'settings',
  'stock-location', 'store', 'tax', 'user', 'workflow-engine-inmemory', 'workflow-engine-redis'];
const plugins = {
  'b2c-core': ['attribute', 'category-details', 'collection-details', 'configuration',
    'marketplace', 'payout', 'secondary_categories', 'seller', 'split-order-payment', 'taxcode', 'wishlist'],
  commission: ['commission'], requests: ['order-return-request', 'requests'], reviews: ['reviews'],
  'payment-stripe-connect': [], resend: [],
};
const nativeDir = name => `node_modules/@medusajs/${name}/dist/migrations`;
const pluginDir = (pkg, mod) => `packages/modules/${pkg}/.medusa/server/src/modules/${mod}/migrations`;
const providerDirs = [
  'packages/modules/payment-stripe-connect/.medusa/server/src/providers/stripe-connect/migrations',
  'packages/modules/resend/.medusa/server/src/providers/resend/migrations',
];
function fixture(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-runtime-config-'));
  t.after(() => {
    function writable(dir) {
      fs.chmodSync(dir, 0o755);
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) writable(path.join(dir, entry.name));
    }
    writable(tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  const source = path.join(tmp, 'source'), dest = path.join(tmp, 'runtime');
  function write(rel, value) {
    const file = path.join(source, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  }
  write('package.json', { private: true, workspaces: ['apps/*', 'packages/modules/*'] });
  write('yarn.lock', '# yarn lockfile v1\n');
  write('apps/backend/package.json', { name: 'api', dependencies: { '@medusajs/medusa': '2.11.3' } });
  write('apps/backend/.medusa/server/medusa-config.js', 'module.exports={}');
  write('apps/backend/.medusa/server/.medusa/types/ignored.d.ts', '// generated');
  write('node_modules/@medusajs/medusa/package.json', { name: '@medusajs/medusa', version: '2.11.3' });
  for (const name of [...migrationless, ...persisted]) {
    write(`node_modules/@medusajs/${name}/package.json`, { name: `@medusajs/${name}`, version: '2.11.3', main: 'dist/index.js' });
    write(`node_modules/@medusajs/${name}/dist/index.js`, 'module.exports={}');
  }
  for (const name of persisted) write(`${nativeDir(name)}/Migration20250101000000.js`, '// native fixture migration');
  // An unknown migrationless provider must NOT receive an invented migrations dir.
  write('node_modules/@medusajs/unknown-provider/package.json', { name: '@medusajs/unknown-provider', version: '2.11.3' });
  write('node_modules/@medusajs/unknown-provider/dist/index.js', 'module.exports={}');
  for (const [pkg, modules] of Object.entries(plugins)) {
    write(`packages/modules/${pkg}/package.json`, { name: `@mercurjs/${pkg}`, version: '1.5.4' });
    write(`packages/modules/${pkg}/.medusa/server/src/index.js`, '// compiled plugin fixture');
    for (const mod of modules) {
      write(`packages/modules/${pkg}/.medusa/server/src/modules/${mod}/index.js`, '// compiled module fixture');
      write(`${pluginDir(pkg, mod)}/Migration20250101000000.js`, '// marketplace fixture migration');
    }
  }
  for (const dir of providerDirs) write(`${path.dirname(dir)}/index.js`, '// compiled provider fixture');
  // Source migration parity must reject a missing individual compiled migration.
  write('packages/modules/b2c-core/src/modules/marketplace/migrations/Migration20261005190000.ts', '// source fixture');
  write(`${pluginDir('b2c-core', 'marketplace')}/Migration20261005190000.js`, '// compiled capture fixture');
  for (const name of ['archive-runtime', 'migrate-native', 'migration-plan', 'future-helper']) {
    write(`deploy/release/${name}.cjs`, `module.exports=${JSON.stringify(name)};`);
  }
  write('deploy/release/recipe.sh', '#!/bin/sh\nexit 1');
  return { source, dest, write, remove: rel => fs.rmSync(path.join(source, rel), { recursive: true, force: true }) };
}

test('archive bakes only the exact verified migrationless dirs into DEST', t => {
  const f = fixture(t);
  const result = archive(f.source, f.dest);
  for (const dir of [...migrationless.map(nativeDir), ...providerDirs]) {
    assert.deepEqual(fs.readdirSync(path.join(f.dest, dir)), [], dir);
    assert.equal(fs.existsSync(path.join(f.source, dir)), false, 'source must remain unchanged: ' + dir);
  }
  assert.equal(fs.existsSync(path.join(f.dest, nativeDir('unknown-provider'))), false);
  assert.equal(fs.existsSync(path.join(f.dest, 'apps/backend/.medusa/server/.medusa')), false);
  assert.ok(result.migrationless_directories.includes(nativeDir('event-bus-redis')));
  assert.ok(!result.migrationless_directories.includes(nativeDir('workflow-engine-redis')));
});

test('archive retains every real native/plugin migration and copies release runner/helper files', t => {
  const f = fixture(t);
  for (const name of ['migrate-native', 'migration-plan', 'future-helper']) fs.chmodSync(path.join(f.source, `deploy/release/${name}.cjs`), 0o600);
  archive(f.source, f.dest);
  for (const dir of [...persisted.map(nativeDir), ...Object.entries(plugins).flatMap(([pkg, mods]) => mods.map(mod => pluginDir(pkg, mod)))]) {
    assert.equal(fs.readFileSync(path.join(f.dest, dir, 'Migration20250101000000.js'), 'utf8'),
      fs.readFileSync(path.join(f.source, dir, 'Migration20250101000000.js'), 'utf8'));
  }
  for (const name of ['migrate-native', 'migration-plan', 'future-helper']) {
    assert.equal(fs.readFileSync(path.join(f.dest, `deploy/release/${name}.cjs`), 'utf8'), `module.exports=${JSON.stringify(name)};`);
    assert.equal(fs.statSync(path.join(f.dest, `deploy/release/${name}.cjs`)).mode & 0o777, 0o444, 'root-owned runtime helper must be non-root-readable and immutable');
    assert.equal(fs.statSync(path.join(f.source, `deploy/release/${name}.cjs`)).mode & 0o777, 0o600, 'source mode stays unchanged');
  }
  assert.equal(fs.existsSync(path.join(f.dest, 'deploy/release/recipe.sh')), false);
});

for (const [label, dir] of [
  ['native payment', nativeDir('payment')],
  ['Redis workflow engine', nativeDir('workflow-engine-redis')],
  ['local workflow engine', nativeDir('workflow-engine-inmemory')],
  ['marketplace', pluginDir('b2c-core', 'marketplace')],
  ['seller', pluginDir('b2c-core', 'seller')],
  ['commission', pluginDir('commission', 'commission')],
]) {
  test(`archive refuses missing true ${label} migrations without synthesizing them`, t => {
    const f = fixture(t); f.remove(dir);
    assert.throws(() => archive(f.source, f.dest), /migration/i);
    assert.equal(fs.existsSync(path.join(f.dest, dir)), false);
  });
}

test('archive refuses empty/metadata-only true migrations', t => {
  const f = fixture(t), dir = nativeDir('workflow-engine-redis');
  f.remove(dir); f.write(`${dir}/Migration20250101000000.d.ts`, '// not executable');
  assert.throws(() => archive(f.source, f.dest), /migration/i);
});

test('archive refuses an omitted individual source marketplace migration', t => {
  const f = fixture(t); f.remove(`${pluginDir('b2c-core', 'marketplace')}/Migration20261005190000.js`);
  assert.throws(() => archive(f.source, f.dest), /Migration20261005190000|migration/i);
});

for (const [label, manifest, version] of [
  ['native', 'node_modules/@medusajs/event-bus-redis/package.json', '2.12.0'],
  ['Mercur provider', 'packages/modules/resend/package.json', '1.6.0'],
]) {
  test(`archive refuses unverified ${label} versions instead of inventing migrationless dirs`, t => {
    const f = fixture(t);
    const pkg = JSON.parse(fs.readFileSync(path.join(f.source, manifest), 'utf8'));
    f.write(manifest, { ...pkg, version });
    assert.throws(() => archive(f.source, f.dest), /version|verified/i);
  });
}

test('archive refuses a missing migrationless package rather than fabricating it', t => {
  const f = fixture(t); f.remove('node_modules/@medusajs/event-bus-redis');
  assert.throws(() => archive(f.source, f.dest), /event-bus-redis|missing|absent/i);
});

test('archive does not follow a migrationless package symlink outside the install root', t => {
  const f = fixture(t), dir = path.join(f.source, 'node_modules/@medusajs/event-bus-redis');
  const outside = path.join(path.dirname(f.source), 'outside');
  fs.mkdirSync(path.join(outside, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'package.json'), JSON.stringify({ name: '@medusajs/event-bus-redis', version: '2.11.3' }));
  fs.writeFileSync(path.join(outside, 'dist/index.js'), 'module.exports={}');
  f.remove('node_modules/@medusajs/event-bus-redis'); fs.symlinkSync(outside, dir);
  assert.throws(() => archive(f.source, f.dest), /outside|escape|symlink/i);
  assert.equal(fs.existsSync(path.join(outside, 'dist/migrations')), false);
});

test('archive handles the verified optional migrationless Algolia module without hiding new DB models', t => {
  const f = fixture(t);
  f.write('packages/modules/algolia/package.json', { name: '@mercurjs/algolia', version: '1.5.4' });
  f.write('packages/modules/algolia/.medusa/server/src/modules/algolia/index.js', '// external search service');
  const dir = 'packages/modules/algolia/.medusa/server/src/modules/algolia/migrations';
  archive(f.source, f.dest);
  assert.deepEqual(fs.readdirSync(path.join(f.dest, dir)), []);
  assert.equal(fs.existsSync(path.join(f.source, dir)), false);
  f.write('packages/modules/algolia/.medusa/server/src/modules/algolia/models/new-model.js', '// no longer migrationless');
  assert.throws(() => archive(f.source, path.join(path.dirname(f.dest), 'with-model')), /migrationless.*models/);
});

test('archive retains existing allowlisted migrations and workspace symlinks verbatim', t => {
  const f = fixture(t), dir = nativeDir('file');
  f.write(`${dir}/Migration20250101000000.js`, '// existing migration must not be erased');
  fs.mkdirSync(path.join(f.source, 'node_modules/@mercurjs'), { recursive: true });
  fs.symlinkSync('../../packages/modules/resend', path.join(f.source, 'node_modules/@mercurjs/resend'));
  archive(f.source, f.dest);
  assert.equal(fs.readFileSync(path.join(f.dest, dir, 'Migration20250101000000.js'), 'utf8'), '// existing migration must not be erased');
  assert.equal(fs.readlinkSync(path.join(f.dest, 'node_modules/@mercurjs/resend')), '../../packages/modules/resend');
  assert.deepEqual(fs.readdirSync(path.join(f.dest, 'node_modules/@mercurjs/resend/.medusa/server/src/providers/resend/migrations')), []);
});

test('archive refuses an unreviewed newly added plugin module without real migrations', t => {
  const f = fixture(t);
  f.write('packages/modules/b2c-core/.medusa/server/src/modules/new-module/index.js', '// unknown module');
  assert.throws(() => archive(f.source, f.dest), /new-module\/migrations/);
});

test('migration directories can be scanned without writes under an unprivileged read-only contract', t => {
  const f = fixture(t); archive(f.source, f.dest);
  // chmod is confined to disposable fixtures; real non-root child also verifies EACCES.
  function readonly(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) readonly(file); else fs.chmodSync(file, 0o444);
    }
    fs.chmodSync(dir, 0o555);
  }
  readonly(f.dest); fs.chmodSync(path.dirname(f.source), 0o755);
  const dirs = [...migrationless.map(nativeDir), ...providerDirs, nativeDir('workflow-engine-redis')];
  const code = `const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
    for(const rel of ${JSON.stringify(dirs)}) fs.readdirSync(path.join(process.argv[1],rel));
    assert.throws(()=>fs.mkdirSync(path.join(process.argv[1],'should-not-write')),e=>['EACCES','EROFS'].includes(e.code));`;
  const child = spawnSync(process.execPath, ['-e', code, f.dest], {
    encoding: 'utf8', ...(process.getuid?.() === 0 ? { uid: 65534, gid: 65534 } : {}),
  });
  assert.equal(child.status, 0, child.stderr);
});

const production = {
  NODE_ENV: 'production', REDIS_URL: 'redis://offline.invalid:6379/2',
  JWT_SECRET: 'J8zP4qW9rT6xK3vN5mL2sD7fH0aB1cE4',
  COOKIE_SECRET: 'C7yR3pV8sU5wM2nQ4kL9tF6gH1bD0aE3',
};
async function config(env, loaded = {}) {
  const isolatedEnv = { ...env }, calls = [], output = { exports: {} };
  const context = vm.createContext({ Buffer, process: { env: isolatedEnv, cwd: () => '/offline/backend' }, module: output });
  const framework = new vm.SyntheticModule(['defineConfig', 'loadEnv', 'Modules'], function () {
    this.setExport('Modules', { PAYMENT: 'payment', NOTIFICATION: 'notification', EVENT_BUS: 'event_bus', WORKFLOW_ENGINE: 'workflows', LOCKING: 'locking' });
    this.setExport('loadEnv', () => { calls.push('loadEnv'); Object.assign(isolatedEnv, loaded); });
    this.setExport('defineConfig', value => { calls.push('defineConfig'); return value; });
  }, { context });
  const source = file => stripTypeScriptTypes(fs.readFileSync(path.join(root, file), 'utf8'), { mode: 'strip' });
  const module = new vm.SourceTextModule(source('apps/backend/medusa-config.ts'), { context });
  await module.link(specifier => {
    if (specifier === '@medusajs/framework/utils') return framework;
    if (specifier === './src/utils/signing-secrets') return new vm.SourceTextModule(source('apps/backend/src/utils/signing-secrets.ts'), { context });
    throw new Error('Unexpected config runtime import: ' + specifier);
  });
  try { await module.evaluate(); } catch (error) { error.configCalls = calls; throw error; }
  return { value: JSON.parse(JSON.stringify(output.exports)), env: isolatedEnv, calls };
}

test('actual config explicitly registers Redis event bus and workflow engine with native loader fields', async () => {
  const { value, env } = await config(production);
  assert.deepEqual(value.modules.filter(mod => ['event_bus', 'workflows'].includes(mod.key)), [
    { key: 'event_bus', resolve: '@medusajs/event-bus-redis', options: { redisUrl: production.REDIS_URL } },
    { key: 'workflows', resolve: '@medusajs/workflow-engine-redis', options: { redis: { url: production.REDIS_URL } } },
  ]);
  assert.equal(value.projectConfig.redisUrl, production.REDIS_URL);
  assert.deepEqual(env, production, 'config must not mutate the environment');
  assert.equal(value.modules.some(mod => mod.key === 'locking' || /locking-redis/.test(mod.resolve)), false,
    'Redis messaging/workflows must not silently change the commerce PostgreSQL lock');
});

for (const redis of [undefined, '', ' \t\n ']) {
  test(`actual production config refuses REDIS_URL=${JSON.stringify(redis)} before defineConfig`, async () => {
    await assert.rejects(config({ ...production, REDIS_URL: redis }), error => {
      assert.match(error.message, /REDIS_URL/);
      assert.deepEqual(error.configCalls, ['loadEnv']);
      return true;
    });
  });
}

test('CI is not a production Redis exemption', async () => {
  await assert.rejects(config({ ...production, CI: 'true', REDIS_URL: undefined }), /REDIS_URL/);
});

test('actual config uses REDIS_URL loaded by loadEnv and rejects an effective production mode without it', async () => {
  const { value } = await config({ ...production, REDIS_URL: undefined }, { REDIS_URL: production.REDIS_URL });
  assert.equal(value.modules.find(mod => mod.key === 'workflows').options.redis.url, production.REDIS_URL);
  await assert.rejects(config({ ...production, NODE_ENV: 'development', REDIS_URL: undefined }, { NODE_ENV: 'production' }), /REDIS_URL/);
});

for (const mode of ['development', 'test', undefined]) {
  test(`actual ${mode || 'unspecified'} config preserves local fallback without Redis`, async () => {
    const { value } = await config({ NODE_ENV: mode });
    assert.equal(value.modules.some(mod => ['event_bus', 'workflows'].includes(mod.key)), false);
    assert.equal(value.projectConfig.http.jwtSecret, 'supersecret');
  });
}

test('development with an explicit Redis URL uses the same native registration fields', async () => {
  const { value } = await config({ NODE_ENV: 'development', REDIS_URL: production.REDIS_URL });
  assert.equal(value.modules.find(mod => mod.key === 'event_bus').options.redisUrl, production.REDIS_URL);
  assert.equal(value.modules.find(mod => mod.key === 'workflows').options.redis.url, production.REDIS_URL);
});
