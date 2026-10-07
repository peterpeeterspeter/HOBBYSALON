'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { classify, INDEX_SELECT, indexMismatchCodes, createCatalogWrapper, observePgQuery } = require('./index-diagnostics.cjs');
assert.equal(classify({ message: 'INDEX_INVALID_PARTITION:cat_order' }), 'INDEX_DIAG_PARTITION_INVALID');
assert.equal(classify({ code: '42501', message: 'secret-canary' }), 'INDEX_DIAG_SQL_PERMISSION');
assert.equal(classify({ message: 'secret-canary', code: 'secret-canary' }), 'INDEX_DIAG_UNKNOWN_ERROR');
assert.equal(classify({ message: 'INDEX_INVALID_PARTITION:secret-canary' }), 'INDEX_DIAG_UNKNOWN_ERROR');
(async () => {
  const canary = 'private_canary';
  const expected = { name: canary, table: 'private_table', method: 'gin', key: 'private_payload jsonb_path_ops' };
  const plan = { indexes: [expected] };
  const row = { name: canary, table_name: expected.table, method: 'gin', valid: true, ready: true, is_unique: false, key_count: 1, attribute_count: 1, no_predicate: true, no_expression: true, key: expected.key };
  const nativeError = Error(`INDEX_INVALID_INDEX:${canary}`);
  const variants = [
    ['table_name', 'wrong', 'TABLE'], ['method', 'btree', 'METHOD'], ['valid', false, 'VALID'],
    ['ready', false, 'READY'], ['is_unique', true, 'UNIQUE'], ['key_count', 2, 'KEY_COUNT'],
    ['attribute_count', 2, 'ATTRIBUTE_COUNT'], ['no_predicate', false, 'PREDICATE'],
    ['no_expression', false, 'EXPRESSION'], ['key', 'private_payload', 'KEY']
  ];
  for (const [field, value, code] of variants) {
    assert.deepEqual(indexMismatchCodes(plan, [{ ...row, [field]: value }], nativeError), [`INDEX_DIAG_INDEX_${code}_MISMATCH`]);
  }
  assert.deepEqual(indexMismatchCodes(plan, [row], nativeError), ['INDEX_DIAG_INDEX_FIELDS_MATCH']);
  assert.deepEqual(indexMismatchCodes(plan, [{ ...row, key: ' "PRIVATE_PAYLOAD"  jsonb_path_ops ' }], nativeError), ['INDEX_DIAG_INDEX_FIELDS_MATCH']);
  assert.deepEqual(indexMismatchCodes(plan, [], nativeError), ['INDEX_DIAG_INDEX_ROW_MISSING']);
  assert.deepEqual(indexMismatchCodes(undefined, [row], nativeError), ['INDEX_DIAG_INDEX_CAPTURE_UNAVAILABLE']);
  assert.deepEqual(indexMismatchCodes(plan, undefined, nativeError), ['INDEX_DIAG_INDEX_CAPTURE_UNAVAILABLE']);
  assert.deepEqual(indexMismatchCodes(plan, [row], Error('private error')), []);
  assert.deepEqual(indexMismatchCodes(plan, [{ ...row, valid: 'true', key_count: '1' }], nativeError), ['INDEX_DIAG_INDEX_VALID_MISMATCH', 'INDEX_DIAG_INDEX_KEY_COUNT_MISMATCH']);
  assert.deepEqual(indexMismatchCodes(plan, [{ ...row, key: null }], nativeError), ['INDEX_DIAG_INDEX_KEY_MISMATCH']);
  for (const success of [false, true]) {
    const messages = [], calls = [], object = {}, auth = { approved: true }, context = {}, resultObject = {};
    const queryArgs = [INDEX_SELECT, ['private_schema']];
    const capturedRows = [{ ...row, key: 'private_payload' }];
    const queryResult = Promise.resolve(capturedRows);
    let order = 0;
    const manager = { config: { get(key) { assert.equal(key, 'schema'); return 'private_schema'; } }, execute: function (...args) {
      assert.strictEqual(this, manager);
      assert.strictEqual(args[0], queryArgs[0]); assert.strictEqual(args[1], queryArgs[1]);
      calls.push(args); return queryResult;
    } };
    const executeDescriptor = Object.getOwnPropertyDescriptor(manager, 'execute');
    const catalog = { async nativePlan(schemaObject, schema) {
      assert.strictEqual(schemaObject, object); assert.equal(schema, 'private_schema'); assert.equal(order++, 0); return plan;
    }, async bootstrapNativeIndex(...args) {
      assert.strictEqual(this, context);
      assert.strictEqual(args[0], manager); assert.strictEqual(args[1], object); assert.strictEqual(args[2], auth);
      assert.equal(order++, 1);
      const returned = manager.execute(...queryArgs); assert.strictEqual(returned, queryResult);
      assert.strictEqual(await returned, capturedRows);
      if (!success) throw nativeError;
      return resultObject;
    } };
    const wrapped = createCatalogWrapper(catalog, code => messages.push(code));
    if (success) assert.strictEqual(await wrapped.call(context, manager, object, auth), resultObject);
    else await assert.rejects(wrapped.call(context, manager, object, auth), error => error === nativeError);
    assert.equal(calls.length, 1); // recorder adds zero real queries, including after failure
    assert.deepEqual(Object.getOwnPropertyDescriptor(manager, 'execute'), executeDescriptor);
    assert.deepEqual(messages, success ? ['INDEX_DIAG_CATALOG_BEGIN', 'INDEX_DIAG_CATALOG_COMPLETE'] : ['INDEX_DIAG_CATALOG_BEGIN', 'INDEX_DIAG_INDEX_KEY_MISMATCH']);
    assert.equal(JSON.stringify(messages).includes('private'), false);
  }
  // Exact SELECT only, inherited execute restoration, sync return/throw and rejected identity.
  for (const mode of ['sync', 'throw', 'reject', 'unrelated']) {
    const messages = [], privateError = Error('private error'), rejected = Promise.reject(privateError);
    rejected.catch(() => {});
    const returned = mode === 'reject' ? rejected : [row];
    const prototype = { execute(...args) { assert.strictEqual(this, manager); assert.equal(args.length, 2); if (mode === 'throw') throw privateError; return returned; } };
    const manager = Object.assign(Object.create(prototype), { config: { get: () => 'private_schema' } });
    const catalog = { nativePlan: async () => plan, bootstrapNativeIndex: async () => {
      if (mode === 'throw') assert.throws(() => manager.execute(INDEX_SELECT, []), error => error === privateError);
      else {
        const observed = manager.execute(mode === 'unrelated' ? 'SELECT private_payload FROM pg_catalog.pg_index' : INDEX_SELECT, []);
        assert.strictEqual(observed, returned);
        if (mode === 'reject') await assert.rejects(observed, error => error === privateError);
      }
      throw nativeError;
    } };
    await assert.rejects(createCatalogWrapper(catalog, code => messages.push(code))(manager, {}), error => error === nativeError);
    assert.equal(Object.hasOwn(manager, 'execute'), false);
    assert.equal(messages[1], mode === 'sync' ? 'INDEX_DIAG_INDEX_FIELDS_MATCH' : 'INDEX_DIAG_INDEX_CAPTURE_UNAVAILABLE');
  }
  // A diagnostic plan failure never skips/replaces the real bootstrap failure.
  let actualCalled = false;
  await assert.rejects(createCatalogWrapper({ nativePlan: async () => { throw Error('private plan'); }, bootstrapNativeIndex: async () => { actualCalled = true; throw nativeError; } }, () => {})({ config: { get: () => 'private_schema' }, execute() {} }, {}), error => error === nativeError);
  assert.equal(actualCalled, true);
  // PG errors remain rejected even if native code subsequently catches them.
  for (const code of ['42501', '28P01', '42601', '42P01', 'private_code']) {
    const messages = [], receiver = {}, sql = { text: 'private SQL', values: ['private payload'] };
    const error = Object.assign(Error('private error'), { code });
    const promise = Promise.reject(error);
    const query = observePgQuery(function (...args) { assert.strictEqual(this, receiver); assert.strictEqual(args[0], sql); return promise; }, c => messages.push(c));
    const returned = query.call(receiver, sql);
    assert.strictEqual(returned, promise);
    await assert.rejects(returned, e => e === error);
    assert.deepEqual(messages, [code === 'private_code' ? 'INDEX_DIAG_SQL_QUERY_ERROR' : classify(error)]);
    assert.equal(JSON.stringify(messages).includes('private'), false);
  }
  {
    const messages = [], receiver = {}, callbackThis = {}, callbackReturn = {}, queryReturn = {};
    const error = Object.assign(Error('private SQL error'), { code: '42601' });
    const query = observePgQuery(function (sql, values, callback) {
      assert.strictEqual(this, receiver); assert.equal(sql, 'private SQL'); assert.strictEqual(values, payload);
      assert.strictEqual(callback.call(callbackThis, error, queryReturn), callbackReturn); return queryReturn;
    }, code => messages.push(code));
    const payload = ['private payload'];
    assert.strictEqual(query.call(receiver, 'private SQL', payload, function (receivedError, receivedResult) {
      assert.strictEqual(this, callbackThis); assert.strictEqual(receivedError, error); assert.strictEqual(receivedResult, queryReturn); return callbackReturn;
    }), queryReturn);
    assert.deepEqual(messages, ['INDEX_DIAG_SQL_SYNTAX']);
    const throwing = observePgQuery(() => { throw error; }, code => messages.push(code));
    assert.throws(() => throwing(), e => e === error);
    assert.deepEqual(messages, ['INDEX_DIAG_SQL_SYNTAX', 'INDEX_DIAG_SQL_SYNTAX']);
    // A broken diagnostic sink must not change query success or original rejection.
    assert.equal(observePgQuery(() => 42, () => { throw Error('sink'); })(), 42);
    assert.throws(() => observePgQuery(() => { throw error; }, () => { throw Error('sink'); })(), e => e === error);
  }
  console.log('PASS: fixed index field codes, zero-query capture, native forwarding/restoration, private-value refusal, caught PG errors (offline mocks only)');
  for (const loggedError of [false, true]) {
    const messages = [];
    class Service {
      get logger_() { return { error() {} }; }
      async onApplicationStart_() { if (loggedError) this.logger_.error('native caught failure'); return 42; }
    }
    const exports = { IndexModuleService: Service };
    const Module = { _load() { return exports; }, _resolveFilename() { return '/app/node_modules/@medusajs/index/dist/services/index-module-service.js'; } };
    const fakeFs = { statSync() { return { isDirectory: () => true }; }, readdirSync() { return ['index.d.ts']; } };
    vm.runInNewContext(fs.readFileSync(__dirname + '/init-observer.cjs', 'utf8'), {
      require(n) { return n === 'node:module' ? Module : fakeFs; }, process: { pid: 7 }, console: { log(s) { messages.push(s); }, error() {} }
    });
    Module._load('native');
    if (loggedError) {
      await assert.rejects(new Service().onApplicationStart_(), { message: 'CI_INDEX_LOGGED_STARTUP_ERROR' });
      assert.equal(messages.length, 0);
    } else {
      assert.equal(await new Service().onApplicationStart_(), 42);
      assert.equal(JSON.parse(messages[0]).marker, 'CI_INDEX_INIT_COMPLETE');
      assert.equal(JSON.parse(messages[0]).kind, 'native');
    }
  }
  let barrier = false;
  await assert.rejects((async () => { barrier = true; throw Error('intentional fixture rollback'); })(), { message: 'intentional fixture rollback' });
  assert.equal(barrier, true);
  await assert.rejects(assert.rejects(Promise.reject(Error('wrong earlier failure')), { message: 'intentional fixture rollback' }));
  console.log('PASS: observer completion, caught-error refusal, exact rollback error/barrier (offline mocks only)');
})().catch(e => { console.error(e); process.exitCode = 1; });
