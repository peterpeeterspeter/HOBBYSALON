#!/usr/bin/env node
'use strict';
const fs = require('node:fs'); const path = require('node:path');
const {workspaces} = require('./audit-dependencies.cjs');

// Verified by read-only inspection of Medusa 2.11.3 / Mercur 1.5.4's installed
// declarations and compiled package trees. Never infer "migrationless" merely
// from a missing directory: in particular workflow-engine-redis HAS migrations.
const migrationlessNative = ['file', 'locking', 'cache-inmemory', 'event-bus-local',
  'auth-emailpass', 'fulfillment-manual', 'file-local', 'file-s3',
  'notification-local', 'event-bus-redis'];
const persistedNative = ['api-key', 'auth', 'cart', 'currency', 'customer', 'fulfillment',
  'index', 'inventory', 'locking-postgres', 'notification', 'order', 'payment',
  'pricing', 'product', 'promotion', 'region', 'sales-channel', 'settings',
  'stock-location', 'store', 'tax', 'user', 'workflow-engine-inmemory', 'workflow-engine-redis'];
const persistedPlugins = {
  'b2c-core': ['attribute', 'category-details', 'collection-details', 'configuration',
    'marketplace', 'payout', 'secondary_categories', 'seller', 'split-order-payment', 'taxcode', 'wishlist'],
  commission: ['commission'], requests: ['order-return-request', 'requests'], reviews: ['reviews'],
};
const migrationlessProviders = [
  ['payment-stripe-connect', 'stripe-connect'], ['resend', 'resend'],
];
// Optional Algolia is also a verified pure external-service module (no models).
// Packaging it must not falsely require DB migrations when the plugin is disabled.
const migrationlessPluginModules = {algolia:['algolia']};
const isMigration = name => /^(?:Migration|InitialSetup).+\.js$/.test(name);

function migrationPlan(root, work) {
  const empty = [], real = new Set();
  function contained(rel) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) throw new Error('Runtime path absent: ' + rel);
    const resolved = fs.realpathSync(file);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('Runtime path escapes install root via symlink: ' + rel);
    return file;
  }
  function verifiedPackage(rel, name, version) {
    const pkg = JSON.parse(fs.readFileSync(contained(rel + '/package.json'), 'utf8'));
    if (pkg.name !== name || pkg.version !== version) throw new Error('Unverified migrationless package name/version: ' + rel + ' (expected ' + name + '@' + version + ')');
  }
  function requireMigrations(rel) {
    const dir = contained(rel);
    if (!fs.statSync(dir).isDirectory() || !fs.readdirSync(dir).some(name => isMigration(name) && fs.statSync(contained(rel + '/' + name)).isFile())) {
      throw new Error('Executable native migrations absent: ' + rel);
    }
    real.add(rel);
  }
  function allowEmpty(rel) {
    contained(path.dirname(rel) + '/index.js');
    // Existing migrations (including empty directories) are copied verbatim.
    // mkdir below will only fill an absent allowlisted directory at DEST.
    if (fs.existsSync(path.join(root, rel))) contained(rel);
    empty.push(rel);
  }
  const backend = work.find(([rel]) => rel === 'apps/backend/package.json')?.[1];
  const medusaManifest = 'node_modules/@medusajs/medusa/package.json';
  const medusaDeclared = Boolean(backend?.dependencies?.['@medusajs/medusa']);
  if (medusaDeclared || fs.existsSync(path.join(root, medusaManifest))) {
    verifiedPackage('node_modules/@medusajs/medusa', '@medusajs/medusa', '2.11.3');
    for (const name of migrationlessNative) {
      const dir = 'node_modules/@medusajs/' + name;
      verifiedPackage(dir, '@medusajs/' + name, '2.11.3');
      allowEmpty(dir + '/dist/migrations');
    }
    for (const name of persistedNative) requireMigrations('node_modules/@medusajs/' + name + '/dist/migrations');
  }
  for (const [pkg, provider] of migrationlessProviders) {
    const dir = 'packages/modules/' + pkg;
    if (!work.some(([rel]) => rel === dir + '/package.json')) continue;
    verifiedPackage(dir, '@mercurjs/' + pkg, '1.5.4');
    allowEmpty(dir + '/.medusa/server/src/providers/' + provider + '/migrations');
  }
  for (const [rel] of work) {
    if (!rel.startsWith('packages/modules/')) continue;
    const dir = path.dirname(rel), pkg = path.basename(dir);
    const compiled = dir + '/.medusa/server/src/modules';
    const source = dir + '/src/modules';
    const names = new Set(persistedPlugins[pkg] || []);
    // Catch new modules and removed compiled module directories as well as the
    // pinned marketplace set. These are persisted modules, not provider services.
    for (const parent of [source, compiled]) {
      if (!fs.existsSync(path.join(root, parent))) continue;
      for (const entry of fs.readdirSync(contained(parent), {withFileTypes:true})) {
        if (entry.isDirectory()) names.add(entry.name);
      }
    }
    for (const name of names) {
      const migrations = compiled + '/' + name + '/migrations';
      if (migrationlessPluginModules[pkg]?.includes(name)) {
        verifiedPackage(dir, '@mercurjs/' + pkg, '1.5.4');
        // A new persisted model/source migration invalidates this exception.
        if ([source, compiled].some(parent => fs.existsSync(path.join(root, parent, name, 'models'))) ||
          fs.existsSync(path.join(root, source, name, 'migrations'))) throw new Error('Verified migrationless module now has models/source migrations: ' + dir + '/' + name);
        allowEmpty(migrations);
        continue;
      }
      requireMigrations(migrations);
      const src = source + '/' + name + '/migrations';
      if (!fs.existsSync(path.join(root, src))) continue;
      for (const file of fs.readdirSync(contained(src)).filter(name => /^(?:Migration|InitialSetup).+\.ts$/.test(name) && !name.endsWith('.d.ts'))) {
        contained(migrations + '/' + file.replace(/\.ts$/, '.js'));
      }
    }
  }
  return {empty, real:[...real]};
}

function archive(root, dest) {
  root = fs.realpathSync(path.resolve(root)); dest = path.resolve(dest);
  if (dest === root || root.startsWith(dest + path.sep) || ['node_modules', 'apps', 'packages', 'deploy'].some(rel => dest === path.join(root, rel) || dest.startsWith(path.join(root, rel) + path.sep))) throw new Error('Archive destination must not overlap a copied install tree');
  if (fs.existsSync(dest)) throw new Error('Archive destination must not exist');
  const work = workspaces(root);
  for (const [rel,pkg] of work) {
    if (rel.startsWith('apps/') && rel !== 'apps/backend/package.json') throw new Error('Backend install context must omit frontend workspaces');
    const dir = path.join(root,path.dirname(rel));
    if (rel === 'apps/backend/package.json' && !fs.existsSync(path.join(dir,'.medusa/server/medusa-config.js'))) throw new Error('Backend compiled config absent');
    if (rel === 'packages/framework/package.json' && !fs.existsSync(path.join(dir,'dist/index.js'))) throw new Error('Framework dist absent');
    if (rel.startsWith('packages/modules/') && !fs.existsSync(path.join(dir,'.medusa/server/src'))) throw new Error('Native plugin archive absent: '+pkg.name);
  }
  // Fail closed BEFORE creating DEST. Never repair missing persisted migrations.
  const plan = migrationPlan(root, work);
  fs.mkdirSync(dest,{recursive:true}); const copied = [];
  function copy(rel) {
    const src = path.join(root,rel); if (!fs.existsSync(src)) return;
    const target = path.join(dest,rel); fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.cpSync(src,target,{recursive:true,dereference:false,verbatimSymlinks:true}); copied.push(rel);
  }
  copy('package.json'); copy('yarn.lock'); copy('node_modules');
  for (const [rel] of work) {
    copy(rel); const dir = path.dirname(rel); copy(dir+'/node_modules');
    copy(dir === 'packages/framework' ? dir+'/dist' : dir+'/.medusa/server');
  }
  // Include the parent runner and all its present/future CJS helpers, not build
  // recipes. No runtime reinstall or entrypoint filesystem repair is necessary.
  const release = path.join(root, 'deploy/release');
  if (fs.existsSync(release)) for (const entry of fs.readdirSync(release, {withFileTypes:true})) {
    if (entry.isFile() && entry.name.endsWith('.cjs')) {
      const rel = 'deploy/release/' + entry.name;
      copy(rel);
      // Host-created audit helpers can be 0600. The final image keeps code
      // root-owned, so the non-root entrypoint needs an explicitly readable copy.
      fs.chmodSync(path.join(dest, rel), 0o444);
    }
  }
  for (const rel of plan.empty) {
    const parent = fs.realpathSync(path.join(dest, path.dirname(rel)));
    if (!parent.startsWith(dest + path.sep)) throw new Error('Migration directory escapes archive via symlink: ' + rel);
    const target = path.join(dest, rel);
    if (fs.existsSync(target)) {
      const resolved = fs.realpathSync(target);
      if (!resolved.startsWith(dest + path.sep) || !fs.statSync(target).isDirectory()) throw new Error('Invalid archived migration directory: ' + rel);
    } else fs.mkdirSync(target, {mode:0o755});
  }
  for (const rel of plan.real) {
    const dir = path.join(dest, rel);
    if (!fs.existsSync(dir) || !fs.readdirSync(dir).some(isMigration)) throw new Error('Native migrations lost in archive: ' + rel);
  }
  // Do not preserve generated type artifacts; startup never generates them.
  fs.rmSync(path.join(dest,'apps/backend/.medusa/server/.medusa'),{recursive:true,force:true});
  return {schema:1,compiled_cwd:'apps/backend/.medusa/server',copied,
    migrationless_directories:plan.empty,validated_migration_directories:plan.real,
    dependency_policy:'same frozen builder install; development dependencies intentionally retained, no runtime reinstall'};
}
module.exports = {archive};
if (require.main === module) try { console.log(JSON.stringify(archive(path.resolve(process.argv[2] || '/app'),path.resolve(process.argv[3] || '/runtime')),null,2)); }
catch (e) { console.error(e.message); process.exitCode = 2; }
