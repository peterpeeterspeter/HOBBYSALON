'use strict';
// Startup-only leaf wrappers. Never alter dependency files, native retry policy,
// user config, or factories outside the framework pgConnectionLoader context.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const installed = new Map();
const identities = new WeakMap();
const CLEANUP_CEILING_MS = 30000;
const pins = Object.freeze({
  '@medusajs/utils/dist/modules-sdk/create-pg-connection.js': 'b111a05994837ef00e9b85fe9b891cacca7301849478db1f71b2c85d083b849d',
  '@medusajs/framework/dist/database/pg-connection-loader.js': '4985a959a8bc6428bd150bbfee3586181ab5809ed42c77b037b70c5a42420829',
  'knex/lib/client.js': '1f8b50b8b3902ece3303bba7afdb0d801b5d0a2a581ee2f3c2e0508ad2b1993e',
  'tarn/dist/Pool.js': '50702f8c2d30a5842ffba55cb8bb5521f361f4ac550b9ce79352616082dc5fdc'
});
function compatibilityError() {
  const error = new Error('Startup PostgreSQL compatibility check failed');
  error.code = 'STARTUP_PG_COMPATIBILITY';
  return error;
}
function install(inputRoot) {
  let root, files, factory, loader;
  // All source, version, resolution and descriptor checks precede export writes.
  // Any failure has a fixed message and no cause (paths/URLs/secrets stay private).
  try {
    if (typeof inputRoot !== 'string' || !path.isAbsolute(inputRoot)) throw new Error();
    root = fs.realpathSync(inputRoot);
    const modules = path.join(root, 'node_modules');
    function contained(file) {
      const actual = fs.realpathSync(file);
      if (!actual.startsWith(modules + path.sep) || !fs.statSync(actual).isFile()) throw new Error();
      return actual;
    }
    files = {};
    for (const [rel, expected] of Object.entries(pins)) {
      const file = contained(path.join(modules, rel));
      // Do not silently select a different nested or symlinked leaf.
      if (file !== path.join(modules, rel)) throw new Error();
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (actual !== expected) throw new Error();
      files[rel] = file;
    }
    for (const [name, version] of Object.entries({
      '@medusajs/framework':'2.11.3', '@medusajs/utils':'2.11.3', '@medusajs/deps':'2.11.3',
      knex:'3.1.0', tarn:'3.0.2', pg:'8.17.1'
    })) {
      const file = contained(path.join(modules, name, 'package.json'));
      if (file !== path.join(modules, name, 'package.json')) throw new Error();
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (pkg.name !== name || pkg.version !== version) throw new Error();
    }
    const factoryFile = files['@medusajs/utils/dist/modules-sdk/create-pg-connection.js'];
    const loaderFile = files['@medusajs/framework/dist/database/pg-connection-loader.js'];
    const factoryRequire = createRequire(factoryFile);
    const knexRequire = createRequire(files['knex/lib/client.js']);
    const depsEntry = contained(factoryRequire.resolve('@medusajs/deps/mikro-orm/postgresql'));
    const depsRequire = createRequire(depsEntry);
    const knexEntry = contained(knexRequire.resolve('knex'));
    if (contained(depsRequire.resolve('knex')) !== knexEntry ||
        contained(factoryRequire.resolve('knex/lib/client.js')) !== files['knex/lib/client.js'] ||
        contained(knexRequire.resolve('tarn/dist/Pool.js')) !== files['tarn/dist/Pool.js'] ||
        !contained(knexRequire.resolve('pg')).startsWith(path.join(modules,'pg') + path.sep)) throw new Error();
    factory = require(factoryFile);
    loader = require(loaderFile);
    for (const [obj, key] of [[factory,'createPgConnection'],[loader,'pgConnectionLoader']]) {
      const descriptor = Object.getOwnPropertyDescriptor(obj,key);
      if (!descriptor || !descriptor.writable || typeof descriptor.value !== 'function') throw new Error();
    }
    const previous = installed.get(root) || identities.get(loader);
    if (previous) {
      if (previous.root !== root || previous.factory !== factory ||
          factory.createPgConnection !== previous.factoryWrapper || loader.pgConnectionLoader !== previous.loaderWrapper) throw new Error();
      return;
    }
  } catch (_) { throw compatibilityError(); }

  const scope = new AsyncLocalStorage();
  const nativeFactory = factory.createPgConnection;
  const nativeLoader = loader.pgConnectionLoader;
  function factoryWrapper(options, ...rest) {
    const state = scope.getStore();
    if (!state?.active) return Reflect.apply(nativeFactory, this, [options, ...rest]);
    const connection = Reflect.apply(nativeFactory, this, [{
      ...options, pool: { ...options?.pool, propagateCreateError: true }
    }, ...rest]);
    state.connections.add(connection);
    return connection; // Synchronous, exact native Knex object (not a Promise/proxy).
  }
  function restore(state) {
    for (const connection of state.connections) {
      if (connection.client.pool) connection.client.pool.propagateCreateError = false;
      if (connection.client.config.pool) connection.client.config.pool.propagateCreateError = false;
    }
  }
  async function cleanup(state) {
    let timer;
    // One total ceiling, not 30 seconds per pool. Rejections are consumed even
    // after timeout; they must never replace the loader's primary error object.
    try {
      await Promise.race([
        Promise.all([...state.connections].map(connection =>
          Promise.resolve().then(() => connection.destroy()).catch(() => undefined))),
        new Promise(resolve => { timer = setTimeout(resolve, CLEANUP_CEILING_MS); })
      ]);
    } finally { clearTimeout(timer); }
  }
  function loaderWrapper(...args) {
    const state = { active: true, connections: new Set() };
    return scope.run(state, async () => {
      try {
        const result = await Reflect.apply(nativeLoader, this, args);
        state.active = false;
        restore(state);
        return result;
      } catch (error) {
        state.active = false;
        try { await cleanup(state); } catch (_) { /* retain native primary error */ }
        try { restore(state); } catch (_) { /* retain native primary error */ }
        throw error;
      } finally { state.active = false; }
    });
  }
  factory.createPgConnection = factoryWrapper;
  loader.pgConnectionLoader = loaderWrapper;
  const record = { root, factory, factoryWrapper, loaderWrapper };
  installed.set(root, record);
  identities.set(loader, record);
}
module.exports = { install };
// Only Node's fixed --require preload installs automatically; a test import is inert.
if (module.parent?.id === 'internal/preload') install(path.resolve(__dirname, '../..'));
