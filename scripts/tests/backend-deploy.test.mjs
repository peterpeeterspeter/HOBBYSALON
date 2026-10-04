import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, symlinkSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const sha = 'a'.repeat(40);
// All deploy mutators are PATH stand-ins. Only real-* fixtures delegate Git/tar.
const stub = `#!/usr/bin/node
const fs=require('node:fs'), p=require('node:path'), cp=require('node:child_process');
const name=p.basename(process.argv[1]), a=process.argv.slice(2), s=process.env.SCENARIO;
const log=x=>fs.appendFileSync(process.env.TRACE,JSON.stringify(x)+'\\n');
log({name,a,payments:process.env.COMMERCE_PAYMENTS_ENABLED,payouts:process.env.COMMERCE_PAYOUTS_ENABLED});
const out=x=>{console.log(x);process.exit(0)}, fail=()=>process.exit(7);
if(name==='git') {
 if(s.startsWith('real-')) {const r=cp.spawnSync('/usr/bin/git',a,{encoding:'utf8'});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status??7);}
 if(a[0]==='-C')a.splice(0,2);
 if(a.join(' ')==='rev-parse --show-toplevel') out(process.env.REPO);
 if(a.join(' ')==='rev-parse HEAD') out('a'.repeat(40));
 if(a[0]==='status') out(s==='dirty'?' M tracked-file':'');
 if(a[0]==='ls-tree') out(s==='gitlink'?'160000 commit '+ 'b'.repeat(40)+'\\tmodule':'');
 if(a[0]==='archive') {if(s==='archive-fail')fail();process.stdout.write('fixture');process.exit(0);}
 if(a[0]==='pull')process.exit(0); fail();
}
if(name==='mktemp')out(fs.mkdtempSync(p.join(process.env.HOME,'isolated-')));
if(name==='rm'){fs.rmSync(a.at(-1),{recursive:true,force:true});process.exit(0);}
if(name==='tar') {
 if(s==='tar-fail')fail();
 if(s.startsWith('real-')){const r=cp.spawnSync('/usr/bin/tar',a,{stdio:'inherit'});process.exit(r.status??7);}
 fs.readFileSync(0); const d=a[a.indexOf('-C')+1];
 fs.mkdirSync(p.join(d,'apps/backend/src'),{recursive:true});
 fs.writeFileSync(p.join(d,'apps/backend/Dockerfile'),'FROM scratch\\nCOPY . .\\n');
 fs.writeFileSync(p.join(d,'apps/backend/src/tracked.ts'),'approved source\\n');process.exit(0);
}
if(name==='docker') {
 if(a[0]==='build') {
  const context=a.at(-1);log({name:'build-context',context,tracked:fs.readFileSync(p.join(context,'apps/backend/src/tracked.ts'),'utf8'),rogue:fs.existsSync(p.join(context,'apps/backend/src/rogue.ts')),ignored:fs.existsSync(p.join(context,'apps/backend/src/ignored.ts')),secret:fs.existsSync(p.join(context,'deploy/vps/.env')),metadata:fs.existsSync(p.join(context,'.git')),claude:fs.existsSync(p.join(context,'.claude'))});
  if(['build-fail','real-build-fail','real-claude-build-fail'].includes(s))fail();process.exit(0);
 }
 if(a[0]==='compose') {
  const b=a.slice(1);
  if(b.join(' ')==='version'){if(s==='compose-fail')fail();out('Docker Compose version v2.test');}
  if(b.join(' ')==='up --help')out(s==='old-compose'?'up -d':'--wait --wait-timeout');
  if(b[0]==='config'){if(s==='config-fail')fail();process.exit(0);}
  if(b[0]==='build'){if(s==='build-fail')fail();process.exit(0);}
  if(b[0]==='up'){if(s==='wait-fail')fail();process.exit(0);}
  if(b[0]==='ps'){const service=b.at(-1);out(s==='missing-'+service?'':service+'-id');}
 }
 if(a[0]==='image'&&a[1]==='inspect')out('sha256:built '+(s==='image-label'?'b'.repeat(40):process.env.EXPECTED_COMMIT));
 if(a[0]==='inspect') {
  const id=a.at(-1);
  if(id==='backend-id'&&a.join(' ').includes('.Image'))out(s==='image-mismatch'?'sha256:other':'sha256:built');
  out(s===id.replace('-id','')+'-unhealthy'?'running unhealthy':'running healthy');
 } fail();
}
if(['install','ln','nginx','systemctl','certbot'].includes(name)){if(s===name+'-fail')fail();process.exit(0);}fail();
`;
function run(scenario='',overrides={}) {
 const dir=mkdtempSync(join(tmpdir(),'backend-deploy-'));
 try {
  const repo=join(dir,'repo'),vps=join(repo,'deploy/vps'),bin=join(dir,'bin');
  mkdirSync(vps,{recursive:true});mkdirSync(bin);
  for(const f of ['deploy.sh','compose.yaml','nginx-api.hobbysalon.be.conf'])copyFileSync(join(root,'deploy/vps',f),join(vps,f));
  if(scenario!=='missing-env')writeFileSync(join(vps,'.env'),'COMMERCE_PAYMENTS_ENABLED=true\nCOMMERCE_PAYOUTS_ENABLED=true\n');
  let expected=sha;
  if(scenario.startsWith('real-')) {
   const git=args=>{const r=spawnSync('/usr/bin/git',args,{cwd:repo,env:{PATH:'/usr/bin:/bin',HOME:dir,GIT_CONFIG_NOSYSTEM:'1'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
   mkdirSync(join(repo,'apps/backend/src'),{recursive:true});
   writeFileSync(join(repo,'apps/backend/Dockerfile'),'FROM scratch\nCOPY . .\n');
   writeFileSync(join(repo,'apps/backend/src/tracked.ts'),'approved source\n');
   mkdirSync(join(repo,'.claude'),{recursive:true});
   writeFileSync(join(repo,'.claude','fixture.txt'),'tracked agent metadata\n');
   writeFileSync(join(repo,'.gitignore'),'.env\nignored.ts\n');
   git(['init','-q']);git(['add','.']);
   git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture']);
   expected=git(['rev-parse','HEAD']);
   if(scenario!=='real-success'&&scenario!=='real-build-fail') {
    // A real existing commit object backs each synthetic gitlink; never touch
    // the source checkout's pre-existing agent worktree or its index.
    git(['update-index','--add','--cacheinfo','160000',expected,'.claude/worktrees/interesting-jepsen']);
    mkdirSync(join(repo,'.claude/worktrees/interesting-jepsen'),{recursive:true});
    const appPath={
     'real-app-gitlink':'apps/backend/vendor module',
     'real-prefix-gitlink':'.claude-app/module',
     'real-quoted-gitlink':'.claude/worktrees/odd\tname',
    }[scenario];
    if(appPath) {
     git(['update-index','--add','--cacheinfo','160000',expected,appPath]);
     mkdirSync(join(repo,appPath),{recursive:true});
    }
    git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','gitlink fixture']);
    expected=git(['rev-parse','HEAD']);
   }
   writeFileSync(join(repo,'apps/backend/src/rogue.ts'),'unapproved\n');
   writeFileSync(join(repo,'apps/backend/src/ignored.ts'),'ignored unapproved\n');
   assert.equal(git(['status','--porcelain','--untracked-files=no']),'');
  }
  writeFileSync(join(bin,'stub'),stub);chmodSync(join(bin,'stub'),0o755);
  for(const name of ['git','tar','mktemp','rm','docker','install','ln','nginx','systemctl','certbot'])if(scenario!=='missing-'+name)symlinkSync(join(bin,'stub'),join(bin,name));
  const trace=join(dir,'trace');writeFileSync(trace,'');
  const result=spawnSync('/bin/bash',[join(vps,'deploy.sh'),repo],{env:{PATH:bin,HOME:dir,TRACE:trace,REPO:repo,SCENARIO:scenario,DEPLOY_APPROVED:'true',EXPECTED_COMMIT:expected,...overrides},encoding:'utf8',timeout:10000});
  const calls=readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  if(scenario.startsWith('real-')) {
   assert.equal(readFileSync(join(repo,'.claude','fixture.txt'),'utf8'),'tracked agent metadata\n','live agent files untouched');
   const head=spawnSync('/usr/bin/git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'});
   assert.equal(head.status,0);assert.equal(head.stdout.trim(),expected,'approved commit unchanged');
  }
  assert.equal(result.error,undefined,'actual shell must finish');
  assert.deepEqual(readdirSync(dir).filter(n=>n.startsWith('isolated-')),[],'contexts cleaned on every exit');
  return {...result,calls,expected,repo};
 } finally {rmSync(dir,{recursive:true,force:true});}
}
const mutations=calls=>calls.filter(({name,a})=>['install','ln','systemctl','certbot'].includes(name)||(name==='git'&&a[0]==='pull')||(name==='docker'&&(a[0]==='build'||['build','up'].includes(a[1]))&&!a.includes('--help')));
for(const [label,scenario,env] of [
 ['missing approval','',{DEPLOY_APPROVED:''}],['wrong approval','',{DEPLOY_APPROVED:'yes'}],
 ['missing commit','',{EXPECTED_COMMIT:''}],['wrong commit','',{EXPECTED_COMMIT:'b'.repeat(40)}],['abbreviated commit','',{EXPECTED_COMMIT:'aaaaaaa'}],
 ['dirty tracked source','dirty',{}],['unsupported gitlinks','gitlink',{}],
 ['missing tar','missing-tar',{}],['missing mktemp','missing-mktemp',{}],['missing rm','missing-rm',{}],
 ['archive failure','archive-fail',{}],['tar failure','tar-fail',{}],
 ['missing environment','missing-env',{}],['missing command','missing-systemctl',{}],
 ['broken compose','compose-fail',{}],['old compose','old-compose',{}],['invalid configuration','config-fail',{}],['invalid nginx prerequisite','nginx-fail',{}],
 ['missing postgres','missing-postgres',{}],['unhealthy postgres','postgres-unhealthy',{}],['unhealthy redis','redis-unhealthy',{}],
 ['payments paused','',{COMMERCE_PAYMENTS_ENABLED:'true'}],['payouts paused','',{COMMERCE_PAYOUTS_ENABLED:'true'}],
])test('preflight rejects '+label+' before mutation',()=>{const r=run(scenario,env);assert.notEqual(r.status,0,r.stdout+r.stderr);assert.deepEqual(mutations(r.calls),[]);});
for(const scenario of ['build-fail','image-label','wait-fail','missing-backend','backend-unhealthy','image-mismatch'])test(scenario+' never reaches ingress or success',()=>{
 const r=run(scenario);assert.notEqual(r.status,0,r.stdout+r.stderr);
 const boundary={
 'build-fail':c=>c.name==='docker'&&c.a[0]==='build',
 'image-label':c=>c.name==='docker'&&c.a[0]==='image',
 'wait-fail':c=>c.name==='docker'&&c.a[1]==='up'&&!c.a.includes('--help'),
 'missing-backend':c=>c.name==='docker'&&c.a[1]==='ps'&&c.a.at(-1)==='backend',
 'backend-unhealthy':c=>c.name==='docker'&&c.a[0]==='inspect'&&c.a.at(-1)==='backend-id',
 'image-mismatch':c=>c.name==='docker'&&c.a[0]==='inspect'&&c.a.join(' ').includes('.Image'),
 }[scenario];
 assert.ok(r.calls.some(boundary),'must reach injected failure');
 assert.equal(r.calls.some(c=>['install','ln','systemctl','certbot'].includes(c.name)),false);assert.doesNotMatch(r.stdout,/Deployment succeeded/);
 if(scenario==='image-label')assert.equal(r.calls.some(c=>c.name==='docker'&&c.a[1]==='up'&&!c.a.includes('--help')),false);
});
for(const scenario of ['install-fail','systemctl-fail','certbot-fail'])test(scenario+' not silently successful',()=>{const r=run(scenario);assert.notEqual(r.status,0);assert.doesNotMatch(r.stdout,/Deployment succeeded/);});
test('healthy exact artifact changes backend only and pauses commerce',()=>{
 const r=run();assert.equal(r.status,0,r.stdout+r.stderr);
 const up=r.calls.filter(c=>c.name==='docker'&&c.a[1]==='up'&&!c.a.includes('--help'));assert.equal(up.length,1);
 assert.deepEqual(up[0].a,['compose','up','-d','--no-deps','--no-build','--wait','--wait-timeout','300','backend']);
 assert.equal(r.calls.some(c=>c.name==='git'&&c.a[0]==='pull'),false);assert.equal(up[0].payments,'false');assert.equal(up[0].payouts,'false');assert.match(r.stdout,/Deployment succeeded.*sha256:built/);
 const check=r.calls.findIndex(c=>c.name==='docker'&&c.a[0]==='inspect'&&c.a.join(' ').includes('.Image'));assert.ok(check>=0&&r.calls.findIndex(c=>c.name==='install')>check);
});
test('compose revision and pause flags',()=>{const source=readFileSync(join(root,'deploy/vps/compose.yaml'),'utf8');assert.match(source,/COMMERCE_PAYMENTS_ENABLED:.*\$\{COMMERCE_PAYMENTS_ENABLED:-false\}/);assert.match(source,/COMMERCE_PAYOUTS_ENABLED:.*\$\{COMMERCE_PAYOUTS_ENABLED:-false\}/);assert.match(source,/org\.opencontainers\.image\.revision:.*EXPECTED_COMMIT/);});
for(const scenario of ['real-success','real-build-fail','real-claude-success','real-claude-build-fail'])test(scenario+' archives only approved bytes and cleans context',()=>{
 const r=run(scenario);assert.equal(r.status===0,scenario.endsWith('success'),r.stdout+r.stderr);
 const build=r.calls.find(c=>c.name==='docker'&&c.a[0]==='build');assert.ok(build,'actual shell must build isolated archive');
 const context=r.calls.find(c=>c.name==='build-context');assert.ok(context);assert.equal(context.tracked,'approved source\n');
 for(const k of ['rogue','ignored','secret','metadata','claude'])assert.equal(context[k],false,k+' excluded');
 assert.ok(!context.context.startsWith(r.repo+'/'));
 assert.deepEqual(build.a,['build','--label','org.opencontainers.image.revision='+r.expected,'--tag','hobbysalon-backend:'+r.expected,'-f',join(context.context,'apps/backend/Dockerfile'),context.context]);
 assert.ok(r.calls.some(c=>c.name==='git'&&c.a.slice(-3).join(' ')==='archive --format=tar '+r.expected));assert.equal(existsSync(context.context),false);
});
for(const scenario of ['real-app-gitlink','real-prefix-gitlink','real-quoted-gitlink'])test(scenario+' refuses unsafe gitlinks before any build',()=>{
 const r=run(scenario);assert.notEqual(r.status,0,r.stdout+r.stderr);
 assert.match(r.stderr,/Gitlinks\/submodules/);assert.deepEqual(mutations(r.calls),[]);
 assert.equal(r.calls.some(c=>c.name==='git'&&c.a.includes('archive')),false);
 assert.equal(r.calls.some(c=>c.name==='mktemp'),false);
});
