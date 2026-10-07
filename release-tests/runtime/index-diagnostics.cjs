'use strict';
// Harness entrypoint only: unchanged candidate main, config argv and authorization.
// Full exceptions go to captured PRIVATE stderr; public output is fixed codes only.
const Module = require('node:module');
const map = {
  MODULE_NOT_FOUND: 'INDEX_DIAG_MODULE_NOT_FOUND', EACCES: 'INDEX_DIAG_EACCES',
  ENOENT: 'INDEX_DIAG_ENOENT', EROFS: 'INDEX_DIAG_EROFS',
  '42501': 'INDEX_DIAG_SQL_PERMISSION', '28P01': 'INDEX_DIAG_SQL_AUTH',
  '42601': 'INDEX_DIAG_SQL_SYNTAX', '42P01': 'INDEX_DIAG_SQL_UNDEFINED_TABLE'
};
function classify(error) {
  if (Object.hasOwn(map, error?.code)) return map[error.code];
  const message = typeof error?.message === 'string' ? error.message : '';
  const exact = {
    CI_EGRESS_DENIED: 'INDEX_DIAG_EGRESS_DENIED', CI_UNIX_SOCKET_DENIED: 'INDEX_DIAG_UNIX_SOCKET_DENIED',
    INDEX_EMPTY_OR_UNSUPPORTED_NATIVE_PLAN: 'INDEX_DIAG_PLAN_UNSUPPORTED',
    INDEX_UNSUPPORTED_NATIVE_FUNCTION: 'INDEX_DIAG_PLAN_UNSUPPORTED',
    INDEX_SCHEMA_SEARCH_PATH_MISMATCH: 'INDEX_DIAG_SCHEMA_MISMATCH',
    INDEX_INVALID_COUNT_ESTIMATE: 'INDEX_DIAG_FUNCTION_INVALID',
    INDEX_MIGRATOR_ROLE_OR_SCHEMA_MISMATCH: 'INDEX_DIAG_ROLE_MISMATCH'
  };
  if (Object.hasOwn(exact, message)) return exact[message];
  if (/^INDEX_INVALID_PARTITION:[A-Za-z_][A-Za-z0-9_]*$/.test(message)) return 'INDEX_DIAG_PARTITION_INVALID';
  if (/^INDEX_INVALID_INDEX:[A-Za-z_][A-Za-z0-9_]*$/.test(message)) return 'INDEX_DIAG_INDEX_INVALID';
  return 'INDEX_DIAG_UNKNOWN_ERROR';
}
// Match ONLY the existing candidate index SELECT. Never issue diagnostic SQL.
const INDEX_SELECT = `SELECT i.relname AS name, t.relname AS table_name, am.amname AS method,
    x.indisvalid AS valid, x.indisready AS ready, x.indisunique AS is_unique, x.indnkeyatts AS key_count,
    x.indnatts AS attribute_count, x.indpred IS NULL AS no_predicate, x.indexprs IS NULL AS no_expression,
    pg_catalog.pg_get_indexdef(i.oid, 1, true) AS key
    FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
    JOIN pg_catalog.pg_class t ON t.oid=x.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_catalog.pg_am am ON am.oid=i.relam WHERE n.nspname=?`;
const normalizeSelect = text => typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
const compact = text => text.replace(/[\s"]/g, '').toLowerCase();
const INDEX_FIELDS = ['name', 'table_name', 'method', 'valid', 'ready', 'is_unique', 'key_count', 'attribute_count', 'no_predicate', 'no_expression', 'key'];
// Diagnostic failures cannot replace native results/errors. No private values are emitted.
function quietly(action) { try { action(); } catch { /* observation only */ } }
function observeResult(result, fulfilled, rejected) {
  if (result && typeof result.then === 'function') {
    // Return neither this side branch nor a transformed promise to the caller.
    result.then(value => quietly(() => fulfilled(value)), error => quietly(() => rejected(error)));
  } else quietly(() => fulfilled(result));
}
function indexMismatchCodes(plan, rows, error) {
  const match = /^INDEX_INVALID_INDEX:([A-Za-z_][A-Za-z0-9_]*)$/.exec(error?.message || '');
  if (!match) return [];
  const expected = plan?.indexes?.find(index => index.name === match[1]);
  if (!expected || !Array.isArray(rows)) return ['INDEX_DIAG_INDEX_CAPTURE_UNAVAILABLE'];
  const row = rows.find(index => index.name === expected.name);
  if (!row) return ['INDEX_DIAG_INDEX_ROW_MISSING'];
  // Mirror the candidate's strict comparisons, including its compact key comparison.
  // Code presence is a boolean mismatch signal; identities and compared values stay private.
  const mismatch = {
    TABLE: row.table_name !== expected.table,
    METHOD: row.method !== expected.method,
    VALID: row.valid !== true,
    READY: row.ready !== true,
    UNIQUE: row.is_unique !== false,
    KEY_COUNT: row.key_count !== 1,
    ATTRIBUTE_COUNT: row.attribute_count !== 1,
    PREDICATE: row.no_predicate !== true,
    EXPRESSION: row.no_expression !== true,
    KEY: typeof row.key !== 'string' || typeof expected.key !== 'string' || compact(row.key) !== compact(expected.key)
  };
  const codes = Object.entries(mismatch).filter(([, failed]) => failed).map(([field]) => `INDEX_DIAG_INDEX_${field}_MISMATCH`);
  return codes.length ? codes : ['INDEX_DIAG_INDEX_FIELDS_MATCH'];
}
function createCatalogWrapper(catalog, emit) {
  const original = catalog.bootstrapNativeIndex;
  return async function (...args) {
    emit('INDEX_DIAG_CATALOG_BEGIN');
    const manager = args[0];
    let plan, rows, restore;
    try {
      // nativePlan captures native DDL in memory, using the SAME schema object/schema;
      // its manager is a recorder, never the real manager. No additional DB call/DDL.
      try { plan = await catalog.nativePlan(args[1], manager.config.get('schema')); }
      catch { /* Native bootstrap still runs unchanged and owns its failure. */ }
      quietly(() => {
        const descriptor = Object.getOwnPropertyDescriptor(manager, 'execute');
        const execute = manager.execute;
        manager.execute = function (...executeArgs) {
          const result = Reflect.apply(execute, this, executeArgs);
          if (normalizeSelect(executeArgs[0]) === normalizeSelect(INDEX_SELECT)) {
            quietly(() => observeResult(result, value => {
              if (Array.isArray(value)) rows = value.map(row => Object.fromEntries(INDEX_FIELDS.map(field => [field, row[field]])));
            }, () => {}));
          }
          return result; // identical sync value/promise, this, arguments and rejection
        };
        restore = () => { if (descriptor) Object.defineProperty(manager, 'execute', descriptor); else delete manager.execute; };
      });
      const result = await Reflect.apply(original, this, args);
      emit('INDEX_DIAG_CATALOG_COMPLETE');
      return result;
    } catch (error) {
      quietly(() => { for (const code of indexMismatchCodes(plan, rows, error)) emit(code); });
      throw error; // original error identity; never convert failure into success
    } finally {
      if (restore) restore();
      plan = undefined; rows = undefined;
    }
  };
}
function observePgQuery(original, emit) {
  const report = error => quietly(() => {
    const code = classify(error);
    emit(code.startsWith('INDEX_DIAG_SQL_') ? code : 'INDEX_DIAG_SQL_QUERY_ERROR');
  });
  return function (...args) {
    // pg promise and callback APIs: native createPartitions may catch either error.
    // Callback receives its original receiver/arguments/result; input objects untouched.
    const callback = args[args.length - 1];
    if (typeof callback === 'function') args[args.length - 1] = function (...callbackArgs) {
      if (callbackArgs[0]) report(callbackArgs[0]);
      return Reflect.apply(callback, this, callbackArgs);
    };
    let result;
    try { result = Reflect.apply(original, this, args); }
    catch (error) { report(error); throw error; }
    quietly(() => observeResult(result, () => {}, report));
    return result;
  };
}
async function main() {
  const emit = code => console.log(JSON.stringify({ marker: 'CI_RUNTIME_DIAGNOSTIC', code }));
  const load = Module._load, seen = new WeakSet();
  Module._load = function (request, parent, isMain) {
    const value = load.apply(this, arguments);
    let filename;
    try { filename = Module._resolveFilename(request, parent); } catch { return value; }
    if (filename === '/app/apps/backend/.medusa/server/medusa-config.js') emit('INDEX_DIAG_CONFIG_IMPORTED');
    if (filename.endsWith('/index-runtime-readonly/catalog.js') && !seen.has(value)) {
      seen.add(value); emit('INDEX_DIAG_CATALOG_IMPORTED');
      value.bootstrapNativeIndex = createCatalogWrapper(value, emit);
    }
    if (filename.endsWith('/@medusajs/index/dist/utils/index.js') && !seen.has(value)) {
      seen.add(value); const original = value.buildSchemaObjectRepresentation;
      // SDK re-exports may be getter-only: wrap the source export instead below.
      if (Object.getOwnPropertyDescriptor(value, 'buildSchemaObjectRepresentation')?.writable) {
        value.buildSchemaObjectRepresentation = function (...args) {
          const result = original.apply(this, args); emit('INDEX_DIAG_SCHEMA_COMPLETE'); return result;
        };
      }
    }
    if (filename.endsWith('/build-schema-object-representation.js') && !seen.has(value)) {
      seen.add(value); const original = value.buildSchemaObjectRepresentation;
      value.buildSchemaObjectRepresentation = function (...args) {
        const result = original.apply(this, args); emit('INDEX_DIAG_SCHEMA_COMPLETE'); return result;
      };
    }
    if (request === 'pg' && value.Client && !seen.has(value.Client)) {
      seen.add(value.Client); const original = value.Client.prototype.connect;
      value.Client.prototype.connect = async function (...args) {
        emit('INDEX_DIAG_PG_CONNECT_BEGIN');
        const result = await original.apply(this, args);
        emit('INDEX_DIAG_PG_CONNECT_COMPLETE'); return result;
      };
      value.Client.prototype.query = observePgQuery(value.Client.prototype.query, emit);
    }
    return value;
  };
  emit('INDEX_DIAG_ENTRY');
  try {
    await require('/app/deploy/release/index-bootstrap.cjs').main();
    emit('INDEX_DIAG_OK');
  } catch (error) {
    emit(classify(error));
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  } finally { Module._load = load; }
}
module.exports = { classify, main, INDEX_SELECT, indexMismatchCodes, createCatalogWrapper, observePgQuery };
if (require.main === module) main().catch(error => { console.error(error?.stack || String(error)); process.exitCode = 1; });