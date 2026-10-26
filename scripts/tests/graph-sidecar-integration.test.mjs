import assert from 'node:assert/strict';
import test from 'node:test';
import {sidecarFixture} from './graph-sidecar-fixture.mjs';
import {createArticleSidecarPlanner,createPrivateArticleSidecarReader,loadArticleSidecarPlanner} from '../../apps/storefront/src/lib/content/article-sidecar-matching.ts';
import {loadArticleExistingKeys} from '../../apps/storefront/src/lib/content/article-catalog-pipeline.ts';
import {runArticleMatchingJobs,toArticleProposalPayload} from '../../apps/storefront/src/lib/content/article-matching-jobs.ts';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',token='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const article={id,title:'Mandje haken',excerpt:null,domain_id:null,body_markdown:'## Materialen\n- Haaknaald 6 mm',is_published:true};
const product={targetType:'product',targetId:pid,title:'Haaknaald 6 mm',productType:'supply',domainIds:[]};
const plan=(f,a=article,c=[product],keys=new Set())=>createArticleSidecarPlanner(f.bundle)(a,c,keys);
test('actual sidecar planner scopes explicit needs into pending candidates with unknown compatibility and preserved source roles',async()=>{
  const f=sidecarFixture([article]);const r=await plan(f);
  assert.equal(r.state,'ready_for_review');assert.equal(r.suggestions.length,1);
  const p=toArticleProposalPayload(r.suggestions[0]);
  assert.equal(p.matcher_version,'article-sidecar-v1');assert.equal(p.proposed_relation,'related_product');assert.equal(p.compatibility,'unknown');
  assert.equal(p.evidence.sidecar.source_sha256,f.rows[0].source_sha256);
  assert.equal(p.evidence.sidecar.automatic_publication_allowed,false);
  assert.equal(p.evidence.sidecar.requirements[0].role,'required');assert.equal(p.evidence.sidecar.requirements[0].evidence,'Haaknaald 6 mm');
});
test('stale/missing/null/blocked/gap data never falls back to the text matcher',async()=>{
  const f=sidecarFixture([article]);
  for(const [a,state] of [[{...article,body_markdown:article.body_markdown+' '},'stale'],[{...article,body_markdown:null},'invalid_source'],[{...article,id:pid},'missing_metadata'],[{...article,is_published:false},'unpublished'],[{...article,is_published:undefined},'invalid_source']]){
    const r=await plan(f,a);assert.equal(r.state,state);assert.deepEqual(r.suggestions,[]);
  }
  for(const [patch,state]of [[{gaps:['Need dimensions']},'gap_review_required'],[{quality_routing:{...f.rows[0].quality_routing,automatic_recommendation_blocked:true}},'blocked'],[{source:{is_published:false}},'unpublished']]){
    const r=await plan(sidecarFixture([article],{metadata:patch}));assert.equal(r.state,state);assert.deepEqual(r.suggestions,[]);
  }
});
test('source evidence uses Unicode codepoint spans, rejects wrong offsets, and never uses roundup/example/alternative/unverified needs',async()=>{
  const a={...article,body_markdown:'🧶 '+article.body_markdown};const f=sidecarFixture([a]);assert.equal((await plan(f,a)).suggestions.length,1);
  f.rows[0].tools[0].evidence_span.start++;assert.equal((await plan(f,a)).state,'invalid_evidence');
  for(const role of ['example','alternative']){
    const f=sidecarFixture([article]);f.rows[0].tools[0].role=role;assert.equal((await plan(f)).suggestions.length,0);
  }
  for(const content_kind of ['pattern_overview','inspiration_roundup']){
    const f=sidecarFixture([article],{metadata:{content_kind}});assert.equal((await plan(f)).suggestions.length,0);
  }
  const unverified=sidecarFixture([article]);unverified.rows[0].tools[0].unverified_project_labels=['mandje'];assert.equal((await plan(unverified)).suggestions.length,0);
  const multiple=sidecarFixture([article]);multiple.rows[0].projects=[{label:'mandje',role:'primary'},{label:'muts',role:'primary'}];assert.equal((await plan(multiple)).suggestions.length,0);
});
test('sidecar products need explicit material evidence; topic-only kits, finished objects and contradictory tools stay excluded',async()=>{
  const f=sidecarFixture([article]);
  const r=await plan(f,article,[product,{...product,targetId:'wrong',title:'Haaknaald 8 mm'},
    {...product,targetId:'finished',productType:'handmade',title:'Mandje haken'},
    {...product,targetId:'kit',title:'Wolpakket haken voor beginners'}]);
  assert.deepEqual(r.suggestions.map(x=>x.row.target_entity_id),[pid]);
});
test('all saved review pairs suppress re-nomination, including accepted/dismissed with no entity_link and pagination',async()=>{
  const calls=[];const rows=[{target_entity_type:'product',target_entity_id:pid,state:'dismissed'},
    {target_entity_type:'workshop',target_entity_id:'w',state:'accepted'}];
  const read=async r=>{calls.push(r);return r.table==='graph_article_reviews'?rows.slice(r.offset,r.offset+r.limit):[];};
  const keys=await loadArticleExistingKeys(read,id,{includeReviews:true,pageSize:1});
  assert.equal(keys.has('product:'+pid),true);assert.equal(keys.has('workshop:w'),true);
  assert.ok(calls.some(x=>x.table==='graph_article_reviews'&&x.offset===2));
  assert.equal((await plan(sidecarFixture([article]),article,[product],keys)).suggestions.length,0);
});
test('catalog QA excludes test/unresolved/new/changed listings and carries unknowns without claiming compatibility',async()=>{
  const f=sidecarFixture([article]);
  f.bundle.catalogQualifications=[{product_id:pid,source_sha256:'f'.repeat(64),candidate_retrieval_eligible:true,material_match_eligible:true,
    automatic_compatibility_confirmed:false,semantic_product_kind:'tool',source:{title:product.title,description:null,short_description:null,product_type:'supply',domain_id:null},gaps:['stock unknown']}];
  f.bundle.productMatchRules=[{product_id:pid,candidate_need:'explicit tool use',compatibility_unknown:['size certification'],never_claim:'verified compatible'}];
  const ready=await plan(f);assert.equal(ready.suggestions.length,1);
  const p=toArticleProposalPayload(ready.suggestions[0]);assert.equal(p.compatibility,'unknown');
  assert.deepEqual(p.evidence.sidecar.catalog.unknowns,['stock unknown','size certification']);
  assert.equal((await plan(f,article,[{...product,title:product.title+' changed'}])).suggestions.length,0);
  assert.equal((await plan(f,article,[{...product,targetId:token}])).suggestions.length,0);
  f.bundle.catalogQualifications[0].candidate_retrieval_eligible=false;assert.equal((await plan(f)).suggestions.length,0);
});
test('a product substrate in its description cannot qualify it as the required material',async()=>{
  const a={...article,body_markdown:'Papier voor het model'};
  const f=sidecarFixture([a],{quote:a.body_markdown});f.rows[0].tools=[];
  f.rows[0].materials=[{label:'papier',role:'required',specifications:null,project_labels:[],evidence:a.body_markdown,
    evidence_span:{start:0,end:a.body_markdown.length,unit:'unicode_codepoints'}}];
  const c={...product,title:'Acrylverf',description:'Acrylverf voor gebruik op papier'};
  assert.equal((await plan(f,a,[c])).suggestions.length,0);
});
test('incomplete kits and destash without an explicit leftover need remain manual search only',async()=>{
  const f=sidecarFixture([article]);const row={product_id:pid,source_sha256:'f'.repeat(64),candidate_retrieval_eligible:true,material_match_eligible:true,
    automatic_compatibility_confirmed:false,semantic_product_kind:'kit',source:{title:product.title,description:null,short_description:null,product_type:'supply',domain_id:null},gaps:[]};
  f.bundle.catalogQualifications=[row];assert.equal((await plan(f)).suggestions.length,0);
  row.semantic_product_kind='material_destash';assert.equal((await plan(f)).suggestions.length,0);
});
function workerFixture(f,options={}) {
  const calls=[];let claimed=false;
  const tables={articles:[options.article??article],products:[{id:pid,title:product.title,product_type:'supply',is_active:true,status:'active'}],
    workshops:[],events:[],event_domains:[],entity_links:[],graph_article_reviews:options.reviews??[]};
  return {calls,plan:createArticleSidecarPlanner(f.bundle),
    read:async r=>{calls.push({name:r.table});return (tables[r.table]??[]).slice(r.offset,r.offset+r.limit).map(x=>Object.fromEntries(r.columns.split(',').map(k=>[k,x[k]])));},
    rpc:async(name,args)=>{calls.push({name,args});if(name==='graph_claim_matching_jobs'){if(claimed)return [];claimed=true;return [{job_key:'article:'+id,kind:'article',article_id:id,revision:1,claimed_revision:1,lease_token:token,lease_until:'2099-01-01T00:00:00Z',status:'running',attempts:1}];}
      if(name==='graph_article_fingerprint')return 'postgres-original-fence';
      if(name==='graph_propose_article_suggestions'){if(options.staleRpc)throw Error('stale article fingerprint');return args.p_proposals.length;}
      if(name==='graph_release_matching_job')return {released:true,status:args.p_outcome==='success'?'complete':'pending'};
      throw Error('Unexpected RPC');},};
}
test('real worker uses same detached body snapshot, original SQL fence and semantic proposal, with no direct writes/approval',async()=>{
  const f=workerFixture(sidecarFixture([article]));const r=await runArticleMatchingJobs(f);
  assert.equal(r.inserted,1);assert.equal(r.outcomes[0].sidecarState,'ready_for_review');
  const p=f.calls.find(x=>x.name==='graph_propose_article_suggestions').args;
  assert.equal(p.p_fingerprint,'postgres-original-fence');assert.equal(p.p_proposals[0].matcher_version,'article-sidecar-v1');
  assert.equal(f.calls.filter(x=>x.name==='articles').length,1);assert.ok(f.calls.some(x=>x.name==='graph_article_reviews'));
  assert.ok(f.calls.every(x=>!x.name.includes('approve')&&!x.name.includes('insert')));
});
test('worker records gate outcomes without proposals and respects review memory; malformed planner never triggers legacy fallback',async()=>{
  const bundle=sidecarFixture([article]);
  for(const options of [{article:{...article,body_markdown:article.body_markdown+' '}},{reviews:[{target_entity_type:'product',target_entity_id:pid,state:'accepted'}]}]){
    const f=workerFixture(bundle,options);const r=await runArticleMatchingJobs(f);assert.equal(r.inserted,0);assert.equal(r.completed,1);
    assert.ok(!f.calls.some(x=>x.name==='graph_propose_article_suggestions'));
  }
  const f=workerFixture(bundle);f.plan=()=>null;const r=await runArticleMatchingJobs(f);assert.equal(r.failed,1);assert.ok(!f.calls.some(x=>x.name==='graph_propose_article_suggestions'));
  const stale=workerFixture(bundle,{staleRpc:true});assert.equal((await runArticleMatchingJobs(stale)).failed,1);
});
test('private Storage integration makes authenticated GETs only; verifies pinned bytes and rejects tamper/errors without credential leaks',async()=>{
  const f=sidecarFixture([article]);const calls=[];
  const fetcher=async(url,options)=>{calls.push({url:String(url),options});const name=String(url).split('v1-2026-10-26/')[1];return new Response(f.files.get(name),{status:200});};
  const read=createPrivateArticleSidecarReader('https://fixture.supabase.co','synthetic-local-key',fetcher);
  const planner=await loadArticleSidecarPlanner(read,f.manifestSha256);assert.equal((await planner(article,[product],new Set())).suggestions.length,1);
  assert.equal(calls.length,3);assert.ok(calls.every(x=>x.options.method==='GET'&&x.options.redirect==='error'&&x.options.headers.apikey==='synthetic-local-key'));
  assert.ok(calls.every(x=>x.url.startsWith('https://fixture.supabase.co/storage/v1/object/article-metadata-sidecar/v1-2026-10-26/')));
  await assert.rejects(loadArticleSidecarPlanner(read),/digest mismatch/);
  f.files.set('article_metadata.jsonl',Buffer.from('tampered'));await assert.rejects(loadArticleSidecarPlanner(read,f.manifestSha256),/integrity mismatch/);
  const fail=createPrivateArticleSidecarReader('https://fixture.supabase.co','synthetic-local-key',async()=>{throw Error('synthetic-local-key sensitive response');});
  await assert.rejects(fail('manifest.json'),e=>e.message==='Private sidecar download failed');
});
