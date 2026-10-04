// Actual complete dashboard module, offline SDK contract; PostgreSQL tests enforce SQL CAS.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const root=new URL('../../',import.meta.url);
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function fixture(options={}) {
 const link={id:L,source_entity_type:'article',source_entity_id:A,target_entity_type:'product',target_entity_id:'p',relation_type:'suggested_auto',...options.link};
 const article={id:A,author_creator_id:options.notOwner?'other':C};
 const reads=[],rpcs=[],directMutations=[],revalidated=[];let deleted=false,dbClients=0;
 const tripwire=()=>{throw Error('unexpected collaborator')};
 const from=table=>{
  assert.ok(['articles','entity_links'].includes(table));
  const q={filters:[],columns:null,select(c){this.columns=c;return this},eq(k,v){this.filters.push([k,v]);return this},
   delete(){directMutations.push('delete');return tripwire()},update(){directMutations.push('update');return tripwire()},
   async execute(){
    reads.push({table,filters:this.filters.slice(),columns:this.columns});
    const r=table==='articles'?article:link;
    const ok=!(options.missingLink&&table==='entity_links')&&this.filters.every(([k,v])=>r[k]===v);
    const error=options.readError&&table==='entity_links'?{message:'read fail'}:null;
    return {data:ok&&!error?Object.fromEntries(this.columns.split(',').map(k=>[k,r[k]])):null,error};
   },maybeSingle(){return this.execute()},then(a,b){return this.execute().then(a,b)}};return q;};
 const rpc=async(name,args)=>{
  assert.equal(name,'graph_decide_article_suggestion');
  assert.deepEqual({...args},{p_link_id:L,p_article_id:A,p_creator_id:C,p_relation:null});
  assert.deepEqual(reads,[
   {table:'entity_links',columns:'id,source_entity_id',filters:[['id',L],['source_entity_type','article'],['relation_type','suggested_auto']]},
   {table:'articles',columns:'id',filters:[['id',A],['author_creator_id',C]]},
  ]);
  if(options.race)Object.assign(link,typeof options.race==='object'?options.race:{relation_type:'required_tool'});
  if(options.ownerRace)article.author_creator_id='other';
  const matching=link.id===args.p_link_id&&link.source_entity_type==='article'&&link.source_entity_id===args.p_article_id&&link.relation_type==='suggested_auto'&&article.author_creator_id===args.p_creator_id;
  rpcs.push({name,args:{...args},matching});
  if(options.dbError)return {data:null,error:{message:'RPC fail'}};
  const affected=matching&&!options.zeroAffected;
  if(affected)deleted=true;
  return {data:options.responseData!==undefined?options.responseData:affected,error:null};
 };
 const collaborators={createPlatformClient:()=>{dbClients++;return {from,rpc}},getAuthUser:async()=>options.unauthenticated?null:{id:'user'},getCreatorByUserId:async()=>options.noCreator?null:{id:C},creatorMakerProfileUrl:()=>'/profile',revalidatePath:p=>revalidated.push(p),redirect(location){const e=Error('redirect');e.digest='NEXT_REDIRECT;';e.location=location;throw e}};
 const ctx=vm.createContext({FormData,Error,URL,fetch:tripwire});const text=stripTypeScriptTypes(readFileSync(new URL('apps/storefront/src/app/actions/dashboard.ts',root),'utf8'));const m=new vm.SourceTextModule(text,{context:ctx});
 const bindings=new Map([...text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].map(x=>[x[2],x[1].split(',').map(s=>s.trim()).filter(Boolean)]));
 await m.link(async spec=>{
  if(spec==='@/lib/content/article-suggestion-relation'){
   const helper=new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL('apps/storefront/src/lib/content/article-suggestion-relation.ts',root),'utf8')),{context:ctx});
   await helper.link(tripwire);return helper;
  }
  assert.ok(bindings.has(spec),`Unsupported import: ${spec}`);
  // Includes toArticleProposalPayload as an unused tripwire, without rewriting source.
  return new vm.SyntheticModule(bindings.get(spec),function(){for(const n of bindings.get(spec))this.setExport(n,collaborators[n]??tripwire)},{context:ctx});
 });await m.evaluate();
 const f=new FormData();f.set('entity_link_id',options.submittedId??L);
 let location;try{await m.namespace.dismissArticleSuggestionAction(f)}catch(e){assert.ok(e.digest?.startsWith('NEXT_REDIRECT'),e.stack);location=e.location}
 assert.deepEqual(directMutations,[],'No direct mutation fallback, even after false/error RPC');
 return {reads,rpcs,link,deleted,dbClients,revalidated,params:new URL(location,'http://fixture.invalid').searchParams};
}
test('dismissal pre-reads the exact pending edge and owner, then calls the managed RPC with edge ID, not source ID',async()=>{
 const f=await fixture();assert.equal(f.params.get('success'),'Suggestie verwijderd.');assert.equal(f.params.get('error'),null);assert.equal(f.rpcs.length,1);
 assert.deepEqual(f.rpcs[0].args,{p_link_id:L,p_article_id:A,p_creator_id:C,p_relation:null});
 assert.notEqual(f.rpcs[0].args.p_link_id,f.rpcs[0].args.p_article_id);assert.equal(f.deleted,true);assert.deepEqual(f.revalidated,['/profile']);
});
for(const option of [{race:true},{zeroAffected:true},{dbError:true},{notOwner:true},{ownerRace:true},{race:{source_entity_type:'product'}},{race:{source_entity_id:'other'}}])test(`dismissal refuses misleading success ${JSON.stringify(option)}`,async()=>{
 const f=await fixture(option);assert.equal(f.params.get('success'),null);assert.ok(f.params.get('error'));assert.equal(f.deleted,false);assert.deepEqual(f.revalidated,[]);
 if(option.race===true)assert.equal(f.link.relation_type,'required_tool');
 assert.equal(f.rpcs.length,option.notOwner?0:1);
});
for(const option of [{missingLink:true},{readError:true},{link:{source_entity_type:'product'}},{link:{relation_type:'required_tool'}}])test(`dismissal requires pending article pre-read ${JSON.stringify(option)}`,async()=>{
 const f=await fixture(option);assert.equal(f.params.get('success'),null);assert.ok(f.params.get('error'));assert.equal(f.rpcs.length,0);assert.equal(f.reads.length,1);assert.equal(f.deleted,false);
});
for(const option of [{unauthenticated:true},{noCreator:true},{submittedId:'invalid'}])test(`dismissal rejects before database access ${JSON.stringify(option)}`,async()=>{
 const f=await fixture(option);assert.equal(f.params.get('success'),null);assert.equal(f.dbClients,0);assert.equal(f.rpcs.length,0);
});
test('dismissal rejects a row-shaped RPC response instead of literal true',async()=>{
 const f=await fixture({responseData:{id:A}});assert.equal(f.params.get('success'),null);assert.equal(f.params.get('error'),'Verwijderen van suggestie mislukt.');assert.equal(f.rpcs.length,1);assert.deepEqual(f.revalidated,[]);
});
