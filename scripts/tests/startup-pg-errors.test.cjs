#!/usr/bin/env node
'use strict';
// OFFLINE only. Real preserved loader/factory/Knex/Tarn/pg/retry bytes; five loader imports
// and pg wire boundary are synthetic. No DB, network, app bootstrap or release acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const vm = require('node:vm');
const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');
const repo = path.resolve(__dirname, '../..');
const root = fs.realpathSync(process.argv[2] || repo); // Test-only argument, not production configuration.
const helperFile = path.join(repo, 'deploy/release/startup-pg-errors.cjs');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
assert(fs.existsSync(helperFile), 'RED: authorized startup propagation helper is missing');
const manifest = new Map(), blocked = [];
const offlineDatabaseUrl = 'postgresql://offline.invalid/offline';
function deny(obj, keys, label) {
  for (const key of keys) if (typeof obj[key] === 'function') obj[key] = function () {
    blocked.push(label + '.' + key); throw new Error('OFFLINE_BOUNDARY_DENIED');
  };
}
deny(require('node:net'), ['connect','createConnection','createServer'], 'net');
deny(require('node:net').Socket.prototype, ['connect'], 'net.Socket');
deny(require('node:net').Server.prototype, ['listen'], 'net.Server');
deny(require('node:tls'), ['connect','createServer'], 'tls');
deny(require('node:tls').TLSSocket.prototype, ['connect'], 'tls.Socket');
const dns = require('node:dns');
deny(dns, Object.keys(dns), 'dns'); deny(dns.promises, Object.keys(dns.promises), 'dns.promises');
for (const cls of [dns.Resolver,dns.promises.Resolver]) if (cls) deny(cls.prototype, Object.getOwnPropertyNames(cls.prototype), 'dns.Resolver');
deny(require('node:dgram'), ['createSocket'], 'dgram');
deny(require('node:dgram').Socket.prototype, ['bind','connect','send'], 'dgram.Socket');
for (const name of ['http','https','http2']) deny(require('node:' + name), ['request','get','connect','createServer','createSecureServer'], name);
deny(require('node:child_process'), ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'], 'child_process');
deny(require('node:worker_threads'), ['Worker'], 'worker_threads');
for (const key of ['fetch','WebSocket']) if (typeof globalThis[key] === 'function') globalThis[key] = () => { blocked.push(key); throw new Error('OFFLINE_BOUNDARY_DENIED'); };
Module.syncBuiltinESMExports();
const oldLoad = Module._load;
const loaderFile = path.join(root, 'node_modules/@medusajs/framework/dist/database/pg-connection-loader.js');
const factoryFile = path.join(root, 'node_modules/@medusajs/utils/dist/modules-sdk/create-pg-connection.js');
const req = Module.createRequire(factoryFile);
const nativeFactory = require(factoryFile);
const originalFactory = nativeFactory.createPgConnection;
const KnexClient = req('knex/lib/client.js');
const knexReq = Module.createRequire(req.resolve('knex/lib/client.js'));
const { Pool } = knexReq('tarn');
const pg = knexReq('pg');
const nativeRetry = req('../common/retry-execution.js').retryExecution;
const stringifyCircular = req('../common/stringify-circular.js').stringifyCircular;
const scenarios = new AsyncLocalStorage();
const records = [], allocated = [];
let current, guardMode, loaderModule;
const savedPg = Object.fromEntries(['connect','query','end'].map(k => [k, pg.Client.prototype[k]]));
pg.Client.prototype.connect = async function () {
  const s = scenarios.getStore(); assert(s, 'driver outside scoped diagnostic'); this._offlineCase = s;
  s.connects++; if (s.pause) await s.pause;
  const code = s.codes[s.connects - 1];
  if (code) { const e = new Error('Synthetic driver rejection'); e.code = code; s.errors.push(e); throw e; }
};
pg.Client.prototype.query = function (query, cb) {
  const s = this._offlineCase; assert(s); s.queries++;
  const text = typeof query === 'string' ? query : query.text;
  queueMicrotask(() => cb(null, { command:'SELECT', rowCount:1, rows:text === 'select version();' ? [{version:'PostgreSQL 16.0 offline'}] : [{'?column?':1}] }));
};
pg.Client.prototype.end = function (cb) { this._offlineCase.ends++; if (cb) queueMicrotask(() => cb(null)); else return Promise.resolve(); };
// Observer delegates synchronously to the actual leaf. Only test timing inputs change.
nativeFactory.createPgConnection = function (options, ...rest) {
  const s = scenarios.getStore();
  const observed = { receiver:this, options, rest };
  const db = Reflect.apply(originalFactory, this, [{...options, pool:{...options.pool,
    min:0,max:1,acquireTimeoutMillis:60,createTimeoutMillis:60,destroyTimeoutMillis:60,
    idleTimeoutMillis:60,reapIntervalMillis:10,createRetryIntervalMillis:5}}, ...rest]);
  assert(db.client instanceof KnexClient); assert(db.client.pool instanceof Pool); assert.equal(db.client.driver, pg);
  observed.db = db; observed.pool = db.client.pool; observed.propagatesAtCreation = db.client.pool.propagateCreateError;
  allocated.push(observed); if (s) { s.factories.push(observed); s.destroyCalls = 0; const destroy = db.client.destroy;
    // Native Knex exposes a readonly destroy getter. Observe its actual client delegate.
    db.client.destroy = function (...args) { s.destroyCalls++; if (s.cleanupFail) throw new Error('Synthetic cleanup failure'); if (s.cleanupHang) return new Promise(() => {}); return Reflect.apply(destroy,this,args); };
    observed.nativeDestroy = () => Reflect.apply(destroy,db.client,[]);
  }
  return db;
};
const observedFactory = nativeFactory.createPgConnection;
const utils = { ContainerRegistrationKeys:{PG_CONNECTION:'pg_connection'}, stringifyCircular };
const sdkGetter = {};
Object.defineProperty(sdkGetter,'createPgConnection',{ enumerable:true, get:() => nativeFactory.createPgConnection });
utils.ModulesSdkUtils = sdkGetter; // Getter-barrel stand-in; real full utils bootstrap explicitly NOT claimed.
utils.retryExecution = function (fn, opts) {
  const s = scenarios.getStore(); s.retryOptions = {...opts};
  return nativeRetry(async () => { s.outer++; try { return await fn(); } catch (e) { s.outerErrors.push(e); throw e; } }, opts);
};
const configManager = {};
Object.defineProperty(configManager,'config',{get:() => scenarios.getStore().config});
const imports = {
  '@medusajs/utils':utils,
  '../deps/awilix':{asValue:value => ({value})},
  '../config':{configManager},
  '../container':{container:{
    hasRegistration:() => !!scenarios.getStore().existing,
    resolve:() => scenarios.getStore().existing,
    register:(_key,value) => { const s = scenarios.getStore(); s.registrations++; s.registered = value.value; }
  }},
  '../logger':{logger:{warn:message => scenarios.getStore().warnings.push(message)}}
};
Module._load = function (request, parent, isMain) {
  const filename = Module._resolveFilename(request,parent,isMain);
  if (typeof filename === 'string' && filename.startsWith(root + path.sep) && fs.existsSync(filename) && !manifest.has(filename)) {
    manifest.set(filename,{sha256:hash(fs.readFileSync(filename)),mode:fs.statSync(filename).mode & 0o777});
  }
  if (filename === loaderFile && !require.cache[filename]) {
    const m = new Module(filename,parent); m.filename=filename; m.paths=Module._nodeModulePaths(path.dirname(filename));
    require.cache[filename]=m;
    const wrapper = new vm.Script(Module.wrap(fs.readFileSync(filename,'utf8')), {filename}).runInNewContext({
      process:{env:{__MEDUSA_DB_CONNECTION_RETRY_DELAY:'5'}} // Native default total=5 retained; diagnostic delay only.
    });
    wrapper.call(m.exports,m.exports,name => {assert(Object.hasOwn(imports,name),'Unexpected loader import'); return imports[name];},m,filename,path.dirname(filename));
    m.loaded=true; loaderModule=m; return m.exports;
  }
  if (path.isAbsolute(filename) && !filename.startsWith(root + path.sep) && filename !== helperFile) throw new Error('OFFLINE_DEPENDENCY_OUTSIDE_ROOT');
  return Reflect.apply(oldLoad,this,arguments);
};
const nativeRead = fs.readFileSync;
fs.readFileSync = function (file, ...args) {
  const value = Reflect.apply(nativeRead,this,[file,...args]);
  if (guardMode && String(file) === guardMode.file) {
    if (guardMode.kind === 'bytes') return typeof value === 'string' ? value+'\n' : Buffer.concat([value,Buffer.from('\n')]);
    const json = JSON.parse(String(value)); json.version = '0.0.0'; const text = JSON.stringify(json);
    return typeof value === 'string' ? text : Buffer.from(text);
  }
  return value;
};
function scenario(codes=[], extra={}) {
  return {codes, connects:0,queries:0,ends:0,outer:0,outerErrors:[],errors:[],warnings:[],factories:[],registrations:0,
    config:{projectConfig:{databaseUrl:offlineDatabaseUrl,databaseSchema:'public',databaseDriverOptions:{pool:{min:0,max:1,propagateCreateError:true,acquireTimeoutMillis:1}}}},...extra};
}
async function test(name, fn) { const t=performance.now(); await fn(); records.push({name,status:'PASS',duration_ms:Number((performance.now()-t).toFixed(3))}); console.log('PASS '+name); }
async function load(s) { return scenarios.run(s, () => loaderModule.exports.pgConnectionLoader()); }
(async () => {
  try {
    const helper = require(helperFile);
    await test('source/version guards fail sanitized before export mutation',async () => {
      for (const bad of [
        {kind:'bytes',file:factoryFile}, {kind:'bytes',file:loaderFile},
        {kind:'bytes',file:req.resolve('knex/lib/client.js')}, {kind:'bytes',file:knexReq.resolve('tarn/dist/Pool.js')},
        ...['@medusajs/framework','@medusajs/utils','@medusajs/deps','knex','tarn','pg'].map(name => ({kind:'version',file:path.join(root,'node_modules',name,'package.json')}))
      ]) {
        guardMode=bad; let e; try { helper.install(root); } catch (error) { e=error; }
        assert(e); assert.equal(e.message,'Startup PostgreSQL compatibility check failed');
        assert.equal(e.code,'STARTUP_PG_COMPATIBILITY'); assert.equal(e.cause,undefined);
        assert.equal(nativeFactory.createPgConnection,observedFactory); assert.equal(loaderModule,undefined);
      }
      guardMode=undefined;
      for (const bad of [null,{},'/nonexistent/secret-root']) {
        assert.throws(() => helper.install(bad), e => e.code==='STARTUP_PG_COMPATIBILITY' && e.message==='Startup PostgreSQL compatibility check failed');
      }
      assert.equal(allocated.length,0);
    });
    helper.install(root);
    const wrappedFactory = nativeFactory.createPgConnection, wrappedLoader = loaderModule.exports.pgConnectionLoader;
    await test('idempotent shared root and getter leaf wiring without startup',async () => {
      helper.install(root); helper.install(path.join(root,'.'));
      assert.equal(nativeFactory.createPgConnection,wrappedFactory); assert.equal(loaderModule.exports.pgConnectionLoader,wrappedLoader);
      assert.equal(sdkGetter.createPgConnection,wrappedFactory); assert.equal(allocated.length,0);
      assert.throws(() => { sdkGetter.createPgConnection = originalFactory; },TypeError);
    });
    await test('native five auth retries warn exact codes and retain terminal object with cleanup',async () => {
      const s=scenario(Array(5).fill('28P01')); const before=JSON.stringify(s.config); let e;
      try { await load(s); } catch (error) { e=error; }
      assert.equal(e,s.errors[4]); assert.equal(e.code,'28P01'); assert.equal(s.outer,5); assert.equal(s.connects,5);
      assert.equal(s.warnings.length,4); assert(s.warnings.every(w => w.includes('28P01')));
      assert(s.outerErrors.every((error,i) => error===s.errors[i])); assert.equal(s.registrations,0);
      assert.equal(s.destroyCalls,1); assert.equal(s.factories[0].pool.destroyed,true); assert.equal(s.factories[0].db.client.pool,undefined);
      assert.equal(s.factories[0].propagatesAtCreation,true); assert.equal(JSON.stringify(s.config),before);
      assert.equal(s.retryOptions.maxRetries,5); assert.equal(s.retryOptions.retryDelay,5);
    });
    for (const failures of [0,1,4]) await test('success after '+failures+' refused connections restores actual pool without destroy',async () => {
      const s=scenario(Array(failures).fill('ECONNREFUSED')); const before=JSON.stringify(s.config); const db=await load(s);
      assert.equal(db,s.factories[0].db); assert.equal(db,s.registered); assert.equal(s.registrations,1); assert.equal(s.outer,failures+1);
      assert.equal(s.connects,failures+1); assert.equal(s.warnings.length,failures); assert.equal(s.destroyCalls,0);
      assert.equal(db.client.pool.propagateCreateError,false); assert.equal(db.client.config.pool.propagateCreateError,false);
      assert.equal(JSON.stringify(s.config),before); await s.factories[0].nativeDestroy();
    });
    await test('outside loader synchronous factory preserves options receiver result and default false',async () => {
      const options={clientUrl:offlineDatabaseUrl,pool:{min:0,max:1}};
      const before=JSON.stringify(options), receiver={role:'diagnostic'}, sentinel={};
      const db=Reflect.apply(wrappedFactory,receiver,[options,sentinel]); const record=allocated.at(-1);
      assert.equal(db,record.db); assert.equal(typeof db.then,'undefined'); assert.equal(record.receiver,receiver);
      assert.equal(record.options,options); assert.equal(record.rest[0],sentinel); assert.equal(JSON.stringify(options),before);
      assert.equal(db.client.pool.propagateCreateError,false); await db.destroy();
    });
    await test('existing registration is returned with no factory or pool mutation',async () => {
      const options={clientUrl:offlineDatabaseUrl,pool:{min:0,max:1}};
      const db=wrappedFactory(options); const count=allocated.length; const s=scenario([],{existing:db});
      assert.equal(await load(s),db); assert.equal(allocated.length,count); assert.equal(s.outer,0); assert.equal(s.registrations,0);
      assert.equal(db.client.pool.propagateCreateError,false); await db.destroy();
    });
    await test('parallel loader contexts do not leak into unrelated factories or each other',async () => {
      let resume; const pause=new Promise(resolve => {resume=resolve;});
      const a=scenario(Array(5).fill('28P01'),{pause}), b=scenario([],{pause});
      const pa=load(a).then(() => {throw new Error('Expected rejection');},e => e), pb=load(b);
      await new Promise(resolve => setImmediate(resolve));
      const outside=wrappedFactory({pool:{min:0,max:1}}); assert.equal(outside.client.pool.propagateCreateError,false);
      assert.equal(a.factories[0].pool.propagateCreateError,true); assert.equal(b.factories[0].pool.propagateCreateError,true);
      resume(); const [error,db]=await Promise.all([pa,pb]); assert.equal(error,a.errors[4]); assert.equal(a.destroyCalls,1);
      assert.equal(b.destroyCalls,0); assert.equal(db.client.pool.propagateCreateError,false); assert.equal(db.client.pool.destroyed,false);
      await b.factories[0].nativeDestroy(); await outside.destroy();
    });
    await test('cleanup rejection cannot replace original terminal auth object',async () => {
      const s=scenario(Array(5).fill('28P01'),{cleanupFail:true}); let error; try {await load(s);} catch(e) {error=e;}
      assert.equal(error,s.errors[4]); assert.equal(s.destroyCalls,1); await s.factories[0].nativeDestroy();
    });
    await test('cleanup hangs bounded by fixed production ceiling and retains primary error',async () => {
      const s=scenario(Array(5).fill('28P01'),{cleanupHang:true}); let error; const start=performance.now();
      try {await load(s);} catch(e) {error=e;}
      assert.equal(error,s.errors[4]); assert.equal(s.destroyCalls,1); assert(performance.now()-start < 30500);
      await s.factories[0].nativeDestroy();
    });
    await test('start-only fixed preload preserves CLI arguments and exact migration branch',async () => {
      const shell=fs.readFileSync(path.join(repo,'apps/backend/entrypoint.sh'),'utf8');
      const expected='exec node --require /app/deploy/release/startup-pg-errors.cjs /app/node_modules/@medusajs/cli/dist/index.js start --types=false --host 0.0.0.0 --port "${PORT:-9000}"';
      assert(shell.includes(expected)); assert.equal(shell.split('--require').length,2);
      assert(!shell.includes('NODE_OPTIONS')); const old='exec node /app/deploy/release/migrate-native.cjs'; assert(shell.includes(old));
      assert(!fs.readFileSync(helperFile,'utf8').includes('process.env'));
    });
    await test('auto preload derives root and refuses invalid root without database invocation',async () => {
      const source=fs.readFileSync(helperFile,'utf8'); const m={exports:{},parent:{id:'internal/preload'}};
      const wrapper=new vm.Script(Module.wrap(source),{filename:helperFile}).runInThisContext();
      // Only the VM's __dirname changes: the derived root must be absent even when CI has dependencies.
      const invalidRoot=path.join(require('node:os').tmpdir(),'startup-pg-errors-missing-'+crypto.randomUUID());
      assert(!fs.existsSync(invalidRoot)); const before=allocated.length;
      assert.throws(() => wrapper.call(m.exports,m.exports,name => require(name),m,helperFile,path.join(invalidRoot,'deploy/release')),
        e => e.code==='STARTUP_PG_COMPATIBILITY' && e.message==='Startup PostgreSQL compatibility check failed' && e.cause===undefined);
      assert.equal(allocated.length,before); // No test-root or environment fallback, and no factory invocation.
    });
    await test('loaded dependency bytes and modes are unchanged; zero network attempts',async () => {
      assert.deepEqual(blocked,[]);
      for (const [file,before] of manifest) { assert.equal(hash(fs.readFileSync(file)),before.sha256); assert.equal(fs.statSync(file).mode & 0o777,before.mode); }
    });
    console.log(JSON.stringify({status:'PASS',tests:records.length,cases:records,loaded_dependency_count:manifest.size,
      loaded_dependency_manifest:[...manifest].map(([file,pin]) => ({file,...pin})),guard_attempts:blocked,
      helper_sha256:hash(fs.readFileSync(helperFile)),test_sha256:hash(fs.readFileSync(__filename)),
      limits:['Synthetic five loader imports and pg connect/query/end; no full utils getter-barrel import (getter stand-in).',
        'Actual factory/Knex/Tarn/pg/stock retry with diagnostic timing only; no DB or app bootstrap.',
        'Process-local network tripwires, not OS sandbox; no release or runtime GO.'],release_go:false,real_runtime_acceptance:false}));
  } catch(e) { console.error(e.stack); process.exitCode=1; }
  finally {
    fs.readFileSync=nativeRead; Module._load=oldLoad; Object.assign(pg.Client.prototype,savedPg);
    for (const record of allocated) if (!record.pool.destroyed) { try { await (record.nativeDestroy ? record.nativeDestroy() : record.db.destroy()); } catch (_) {} }
  }
})();
