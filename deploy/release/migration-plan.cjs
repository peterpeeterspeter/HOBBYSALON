'use strict';

// Pure planning: consume native merged configuration, never reconstruct defaults.
const REQUIRED_MODULES = ['order', 'payment', 'notification', 'marketplace', 'split_order_payment', 'payout', 'order_return'];
const TABLE_COLUMNS = Object.freeze({
  order_transaction: ['order_id', 'reference', 'reference_id'],
  payment: ['id', 'payment_collection_id'],
  capture: ['id', 'payment_id'],
  notification: ['id', 'idempotency_key', 'status'],
  marketplace_capture_tail: ['payment_id', 'cart_id', 'capture_id', 'snapshot', 'event_id', 'accounting_at', 'event_enqueued_at', 'completed_at', 'attempts', 'last_attempt_at', 'last_error'],
  refund_settlement: ['operation_id', 'order_id', 'scope_id', 'fingerprint', 'plan', 'phase', 'reversal_receipt_id'],
  payout_execution: ['order_id', 'scope_id', 'plan', 'phase', 'payout_id', 'transfer_id'],
  native_return_execution: ['request_id', 'order_id', 'fingerprint', 'plan', 'phase', 'native_return_id', 'order_change_id'],
});
const INDEX_POSTCONDITIONS = Object.freeze([
  { name: 'IDX_notification_idempotency_key_unique', table: 'notification', columns: ['idempotency_key'], unique: true, predicate: 'deleted_at IS NULL' },
  { name: 'marketplace_order_capture_once', table: 'order_transaction', columns: ['order_id', 'reference_id'], unique: true, predicate: "reference = 'capture' AND reference_id IS NOT NULL" },
  { name: 'marketplace_payment_full_capture_once', table: 'capture', columns: ['payment_id'], unique: true, predicate: null },
  { name: 'marketplace_capture_tail_pending', table: 'marketplace_capture_tail', columns: ['last_attempt_at', 'created_at'], unique: false, predicate: 'completed_at IS NULL' },
  { name: 'refund_settlement_unfinished_scope', table: 'refund_settlement', columns: ['scope_id'], unique: true, predicate: "phase <> 'completed'" },
  { name: 'payout_execution_unfinished_scope', table: 'payout_execution', columns: ['scope_id'], unique: true, predicate: "phase = 'started'" },
  { name: 'native_return_execution_unfinished_order', table: 'native_return_execution', columns: ['order_id'], unique: true, predicate: "phase <> 'confirmed'" },
]);
const TRIGGER_POSTCONDITIONS = Object.freeze([
  ['marketplace_capture_tail', 'marketplace_capture_tail_immutable', 'marketplace_capture_tail_immutable'],
  ['refund_settlement', 'refund_settlement_guard_trigger', 'refund_settlement_guard'],
  ['payout_execution', 'payout_execution_guard', 'payout_execution_guard'],
  ['payout_execution', 'payout_execution_no_truncate', 'payout_execution_guard'],
  ['native_return_execution', 'native_return_execution_guard', 'guard_native_return_execution'],
  ['native_return_execution', 'native_return_execution_no_truncate', 'guard_native_return_execution'],
]);

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function parsePolicies(env) {
  const links = env.RELEASE_MIGRATE_LINKS ?? 'skip';
  const scripts = env.RELEASE_MIGRATE_SCRIPTS ?? 'skip';
  if (!['skip', 'safe'].includes(links)) throw new Error('Only skip or safe link policy is permitted');
  if (!['skip', 'approved'].includes(scripts)) throw new Error('Only skip or approved script policy is permitted');
  if (scripts === 'approved' && env.RELEASE_MIGRATION_SCRIPTS_APPROVED !== 'yes') {
    throw new Error('Migration scripts require separate RELEASE_MIGRATION_SCRIPTS_APPROVED=yes');
  }
  return { links, scripts };
}
function databaseOptions(projectConfig, env) {
  if (!isRecord(projectConfig)) throw new Error('Native project configuration is missing');
  if (!env.DATABASE_URL || projectConfig.databaseUrl !== env.DATABASE_URL) {
    throw new Error('Explicit DATABASE_URL must match the native project configuration');
  }
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Invalid DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error('DATABASE_URL must name a PostgreSQL database');
  }
  const schema = projectConfig.databaseSchema ?? env.DATABASE_SCHEMA ?? 'public';
  if (typeof schema !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error('Invalid database schema');
  if (env.DATABASE_SCHEMA && env.DATABASE_SCHEMA !== schema) throw new Error('Database schema approval does not match native configuration');
  const configuredDriver = projectConfig.databaseDriverOptions ?? {};
  if (!isRecord(configuredDriver) || (configuredDriver.connection !== undefined && !isRecord(configuredDriver.connection))) {
    throw new Error('Invalid native database driver options');
  }
  // Native pgConnectionLoader defaults SSL to false; do not let loadDatabaseConfig
  // silently replace it with its remote-host SSL heuristic during module migration.
  const { pool = {}, ...driver } = configuredDriver;
  if (!isRecord(pool)) throw new Error('Invalid native database pool');
  const ssl = driver.ssl ?? driver.connection?.ssl ?? false;
  if (env.DATABASE_SSL === 'false' && ssl !== false) throw new Error('DATABASE_SSL=false conflicts with native driver options');
  return {
    clientUrl: env.DATABASE_URL, schema,
    driverOptions: { ...driver, connection: { ...driver.connection, ssl } },
    pool: { ...pool }, debug: projectConfig.databaseLogging ?? false,
    database: projectConfig.databaseName,
  };
}
function buildMigrationPlan({ modules, database, modulePackageNames, resolveModule, cwd }) {
  if (!isRecord(modules) || !isRecord(database) || typeof resolveModule !== 'function') throw new Error('Native merged modules and database are required');
  const entries = new Map();
  for (const [moduleKey, declaration] of Object.entries(modules)) {
    if (declaration === false || declaration?.disable === true) continue;
    if (moduleKey === 'link_modules' || moduleKey === 'remoteLink' || moduleKey === '@medusajs/link-modules') continue;
    if (!isRecord(declaration)) throw new Error(`Invalid merged declaration: ${moduleKey}`);
    if ((declaration.scope ?? 'internal') !== 'internal') throw new Error(`External migration is not supported: ${moduleKey}`);
    if (declaration.options !== undefined && !isRecord(declaration.options)) throw new Error(`Invalid module options: ${moduleKey}`);
    const options = { ...declaration.options };
    if (options.database !== undefined && !isRecord(options.database)) throw new Error(`Invalid module database: ${moduleKey}`);
    const ownDatabase = options.database ?? {};
    if (ownDatabase.driverOptions !== undefined && (!isRecord(ownDatabase.driverOptions) ||
        (ownDatabase.driverOptions.connection !== undefined && !isRecord(ownDatabase.driverOptions.connection)))) {
      throw new Error(`Invalid module database driver options: ${moduleKey}`);
    }
    const ownConnection = ownDatabase.driverOptions?.connection ?? {};
    if (['host', 'port', 'user', 'password', 'database', 'connectionString', 'searchPath'].some((key) => ownConnection[key] !== undefined)) {
      throw new Error(`Module driver must not override approved database/schema: ${moduleKey}`);
    }
    const ownSSL = ownDatabase.driverOptions?.ssl ?? ownConnection.ssl;
    const sharedSSL = database.driverOptions.connection.ssl;
    if (ownSSL !== undefined && JSON.stringify(ownSSL) !== JSON.stringify(sharedSSL)) {
      throw new Error(`Module driver conflicts with approved SSL policy: ${moduleKey}`);
    }
    if (ownDatabase.connection || ownDatabase.host || ownDatabase.user || ownDatabase.password || ownDatabase.port ||
        (ownDatabase.clientUrl !== undefined && ownDatabase.clientUrl !== database.clientUrl) ||
        (ownDatabase.schema !== undefined && ownDatabase.schema !== database.schema) ||
        (ownDatabase.database !== undefined && ownDatabase.database !== database.database)) {
      throw new Error(`Module must use the approved shared database/schema: ${moduleKey}`);
    }
    options.database = { ...database, ...ownDatabase,
      clientUrl: database.clientUrl, schema: database.schema,
      driverOptions: { ...database.driverOptions, ...ownDatabase.driverOptions,
        connection: { ...database.driverOptions.connection, ...ownConnection, ssl: ownSSL ?? sharedSSL },
      },
      pool: ownDatabase.pool ?? database.pool,
    };
    const moduleExports = isRecord(declaration.resolve) ? declaration.resolve : undefined;
    const nativePath = typeof declaration.resolve === 'string' ? declaration.resolve : modulePackageNames[moduleKey];
    if (!nativePath) throw new Error(`Missing native resolution path: ${moduleKey}`);
    const modulePath = resolveModule(nativePath, cwd);
    if (typeof modulePath !== 'string' || !modulePath.endsWith('.js')) throw new Error(`Only compiled native modules may migrate: ${moduleKey}`);
    const configuredDependencies = declaration.dependencies ?? [];
    const nativeDependencies = declaration.definition?.dependencies ?? [];
    if (![configuredDependencies, nativeDependencies].every((value) => Array.isArray(value) && value.every((dependency) => typeof dependency === 'string'))) throw new Error(`Invalid module dependencies: ${moduleKey}`);
    const dependencies = [...new Set([...nativeDependencies, ...configuredDependencies])];
    entries.set(moduleKey, { moduleKey, modulePath, moduleExports, options, cwd, dependencies });
  }
  for (const key of REQUIRED_MODULES) if (!entries.has(key)) throw new Error(`Required release module absent or disabled: ${key}`);
  // Stable topological order, including the cross-module SQL dependency that
  // Medusa's service dependency graph does not describe.
  entries.get('marketplace').dependencies = [...entries.get('marketplace').dependencies, 'order', 'payment'];
  const visiting = new Set(); const visited = new Set(); const plan = [];
  function visit(key) {
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error(`Cyclic migration dependency: ${key}`);
    visiting.add(key);
    for (const dependency of entries.get(key).dependencies) {
      if (entries.has(dependency)) visit(dependency);
      else if (Object.hasOwn(modules, dependency)) throw new Error(`Disabled migration dependency: ${dependency}`);
    }
    visiting.delete(key); visited.add(key);
    const { dependencies, ...migration } = entries.get(key);
    plan.push(migration);
  }
  for (const key of ['order', 'payment', ...entries.keys()]) visit(key);
  return plan;
}
async function executeMigrationPlan({ plan, migrateUp, beforeModule = async () => {}, afterModule = async () => {}, verify, syncLinks, runScripts, policies }) {
  if (!Array.isArray(plan) || !plan.length || typeof migrateUp !== 'function' || typeof verify !== 'function') throw new Error('Migration execution requires a plan and schema postconditions');
  if (!policies || !['skip', 'safe'].includes(policies.links) || !['skip', 'approved'].includes(policies.scripts)) throw new Error('Invalid migration policies');
  if (policies.links === 'safe' && typeof syncLinks !== 'function') throw new Error('Safe link executor is missing');
  if (policies.scripts === 'approved' && typeof runScripts !== 'function') throw new Error('Approved script executor is missing');
  for (const migration of plan) {
    await beforeModule(migration.moduleKey);
    try { await migrateUp(migration); } catch (cause) { throw new Error(`Native migration failed: ${migration.moduleKey}`, { cause }); }
    await afterModule(migration.moduleKey);
  }
  // Schema failure must prevent links/scripts as well as a success receipt.
  await verify();
  if (policies.links === 'safe') await syncLinks();
  if (policies.scripts === 'approved') await runScripts();
  if (policies.links === 'safe' || policies.scripts === 'approved') await verify();
}
function normalizePredicate(value) {
  return value == null ? null : value.replace(/::(?:text|character varying)/g, '').replace(/[()"\s]/g, '').toLowerCase();
}
function assertSchemaPostconditions({ columns, indexes, triggers }, { tables = Object.keys(TABLE_COLUMNS), financial = true } = {}) {
  if (!Array.isArray(columns)) throw new Error('Invalid schema column response');
  for (const table of tables) for (const column of TABLE_COLUMNS[table]) {
    if (!columns.some((row) => row.table_name === table && row.column_name === column)) throw new Error(`Schema postcondition missing column: ${table}.${column}`);
  }
  if (!financial) return;
  if (!Array.isArray(indexes) || !Array.isArray(triggers)) throw new Error('Invalid schema integrity response');
  for (const expected of INDEX_POSTCONDITIONS) {
    const actual = indexes.find((row) => row.name === expected.name);
    if (!actual || actual.table_name !== expected.table || actual.is_unique !== expected.unique || actual.is_valid !== true || actual.is_ready !== true ||
        JSON.stringify(actual.columns) !== JSON.stringify(expected.columns) || normalizePredicate(actual.predicate) !== normalizePredicate(expected.predicate)) {
      throw new Error(`Schema postcondition invalid index: ${expected.name}`);
    }
  }
  for (const [table, name, func] of TRIGGER_POSTCONDITIONS) {
    if (!triggers.some((row) => row.table_name === table && row.name === name && row.function_name === func && ['O', 'A'].includes(row.enabled))) {
      throw new Error(`Schema postcondition missing enabled trigger: ${name}`);
    }
  }
}
module.exports = { REQUIRED_MODULES, TABLE_COLUMNS, INDEX_POSTCONDITIONS, TRIGGER_POSTCONDITIONS, parsePolicies, databaseOptions, buildMigrationPlan, executeMigrationPlan, assertSchemaPostconditions };
