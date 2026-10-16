'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const { REQUIRED_MODULES, TABLE_COLUMNS, INDEX_POSTCONDITIONS, TRIGGER_POSTCONDITIONS, parsePolicies, databaseOptions, buildMigrationPlan, executeMigrationPlan, assertSchemaPostconditions } = require('../../deploy/release/migration-plan.cjs');
const { assertReleaseApproval, configureRuntime, readSchema, runApprovedScripts, runNativeMigrations } = require('../../deploy/release/migrate-native.cjs');

const env = { DATABASE_URL: 'postgres://fixture:fixture@offline-postgres/release', DATABASE_SSL: 'false' };
const database = databaseOptions({ databaseUrl: env.DATABASE_URL }, env);
const cwd = '/compiled/server';
const resolveModule = (name) => name.startsWith('./src/') ? `${cwd}/${name.slice(2)}/index.js` : `/native/${name}/index.js`;
const fixtures = () => ({
  marketplace: { resolve: '@fixture/marketplace', options: { plugin_option: true } },
  ...Object.fromEntries(REQUIRED_MODULES.filter((key) => key !== 'marketplace').map((key) => [key, { resolve: `@fixture/${key}` }])),
});
const planFor = (modules = fixtures(), extra = {}) => buildMigrationPlan({ modules, database, modulePackageNames: {}, resolveModule, cwd, ...extra });
const validSchema = () => ({
  columns: Object.entries(TABLE_COLUMNS).flatMap(([table_name, columns]) => columns.map((column_name) => ({ table_name, column_name }))),
  indexes: INDEX_POSTCONDITIONS.map((index) => ({ name: index.name, table_name: index.table, columns: index.columns, is_unique: index.unique, is_valid: true, is_ready: true, predicate: index.predicate })),
  triggers: TRIGGER_POSTCONDITIONS.map(([table_name, name, function_name]) => ({ table_name, name, function_name, enabled: 'O' })),
});

// All native objects below are explicit fixtures; no installed code, database,
// provider or application runtime is loaded by this test suite.
test('ordered plan runs native order/payment before marketplace even when plugin is first', () => {
  const modules = fixtures();
  const plan = planFor(modules);
  assert.deepEqual(plan.slice(0, 3).map((entry) => entry.moduleKey), ['order', 'payment', 'marketplace']);
  assert.equal(plan.length, REQUIRED_MODULES.length);
  assert.equal(modules.marketplace.options.database, undefined);
});
test('preserves wrappers, providers, defaults, module database options and native definitions', () => {
  const providers = [{ resolve: '@fixture/provider', id: 'provider', options: { token: 'fixture-only' } }];
  const exports = { service: class FixtureService {} };
  const modules = fixtures();
  modules.payment = { resolve: './src/modules/payment-capture-recovery', options: { providers, custom: true, database: { pool: { min: 0 }, debug: true } } };
  modules.notification = { resolve: exports, options: { providers } };
  modules.fulfillment = { resolve: '@fixture/fulfillment', options: { providers: [{ id: 'manual', resolve: '@fixture/manual' }] } };
  modules.auth = { resolve: '@fixture/auth', options: { providers: [{ id: 'emailpass', resolve: '@fixture/emailpass' }] } };
  modules.user = { resolve: '@fixture/user', options: { jwt_secret: 'fixture-native-secret' } };
  const plan = planFor(modules, { modulePackageNames: { notification: '@fixture/notification' } });
  const payment = plan.find((entry) => entry.moduleKey === 'payment');
  assert.equal(payment.modulePath, '/compiled/server/src/modules/payment-capture-recovery/index.js');
  assert.strictEqual(payment.options.providers, providers);
  assert.equal(payment.options.custom, true);
  assert.deepEqual(payment.options.database.pool, { min: 0 });
  assert.equal(payment.options.database.debug, true);
  assert.strictEqual(plan.find((entry) => entry.moduleKey === 'notification').moduleExports, exports);
  assert.equal(plan.find((entry) => entry.moduleKey === 'user').options.jwt_secret, 'fixture-native-secret');
  assert.equal(plan.find((entry) => entry.moduleKey === 'auth').options.providers[0].id, 'emailpass');
  assert.equal(plan.find((entry) => entry.moduleKey === 'fulfillment').options.providers[0].id, 'manual');
});
test('stable dependency order, disabled/link skips and cycle rejection', () => {
  const modules = fixtures();
  modules.order.definition = { dependencies: ['auth', 'logger'] };
  modules.auth = { resolve: '@fixture/auth' };
  modules.disabled = { disable: true }; modules.oldDisabled = false;
  modules.link_modules = { resolve: '@fixture/link' };
  const keys = planFor(modules).map((entry) => entry.moduleKey);
  assert.ok(keys.indexOf('auth') < keys.indexOf('order'));
  assert.ok(!keys.includes('disabled') && !keys.includes('oldDisabled') && !keys.includes('link_modules'));
  modules.auth.dependencies = ['order'];
  assert.throws(() => planFor(modules), /Cyclic/);
  modules.auth = { disable: true };
  assert.throws(() => planFor(modules), /Disabled migration dependency/);
});
test('missing native modules, external modules, unresolved/source paths fail before migration', () => {
  for (const key of REQUIRED_MODULES) {
    const modules = fixtures(); delete modules[key];
    assert.throws(() => planFor(modules), /Required release module/);
  }
  const modules = fixtures(); modules.payment.scope = 'external';
  assert.throws(() => planFor(modules), /External/);
  assert.throws(() => planFor(fixtures(), { resolveModule: () => '/source/index.ts' }), /Only compiled/);
  assert.throws(() => planFor(fixtures(), { resolveModule: () => { throw new Error('fixture resolution failed'); } }), /fixture resolution failed/);
});
test('explicit database/schema/driver bypasses remote SSL heuristic and preserves native SSL/pool', () => {
  assert.deepEqual(database.driverOptions, { connection: { ssl: false } });
  assert.equal(database.schema, 'public');
  const driver = { connection: { ssl: { rejectUnauthorized: true }, statement_timeout: 5000 }, pool: { min: 0, max: 3 } };
  const db = databaseOptions({ databaseUrl: env.DATABASE_URL, databaseSchema: 'commerce', databaseDriverOptions: driver, databaseLogging: true }, { DATABASE_URL: env.DATABASE_URL, DATABASE_SCHEMA: 'commerce' });
  assert.equal(db.schema, 'commerce');
  assert.deepEqual(db.driverOptions.connection.ssl, { rejectUnauthorized: true });
  assert.equal(db.driverOptions.connection.statement_timeout, 5000);
  assert.deepEqual(db.pool, { min: 0, max: 3 });
  assert.equal(db.driverOptions.pool, undefined);
  assert.equal(db.debug, true);
  assert.deepEqual(driver.pool, { min: 0, max: 3 });
  for (const bad of [{}, { DATABASE_URL: 'sqlite:///tmp/test' }, { ...env, DATABASE_SCHEMA: 'x;drop schema public' }]) {
    assert.throws(() => databaseOptions({ databaseUrl: bad.DATABASE_URL }, bad));
  }
  assert.throws(() => databaseOptions({ databaseUrl: 'postgres://other/other' }, env), /must match/);
  assert.throws(() => databaseOptions({ databaseUrl: env.DATABASE_URL, databaseSchema: 'other' }, { ...env, DATABASE_SCHEMA: 'public' }), /schema approval/);
  assert.throws(() => databaseOptions({ databaseUrl: env.DATABASE_URL, databaseDriverOptions: driver }, env), /conflicts/);
});
test('rejects alternate module database/schema and non-object options', () => {
  for (const override of [{ clientUrl: 'postgres://other/other' }, { schema: 'other' }, { host: 'other' }, { connection: {} }, { database: 'other' }]) {
    const modules = fixtures(); modules.payment.options = { database: override };
    assert.throws(() => planFor(modules), /approved shared database/);
  }
  const modules = fixtures(); modules.payment.options = ['wrong'];
  assert.throws(() => planFor(modules), /Invalid module options/);
});
test('module driver options stay explicit and cannot redirect schema or weaken SSL', () => {
  const modules = fixtures();
  modules.payment.options = { database: { driverOptions: { connection: { statement_timeout: 1234 } } } };
  const payment = planFor(modules).find((entry) => entry.moduleKey === 'payment');
  assert.deepEqual(payment.options.database.driverOptions.connection, { ssl: false, statement_timeout: 1234 });
  for (const driverOptions of [{ connection: { ssl: true } }, { connection: { connectionString: 'postgres://other/other' } }, 'invalid']) {
    modules.payment.options.database.driverOptions = driverOptions;
    assert.throws(() => planFor(modules), /Module driver|Invalid module database driver/);
  }
});
test('configured and native dependency declarations are both preserved', () => {
  const modules = fixtures();
  modules.order.definition = { dependencies: ['auth'] };
  modules.order.dependencies = ['user'];
  modules.auth = { resolve: '@fixture/auth' }; modules.user = { resolve: '@fixture/user' };
  assert.deepEqual(planFor(modules).slice(0, 3).map((entry) => entry.moduleKey), ['auth', 'user', 'order']);
});
test('stops at first asynchronous native failure; never runs downstream verification/links/scripts', async () => {
  const calls = [];
  await assert.rejects(executeMigrationPlan({ plan: planFor(), policies: { links: 'safe', scripts: 'approved' },
    migrateUp: async ({ moduleKey }) => { calls.push(moduleKey); await Promise.resolve(); if (moduleKey === 'payment') throw new Error('fixture failure'); },
    verify: async () => calls.push('verify'), syncLinks: async () => calls.push('links'), runScripts: async () => calls.push('scripts'),
  }), (error) => error.message === 'Native migration failed: payment' && error.cause.message === 'fixture failure');
  assert.deepEqual(calls, ['order', 'payment']);
});
test('migration awaits each module; schema verifies before and after explicit links/scripts', async () => {
  const calls = []; let inFlight = 0;
  await executeMigrationPlan({ plan: planFor(), policies: { links: 'safe', scripts: 'approved' },
    migrateUp: async ({ moduleKey }) => { assert.equal(inFlight++, 0); await Promise.resolve(); calls.push(moduleKey); inFlight--; },
    verify: async () => calls.push('verify'), syncLinks: async () => calls.push('safe-links'), runScripts: async () => calls.push('approved-scripts'),
  });
  assert.deepEqual(calls, [...planFor().map((entry) => entry.moduleKey), 'verify', 'safe-links', 'approved-scripts', 'verify']);
});
test('skip means no links/scripts; missing postconditions and postcondition failures fail closed', async () => {
  const calls = [];
  await executeMigrationPlan({ plan: planFor(), policies: parsePolicies({}), migrateUp: async () => {}, verify: async () => calls.push('verify'), syncLinks: async () => calls.push('links'), runScripts: async () => calls.push('scripts') });
  assert.deepEqual(calls, ['verify']);
  await assert.rejects(executeMigrationPlan({ plan: planFor(), policies: parsePolicies({}), migrateUp: async () => {} }), /schema postconditions/);
  await assert.rejects(executeMigrationPlan({ plan: planFor(), policies: { links: 'safe', scripts: 'approved' }, migrateUp: async () => {}, verify: async () => { throw new Error('fixture schema missing'); }, syncLinks: async () => calls.push('links'), runScripts: async () => calls.push('scripts') }), /fixture schema missing/);
  assert.deepEqual(calls, ['verify']);
});
test('approval and unknown policies reject without loading native config', () => {
  const hash = 'a'.repeat(64);
  assert.throws(() => assertReleaseApproval({}, () => { throw new Error('must not read'); }), /explicit/);
  assert.throws(() => assertReleaseApproval({ RELEASE_MIGRATION_APPROVED: 'yes' }, () => 'invalid'), /Invalid baked/);
  assert.throws(() => assertReleaseApproval({ RELEASE_MIGRATION_APPROVED: 'yes', RELEASE_MIGRATION_SOURCE_SHA256: 'b'.repeat(64) }, () => hash), /must match/);
  assertReleaseApproval({ RELEASE_MIGRATION_APPROVED: 'yes', RELEASE_MIGRATION_SOURCE_SHA256: hash }, () => hash + '\n');
  assert.deepEqual(parsePolicies({}), { links: 'skip', scripts: 'skip' });
  for (const links of ['all', '', 'destructive']) assert.throws(() => parsePolicies({ RELEASE_MIGRATE_LINKS: links }), /link policy/);
  assert.throws(() => parsePolicies({ RELEASE_MIGRATE_SCRIPTS: 'approved' }), /separate/);
  for (const scripts of ['run', '', 'yes']) assert.throws(() => parsePolicies({ RELEASE_MIGRATE_SCRIPTS: scripts }), /script policy/);
  assert.deepEqual(parsePolicies({ RELEASE_MIGRATE_LINKS: 'safe', RELEASE_MIGRATE_SCRIPTS: 'approved', RELEASE_MIGRATION_SCRIPTS_APPROVED: 'yes' }), { links: 'safe', scripts: 'approved' });
});
test('schema validation rejects missing columns, invalid/wrong indexes and disabled/wrong triggers', () => {
  assertSchemaPostconditions(validSchema());
  const missing = validSchema(); missing.columns = missing.columns.filter((row) => row.column_name !== 'reference_id');
  assert.throws(() => assertSchemaPostconditions(missing), /order_transaction.reference_id/);
  for (const override of [{ is_unique: false }, { is_valid: false }, { is_ready: false }, { table_name: 'wrong' }, { columns: ['reference_id', 'order_id'] }, { predicate: "reference = 'capture'" }]) {
    const schema = validSchema(); Object.assign(schema.indexes[0], override);
    assert.throws(() => assertSchemaPostconditions(schema), /invalid index/);
  }
  const schema = validSchema(); schema.indexes.find((index) => index.name === 'marketplace_order_capture_once').predicate = "((reference = 'capture'::text) AND (reference_id IS NOT NULL))";
  assertSchemaPostconditions(schema);
  for (const override of [{ enabled: 'D' }, { function_name: 'wrong' }]) {
    const schema = validSchema(); Object.assign(schema.triggers[0], override);
    assert.throws(() => assertSchemaPostconditions(schema), /enabled trigger/);
  }
});
test('schema reader uses parameterized read-only SQL and approved schema', async () => {
  const calls = [];
  await readSchema({ raw: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } }, 'commerce', ['capture'], true);
  assert.equal(calls.length, 3);
  for (const call of calls) { assert.ok(/^SELECT/.test(call.sql)); assert.equal(call.params[0], 'commerce'); assert.ok(!call.sql.includes('commerce')); }
  assert.deepEqual(calls[0].params, ['commerce', 'capture']);
  assert.match(calls[1].sql, /array_to_json\(ARRAY\(/, 'native pg name[] must be projected as JSON, not an unparsed array string');
});
test('native script child exit code, signal and spawn errors are checked', async () => {
  for (const [code, signal, succeeds] of [[0, null, true], [1, null, false], [null, 'SIGTERM', false]]) {
    const fakeSpawn = (executable, args, options) => {
      assert.equal(executable, process.execPath); assert.deepEqual(args, ['/app/node_modules/@medusajs/cli/dist/index.js', 'db:migrate:scripts']);
      assert.equal(options.cwd, cwd); assert.equal(options.stdio, 'inherit');
      const child = new EventEmitter(); queueMicrotask(() => child.emit('close', code, signal)); return child;
    };
    if (succeeds) await runApprovedScripts(cwd, env, fakeSpawn);
    else await assert.rejects(runApprovedScripts(cwd, env, fakeSpawn), /scripts failed/);
  }
  await assert.rejects(runApprovedScripts(cwd, env, () => { const child = new EventEmitter(); queueMicrotask(() => child.emit('error', new Error('fixture spawn failure'))); return child; }), /fixture spawn failure/);
});
test('private XDG directory is writable under /tmp and ignores caller path', () => {
  const runtimeEnv = { XDG_CONFIG_HOME: '/readonly/arbitrary', APP_ENV: 'development' };
  configureRuntime(runtimeEnv);
  try {
    assert.ok(runtimeEnv.XDG_CONFIG_HOME.startsWith('/tmp/medusa-release-config-'));
    fs.accessSync(runtimeEnv.XDG_CONFIG_HOME, fs.constants.W_OK);
    assert.equal(fs.statSync(runtimeEnv.XDG_CONFIG_HOME).mode & 0o777, 0o700);
    assert.equal(runtimeEnv.NODE_ENV, 'production'); assert.equal(runtimeEnv.APP_ENV, 'production');
    assert.equal(runtimeEnv.MEDUSA_TELEMETRY_DISABLED, 'true');
  } finally { fs.rmSync(runtimeEnv.XDG_CONFIG_HOME, { recursive: true, force: true }); }
});
function nativeFixture({ failModule, omitCapture = false } = {}) {
  const calls = []; const config = { projectConfig: { databaseUrl: env.DATABASE_URL }, modules: { payment: { resolve: './src/modules/payment-capture-recovery', options: { providers: [{ id: 'fixture', resolve: '@fixture/provider' }] } } } };
  const columns = validSchema().columns.filter((row) => !omitCapture || row.table_name !== 'capture');
  const pg = { raw: async (sql, params) => { calls.push(['sql', sql, params]); if (sql.includes('information_schema.columns')) return { rows: columns }; if (sql.includes('pg_index')) return { rows: validSchema().indexes }; return { rows: validSchema().triggers }; }, destroy: async () => calls.push(['destroy']) };
  const container = { resolve: (key) => ({ config, logger: { info: (message) => calls.push(['log', message]) }, pg })[key], dispose: async () => calls.push(['dispose']) };
  const native = {
    ContainerRegistrationKeys: { CONFIG_MODULE: 'config', LOGGER: 'logger', PG_CONNECTION: 'pg' }, MODULE_PACKAGE_NAMES: {}, resolveModule,
    initializeContainer: async (directory, options) => { calls.push(['initialize', directory, options]); return container; },
    getResolvedPlugins: async (directory, suppliedConfig, isProject) => { assert.strictEqual(suppliedConfig, config); assert.equal(isProject, true); calls.push(['plugins']); return [{ resolve: '/fixture/plugin', modules: fixtures() }]; },
    mergePluginModules: (suppliedConfig, plugins) => { calls.push(['merge-plugins']); suppliedConfig.modules = { ...plugins[0].modules, ...suppliedConfig.modules }; },
    MedusaAppLoader: class { constructor(options) { assert.strictEqual(options.container, container); assert.equal(options.cwd, cwd); } mergeDefaultModules(modules) { calls.push(['merge-defaults']); return { ...modules, auth: { resolve: '@fixture/auth', options: { providers: [{ id: 'native-default', resolve: '@fixture/emailpass' }] } } }; } },
    Migrator: class { async ensureMigrationsTable() { calls.push(['native-migrations-table']); } },
    pgConnectionLoader: async () => { assert.equal(config.projectConfig.databaseSchema, 'public'); assert.equal(config.projectConfig.databaseDriverOptions.connection.ssl, false); calls.push(['pg-loader']); },
    MedusaModule: { migrateUp: async (migration) => { calls.push(['migrate', migration]); if (migration.moduleKey === failModule) throw new Error('fixture migration failed'); } },
    LinkLoader: class { async load() { calls.push(['load-links']); } }, syncLinks: async (loader, options) => { assert.equal(options.executeAll, false); assert.equal(options.executeSafe, true); calls.push(['safe-links']); },
  };
  return { calls, native, config, runScripts: async () => calls.push(['scripts']) };
}
test('runner consumes native plugin merge then actual merged defaults and migrates wrappers directly', async () => {
  const fixture = nativeFixture();
  const result = await runNativeMigrations({ directory: cwd, env, ...fixture });
  assert.deepEqual(fixture.calls[0], ['initialize', cwd, { skipDbConnection: true }]);
  assert.deepEqual(fixture.calls.slice(1, 4).map((call) => call[0]), ['plugins', 'merge-plugins', 'merge-defaults']);
  const migrations = fixture.calls.filter((call) => call[0] === 'migrate').map((call) => call[1]);
  assert.deepEqual(migrations.slice(0, 3).map((migration) => migration.moduleKey), ['order', 'payment', 'marketplace']);
  assert.ok(result.modules.includes('auth'));
  const payment = migrations.find((migration) => migration.moduleKey === 'payment');
  assert.equal(payment.modulePath, '/compiled/server/src/modules/payment-capture-recovery/index.js');
  assert.strictEqual(payment.options.providers, fixture.config.modules.payment.options.providers);
  for (const migration of migrations) {
    assert.equal(migration.options.database.clientUrl, env.DATABASE_URL);
    assert.equal(migration.options.database.schema, 'public');
    assert.equal(migration.options.database.driverOptions.connection.ssl, false);
  }
  assert.ok(!fixture.calls.some((call) => ['scripts', 'load-links', 'safe-links'].includes(call[0])));
  assert.deepEqual(fixture.calls.slice(-2), [['destroy'], ['dispose']]);
});
test('runner native failure and missing order/payment schema prevent marketplace and success', async () => {
  for (const options of [{ failModule: 'payment' }, { omitCapture: true }]) {
    const fixture = nativeFixture(options);
    await assert.rejects(runNativeMigrations({ directory: cwd, env, ...fixture }), /Native migration failed: payment|Schema postcondition missing column: capture/);
    const keys = fixture.calls.filter((call) => call[0] === 'migrate').map((call) => call[1].moduleKey);
    assert.deepEqual(keys, ['order', 'payment']);
    assert.ok(!fixture.calls.some((call) => call[0] === 'log' && call[1].includes('postconditions verified')));
    assert.deepEqual(fixture.calls.slice(-2), [['destroy'], ['dispose']]);
  }
});
test('runner explicit safe links only; script approval and unknown policy checked before config', async () => {
  const fixture = nativeFixture();
  await runNativeMigrations({ directory: cwd, env: { ...env, RELEASE_MIGRATE_LINKS: 'safe' }, ...fixture });
  assert.ok(fixture.calls.some((call) => call[0] === 'safe-links'));
  assert.ok(!fixture.calls.some((call) => call[0] === 'scripts'));
  const invalid = nativeFixture();
  await assert.rejects(runNativeMigrations({ directory: cwd, env: { ...env, RELEASE_MIGRATE_SCRIPTS: 'approved' }, ...invalid }), /separate/);
  assert.deepEqual(invalid.calls, []);
});
test('entrypoint retains compiled gate; default startup has no migrations and rejects other modes', () => {
  const entrypoint = path.resolve(__dirname, '../../apps/backend/entrypoint.sh');
  const source = fs.readFileSync(entrypoint, 'utf8');
  const startup = source.slice(source.indexOf('  start)'), source.indexOf('  migrate)'));
  assert.ok(startup.includes(' start --types=false'));
  assert.ok(!startup.includes('db:migrate') && !startup.includes('migrate-native'));
  assert.ok(source.includes('RELEASE_MIGRATION_APPROVED'));
  assert.ok(source.includes('RELEASE_MIGRATION_SOURCE_SHA256'));
  assert.ok(source.includes('exec node /app/deploy/release/migrate-native.cjs'));
  assert.ok(!source.includes('db:migrate --'));
  assert.ok(!source.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n').includes('ts-node'));
  const unknown = spawnSync('sh', [entrypoint, 'seed'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(unknown.status, 64); assert.match(unknown.stderr, /Allowed commands/);
  const ungated = spawnSync('sh', [entrypoint, 'migrate'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(ungated.status, 78); assert.match(ungated.stderr, /explicit RELEASE_MIGRATION_APPROVED/);
  const extraArguments = spawnSync('sh', [entrypoint, 'migrate', '--execute-all-links'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(extraArguments.status, 64); assert.match(extraArguments.stderr, /take no arguments/);
});
