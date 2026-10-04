// Focused offline integration: actual pipeline, matcher and eligibility helper.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
const pipelinePath = 'apps/storefront/src/lib/content/article-catalog-pipeline.ts';
async function load() {
  const context = vm.createContext({ Date, Error });
  const cache = new Map();
  async function module(path) {
    if (cache.has(path)) return cache.get(path);
    const m = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL(path, root), 'utf8')), {context, identifier:path});
    cache.set(path, m);
    await m.link(async specifier => {
      const resolved = new URL(specifier + (specifier.endsWith('.ts') ? '' : '.ts'), new URL(path, root));
      return module(resolved.href.slice(root.href.length));
    });
    return m;
  }
  const m = await module(pipelinePath); await m.evaluate(); return m.namespace;
}
const article = {id:'a', title:'Mandje haken', excerpt:null, body_markdown:'## Materialen\n- Haaknaald 6 mm', domain_id:'d', is_published:true};
const product = {id:'p', title:'Haaknaald 6 mm', description:null, domain_id:'d', is_active:true, status:'active', product_type:'supply', creator_id:'other-merchant'};
function fixture(overrides = {}, failTable) {
  const tables = {articles:[article], products:[product], workshops:[], events:[], event_domains:[], entity_links:[], ...overrides};
  const reads = [];
  const read = async request => {
    reads.push(structuredClone(request));
    if(request.table === failTable) throw Error('offline read error');
    let rows = tables[request.table] ?? [];
    for(const [key,value] of Object.entries(request.equals ?? {})) rows = rows.filter(row=>row[key] === value);
    rows = [...rows].sort((a,b)=>a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return rows.slice(request.offset,request.offset + request.limit).map(row=>Object.fromEntries(request.columns.split(',').map(key=>[key,row[key]])));
  };
  return {read,reads,tables};
}
test('cross-merchant catalog scan pages beyond first page and suppresses domain-only candidates', async () => {
  const api = await load(); const f = fixture({products:[{...product,id:'0',title:'Schildersezel'},product]});
  const catalog = await api.loadArticleCatalog(f.read, {pageSize:1,now:new Date('2026-10-03T00:00:00Z')});
  const links = await api.loadArticleExistingKeys(f.read,'a',{pageSize:1});
  const result = api.planArticleSuggestions(article,catalog,links);
  assert.deepEqual(Array.from(result,m=>m.row.target_entity_id),['p']);
  assert.equal(result[0].row.relation_type,'suggested_auto');
  assert.equal(result[0].proposedRelation,'related_product');
  assert.ok(result[0].evidence.length);
  assert.ok(f.reads.filter(r=>r.table==='products').some(r=>r.offset===1));
  assert.ok(f.reads.every(r=>!Object.hasOwn(r.equals ?? {},'creator_id')));
});
test('excludes archived/inactive products, unpaid/expired workshops and past events; supports event domains', async () => {
  const api = await load(); const f = fixture({products:[{...product,status:'archived'},{...product,id:'inactive',is_active:false}],
    workshops:[{id:'w',title:'Haken',domain_id:'d',is_active:true,listing_fee_status:'launch_free'},
      {id:'unpaid',title:'Haken',is_active:true,listing_fee_status:'unpaid'},
      {id:'expired',title:'Haken',is_active:true,listing_fee_status:'paid',listing_expires_at:'2026-10-02'}],
    events:[{id:'e',title:'Haakfestival haken',is_active:true,ends_at:'2026-10-04'},
      {id:'past',title:'Haken',is_active:true,ends_at:'2026-10-02'}],
    event_domains:[{id:'ed',event_id:'e',domain_id:'d'}]});
  const candidates=await api.loadArticleCatalog(f.read,{pageSize:2,now:new Date('2026-10-03T00:00:00Z')});
  assert.deepEqual(Array.from(candidates,c=>c.targetId).sort(),['e','w']);
  assert.deepEqual(Array.from(candidates.find(c=>c.targetId==='e').domainIds),['d']);
});
test('preserves existing pending/manual/outbound/inbound keys without touching rows', async () => {
  const api=await load(); const f=fixture({entity_links:[
    {id:'1',source_entity_type:'article',source_entity_id:'a',target_entity_type:'product',target_entity_id:'p',relation_type:'required_material'},
    {id:'2',source_entity_type:'workshop',source_entity_id:'w',target_entity_type:'article',target_entity_id:'a',relation_type:'related'},
    {id:'3',source_entity_type:'article',source_entity_id:'a',target_entity_type:'event',target_entity_id:'e',relation_type:'suggested_auto'}]});
  const before=JSON.stringify(f.tables);
  const keys=await api.loadArticleExistingKeys(f.read,'a',{pageSize:1});
  assert.deepEqual(Array.from(keys).sort(),['event:e','product:p','workshop:w']);
  const candidates=await api.loadArticleCatalog(f.read);
  assert.equal(api.planArticleSuggestions(article,candidates,keys).length,0);
  assert.equal(JSON.stringify(f.tables),before);
});
test('read failure aborts rather than planning from incomplete catalog or missing existing decisions', async () => {
  const api=await load();
  await assert.rejects(api.loadArticleCatalog(fixture({},'event_domains').read),/offline read error/);
  await assert.rejects(api.loadArticleExistingKeys(fixture({},'entity_links').read,'a'),/offline read error/);
});
test('pending rows are bounded deterministic recommendations, never requirements', async () => {
  const api=await load(); const catalog=Array.from({length:6},(_,i)=>({targetType:'product',targetId:`p${i}`,title:'Haaknaald 6 mm',domainIds:['d'],productType:'supply'}));
  const results=api.planArticleSuggestions(article,catalog,new Set());
  assert.equal(results.length,3);
  assert.ok(results.every(m=>m.row.relation_type==='suggested_auto' && m.row.weight<=100 && m.proposedRelation==='related_product'));
  assert.deepEqual(Array.from(results,m=>m.row.sort_order),[1,2,3]);
  assert.equal(JSON.stringify(results),JSON.stringify(api.planArticleSuggestions(article,[...catalog].reverse(),new Set())));
});
