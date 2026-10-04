import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const script=path.join(root,'apps/storefront/scripts/run-article-matching-jobs.ts');
const resolver=path.join(root,'apps/storefront/scripts/test-resolver-register.mjs');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',token='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const article={id,title:'Mandje haken',body_markdown:'## Materialen\n- Haaknaald 6 mm',excerpt:null,domain_id:null,is_published:true};
const job={job_key:`article:${id}`,kind:'article',article_id:id,revision:1,claimed_revision:1,status:'running',lease_token:token,lease_until:'2099-01-01T00:00:00Z',attempts:1};
async function fixture(fn,options={}){
  const calls=[];const dir=await mkdtemp(path.join(tmpdir(),'graph-worker-cli-'));let claims=0;
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost'),name=url.pathname.split('/').at(-1);let body='';for await(const chunk of req)body+=chunk;
    const args=body?JSON.parse(body):null;calls.push({method:req.method,name,url:req.url,args,key:req.headers.apikey});
    if(options.fail===name){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'secret-sensitive-HTTP-body'}));return;}
    if(options.redirect===name){res.writeHead(302,{Location:'/should-not-follow'});res.end();return;}
    let result;
    if(req.method==='POST'){
      if(name==='graph_claim_matching_jobs')result=options.repeat||claims++===0?[options.catalog?{...job,kind:'catalog',job_key:'catalog',article_id:null}:job]:[];
      else if(name==='graph_article_fingerprint')result='original-fingerprint';
      else if(name==='graph_propose_article_suggestions')result=options.dismissed?0:args.p_proposals.length;
      else if(name==='graph_release_matching_job')result={released:true,status:options.releaseStatus??(args.p_outcome==='success'?'complete':'pending')};
      else if(name==='graph_fanout_matching_job')result={done:options.done??true,enqueued:1};
      else{res.writeHead(400);res.end();return;}
    }else{
      const tables={articles:[article],products:[{id:pid,title:'Haaknaald 6 mm',is_active:true,status:'active',product_type:'supply',creator_id:'other-owner'}],workshops:[],events:[],event_domains:[],entity_links:[]};
      if(!Object.hasOwn(tables,name)){res.writeHead(400);res.end();return;}
      result=tables[name];for(const[k,v]of url.searchParams)if(v.startsWith('eq.'))result=result.filter(r=>String(r[k])===v.slice(3));
      result=result.slice(Number(url.searchParams.get('offset')),Number(url.searchParams.get('offset'))+Number(url.searchParams.get('limit')));
      result=result.map(r=>Object.fromEntries(url.searchParams.get('select').split(',').map(k=>[k,r[k]])));
    }
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const envFile=path.join(dir,'worker.env');
  await writeFile(envFile,`SUPABASE_URL=http://127.0.0.1:${server.address().port}\n${options.anon?'NEXT_PUBLIC_SUPABASE_ANON_KEY':'SUPABASE_SERVICE_ROLE_KEY'}=synthetic-local-key\n`);
  const run=(args=[],importOnly=false)=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--max-old-space-size=160','--experimental-strip-types','--import',resolver,...(importOnly?['--input-type=module','-e',typeof importOnly==='string'?importOnly:`import ${JSON.stringify(new URL('file://'+script).href)}`]:[script,'--env-file',envFile,...args])],{cwd:dir,env:{PATH:process.env.PATH,HOME:dir,NODE_NO_WARNINGS:'1'}});
    let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.once('error',reject);child.once('exit',code=>resolve({code,stdout,stderr}));
  });try{await fn({run,calls});}finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
}
test('real CLI GET/RPC wire protocol, original fingerprint and pending evidence; never table writes',async()=>{
  await fixture(async({run,calls})=>{const r=await run();assert.equal(r.code,0,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.completed,1);assert.equal(report.inserted,1);
    const claim=calls.find(c=>c.name==='graph_claim_matching_jobs');assert.deepEqual(claim.args,{p_limit:1,p_lease_seconds:120});
    assert.ok(calls.findIndex(c=>c.name==='graph_article_fingerprint')<calls.findIndex(c=>c.name==='articles'));
    const proposal=calls.find(c=>c.name==='graph_propose_article_suggestions').args;assert.equal(proposal.p_fingerprint,'original-fingerprint');assert.equal(proposal.p_proposals[0].target_entity_id,pid);assert.equal(proposal.p_proposals[0].proposed_relation,'related_product');assert.equal(proposal.p_proposals[0].matcher_version,'article-catalog-v1');assert.ok(proposal.p_proposals[0].evidence.length);
    assert.ok(calls.every(c=>c.method==='GET'||c.url.startsWith('/rest/v1/rpc/')));assert.ok(calls.filter(c=>c.name==='products').every(c=>!c.url.includes('creator_id')));assert.ok(!r.stdout.includes('synthetic-local-key'));assert.ok(!r.stderr.includes('synthetic-local-key'));
  });
});
test('CLI help/import are inert, unknown options and malformed bounds fail before HTTP',async()=>{
  await fixture(async({run,calls})=>{assert.equal((await run(['--help'])).code,0);assert.equal((await run([],true)).code,0);
    for(const args of [['--approve'],['--max-jobs','21'],['--max-jobs','0'],['--max-jobs','1.2'],['--max-catalog-batches','21'],['--max-catalog-batches','0'],['--max-jobs'],['--max-jobs','1','--max-jobs','2']]){const r=await run(args);assert.equal(r.code,1);assert.equal(r.stdout,'');}assert.equal(calls.length,0);
  });
});
test('service-role key is mandatory; anonymous fallback is forbidden',async()=>{await fixture(async({run,calls})=>{const r=await run();assert.equal(r.code,1);assert.equal(calls.length,0);assert.ok(!r.stderr.includes('synthetic-local-key'));},{anon:true});});
test('CLI release reports pending revision as deferred and terminal SQL failure with nonzero exit',async()=>{
  for(const status of ['pending','failed'])await fixture(async({run,calls})=>{
    const r=await run();assert.equal(r.code,status==='failed'?1:0,r.stderr);
    const report=JSON.parse(r.stdout);assert.equal(report.completed,0);assert.equal(report[status==='failed'?'failed':'deferred'],1);
    assert.equal(calls.filter(c=>c.name==='graph_release_matching_job').length,1);
  },{releaseStatus:status});
});
test('default and explicit max-jobs bound actual HTTP claim effects',async()=>{for(const [args,max]of [[[],5],[['--max-jobs','20'],20]])await fixture(async({run,calls})=>{const r=await run(args);assert.equal(r.code,0,r.stderr);assert.equal(JSON.parse(r.stdout).claimed,max);assert.equal(calls.filter(c=>c.name==='graph_claim_matching_jobs').length,max);},{repeat:true});});
test('catalog partial bounded default four/explicit twenty yields successfully and stops',async()=>{for(const [args,max]of [[[],4],[['--max-catalog-batches','20'],20]])await fixture(async({run,calls})=>{const r=await run(args);assert.equal(r.code,0,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.deferred,1);assert.equal(report.completed,0);assert.equal(calls.filter(c=>c.name==='graph_fanout_matching_job').length,max);assert.equal(calls.find(c=>c.name==='graph_release_matching_job').args.p_outcome,'yield');assert.equal(calls.filter(c=>c.name==='graph_claim_matching_jobs').length,1);},{catalog:true,done:false});});
test('SQL zero dismissed result is respected; no retry or fallback insertion',async()=>{await fixture(async({run,calls})=>{const r=await run();assert.equal(r.code,0,r.stderr);assert.equal(JSON.parse(r.stdout).inserted,0);assert.equal(calls.filter(c=>c.name==='graph_propose_article_suggestions').length,1);},{dismissed:true});});
test('imported real transport rejects unknown tables/RPC before effects, explicit env ignores ambient project',async()=>{
  await fixture(async({run,calls})=>{
    const code=`import assert from 'node:assert/strict';import {createWorkerTransport,main} from ${JSON.stringify(new URL('file://'+script).href)};const before={...process.env};const t=createWorkerTransport('http://127.0.0.1:1','fixture-key');await assert.rejects(t.read({table:'graph_article_reviews',columns:'*',order:[],offset:0,limit:1}));await assert.rejects(t.rpc('graph_autoapprove',{}));await main(['--env-file',${JSON.stringify('ENV_PLACEHOLDER')}],{SUPABASE_SERVICE_ROLE_KEY:'ambient-secret',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1'});assert.deepEqual({...process.env},before);`;
    // The fixture file is available beside the child CWD, never production configuration.
    const r=await run([],code.replace(JSON.stringify('ENV_PLACEHOLDER'),JSON.stringify('worker.env')));assert.equal(r.code,0,r.stderr);assert.equal(JSON.parse(r.stdout).completed,1);assert.ok(calls.every(c=>c.key==='synthetic-local-key'));
  });
});
test('HTTP failure/redirect are generic sanitized, no retry or redirected request, truthful failed exit',async()=>{for(const options of [{fail:'products'},{redirect:'products'}])await fixture(async({run,calls})=>{const r=await run();assert.equal(r.code,1);assert.equal(JSON.parse(r.stdout).failed,1);assert.ok(!r.stderr.includes('secret-sensitive'));assert.ok(!r.stdout.includes('secret-sensitive'));assert.ok(!r.stderr.includes('127.0.0.1'));assert.equal(calls.filter(c=>c.name==='products').length,1);assert.ok(!calls.some(c=>c.name==='should-not-follow'));},options);});
