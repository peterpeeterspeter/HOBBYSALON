import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

// Offline behavioral tests of the real helper AND the real config module.
// Run: node --experimental-vm-modules --test scripts/tests/backend-signing-secrets.test.mjs
// Framework stubs do not resolve providers, start Medusa, or access the network.
const root = new URL('../../', import.meta.url);
const configPath = new URL('apps/backend/medusa-config.ts', root);
const helperPath = new URL('apps/backend/src/utils/signing-secrets.ts', root);
const jwt = 'J8zP4qW9rT6xK3vN5mL2sD7fH0aB1cE4';
const cookie = 'C7yR3pV8sU5wM2nQ4kL9tF6gH1bD0aE3';
const valid = { NODE_ENV: 'production', JWT_SECRET: jwt, COOKIE_SECRET: cookie };
const originalEnv = { ...process.env };
const source = (path) => stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'strip' });
const plain = (value) => JSON.parse(JSON.stringify(value));

async function loadHelper() {
  const context = vm.createContext({ Buffer });
  const helper = new vm.SourceTextModule(source(helperPath), { context });
  await helper.link(() => { throw new Error('Unexpected helper dependency'); });
  await helper.evaluate();
  return helper.namespace.resolveSigningSecrets;
}

async function loadConfig(env, loaded = {}) {
  const isolatedEnv = { ...env };
  const calls = [];
  const exported = { exports: {} };
  const context = vm.createContext({
    Buffer,
    process: { env: isolatedEnv, cwd: () => '/offline/backend' },
    module: exported,
  });
  const framework = new vm.SyntheticModule(['defineConfig', 'loadEnv'], function () {
    this.setExport('loadEnv', (mode, cwd) => {
      calls.push(['loadEnv', mode, cwd]);
      Object.assign(isolatedEnv, loaded);
    });
    this.setExport('defineConfig', (config) => {
      calls.push(['defineConfig']);
      return config;
    });
  }, { context });
  const config = new vm.SourceTextModule(source(configPath), { context });
  await config.link((specifier) => {
    if (specifier === '@medusajs/framework/utils') return framework;
    if (specifier === './src/utils/signing-secrets') {
      return new vm.SourceTextModule(source(helperPath), { context });
    }
    throw new Error(`Unexpected config runtime import: ${specifier}`);
  });
  try {
    await config.evaluate();
    return { config: exported.exports, calls, env: isolatedEnv };
  } catch (error) {
    error.configCalls = calls;
    throw error;
  }
}

const invalid = [
  ['both missing', { JWT_SECRET: undefined, COOKIE_SECRET: undefined }],
  ['JWT missing', { JWT_SECRET: undefined }],
  ['cookie missing', { COOKIE_SECRET: undefined }],
  ['JWT empty', { JWT_SECRET: '' }],
  ['cookie empty', { COOKIE_SECRET: '' }],
  ['JWT whitespace only', { JWT_SECRET: ' \t\n ' }],
  ['cookie whitespace only', { COOKIE_SECRET: '\u00a0 \n' }],
  ['JWT default', { JWT_SECRET: 'supersecret' }],
  ['cookie default', { COOKIE_SECRET: 'supersecret' }],
  ['padded default', { JWT_SECRET: 'SUPERSECRET-supersecret-supersecret' }],
  ['change-me placeholder', { COOKIE_SECRET: 'change-me-change-me-change-me-change-me' }],
  ['JWT 31 bytes', { JWT_SECRET: jwt.slice(0, 31) }],
  ['cookie 31 bytes', { COOKIE_SECRET: cookie.slice(0, 31) }],
  ['JWT leading whitespace', { JWT_SECRET: ` ${jwt}` }],
  ['cookie trailing whitespace', { COOKIE_SECRET: `${cookie}\n` }],
  ['embedded whitespace', { JWT_SECRET: `${jwt.slice(0, 16)} ${jwt.slice(16)}` }],
  ['single-character repetition', { JWT_SECRET: 'x'.repeat(32) }],
  ['identical keys', { COOKIE_SECRET: jwt }],
  ['CI production missing', { CI: 'true', JWT_SECRET: undefined, COOKIE_SECRET: undefined }],
  ['CI production short', { CI: 'true', JWT_SECRET: 'short', COOKIE_SECRET: 'other' }],
];

function checkError(error, env) {
  assert.match(error.message, /JWT_SECRET|COOKIE_SECRET/);
  for (const value of [env.JWT_SECRET, env.COOKIE_SECRET]) {
    if (value && value.trim()) assert.ok(!error.message.includes(value), 'error must not disclose key values');
  }
  return true;
}

for (const [label, override] of invalid) {
  test(`actual config rejects ${label} before defineConfig`, async () => {
    const env = { ...valid, ...override };
    await assert.rejects(loadConfig(env), (error) => {
      checkError(error, env);
      assert.deepEqual(error.configCalls, [['loadEnv', 'production', '/offline/backend']]);
      return true;
    });
  });
  test(`helper rejects ${label} without environment mutation`, async () => {
    const resolve = await loadHelper();
    const env = { ...valid, ...override };
    const before = { ...env };
    assert.throws(() => resolve(Object.freeze(env)), (error) => checkError(error, env));
    assert.deepEqual(env, before);
  });
}

for (const mode of ['development', 'test']) {
  test(`actual config preserves explicit ${mode} defaults`, async () => {
    const { config } = await loadConfig({ NODE_ENV: mode });
    assert.equal(config.projectConfig.http.jwtSecret, 'supersecret');
    assert.equal(config.projectConfig.http.cookieSecret, 'supersecret');
  });
  test(`helper preserves ${mode} defaults and explicit custom values`, async () => {
    const resolve = await loadHelper();
    assert.deepEqual(plain(resolve({ NODE_ENV: mode })), { jwtSecret: 'supersecret', cookieSecret: 'supersecret' });
    assert.deepEqual(plain(resolve({ NODE_ENV: mode, JWT_SECRET: 'local-jwt', COOKIE_SECRET: 'local-cookie' })),
      { jwtSecret: 'local-jwt', cookieSecret: 'local-cookie' });
  });
}

test('actual config accepts independent production keys unchanged', async () => {
  const { config, calls, env } = await loadConfig(valid);
  assert.equal(config.projectConfig.http.jwtSecret, jwt);
  assert.equal(config.projectConfig.http.cookieSecret, cookie);
  assert.deepEqual(calls, [['loadEnv', 'production', '/offline/backend'], ['defineConfig']]);
  assert.deepEqual(env, valid);
});

test('actual config reads keys added by loadEnv before validation', async () => {
  const { config } = await loadConfig({ NODE_ENV: 'production' }, { JWT_SECRET: jwt, COOKIE_SECRET: cookie });
  assert.equal(config.projectConfig.http.jwtSecret, jwt);
  assert.equal(config.projectConfig.http.cookieSecret, cookie);
});

test('actual config rejects invalid keys added by loadEnv', async () => {
  await assert.rejects(loadConfig(valid, { JWT_SECRET: 'supersecret' }), /JWT_SECRET/);
});

test('actual config validates effective production mode after loadEnv', async () => {
  await assert.rejects(loadConfig({ NODE_ENV: 'development' }, { NODE_ENV: 'production' }), /JWT_SECRET|COOKIE_SECRET/);
});

test('actual config defaults unspecified mode to development', async () => {
  const { config, calls } = await loadConfig({});
  assert.equal(config.projectConfig.http.jwtSecret, 'supersecret');
  assert.equal(calls[0][1], 'development');
});

test('helper accepts exactly 32 UTF-8 bytes and preserves values', async () => {
  const resolve = await loadHelper();
  const ascii = jwt.slice(0, 32);
  const unicode = 'éøåçñüäöÉØÅÇÑÜÄÖ';
  assert.equal(Buffer.byteLength(unicode, 'utf8'), 32);
  assert.deepEqual(plain(resolve({ ...valid, JWT_SECRET: ascii, COOKIE_SECRET: unicode })),
    { jwtSecret: ascii, cookieSecret: unicode });
});

test('helper rejects fewer than 32 UTF-8 bytes', async () => {
  const resolve = await loadHelper();
  const tooShort = 'éøåçñüäöÉØÅÇÑÜÄ';
  assert.equal(Buffer.byteLength(tooShort, 'utf8'), 30);
  assert.throws(() => resolve({ ...valid, JWT_SECRET: tooShort }), /JWT_SECRET must contain at least 32 UTF-8 bytes/);
});

test('actual config does not allow defaults in other runtime modes', async () => {
  await assert.rejects(loadConfig({ NODE_ENV: 'staging' }), /JWT_SECRET|COOKIE_SECRET/);
});

test('host process environment remains untouched', () => {
  assert.deepEqual({ ...process.env }, originalEnv);
});
