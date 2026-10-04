import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function fixture(options={}) {
  const reads=[],writes=[],revalidated=[],rpcs=[],timeline=[];
  const tables={articles:[{id:A,author_creator_id:C,slug:'mandje'}],products:[{id:'p',title:'Haaknaald 6 mm',product_type:'supply',domain_id:null,status:'active',is_active:true,creator_id:'other'}],workshops:[],events:[],event_domains:[],entity_links:options.links??[]};
  function from(table) {
    const q={columns:'*',filters:[],op:null,payload:null,start:0,end:Infinity,
      select(columns){this.columns=columns;return this;},eq(key,value){this.filters.push([key,value]);return this;},
      neq(key,value){this.filters.push([key,value,'neq']);return this;},in(key,value){this.filters.push([key,value,'in']);return this;},
      order(){return this;},range(start,end){this.start=start;this.end=end;return this;},limit(limit){this.end=limit-1;return this;},
      insert(payload){this.op='insert';this.payload=payload;return this;},update(payload){this.op='update';this.payload=payload;return this;},
      delete(){this.op='delete';return this;},
      async execute(single){
        if(this.op) {
          writes.push({table,op:this.op,payload:this.payload,filters:this.filters});
          if(table==='articles') {timeline.push('save');if(!options.zeroAffected)Object.assign(tables.articles[0],this.payload);return {data:options.zeroAffected?null:{id:A},error:null};}
          return {data:this.payload,error:options.insertError?{message:'insert failed'}:null};
        }
        reads.push({table,filters:this.filters});timeline.push('read:'+table);
        if(table===options.readError) return {data:null,error:{message:'read failed'}};
        if(Object.hasOwn(options.rawResults??{},table)) return {data:options.rawResults[table],error:null};
        const rows=(tables[table]??[]).filter(r=>this.filters.every(([k,v,op])=>op==='neq'?r[k]!==v:op==='in'?v.includes(r[k]):r[k]===v)).slice(this.start,this.end+1);
        const projected=rows.map(r=>this.columns==='*'?{...r}:Object.fromEntries(this.columns.split(',').map(k=>[k,r[k]])));
        return {data:single?(projected[0]??null):projected,error:null};
      },single(){return this.execute(true);},maybeSingle(){return this.execute(true);},then(a,b){return this.execute(false).then(a,b);}
    };return q;
  }
  const tripwire=()=>{throw Error('Unexpected collaborator');};
  const rpc=async(name,args)=>{
    rpcs.push({name,args});timeline.push('rpc:'+name);
    if(options.fingerprintError&&name==='graph_article_fingerprint')return {data:null,error:{message:'unavailable'}};
    if(name==='graph_article_fingerprint')return {data:'fixture-fingerprint',error:null};
    if(name==='graph_propose_article_suggestions')return {data:options.invalidCount?'bad':options.dismissed?0:args.p_proposals.length,error:options.insertError||options.stale?{message:'failed'}:null};
    throw Error('Unexpected RPC');
  };
  const collaborators={createPlatformClient:()=>({from,rpc}),getAuthUser:async()=>({id:'user'}),getCreatorByUserId:async()=>({id:C}),
    isAuthorableArticleType:()=>true,revalidatePath:p=>revalidated.push(p),
    redirect(location){const e=Error('redirect');e.digest='NEXT_REDIRECT;';e.location=location;throw e;}};
  const context=vm.createContext({FormData,Error,Date,URL,URLSearchParams,fetch:tripwire}); const cache=new Map();
  async function real(path) {
    if(cache.has(path)) return cache.get(path);
    const src=stripTypeScriptTypes(readFileSync(new URL(path,root),'utf8'));
    const mod=new vm.SourceTextModule(src,{context,identifier:path});cache.set(path,mod);
    const bindings=new Map([...src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].map(m=>[m[2],m[1].split(',').map(s=>s.trim()).filter(Boolean)]));
    await mod.link(async spec=>{
      if(spec==='@/lib/profile/creator-maker-path') return real('apps/storefront/src/lib/profile/creator-maker-path.ts');
      if(spec==='@/lib/content/article-catalog-pipeline') return real('apps/storefront/src/lib/content/article-catalog-pipeline.ts');
      if(spec==='@/lib/content/article-matching-jobs') return real('apps/storefront/src/lib/content/article-matching-jobs.ts');
      if(spec.startsWith('.')) return real(new URL(spec+'.ts',new URL(path,root)).href.slice(root.href.length));
      const names=bindings.get(spec);assert.ok(names,`Unknown import ${spec}`);
      return new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,collaborators[n]??tripwire);},{context});
    });return mod;
  }
  // Prelink the shared diamond dependency before linking dashboard's two imports.
  // Source modules are real; only SDK/auth/framework boundaries are synthetic.
  await real('apps/storefront/src/lib/content/article-catalog-pipeline.ts');
  await real('apps/storefront/src/lib/content/article-matching-jobs.ts');
  const mod=await real('apps/storefront/src/app/actions/dashboard.ts');await mod.evaluate();
  const form=new FormData();for(const [k,v] of Object.entries({id:A,title:'Mandje haken',slug:'mandje',article_type:'tutorial',body_markdown:'## Materialen\n- Haaknaald 6 mm'}))form.set(k,v);
  const invoke=async action=>{try{await mod.namespace[action](form);}catch(e){assert.ok(e.digest?.startsWith('NEXT_REDIRECT'));return e.location;}};
  return {reads,writes,revalidated,rpcs,timeline,tables,update:()=>invoke('updateArticleAction'),create:()=>invoke('createArticleAction')};
}
test('actual article update uses entire catalog and atomic RPC, never deletes previous proposals',async()=>{
  const f=await fixture();const location=await f.update();
  const url=new URL(location,'http://fixture.invalid');
  assert.equal(url.pathname,'/profile');assert.equal(url.searchParams.get('tab'),'profiel');
  assert.equal(url.searchParams.get('success'),'Artikel bijgewerkt. Suggesties vernieuwd.');
  assert.equal(url.searchParams.has('error'),false);
  assert.equal(f.writes.filter(w=>w.op==='delete').length,0);
  assert.equal(f.writes.filter(w=>w.table==='entity_links').length,0);
  const insert=f.rpcs.find(r=>r.name==='graph_propose_article_suggestions');assert.ok(insert);
  assert.equal(insert.args.p_proposals[0].target_entity_id,'p');assert.equal(insert.args.p_proposals[0].proposed_relation,'related_product');
  assert.equal(insert.args.p_proposals[0].matcher_version,'article-catalog-v1');assert.ok(insert.args.p_proposals[0].evidence.length);
  assert.equal(insert.args.p_article_id,A);assert.equal(insert.args.p_fingerprint,'fixture-fingerprint');
  assert.ok(f.timeline.indexOf('save')<f.timeline.indexOf('rpc:graph_article_fingerprint'));
  assert.ok(f.timeline.indexOf('rpc:graph_article_fingerprint')<f.timeline.lastIndexOf('read:articles'));
  assert.ok(f.reads.filter(r=>r.table==='products').every(r=>!r.filters.some(([k])=>k==='creator_id')));
});
test('existing pending nomination survives ordinary article update without duplicate insert',async()=>{
  // Retained-state suppression is covered separately from the positive RPC path.
  const f=await fixture({links:[{id:'l',source_entity_type:'article',source_entity_id:A,target_entity_type:'product',target_entity_id:'p',relation_type:'suggested_auto'}]});
  await f.update();assert.equal(f.writes.filter(w=>w.table==='entity_links').length,0);
  assert.equal(f.rpcs.filter(r=>r.name==='graph_propose_article_suggestions').length,0);
});
test('actual article creation preserves profile tab and success parameters after atomic proposals',async()=>{
  const f=await fixture();const location=await f.create();const url=new URL(location,'http://fixture.invalid');
  assert.equal(url.pathname,'/profile');assert.equal(url.searchParams.get('tab'),'profiel');
  assert.equal(url.searchParams.get('success'),'Artikel opgeslagen met link-suggesties.');
  assert.equal(url.searchParams.has('error'),false);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].table,'articles');assert.equal(f.writes[0].op,'insert');
  assert.deepEqual(f.rpcs.map(r=>r.name),['graph_article_fingerprint','graph_propose_article_suggestions']);
});
test('catalog read failure does not delete existing links or report successful refresh',async()=>{
  const f=await fixture({readError:'event_domains'});const location=await f.update();
  assert.equal(f.writes.filter(w=>w.table==='entity_links').length,0);assert.ok(location.includes('error='),location);
});
const invalidCatalogResults = [
  ['null response', null],
  ['undefined response', undefined],
  ['object response', {}],
  ['string response', 'invalid catalog'],
  ['number response', 1],
  ['boolean response', false],
  ['null row', [null]],
  ['undefined row', [undefined]],
  ['array row', [[]]],
  ['string row', ['invalid catalog row']],
  ['number row', [1]],
  ['boolean row', [false]],
  ['valid row followed by an invalid row', [{event_id:'event',domain_id:'domain'}, []]],
];
for (const action of ['create','update']) {
  for (const [label, rawResult] of invalidCatalogResults) {
    test(`${action}: invalid catalog ${label} fails closed after saving without proposing or changing links`,async()=>{
      const links=[
        {id:'pending',source_entity_type:'article',source_entity_id:A,target_entity_type:'product',target_entity_id:'old',relation_type:'suggested_auto'},
        {id:'manual',source_entity_type:'article',source_entity_id:A,target_entity_type:'product',target_entity_id:'approved',relation_type:'related_product'},
      ];
      const originalLinks=structuredClone(links);
      // With no events, downstream catalog parsing never consumes these rows.
      // Only the real CatalogRead boundary can reject every malformed row here.
      const f=await fixture({links,rawResults:{event_domains:rawResult}});
      const location=await f[action]();const params=new URL(location,'http://fixture.invalid').searchParams;
      assert.ok(f.reads.some(r=>r.table==='event_domains'));
      assert.equal(params.get('tab'),'profiel');
      assert.equal(params.get('success'),'Artikel opgeslagen.');
      assert.ok(params.get('error')?.includes('link-suggesties'),location);
      assert.equal(f.tables.articles[0].title,'Mandje haken');
      assert.equal(f.writes.length,1);
      assert.equal(f.writes[0].table,'articles');
      assert.equal(f.writes[0].op,action==='create'?'insert':'update');
      assert.equal(f.rpcs.length,1);
      assert.equal(f.rpcs[0].name,'graph_article_fingerprint');
      assert.deepEqual(Object.entries(f.rpcs[0].args),[['p_article_id',A]]);
      assert.deepEqual(f.tables.entity_links,originalLinks);
      assert.deepEqual(f.revalidated,['/profile']);
    });
  }
}
test('zero affected article update never starts suggestion reads or writes',async()=>{
  const f=await fixture({zeroAffected:true});await f.update();
  assert.ok(f.reads.every(r=>r.table==='articles'));assert.equal(f.writes.filter(w=>w.table==='entity_links').length,0);
});
test('pending insert failure is surfaced without saying suggestions refreshed',async()=>{
  const f=await fixture({insertError:true});assert.ok((await f.update()).includes('error='));
});
test('terminal decision zero count is successful without direct fallback or renominating writes',async()=>{
 const f=await fixture({dismissed:true});const location=await f.update();assert.ok(!location.includes('error='),location);
 assert.equal(f.rpcs.filter(r=>r.name==='graph_propose_article_suggestions').length,1);assert.equal(f.writes.filter(w=>w.table==='entity_links').length,0);
});
for(const failure of [{fingerprintError:true},{invalidCount:true},{stale:true}])test(`RPC failure keeps saved article and never falls back to direct insertion ${JSON.stringify(failure)}`,async()=>{
 const f=await fixture(failure);const location=await f.update();const params=new URL(location,'http://fixture.invalid').searchParams;
 assert.ok(params.get('success')?.includes('Artikel opgeslagen'));assert.ok(params.get('error'));
 assert.equal(f.writes.filter(w=>w.table==='articles').length,1);assert.equal(f.writes.filter(w=>w.table==='entity_links').length,0);
 if(failure.fingerprintError)assert.ok(f.reads.every(r=>r.table==='articles'));
});
for (const action of ['create','update']) {
  for (const failure of [{readError:'event_domains'},{insertError:true}]) {
    test(`${action}: optional suggestion failure acknowledges saved article and revalidates without retrying the write (${Object.keys(failure)[0]})`,async()=>{
      const f=await fixture(failure);const location=await f[action]();
      const params=new URL(location,'http://fixture.invalid').searchParams;
      assert.ok(params.get('success')?.includes('Artikel opgeslagen'),location);
      assert.equal(params.get('tab'),'profiel',location);
      assert.ok(params.get('error')?.includes('link-suggesties'),location);
      assert.ok(params.get('error')?.includes('Bewerk het opgeslagen artikel'),location);
      assert.ok(!params.get('success').includes('Suggesties vernieuwd'));
      assert.equal(f.writes.filter(w=>w.table==='articles').length,1);
      assert.ok(f.revalidated.includes('/profile'));
    });
  }
}
