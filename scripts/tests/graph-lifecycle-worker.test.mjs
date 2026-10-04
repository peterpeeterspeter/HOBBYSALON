import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
async function load(){
  const context=vm.createContext({Date,Error});const cache=new Map();
  async function module(url){
    if(cache.has(url.href))return cache.get(url.href);
    const m=new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(url,'utf8')),{context,identifier:url.href});cache.set(url.href,m);
    await m.link(s=>module(new URL(s+(s.endsWith('.ts')?'':'.ts'),url)));return m;
  }
  const m=await module(new URL('apps/storefront/src/lib/content/article-matching-jobs.ts',root));await m.evaluate();return m.namespace;
}
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',token='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const article={id,title:'Mandje haken',excerpt:null,body_markdown:'## Materialen\n- Haaknaald 6 mm',domain_id:null,is_published:true};
const product={id:pid,title:'Haaknaald 6 mm',is_active:true,status:'active',product_type:'supply',creator_id:'another-owner'};
const job={job_key:`article:${id}`,kind:'article',article_id:id,revision:1,claimed_revision:1,lease_token:token,lease_until:'2099-01-01T00:00:00Z',status:'running',attempts:1};
function fixture(options={}){
  const calls=[];let claims=0;const tables={articles:[article],products:[{...product,id:'00000000-0000-4000-8000-000000000000',title:'Schildersezel'},product],workshops:[],events:[],event_domains:[],entity_links:[],...options.tables};
  const read=async r=>{calls.push({name:r.table,args:structuredClone(r)});if(r.table===options.failTable)throw Error('secret https://credential@example.invalid');let rows=tables[r.table];if(!rows)throw Error('unknown table');for(const[k,v]of Object.entries(r.equals??{}))rows=rows.filter(x=>x[k]===v);return rows.slice(r.offset,r.offset+r.limit).map(x=>Object.fromEntries(r.columns.split(',').map(k=>[k,x[k]])));};
  const rpc=async(name,args)=>{
    calls.push({name,args:structuredClone(args)});
    if(name==='graph_claim_matching_jobs')return claims++===0?(options.claim??[job]):[];
    if(name==='graph_article_fingerprint')return 'original-fingerprint';
    if(name==='graph_propose_article_suggestions'){if(options.stale)throw Error('stale source');return options.inserted??args.p_proposals.length;}
    if(name==='graph_release_matching_job')return options.release??(options.finish===false?{released:false,status:null}:{released:true,status:args.p_outcome==='success'?'complete':'pending'});
    if(name==='graph_fanout_matching_job')return options.fanout??{done:true,enqueued:1};
    throw Error('unknown RPC');
  };return{read,rpc,calls,tables};
}
const counts=r=>Object.fromEntries(['claimed','completed','failed','deferred','lost','inserted'].map(k=>[k,r[k]]));
test('release uses actual SQL state: revision pending is deferred, terminal failure is failed, malformed state fails closed',async()=>{
  const api=await load();
  for(const [release,expected] of [[{released:true,status:'pending'},'deferred'],[{released:true,status:'failed'},'failed'],[{released:false,status:null},'lost'],[{released:true,status:'running'},'failed'],[{released:'true',status:'complete'},'failed'],[{released:true,status:['complete']},'failed']]) {
    const f=fixture({release}),r=await api.runArticleMatchingJobs(f);
    assert.equal(r[expected],1);assert.equal(r.completed,0);assert.equal(r.inserted,1);
    const calls=f.calls.filter(c=>c.name==='graph_release_matching_job');assert.equal(calls.length,1);
    assert.equal(calls[0].args.p_outcome,'success');assert.ok(!f.calls.some(c=>c.name==='graph_finish_matching_job'));
  }
});
test('actual matcher: fingerprint precedes article, pages full cross-owner catalog, pending proposals only',async()=>{
  const api=await load(),f=fixture();const r=await api.runArticleMatchingJobs({...f,pageSize:1});
  assert.deepEqual(counts(r),{claimed:1,completed:1,failed:0,deferred:0,lost:0,inserted:1});
  const names=f.calls.map(c=>c.name);assert.ok(names.indexOf('graph_article_fingerprint')<names.indexOf('articles'));
  const p=f.calls.find(c=>c.name==='graph_propose_article_suggestions').args;
  assert.equal(p.p_fingerprint,'original-fingerprint');assert.equal(p.p_proposals[0].target_entity_id,pid);
  assert.deepEqual(Object.keys(p.p_proposals[0]).sort(),['compatibility','evidence','matcher_version','proposed_relation','score','sort_order','target_entity_id','target_entity_type','weight'].sort());
  assert.equal(p.p_proposals[0].matcher_version,'article-catalog-v1');assert.equal(p.p_proposals[0].proposed_relation,'related_product');assert.ok(p.p_proposals[0].evidence.length);
  assert.ok(f.calls.some(c=>c.name==='products'&&c.args.offset===1));assert.ok(f.calls.filter(c=>c.name==='products').every(c=>!('creator_id'in(c.args.equals??{}))));
  assert.ok(f.calls.filter(c=>c.name==='graph_claim_matching_jobs').every(c=>c.args.p_limit===1&&c.args.p_lease_seconds===120));
});
test('terminal dismissal stays SQL authoritative: zero insertion is valid, no lower-level writes',async()=>{
  const api=await load(),f=fixture({inserted:0});const r=await api.runArticleMatchingJobs(f);assert.equal(r.inserted,0);assert.equal(r.completed,1);
  assert.equal(f.calls.filter(c=>c.name==='graph_propose_article_suggestions').length,1);assert.ok(f.calls.every(c=>!c.name.includes('approve')&&!c.name.includes('review')));
});
test('concurrent semantic source change rejects original fingerprint and retries sanitized',async()=>{
  const api=await load(),f=fixture({stale:true});const original=f.read;f.read=async r=>{const rows=await original(r);if(r.table==='articles')f.tables.articles[0]={...article,title:'Nieuwe inhoud'};return rows;};
  const r=await api.runArticleMatchingJobs(f);assert.equal(r.failed,1);assert.equal(r.completed,0);
  assert.equal(f.calls.find(c=>c.name==='graph_propose_article_suggestions').args.p_fingerprint,'original-fingerprint');
  assert.equal(f.calls.find(c=>c.name==='graph_release_matching_job').args.p_outcome,'failure');assert.ok(!JSON.stringify(r).includes('secret'));
});
test('read error retries and lease loss is not completed; committed insert remains counted',async()=>{
  const api=await load();for(const options of [{failTable:'products'},{failTable:'products',finish:false},{finish:false}]){
    const f=fixture(options),r=await api.runArticleMatchingJobs(f);assert.equal(r.completed,0);assert.equal(r.lost,options.finish===false?1:0);assert.equal(r.failed,options.finish===false?0:1);
    assert.equal(r.inserted,options.failTable?0:1);assert.ok(!JSON.stringify(f.calls.at(-2)).includes('credential'));
  }
});
test('deleted article reports lost when queue row vanished, never invented success',async()=>{
  const api=await load(),f=fixture({tables:{articles:[]},finish:false});const r=await api.runArticleMatchingJobs(f);assert.equal(r.lost,1);assert.equal(r.completed,0);assert.ok(!f.calls.some(c=>c.name==='graph_propose_article_suggestions'));
});
test('catalog completion owns finish; partial catalog yields pending/backoff once and breaks claim loop',async()=>{
  const api=await load(),catalog={...job,kind:'catalog',job_key:'catalog',article_id:null};
  for(const done of [true,false]){const f=fixture({claim:[catalog],fanout:{done,enqueued:2}}),r=await api.runArticleMatchingJobs({...f,maxCatalogBatches:2});
    assert.equal(r.completed,done?1:0);assert.equal(r.deferred,done?0:1);assert.equal(r.failed,0);
    const finishes=f.calls.filter(c=>c.name==='graph_release_matching_job');assert.equal(finishes.length,done?0:1);if(!done){assert.equal(finishes[0].args.p_outcome,'yield');assert.equal(f.calls.filter(c=>c.name==='graph_claim_matching_jobs').length,1);}
  }
});
test('malformed claims fail before reads/finishes and bounds fail before claim',async()=>{
  const api=await load();for(const claim of [{},[job,job],[{...job,lease_token:'bad'}],[{...job,kind:'unknown'}],[{...job,attempts:6}]]){
    const f=fixture({claim});await assert.rejects(api.runArticleMatchingJobs(f));assert.equal(f.calls.length,1);
  }
  for(const limits of [{maxJobs:21},{maxJobs:0},{maxJobs:1.2},{maxCatalogBatches:21},{pageSize:0}]){const f=fixture();await assert.rejects(api.runArticleMatchingJobs({...f,...limits}));assert.equal(f.calls.length,0);}
});
test('malformed proposal and fanout counts rejected, no false completion',async()=>{
  const api=await load();for(const inserted of ['1',-1,2,NaN]){const f=fixture({inserted}),r=await api.runArticleMatchingJobs(f);assert.equal(r.failed,1);assert.equal(r.completed,0);assert.equal(r.inserted,0);}
  for(const fanout of [{done:'true',enqueued:1},{done:false,enqueued:-1},{done:true,enqueued:201},null]){const f=fixture({claim:[{...job,kind:'catalog',job_key:'catalog',article_id:null}],fanout});if(fanout===null)f.rpc=async(n,a)=>{f.calls.push({name:n,args:a});if(n==='graph_claim_matching_jobs')return f.calls.length===1?[{...job,kind:'catalog',job_key:'catalog',article_id:null}]:[];if(n==='graph_fanout_matching_job')return null;return {released:true,status:'pending'};};const r=await api.runArticleMatchingJobs(f);assert.equal(r.failed,1);assert.equal(r.completed,0);}
});
test('default and explicit max-jobs are hard single-claim bounds',async()=>{
  const api=await load();for(const maxJobs of [undefined,20]){const f=fixture();const orig=f.rpc;f.rpc=async(n,a)=>n==='graph_claim_matching_jobs'?(f.calls.push({name:n,args:a}),[job]):orig(n,a);const r=await api.runArticleMatchingJobs({...f,maxJobs});assert.equal(r.claimed,maxJobs??5);assert.equal(r.completed,maxJobs??5);}
});
