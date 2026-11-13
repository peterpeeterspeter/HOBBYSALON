import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import * as contract from './conversions';

// Transpile the real server module, replace only request cookies and server guard.
// No database, network or Next server needed; serialize through Next's real cookie code.
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc');
const {ResponseCookies} = require('next/dist/compiled/@edge-runtime/cookies');
const source = readFileSync(new URL('./conversions.server.ts',import.meta.url),'utf8');
const compiled = swc.transformSync(source,{jsc:{parser:{syntax:'typescript'},target:'es2020'},module:{type:'commonjs'}}).code;
function server(consent:string|null='granted',generation:string|null='11111111-1111-4111-8111-111111111111',fail=false) {
  const writes:any[]=[];
  const store={get:(key:string)=>{
    if(fail)throw new Error('fixture cookie failure');
    const value=key==='hs_analytics_consent'?consent:key===contract.CONSENT_GENERATION_KEY?generation:null;
    return value===null?undefined:{value};
  },set:(...args:any[])=>writes.push(args)};
  const mod:any={exports:{}};
  const resolve=(id:string)=>{
    if(id==='server-only')return {};
    if(id==='next/headers')return {cookies:async()=>store};
    if(id==='node:crypto')return {randomUUID};
    if(id==='./conversions')return contract;
    throw new Error('unexpected require '+id);
  };
  new Function('require','module','exports',compiled)(resolve,mod,mod.exports);
  return {queue:mod.exports.queueConversion,writes};
}
test('server queues sanitized receipt bound to occurrence consent and serializes once',async()=>{
  const f=server();await f.queue('listing_published',{listing_type:'handmade',email:'PRIVATE'});
  assert.equal(f.writes.length,1);const [name,raw,options]=f.writes[0];
  assert.equal(name,contract.CONVERSION_COOKIE);assert.equal(options.maxAge,300);assert.equal(options.path,'/');assert.equal(options.sameSite,'lax');assert.equal(options.domain,undefined);
  const headers=new Headers();new ResponseCookies(headers).set(name,raw,options);
  const encoded=headers.get('set-cookie')!.split(';')[0].slice(name.length+1);
  const receipt=contract.parseConversionReceipt(decodeURIComponent(encoded));
  assert.equal(receipt?.generation,'11111111-1111-4111-8111-111111111111');assert.equal(receipt?.event,'listing_published');
  assert.deepEqual(receipt?.payload,{listing_type:'handmade'});assert.ok(!raw.includes('PRIVATE'));
});
test('server cannot queue without granted consent and valid generation',async()=>{
  for(const [choice,generation] of [[null,null],['pending',null],['denied','11111111-1111-4111-8111-111111111111'],['granted',null],['granted','malformed']] as const){
    const f=server(choice,generation);await f.queue('listing_published',{listing_type:'handmade'});assert.equal(f.writes.length,0);
  }
});
test('unsupported server payloads and cookie failures cannot affect business success',async()=>{
  const f=server();await f.queue('purchase',{});await f.queue('listing_published',{listing_type:'other'});assert.equal(f.writes.length,0);
  const broken=server('granted',null,true);await assert.doesNotReject(broken.queue('listing_published',{listing_type:'handmade'}));assert.equal(broken.writes.length,0);
});
