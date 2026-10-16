#!/usr/bin/env node
'use strict';
// Synthetic fixtures test validation logic only: not a Medusa build or DB smoke.
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), assert=require('node:assert/strict'), cp=require('node:child_process');
const {audit, snapshot, lockEntries}=require('./audit-dependencies.cjs');
const {archive}=require('./archive-runtime.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'release-offline-')); let tests=0;
function test(name,fn){fn();tests++;console.log('PASS '+name);}
function write(rel,value){const p=path.join(tmp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof value==='string'?value:JSON.stringify(value));}
const deps={'@medusajs/payment':'2.11.3','@medusajs/notification':'2.11.3',knex:'3.1.0'};
const tools={turbo:'2.7.5','ts-node':'10.9.2',typescript:'5.9.3'};
write('package.json',{private:true,packageManager:'yarn@1.22.21',workspaces:['apps/*'],devDependencies:{turbo:'2.7.5'}});
write('apps/backend/package.json',{name:'api',version:'0.0.1',dependencies:deps,devDependencies:{'ts-node':'10.9.2',typescript:'5.9.3'}});
const all={...deps,...tools};const lock={};let text='# yarn lockfile v1\n';
for(const [name,version] of Object.entries(all)) {const selector=name+'@'+version,resolved='https://offline.invalid/'+name+'/'+version;lock[selector]=resolved;text+=JSON.stringify(selector)+':\n  version '+JSON.stringify(version)+'\n  resolved '+JSON.stringify(resolved)+'\n';write('node_modules/'+name+'/package.json',{name,version});}
write('yarn.lock',text);write('node_modules/.yarn-integrity',{flags:[],lockfileEntries:lock});
test('exact frozen metadata passes',()=>assert.equal(audit(tmp,'installed').release_acceptance,true));
test('cache never release acceptance',()=>assert.equal(audit(tmp,'installed-cache').release_acceptance,false));
test('package manager drift rejected',()=>{write('package.json',{private:true,packageManager:'yarn@1.22.22',devDependencies:{turbo:'2.7.5'}});assert.equal(audit(tmp,'installed').release_acceptance,false);write('package.json',{private:true,packageManager:'yarn@1.22.21',devDependencies:{turbo:'2.7.5'}});});
test('missing security resolution rejected',()=>{write('package.json',{private:true,packageManager:'yarn@1.22.21',devDependencies:{turbo:'2.7.5'},resolutions:{'**/handlebars':'4.7.9'}});assert.equal(audit(tmp,'installed').release_acceptance,false);write('package.json',{private:true,packageManager:'yarn@1.22.21',devDependencies:{turbo:'2.7.5'}});});
write('node_modules/typescript/package.json',{name:'typescript',version:'5.6.2'});
test('compiler drift rejected',()=>assert.equal(audit(tmp,'installed').release_acceptance,false));
write('node_modules/typescript/package.json',{name:'typescript',version:'5.9.3'});
write('node_modules/.yarn-integrity',{lockfileEntries:{}});
test('empty install metadata rejected',()=>assert.equal(audit(tmp,'installed').release_acceptance,false));
write('node_modules/.yarn-integrity',{flags:[],lockfileEntries:lock});
const changed={...lock};changed['typescript@5.9.3']='https://offline.invalid/drift';write('node_modules/.yarn-integrity',{lockfileEntries:changed});
test('resolved URL drift rejected',()=>assert.equal(audit(tmp,'installed').release_acceptance,false));
write('node_modules/.yarn-integrity',{lockfileEntries:lock});
test('lock selector parser handles grouped scoped keys',()=>assert.equal(lockEntries('# yarn lockfile v1\n"@scope/a@^1", "@scope/a@1":\n  version "1"\n  resolved "url"\n')['@scope/a@^1'].version,'1'));
test('duplicate selectors rejected',()=>assert.throws(()=>lockEntries(text+text),/Duplicate/));
test('manifest drift is observable',()=>{const before=JSON.stringify(snapshot(tmp));write('package.json',{private:true});assert.notEqual(JSON.stringify(snapshot(tmp)),before);});
test('archive fails without native output',()=>assert.throws(()=>archive(tmp,path.join(tmp,'runtime')),/compiled config absent/));
write('apps/backend/.medusa/server/medusa-config.js','module.exports={}');write('apps/backend/.medusa/server/package.json',{name:'api'});
const dest=path.join(tmp,'archive');test('archive contains compiled backend not source',()=>{archive(tmp,dest);assert.ok(fs.existsSync(path.join(dest,'apps/backend/.medusa/server/medusa-config.js')));assert.equal(fs.existsSync(path.join(dest,'apps/backend/src')),false);});
const actual=path.resolve(__dirname,'../../apps/backend/entrypoint.sh');const shell=fs.readFileSync(actual,'utf8');
test('POSIX syntax',()=>assert.equal(cp.spawnSync('sh',['-n',actual]).status,0));
// Relocate absolute image paths ONLY in a disposable test copy; no runtime override.
const compiled=path.join(tmp,'compiled');fs.mkdirSync(compiled);fs.writeFileSync(path.join(compiled,'medusa-config.js'),'module.exports={}');
const receipt=path.join(tmp,'source.sha256'),digest='a'.repeat(64);fs.writeFileSync(receipt,digest+'\n');
const fakebin=path.join(tmp,'fakebin');fs.mkdirSync(fakebin);const capture=path.join(tmp,'capture');fs.writeFileSync(path.join(fakebin,'node'),'#!/bin/sh\nprintf "%s\\n" "$PWD" "$@" > "$CAPTURE"\n');fs.chmodSync(path.join(fakebin,'node'),0o755);
const runner=path.join(tmp,'migrate-native.cjs'),planner=path.join(tmp,'migration-plan.cjs');fs.writeFileSync(runner,'fixture');fs.writeFileSync(planner,'fixture');
const entry=path.join(tmp,'entry.sh');fs.writeFileSync(entry,shell.replaceAll('/app/apps/backend/.medusa/server',compiled).replaceAll('/release/source.sha256',receipt).replaceAll('/app/deploy/release/migrate-native.cjs',runner).replaceAll('/app/deploy/release/migration-plan.cjs',planner));
function run(args,env={}){fs.rmSync(capture,{force:true});const r=cp.spawnSync('sh',[entry,...args],{env:{PATH:fakebin+':/usr/bin:/bin',CAPTURE:capture,...env},encoding:'utf8'});return {...r,args:fs.existsSync(capture)?fs.readFileSync(capture,'utf8'):''};}
test('default compiled start disables types',()=>{const r=run([]);assert.equal(r.status,0);assert.match(r.args,/start\n--types=false\n--host\n0.0.0.0\n--port\n9000/);assert.ok(r.args.startsWith(compiled+'\n'));});
test('startup ignores legacy migration/seed env',()=>{const r=run(['start'],{MIGRATE_LINKS:'all',SEED_DEMO_DATA:'true'});assert.equal(r.status,0);assert.doesNotMatch(r.args,/db:migrate|seed/);});
test('extra and arbitrary commands refused',()=>{assert.equal(run(['start','--types=true']).status,64);assert.equal(run(['sh']).status,64);});
test('unapproved migration refuses before dispatch',()=>{const r=run(['migrate']);assert.equal(r.status,78);assert.equal(r.args,'');});
test('spoofed environment source does not approve',()=>{const r=run(['migrate'],{RELEASE_MIGRATION_APPROVED:'yes',RELEASE_MIGRATION_SOURCE_SHA256:'b'.repeat(64),RELEASE_SOURCE_SHA256:'b'.repeat(64)});assert.equal(r.status,78);assert.equal(r.args,'');});
test('approved default migration skips links',()=>{const r=run(['migrate'],{RELEASE_MIGRATION_APPROVED:'yes',RELEASE_MIGRATION_SOURCE_SHA256:digest});assert.equal(r.status,0);assert.ok(r.args.endsWith(runner+'\n'));assert.doesNotMatch(r.args,/db:migrate/);});
test('approved safe links exact CLI flag',()=>{const r=run(['migrate'],{RELEASE_MIGRATION_APPROVED:'yes',RELEASE_MIGRATION_SOURCE_SHA256:digest,RELEASE_MIGRATE_LINKS:'safe'});assert.equal(r.status,0);assert.ok(r.args.endsWith(runner+'\n'));assert.doesNotMatch(r.args,/--execute-all-links/);});
test('destructive links refuse',()=>{const r=run(['migrate'],{RELEASE_MIGRATION_APPROVED:'yes',RELEASE_MIGRATION_SOURCE_SHA256:digest,RELEASE_MIGRATE_LINKS:'all'});assert.equal(r.status,78);assert.equal(r.args,'');});
console.log(JSON.stringify({tests,passed:tests,scope:'synthetic offline validator and shell contract; no install/build/server/database/provider'}));
fs.rmSync(tmp,{recursive:true,force:true});