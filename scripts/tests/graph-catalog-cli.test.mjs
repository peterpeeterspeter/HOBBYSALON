import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const script=path.join(root,'apps/storefront/scripts/auto-link-articles.ts');
const resolver=path.join(root,'apps/storefront/scripts/test-resolver-register.mjs');
const article={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Mandje haken',excerpt:null,body_markdown:'## Materialen\n- Haaknaald 6 mm',domain_id:'d',is_published:true,author_creator_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
const product={id:'p',title:'Haaknaald 6 mm',product_type:'supply',status:'active',is_active:true,domain_id:'d'};
async function fixture(fn,options={}) {
  const calls=[];const dir=await mkdtemp(path.join(tmpdir(),'graph-catalog-cli-'));
  const server=createServer((req,res)=>{
    calls.push({method:req.method,url:req.url,key:req.headers.apikey});
    const url=new URL(req.url,'http://localhost');const table=url.pathname.split('/').at(-1);
    if(options.fail===table){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'sensitive provider response'}));return;}
    const tables={articles:[article],products:[product,{...product,id:'irrelevant',title:'Schildersezel'}],workshops:[],events:[],event_domains:[],entity_links:[],...options.tables};
    let rows=tables[table]??[];
    for(const [key,value] of url.searchParams)if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===value.slice(3));
    const start=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??200);
    rows=rows.slice(start,start+limit);const columns=(url.searchParams.get('select')??'*').split(',');
    if(columns[0]!=='*')rows=rows.map(row=>Object.fromEntries(columns.map(key=>[key,row[key]])));
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(rows));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const envPath=path.join(dir,'test.env');
  await writeFile(envPath,`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${server.address().port}\nSUPABASE_SERVICE_ROLE_KEY=synthetic-local-fixture-key\n`);
  const run=(args=[],packageCommand=false)=>new Promise(async(resolve,reject)=>{
    try {
    const env={PATH:process.env.PATH,HOME:dir};
    const pkg=JSON.parse(await readFile(path.join(root,'apps/storefront/package.json'),'utf8'));
    const launch=packageCommand ? pkg.scripts['auto-link:articles'].split(' ').slice(1).map(arg=>arg==='scripts/auto-link-articles.ts'?script:arg.startsWith('./scripts/')?path.join(root,'apps/storefront',arg):arg) : ['--experimental-strip-types','--import',resolver,script];
    const child=spawn(process.execPath,[...launch,'--env-file',envPath,...args],{cwd:dir,env});
    let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
    child.once('error',reject);child.once('exit',code=>resolve({code,stdout,stderr}));
    } catch(error) { reject(error); }
  });
  try{await fn({run,calls});}finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
}
test('actual CLI defaults to dry-run, reports evidence across catalog and makes GET calls only',async()=>{
  await fixture(async({run,calls})=>{
    const result=await run([],true);assert.equal(result.code,0,result.stderr);
    const report=JSON.parse(result.stdout);assert.equal(report.mode,'dry-run');assert.equal(report.writes,0);
    assert.equal(report.articlesScanned,1);assert.equal(report.proposals.length,1);
    assert.equal(report.proposals[0].row.target_entity_id,'p');assert.equal(report.proposals[0].row.relation_type,'suggested_auto');
    assert.ok(report.proposals[0].evidence.length);assert.equal(report.proposals[0].proposedRelation,'related_product');
    assert.ok(calls.length>0);assert.ok(calls.every(c=>c.method==='GET'));
    assert.ok(calls.filter(c=>c.url.includes('/products?')).every(c=>!c.url.includes('creator_id')));
    assert.ok(!result.stdout.includes('synthetic-local-fixture-key'));assert.ok(!result.stderr.includes('synthetic-local-fixture-key'));
  });
});
test('CLI rejects unknown/write arguments and bad limits before any HTTP request',async()=>{
  await fixture(async({run,calls})=>{
    for(const args of [['--write'],['--limit','2junk'],['--limit','0'],['--author-creator-id','bad'],['--limit']]){
      const result=await run(args);assert.equal(result.code,1);assert.ok(result.stderr.length);
    }
    assert.equal(calls.length,0);
  });
});
test('read failure exits nonzero without fabricated report, writes or provider response leakage',async()=>{
  await fixture(async({run,calls})=>{
    const result=await run(['--dry-run']);assert.equal(result.code,1);
    assert.equal(result.stdout,'');assert.ok(!result.stderr.includes('sensitive provider response'));
    assert.ok(calls.every(c=>c.method==='GET'));
  },{fail:'entity_links'});
});
test('limit and explicit author scope bound the articles, never restrict catalog merchants',async()=>{
  await fixture(async({run,calls})=>{
    const result=await run(['--limit','1','--author-creator-id',article.author_creator_id]);assert.equal(result.code,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).articlesScanned,1);
    const articleCall=calls.find(c=>c.url.includes('/articles?'));assert.ok(articleCall.url.includes('author_creator_id'));
    assert.ok(articleCall.url.includes('limit=1'));
    assert.ok(calls.filter(c=>c.url.includes('/products?')).every(c=>!c.url.includes('creator_id')));
  },{tables:{articles:[article,{...article,id:'b'},{...article,id:'c',author_creator_id:'other'}]}});
});
test('existing nomination is excluded in the real CLI output',async()=>{
  await fixture(async({run,calls})=>{
    const result=await run([],true);assert.equal(result.code,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).proposals.length,0);assert.ok(calls.every(c=>c.method==='GET'));
  },{tables:{entity_links:[{id:'l',source_entity_type:'article',source_entity_id:article.id,target_entity_type:'product',target_entity_id:'p',relation_type:'suggested_auto'}]}});
});
