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
      const original = value.bootstrapNativeIndex;
      value.bootstrapNativeIndex = async function (...args) {
        emit('INDEX_DIAG_CATALOG_BEGIN');
        const result = await original.apply(this, args);
        emit('INDEX_DIAG_CATALOG_COMPLETE'); return result;
      };
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
module.exports = { classify, main };
if (require.main === module) main().catch(error => { console.error(error?.stack || String(error)); process.exitCode = 1; });