// Actual home-page + actual journey service composed in an offline VM.
// Public query/framework boundaries are narrow stand-ins; not Next/RLS/browser acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
const root=new URL('../../apps/storefront/src/',import.meta.url);
const candidate=id=>({id,title:`Creatief ${id}`,slug:id,featured_image_url:`/${id}.jpg`,difficulty_level:'beginner'});
const plain=x=>JSON.parse(JSON.stringify(x));
async function load(options={}){
 const attempts=[],calls=[],cache=[];let scheduled=0,cleared=0;
 const forbidden=name=>{attempts.push(name);throw new Error(`forbidden:${name}`)};
 const articles=[candidate('first'),candidate('complete')];
 const makersRail=[{id:'rail-maker',slug:'atelier-local',display_name:'Maker',photoUrl:'/maker.jpg'}];
 const productRail=[{id:'rail-product',slug:'rail-product',title:'Garen',featured_image_url:'/garen.jpg'}];
 const queryTripwire=new Proxy({}, {get:(_,k)=>()=>forbidden(`client:${String(k)}`)});
 const context=vm.createContext({setTimeout:()=>{scheduled++;return scheduled},clearTimeout:()=>{cleared++},fetch:()=>forbidden('network'),console:{error:(...args)=>calls.push(['error',String(args[0])])}}, {codeGeneration:{strings:false,wasm:false}});
 const collaborators={
  'next/cache':{unstable_cache:(fn,keys,settings)=>{cache.push({keys:plain(keys),settings:plain(settings)});return (...args)=>{calls.push(['cache-invoke',args.length]);return fn(...args)}}},
  '@/lib/platform/client':{createPlatformClient:()=>queryTripwire},
  '@/lib/platform/queries/articles':{listLatestArticles:async n=>{calls.push(['articles',n]);return articles}},
  '@/lib/platform/queries/projects':{listFeaturedProjects:async n=>{calls.push(['projects',n]);return []},listProjectProductLinks:async()=>forbidden('unused-project-products')},
  '@/lib/platform/queries/entity-links':{getEntityConnections:async(kind,id)=>{
   calls.push(['graph',kind,id]);
   return [{entityType:'product',entityId:'p',relationType:'related_product',direction:'outbound'},...(id==='complete'?[{entityType:'workshop',entityId:'w',relationType:'related_workshop',direction:'outbound'}]:[]),{entityType:'creator',entityId:'c',relationType:'made_by',direction:'outbound'}];
  }},
  '@/lib/platform/queries/products':{
   listProductsByIds:async ids=>{calls.push(['products',plain(ids)]);if(options.rejectHydration)throw new Error('fixture journey hydration');return [{id:'p',title:'Wol',slug:'wol'}]},
   listMaterialsCatalog:async opts=>{calls.push(['rail',opts.catalog_scope]);return {products:productRail}}
  },
  '@/lib/platform/queries/workshops':{listWorkshopsByIds:async ids=>{calls.push(['workshops',plain(ids)]);return [{id:'w',title:'Breien',slug:'breien',city:'Gent'}]},listDiscoveryWorkshops:async()=>({workshops:[]})},
  '@/lib/platform/queries/creators':{getCreatorById:async id=>({id,slug:'atelier',display_name:'Atelier',business_name:null}),listCreatorsDirectory:async()=>({creators:makersRail})},
  '@/lib/platform/queries/domains':{listActiveDomains:async()=>[]},
  '@/lib/platform/queries/events':{listAgendaEvents:async()=>({events:[]})},
  '@/lib/listing/featured-hero':{pickDayStableSample:(items,n)=>items.slice(0,n)},
  '@/lib/perf/server-timing':{logServerPerf:(name,value)=>calls.push(['perf',name,value.journey])},
  '@/lib/agenda/agenda-helpers':{eventIsUpcomingOrOngoing:()=>forbidden('unused-agenda'),resolveAgendaDatePreset:()=>({})},
 };
 const real={
  '@/lib/services/home-page':'lib/services/home-page.ts',
  '@/lib/services/home-journey':'lib/services/home-journey.ts',
  '@/lib/services/home-router-helpers':'lib/services/home-router-helpers.ts',
 };
 const modules=new Map();
 const moduleFor=name=>{
  if(modules.has(name))return modules.get(name);
  let mod;
  if(real[name])mod=new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL(real[name],root),'utf8')),{context,identifier:name,importModuleDynamically:n=>forbidden(`dynamic:${n}`)});
  else{const exports=collaborators[name];if(!exports)return forbidden(`import:${name}`);mod=new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context,identifier:name})}
  modules.set(name,mod);return mod;
 };
 // Prelink shared module to avoid VM's concurrent diamond linking limitation.
 await moduleFor('@/lib/services/home-router-helpers').link(moduleFor);
 await moduleFor('@/lib/services/home-journey').link(moduleFor);
 const mod=moduleFor('@/lib/services/home-page');await mod.link(moduleFor);await mod.evaluate();
 assert.deepEqual(attempts,[],'initialization effects forbidden');
 return {cache,calls,articles,makersRail,productRail,async run(){try{return plain(await mod.namespace.getHomePageData())}finally{assert.deepEqual(attempts,[],'no effects hidden by service fallback');assert.equal(scheduled,cleared,'timeout cleared')}}};
}

test('actual homepage service consumes strongest actual journey and preserves neighboring blocks',async()=>{
 const f=await load();const result=await f.run();
 assert.equal(result.journey.href,'/artikel/complete');
 assert.deepEqual(result.journey.materials,[{label:'Wol',href:'/product/wol'}]);
 assert.deepEqual(result.journey.workshop,{label:'Breien in Gent',href:'/workshop/breien'});
 assert.deepEqual(result.journey.makers,[{label:'Atelier',href:'/creator/atelier'}]);
 assert.deepEqual(result.homeMakeItems.map(x=>x.item.id),['first','complete']);
 assert.deepEqual(result.makers,f.makersRail);assert.deepEqual(result.materials,f.productRail);assert.deepEqual(result.makersmarkt,f.productRail);
 assert.deepEqual(result.featuredEvents,[]);assert.deepEqual(result.upcomingWorkshops,[]);assert.deepEqual(result.domainsWithLiveContent,[]);
 assert.deepEqual(f.calls.filter(c=>c[0]==='graph'),[['graph','article','first'],['graph','article','complete']]);
 assert.ok(f.calls.some(c=>c[0]==='perf'&&c[2]===1));
});
test('actual shared cache contract stays account-free, stable and receives no caller identity',async()=>{
 const f=await load();assert.deepEqual(f.cache,[{keys:['home-page-data-v6'],settings:{revalidate:300,tags:['home-page']}}]);
 const first=await f.run();assert.deepEqual(await f.run(),first);
 assert.ok(f.calls.filter(c=>c[0]==='cache-invoke').every(c=>c[1]===0));
});
test('actual service owns unexpected journey hydration fallback without losing other homepage blocks',async()=>{
 const f=await load({rejectHydration:true});const result=await f.run();
 assert.equal(result.journey,null);assert.deepEqual(result.makers,f.makersRail);assert.deepEqual(result.materials,f.productRail);
 assert.deepEqual(result.homeMakeItems.map(x=>x.item.id),['first','complete']);
 assert.ok(f.calls.some(c=>c[0]==='error'&&c[1]==='[home-page] journey failed:'));
});
