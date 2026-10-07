'use strict';
// Read-only byte inspection only. No application imports or server/migration start.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const fail = m => { throw new Error(m); };
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const deps = json('/release/dependencies.json'), source = json('/release/source.json');
if (deps.parity_pass !== true || deps.mode !== 'installed' || deps.release_acceptance !== true) fail('Installed parity receipt failed');
if (hash(fs.readFileSync('/app/yarn.lock')) !== deps.root_lock_sha256) fail('Runtime root lock drift');
if (hash(fs.readFileSync('/app/node_modules/.yarn-integrity')) !== deps.yarn_integrity_sha256) fail('Installed integrity drift');
for (const d of [...deps.manifests, ...deps.packages.map(p => ({path: p.path + '/package.json', sha256: p.package_json_sha256}))]) {
  if (hash(fs.readFileSync('/app/' + d.path)) !== d.sha256) fail('Runtime installed manifest drift: ' + d.path);
}
const sourceMap = new Map(source.files.map(f => [f.path, f.sha256]));
const files = [], roots = ['apps/backend/.medusa/server', 'packages/framework/dist', 'deploy/release'];
const archive = json('/release/archive.json');
// Native persisted migrations live under installed node_modules, not plugin roots.
for (const r of archive.validated_migration_directories) {
  if (!r.startsWith('node_modules/') && !r.startsWith('packages/modules/')) fail('Unexpected native migration root');
  if (r.split('/').includes('..')) fail('Unsafe native migration root');
  if (r.startsWith('node_modules/')) roots.push(r);
}
for (const e of fs.readdirSync('/app/packages/modules', {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
  if (!e.isDirectory()) fail('Unexpected module root');
  roots.push('packages/modules/' + e.name + '/.medusa/server');
}
function walk(rel) {
  for (const e of fs.readdirSync('/app/' + rel, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) walk(r);
    else if (e.isSymbolicLink() && r === 'apps/backend/.medusa/server/static') {
      if (fs.realpathSync('/app/' + r) !== '/app/apps/backend/static') fail('Unexpected static link');
    } else if (e.isFile()) files.push({path:r,sha256:hash(fs.readFileSync('/app/' + r))});
    else fail('Unexpected compiled file type: ' + r);
  }
}
for (const root of roots) walk(root);
const required = ["apps/backend/.medusa/server/src/modules/index-runtime-readonly/catalog.js", "apps/backend/.medusa/server/src/modules/index-runtime-readonly/index.js", "apps/backend/.medusa/server/src/modules/index-runtime-readonly/loader.js", "apps/backend/.medusa/server/src/modules/index-runtime-readonly/provider.js", "apps/backend/.medusa/server/src/modules/index-runtime-readonly/service.js", "deploy/release/index-bootstrap.cjs", "packages/modules/commission/.medusa/server/src/workflows/commission/steps/calculate-commission-lines.js", "packages/modules/commission/.medusa/server/src/workflows/commission/steps/create-commission-lines.js"] .concat([
 'apps/backend/.medusa/server/medusa-config.js',
 'packages/framework/dist/index.js',
 'deploy/release/migrate-native.cjs',
 'deploy/release/migration-plan.cjs',
 'packages/modules/b2c-core/.medusa/server/src/modules/marketplace/migrations/Migration20261006113000.js',
 'packages/modules/b2c-core/.medusa/server/src/utils/marketplace-capture-ack.js',
 'packages/modules/b2c-core/.medusa/server/src/utils/marketplace-capture-subscriber.js',
 'packages/modules/b2c-core/.medusa/server/src/utils/marketplace-capture.js',
 'packages/modules/b2c-core/.medusa/server/src/subscribers/split-payment-payment-captured.js'
]);
const present = new Map(files.map(f => [f.path,f.sha256]));
for (const r of required) if (!present.has(r)) fail('Required actual compiled file missing: ' + r);
for (const f of files.filter(f => f.path.startsWith('deploy/release/'))) {
  if (!f.path.endsWith('.cjs') || sourceMap.get(f.path) !== f.sha256) fail('Release helper source drift');
}
for (const r of archive.validated_migration_directories) {
  if (!files.some(f=>f.path.startsWith(r + '/') && /\/(Migration|InitialSetup).+\.js$/.test(f.path))) fail('Actual native migration missing');
}
const baked = fs.readFileSync('/release/source.sha256','utf8').trim();
if (hash(fs.readFileSync('/release/source.json')) !== baked) fail('Baked source receipt mismatch');
console.log(JSON.stringify({schema:1,status:'PASS',kind:'actual-image-read-only-inspection',
 source_snapshot_sha256:baked,root_lock_sha256:deps.root_lock_sha256,
 entrypoint_sha256:hash(fs.readFileSync('/usr/local/bin/release-entrypoint')),
 installed_manifest_parity:true,compiled_roots:roots,required_files:required,
 compiled_files:files,compiled_files_sha256:hash(Buffer.from(JSON.stringify(files))),
 production_release:false,runtime_acceptance:false}));
