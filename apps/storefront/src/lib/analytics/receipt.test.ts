import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { consumeConversionReceipt } from "./receipt";
import { setConsent, syncAnalytics, sendPageView } from "./consent";
import { CONVERSION_COOKIE, CONSENT_GENERATION_KEY } from "./conversions";

function browser(t: TestContext, path = "/workshops") {
  const cookies = new Map<string,string>([["hs_analytics_consent", "granted"]]);
  const storage = new Map([["hs_analytics_consent", "granted"]]);
  const generation = '11111111-1111-4111-8111-111111111111';
  cookies.set(CONSENT_GENERATION_KEY, generation); storage.set(CONSENT_GENERATION_KEY, generation);
  const scripts = new Map<string, any>(); const calls: unknown[][] = [];
  const window: any = { location: new URL(`https://hobbysalon.nl${path}`), hsGa4Ready: true, "ga-disable-G-KP9BXCEF2Z": false,
    localStorage: {getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)},
    dispatchEvent:()=>true, gtag:(...args:unknown[])=>calls.push(args) };
  const document: any = { referrer: "https://other.invalid/?email=private", getElementById:(id:string)=>scripts.get(id),
    createElement:()=>{const script:any={remove:()=>scripts.delete(script.id)};return script;},head:{appendChild:(s:any)=>scripts.set(s.id,s)}};
  Object.defineProperty(document,"cookie",{get:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),set:(raw:string)=>{const part=raw.split(';')[0];const i=part.indexOf('=');const k=part.slice(0,i),v=part.slice(i+1);if(raw.includes('Max-Age=0'))cookies.delete(k);else cookies.set(k,v);}});
  for(const [key,value] of Object.entries({window,document})){const prior=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});t.after(()=>prior?Object.defineProperty(globalThis,key,prior):Reflect.deleteProperty(globalThis,key));}
  const put=(id:string,event="listing_published",payload:Record<string,string>={listing_type:"handmade"},epoch = storage.get(CONSENT_GENERATION_KEY))=>cookies.set(CONVERSION_COOKIE,encodeURIComponent(JSON.stringify({id,event,payload,generation:epoch})));
  return {window,cookies,storage,scripts,calls,put};
}

test("public ready consumer emits fixed sanitized payload once, deletes before dispatch",t=>{
  const f=browser(t); f.put("receipt_test_public");consumeConversionReceipt();consumeConversionReceipt();
  assert.equal(f.cookies.has(CONVERSION_COOKIE),false);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0][1],"listing_published");assert.ok(!JSON.stringify(f.calls).includes("private"));
  f.put("receipt_test_public");consumeConversionReceipt();assert.equal(f.calls.length,1);
});
test("private route retains consented receipt but cannot load Google; public readiness consumes",t=>{
  const f=browser(t,"/dashboard?token=private");f.put("receipt_test_private");f.cookies.set('_ga','erase');
  syncAnalytics(sendPageView);consumeConversionReceipt();assert.equal(f.scripts.size,0);assert.equal(f.cookies.has('_ga'),false);assert.equal(f.cookies.has(CONVERSION_COOKIE),true);
  f.window.location=new URL('https://hobbysalon.nl/workshops');syncAnalytics(()=>{sendPageView();consumeConversionReceipt();});
  assert.equal(f.cookies.has(CONVERSION_COOKIE),true);f.scripts.get('hs-google-analytics').onload();
  const events=f.window.dataLayer.map((args:IArguments)=>Array.from(args)).filter((args:unknown[])=>args[0]==='event');
  assert.equal(events.filter((args:unknown[])=>args[1]==='listing_published').length,1);assert.equal(f.cookies.has(CONVERSION_COOKIE),false);
});
test("not ready never consumes; withdrawal deletes receipt and regrant cannot replay",t=>{
  const f=browser(t);f.put('receipt_test_withdrawal');f.window.hsGa4Ready=false;consumeConversionReceipt();assert.equal(f.calls.length,0);assert.equal(f.cookies.has(CONVERSION_COOKIE),true);
  setConsent('denied');assert.equal(f.cookies.has(CONVERSION_COOKIE),false);setConsent('granted');consumeConversionReceipt();
  assert.ok(!f.window.dataLayer.some((args:IArguments)=>Array.from(args)[1]==='listing_published'));
});
test("malformed and unsupported receipts are discarded without conversion",t=>{
  const f=browser(t);for(const raw of ['%bad',encodeURIComponent('{}'),encodeURIComponent(JSON.stringify({id:'receipt_test_bad',event:'purchase',payload:{}}))]){f.cookies.set(CONVERSION_COOKIE,raw);consumeConversionReceipt();assert.equal(f.cookies.has(CONVERSION_COOKIE),false);}
  assert.equal(f.calls.length,0);
});
test("double opt-in receipt sends only allowlisted newsletter fields",t=>{
  const f=browser(t);f.put('receipt_test_double','newsletter_signup',{signup_source:'lead_magnet_form',opt_in_method:'double',email:'private'});consumeConversionReceipt();
  assert.equal(f.calls[0][1],'newsletter_signup');assert.ok(!JSON.stringify(f.calls).includes('private'));
});
test("route tracker invokes receipt only after transport readiness",()=>{
  const source=readFileSync(new URL('../../components/analytics/AnalyticsRouteTracker.tsx',import.meta.url),'utf8');
  assert.match(source,/const ready = \(\) => \{ sendPageView\(\); consumeConversionReceipt\(\); \}/);assert.match(source,/syncAnalytics\(ready\)/);
});

test("late response from an earlier grant cannot replay after withdrawal and regrant",t=>{
  const f=browser(t);const oldGeneration=f.storage.get(CONSENT_GENERATION_KEY)!;
  setConsent('denied');setConsent('granted');
  f.window.hsGa4Ready=true;f.window['ga-disable-G-KP9BXCEF2Z']=false;
  f.put('receipt_test_late','listing_published',{listing_type:'handmade'},oldGeneration);
  consumeConversionReceipt();
  assert.equal(f.cookies.has(CONVERSION_COOKIE),false);
  assert.ok(!f.window.dataLayer.some((args:IArguments)=>Array.from(args)[1]==='listing_published'));
});
