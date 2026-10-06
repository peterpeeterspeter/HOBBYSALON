#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const { parsePolicies, databaseOptions, buildMigrationPlan, executeMigrationPlan, assertSchemaPostconditions, TABLE_COLUMNS, INDEX_POSTCONDITIONS } = require('./migration-plan.cjs');

const COMPILED_CWD = '/app/apps/backend/.medusa/server';
const CLI = '/app/node_modules/@medusajs/cli/dist/index.js';
function assertReleaseApproval(env, readReceipt = () => fs.readFileSync('/release/source.sha256', 'utf8')) {
  if (env.RELEASE_MIGRATION_APPROVED !== 'yes') throw new Error('Migration blocked: explicit RELEASE_MIGRATION_APPROVED=yes required');
  const source = readReceipt().trim();
  if (!/^[0-9a-f]{64}$/.test(source)) throw new Error('Invalid baked source hash');
  if (env.RELEASE_MIGRATION_SOURCE_SHA256 !== source) throw new Error('Migration blocked: approved source hash must match baked image receipt');
}
function configureRuntime(env) {
  // Configstore/telemetry must not try to write into the root-owned image.
  // Never honor arbitrary caller paths for runtime config or compiled source.
  env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join('/tmp', 'medusa-release-config-'));
  env.MEDUSA_TELEMETRY_DISABLED = 'true';
  env.NODE_ENV = 'production';
  env.APP_ENV = 'production';
}
function loadNativeDependencies(directory) {
  const nativeRequire = createRequire(path.join(directory, 'medusa-config.js'));
  const { MedusaAppLoader, Migrator } = nativeRequire('@medusajs/framework');
  const { MedusaModule } = nativeRequire('@medusajs/framework/modules-sdk');
  const { initializeContainer } = nativeRequire('@medusajs/medusa/loaders/index');
  const { pgConnectionLoader } = nativeRequire('@medusajs/framework/database');
  const { getResolvedPlugins, mergePluginModules, MODULE_PACKAGE_NAMES, ContainerRegistrationKeys } = nativeRequire('@medusajs/framework/utils');
  const { LinkLoader } = nativeRequire('@medusajs/framework/links');
  const { syncLinks } = nativeRequire('@medusajs/medusa/commands/db/sync-links');
  return { MedusaAppLoader, Migrator, MedusaModule, initializeContainer, pgConnectionLoader, getResolvedPlugins, mergePluginModules, MODULE_PACKAGE_NAMES, ContainerRegistrationKeys, LinkLoader, syncLinks,
    resolveModule: (nativePath, cwd) => {
      // Local paths must already point into the compiled src archive. No
      // ts-node, workspace source, dist guessing or vendor patch fallback.
      let target = nativePath;
      if (nativePath.startsWith('./')) {
        if (!nativePath.startsWith('./src/')) throw new Error('Local modules must use compiled ./src paths');
        target = path.resolve(cwd, nativePath);
        if (!target.startsWith(path.join(cwd, 'src') + path.sep)) throw new Error('Local module escapes compiled archive');
      }
      const resolved = nativeRequire.resolve(target);
      if (!resolved.startsWith('/app/node_modules/') &&
          !(resolved.startsWith('/app/') && resolved.includes('/.medusa/server/'))) {
        throw new Error('Module resolution is outside the baked native/compiled archive');
      }
      return resolved;
    },
  };
}
async function readSchema(pgConnection, schema, tables, financial) {
  const placeholders = tables.map(() => '?').join(',');
  const columns = await pgConnection.raw(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = ? AND table_name IN (${placeholders})`, [schema, ...tables]);
  if (!financial) return { columns: columns.rows };
  const names = INDEX_POSTCONDITIONS.map((index) => index.name);
  const indexes = await pgConnection.raw(`SELECT idx.relname AS name, tbl.relname AS table_name,
    i.indisunique AS is_unique, i.indisvalid AS is_valid, i.indisready AS is_ready,
    pg_get_expr(i.indpred, i.indrelid) AS predicate,
    array_to_json(ARRAY(SELECT a.attname FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
      JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = k.attnum ORDER BY k.position)) AS columns
    FROM pg_index i JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid JOIN pg_namespace n ON n.oid = tbl.relnamespace
    WHERE n.nspname = ? AND idx.relname IN (${names.map(() => '?').join(',')})`, [schema, ...names]);
  const triggers = await pgConnection.raw(`SELECT tbl.relname AS table_name, t.tgname AS name, t.tgenabled AS enabled, p.proname AS function_name
    FROM pg_trigger t JOIN pg_class tbl ON tbl.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = ? AND NOT t.tgisinternal`, [schema]);
  return { columns: columns.rows, indexes: indexes.rows, triggers: triggers.rows };
}
function runApprovedScripts(directory, env, spawnProcess = spawn) {
  // Unlike the native db:migrate parent, verify exit code AND termination signal.
  return new Promise((resolve, reject) => {
    const child = spawnProcess(process.execPath, [CLI, 'db:migrate:scripts'], { cwd: directory, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0 && !signal) resolve();
      else reject(new Error(`Native migration scripts failed (code=${code}, signal=${signal ?? 'none'})`));
    });
  });
}
async function runNativeMigrations({ directory, env, native, runScripts = runApprovedScripts }) {
  const policies = parsePolicies(env);
  // Load native config/feature flags only, not services/providers/start hooks.
  // Set explicit schema/driver before establishing the native shared connection.
  const container = await native.initializeContainer(directory, { skipDbConnection: true });
  const keys = native.ContainerRegistrationKeys;
  const configModule = container.resolve(keys.CONFIG_MODULE);
  const logger = container.resolve(keys.LOGGER);
  const database = databaseOptions(configModule.projectConfig, env);
  configModule.projectConfig.databaseSchema = database.schema;
  configModule.projectConfig.databaseDriverOptions = { ...database.driverOptions, pool: database.pool };
  const plugins = await native.getResolvedPlugins(directory, configModule, true);
  native.mergePluginModules(configModule, plugins);
  const loader = new native.MedusaAppLoader({ container, cwd: directory });
  // This native method supplies the actual installed defaults and definitions;
  // raw input config or a handwritten list is not a complete native module set.
  const modules = loader.mergeDefaultModules(configModule.modules);
  const plan = buildMigrationPlan({ modules, database, modulePackageNames: native.MODULE_PACKAGE_NAMES, resolveModule: native.resolveModule, cwd: directory });
  let pgConnection;
  try {
    await native.pgConnectionLoader();
    pgConnection = container.resolve(keys.PG_CONNECTION);
    if (!pgConnection || typeof pgConnection.raw !== 'function') throw new Error('Native shared PostgreSQL connection is missing');
    await new native.Migrator({ container }).ensureMigrationsTable();
    const verifyTables = async (tables, financial = false) => {
      const schema = await readSchema(pgConnection, database.schema, tables, financial);
      assertSchemaPostconditions(schema, { tables, financial });
    };
    await executeMigrationPlan({
      plan, policies,
      migrateUp: (migration) => native.MedusaModule.migrateUp({ ...migration, container }),
      beforeModule: async (key) => {
        if (key === 'marketplace') await verifyTables(['order_transaction', 'payment', 'capture']);
        logger.info(`Release native migration: ${key}`);
      },
      verify: () => verifyTables(Object.keys(TABLE_COLUMNS), true),
      syncLinks: async () => {
        await new native.LinkLoader(plugins.map((plugin) => path.join(plugin.resolve, 'links')), logger).load();
        await native.syncLinks(loader, { executeAll: false, executeSafe: true, directory, container });
      },
      runScripts: () => runScripts(directory, env),
    });
    return { modules: plan.map((migration) => migration.moduleKey), schema: database.schema, policies };
  } finally {
    try { if (pgConnection) await pgConnection.destroy(); }
    finally { await container.dispose(); }
  }
}
async function main() {
  if (process.argv.length !== 2) throw new Error('Native release migration runner takes no arguments');
  assertReleaseApproval(process.env);
  parsePolicies(process.env);
  if (!process.env.DATABASE_URL) throw new Error('Explicit DATABASE_URL required');
  if (!fs.statSync(path.join(COMPILED_CWD, 'medusa-config.js')).isFile()) throw new Error('Compiled config is missing');
  configureRuntime(process.env);
  process.chdir(COMPILED_CWD);
  try {
    const result = await runNativeMigrations({ directory: COMPILED_CWD, env: process.env, native: loadNativeDependencies(COMPILED_CWD) });
    console.log(JSON.stringify({ status: 'verified', ...result }));
  } finally {
    fs.rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
  }
}
module.exports = { assertReleaseApproval, configureRuntime, loadNativeDependencies, readSchema, runApprovedScripts, runNativeMigrations };
if (require.main === module) {
  main().then(() => process.exit(0), (error) => {
    // Do not echo SQL/config/credentials from nested vendor errors.
    console.error('Release migration blocked or failed; no success receipt emitted (' + error.name + ')');
    process.exit(1);
  });
}
