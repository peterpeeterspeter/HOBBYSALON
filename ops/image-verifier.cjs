'use strict';
// Invoked by node -e, NOT the application entrypoint. Reads actual packaged files.
// Resolves literal compiled imports without executing application/providers/DB.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),Module=require('node:module');
const sha='f105b2fc1421320edc8860c8419fb2ec5c8aba43';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const blocked=[];
function deny(obj,keys,label){for(const k of keys)if(typeof obj[k]==='function')obj[k]=function(){blocked.push(label+'.'+k);throw Error('NO_NETWORK_OR_SUBPROCESS');};}
deny(require('node:net'),['connect','createConnection','createServer'],'net');
deny(require('node:net').Socket.prototype,['connect'],'net.Socket');
deny(require('node:net').Server.prototype,['listen'],'net.Server');
deny(require('node:tls'),['connect','createServer'],'tls');
const dns=require('node:dns');deny(dns,Object.keys(dns),'dns');deny(dns.promises,Object.keys(dns.promises),'dns.promises');
for(const c of [dns.Resolver,dns.promises.Resolver])if(c)deny(c.prototype,Object.getOwnPropertyNames(c.prototype),'dns.Resolver');
deny(require('node:dgram'),['createSocket'],'dgram');
for(const n of ['http','https','http2'])deny(require('node:'+n),['request','get','connect','createServer','createSecureServer'],n);
deny(require('node:child_process'),['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'],'child_process');
deny(require('node:worker_threads'),['Worker'],'worker_threads');
for(const k of ['fetch','WebSocket'])if(typeof globalThis[k]==='function')globalThis[k]=()=>{blocked.push(k);throw Error('NO_NETWORK');};
Module.syncBuiltinESMExports();
assert.equal(process.getuid(),1001);assert.equal(process.getgid(),1001);
assert.equal(process.env.NODE_ENV,'production');
assert.equal(process.env.NODE_OPTIONS,undefined);
assert(!Object.keys(process.env).some(k=>/(?:DATABASE|REDIS|STRIPE|RESEND|ALGOLIA|SECRET|PASSWORD)/i.test(k)),'No operational credentials permitted');
const root='/app',cwd='/app/apps/backend/.medusa/server';
assert.equal(process.cwd(),cwd);
const fullBytes=fs.readFileSync('/audit/full-source.json');
assert.equal(hash(fullBytes),'ca62f61071258d2e0d83cea34f4cbc754db251e9f1fe55441c9c47a612c52d6f');
const full=JSON.parse(fullBytes),sourceBytes=fs.readFileSync('/release/source.json'),source=JSON.parse(sourceBytes);
assert.equal(full.schema,2);assert.equal(full.files.length,3886);assert.equal(source.schema,2);
assert.equal(fs.readFileSync('/release/source.sha256','utf8').trim(),hash(sourceBytes));
const reference=new Map(full.files.map(x=>[x.path,x]));
const copiedRoot=p=>['package.json','yarn.lock','turbo.json'].includes(p)||['apps/backend/','packages/','deploy/release/'].some(x=>p.startsWith(x));
assert(source.files.length>1000,'Nonempty all-root baked snapshot required');
for(const f of source.files){assert(copiedRoot(f.path),'Unexpected source root');assert.deepEqual(f,reference.get(f.path),'Baked source differs from frozen merged main');}
for(const rel of ['package.json','yarn.lock','turbo.json','apps/backend/package.json','apps/backend/medusa-config.ts','apps/backend/entrypoint.sh','apps/backend/Dockerfile','deploy/release/recipe.sh','deploy/release/startup-pg-errors.cjs'])assert(source.files.some(x=>x.path===rel),'Missing critical baked source: '+rel);
function owned(file){const real=fs.realpathSync(file);assert(real===root||real.startsWith(root+'/'),'Runtime path escapes image root');const st=fs.statSync(real);assert.equal(st.uid,0,'Executable code must remain root-owned');assert.equal(st.mode&0o022,0,'Executable code must not be group/world writable');return real;}
function fixed(file,digest){const st=fs.statSync(file);assert(st.isFile());assert.equal(st.uid,0);assert.equal(st.mode&0o022,0);assert.equal(hash(fs.readFileSync(file)),digest);}
fixed('/usr/local/bin/release-entrypoint','dfaaa1404f22485c2c66f89c80ebc63f8be0a87e3b5d187865dc0578b6968c5f');
fixed('/app/deploy/release/startup-pg-errors.cjs','00e2bd9c556b9a622ec6a16ccf48f2901521f36e13e5ec2b9985cbce324bfe17');
fixed('/app/deploy/release/audit-dependencies.cjs','5369e834cbd7f038b3f4cff9183d506f791829d59fc3fb6324e7214875438ff0');
fixed('/app/deploy/release/archive-runtime.cjs','44c1669a48978c4353e9e49a605d05b904755e368b11f173dbaf6d782d69f3b4');
for(const rel of ['source.json','source.sha256','preflight.json','dependencies.json','archive.json']){const s=fs.statSync('/release/'+rel);assert.equal(s.uid,0);assert.equal(s.mode&0o022,0);}
const entry=fs.readFileSync('/usr/local/bin/release-entrypoint','utf8');
const start=entry.split('  start)')[1].split('    ;;')[0];
assert(start.includes('node --require /app/deploy/release/startup-pg-errors.cjs /app/node_modules/@medusajs/cli/dist/index.js start --types=false'));
assert(!/migrat|seed|schema|sync/i.test(start),'Normal start must not mutate schema');
assert(entry.includes('RELEASE_MIGRATION_APPROVED'));assert(entry.includes('RELEASE_MIGRATION_SOURCE_SHA256'));
assert(fs.statSync(cwd+'/medusa-config.js').isFile());owned(cwd+'/medusa-config.js');
assert(!/\b(?:synchronize|migrationsRun|autoMigrate|runMigrations)\s*:\s*true/.test(fs.readFileSync(cwd+'/medusa-config.js','utf8')),'No config auto-schema opt-in');
const pins={
 '@medusajs/utils/dist/modules-sdk/create-pg-connection.js':'b111a05994837ef00e9b85fe9b891cacca7301849478db1f71b2c85d083b849d',
 '@medusajs/framework/dist/database/pg-connection-loader.js':'4985a959a8bc6428bd150bbfee3586181ab5809ed42c77b037b70c5a42420829',
 'knex/lib/client.js':'1f8b50b8b3902ece3303bba7afdb0d801b5d0a2a581ee2f3c2e0508ad2b1993e',
 'tarn/dist/Pool.js':'50702f8c2d30a5842ffba55cb8bb5521f361f4ac550b9ce79352616082dc5fdc'
};
for(const [rel,digest]of Object.entries(pins))fixed(root+'/node_modules/'+rel,digest);
for(const [name,version]of Object.entries({'@medusajs/framework':'2.11.3','@medusajs/utils':'2.11.3','@medusajs/deps':'2.11.3',knex:'3.1.0',tarn:'3.0.2',pg:'8.17.1'})){
 const f=root+'/node_modules/'+name+'/package.json';owned(f);const p=JSON.parse(fs.readFileSync(f));assert.equal(p.name,name);assert.equal(p.version,version);
}
const factoryReq=Module.createRequire(root+'/node_modules/@medusajs/utils/dist/modules-sdk/create-pg-connection.js');
const knexReq=Module.createRequire(root+'/node_modules/knex/lib/client.js');
const depsReq=Module.createRequire(owned(factoryReq.resolve('@medusajs/deps/mikro-orm/postgresql')));
assert.equal(owned(depsReq.resolve('knex')),owned(knexReq.resolve('knex')));
assert.equal(owned(factoryReq.resolve('knex/lib/client.js')),root+'/node_modules/knex/lib/client.js');
assert.equal(owned(knexReq.resolve('tarn/dist/Pool.js')),root+'/node_modules/tarn/dist/Pool.js');
assert(owned(knexReq.resolve('pg')).startsWith(root+'/node_modules/pg/'));
// Audit is an exact-hash-pinned read-only helper; no install/bootstrap/fixtures.
const audit=require(root+'/deploy/release/audit-dependencies.cjs');
const preflight=JSON.parse(fs.readFileSync('/release/preflight.json'));
const baked=JSON.parse(fs.readFileSync('/release/dependencies.json'));
assert.equal(preflight.mode,'preflight');assert.deepEqual(preflight.problems,[]);
assert.equal(baked.mode,'installed');assert.equal(baked.parity_pass,true);assert.equal(baked.release_acceptance,true);
const actual=audit.audit(root,'installed');assert.equal(actual.release_acceptance,true);assert.equal(actual.parity_pass,true);
assert.equal(actual.root_lock_sha256,'d34b60391a4b7fbafc26507494ad32177bf5676166691155302f95cfeb2dcac6');
assert.equal(actual.yarn_integrity_sha256,baked.yarn_integrity_sha256);
assert.equal(actual.installed_package_count,baked.installed_package_count);
assert.deepEqual(actual.packages,baked.packages);assert.deepEqual(actual.manifests,baked.manifests);
for(const p of actual.packages)owned(root+'/'+p.path+'/package.json');
const archive=JSON.parse(fs.readFileSync('/release/archive.json'));
assert.equal(archive.compiled_cwd,'apps/backend/.medusa/server');assert(archive.validated_migration_directories.length>0);
for(const rel of archive.validated_migration_directories){owned(root+'/'+rel);assert(fs.readdirSync(root+'/'+rel).some(x=>/^(Migration|InitialSetup).+\.js$/.test(x)));}
for(const rel of archive.migrationless_directories){owned(root+'/'+rel);assert(fs.statSync(root+'/'+rel).isDirectory());}
const roots=['apps/backend/.medusa/server'];
for(const [rel]of audit.workspaces(root)){
 if(rel==='packages/framework/package.json'){assert(fs.existsSync(root+'/packages/framework/dist/index.js'));roots.push('packages/framework/dist');}
 else if(rel.startsWith('packages/modules/')){const r=path.dirname(rel)+'/.medusa/server';assert(fs.statSync(root+'/'+r+'/src').isDirectory());roots.push(r);}
}
assert.equal(roots.length,10,'Backend, framework and all eight native module roots required');
// Import parser is installed locked TypeScript; never require a config, module, provider or app.
const ts=require(root+'/node_modules/typescript');assert.equal(ts.version,'5.9.3');
const builtins=new Set(Module.builtinModules.flatMap(x=>[x,x.startsWith('node:')?x:'node:'+x]));
const files=[],imports=[],seen=new Set();
function walk(dir){owned(dir);for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='static')continue;const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.isFile()&&/\.[cm]?js$/.test(e.name)){owned(f);files.push(f);}else if(e.isSymbolicLink()){owned(f);}}}
for(const r of roots)walk(root+'/'+r);
function resolve(from,spec){if(builtins.has(spec))return;const req=Module.createRequire(from),resolved=owned(req.resolve(spec));assert(fs.statSync(resolved).isFile());const key=from+'\0'+spec;if(!seen.has(key)){seen.add(key);imports.push({from:path.relative(root,from),specifier:spec,resolved:path.relative(root,resolved),sha256:hash(fs.readFileSync(resolved))});}}
for(const file of files){const text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(ast.parseDiagnostics.length,0,'Compiled JS parse failed');function visit(n){if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteralLike(n.moduleSpecifier))resolve(file,n.moduleSpecifier.text);if(ts.isCallExpression(n)&&n.arguments.length&&ts.isStringLiteralLike(n.arguments[0])&&((ts.isIdentifier(n.expression)&&n.expression.text==='require')||n.expression.kind===ts.SyntaxKind.ImportKeyword))resolve(file,n.arguments[0].text);ts.forEachChild(n,visit);}visit(ast);}
assert(files.length>100);assert(imports.length>100);assert.deepEqual(blocked,[]);
console.log(JSON.stringify({schema:1,status:'PASS',source_commit:sha,full_source_snapshot_sha256:hash(fullBytes),builder_source_snapshot_sha256:hash(sourceBytes),baked_source_files:source.files.length,installed_release_acceptance:true,installed_packages:actual.installed_package_count,native_version_and_byte_guards:true,uid:process.getuid(),gid:process.getgid(),compiled_roots:roots,compiled_js_files:files.length,literal_runtime_imports_resolved:imports.length,imports,scope:'read-only packaged-file/metadata/native-pin/static-import-resolution verification; no application/provider execution, network, DB, schema mutation or deployment; computed/nonliteral imports are not certified'},null,2));
