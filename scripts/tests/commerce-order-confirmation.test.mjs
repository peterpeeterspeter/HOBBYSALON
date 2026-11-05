import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../../apps/storefront/src/lib/commerce/medusa/orders.ts',import.meta.url),'utf8').replace(/^import "server-only";\s*/m,'').replace(/^import[\s\S]*?from ["'][^"']+["'];?\r?\n/gm,'');
function fixture(token,ok=true){
 const calls=[];
 const context=vm.createContext({Buffer,process:{env:{MEDUSA_ADMIN_API_TOKEN:token,MEDUSA_BACKEND_URL:'http://localhost:9008'}},getAuthUser:async()=>null,medusaAmountToCents:n=>Math.round(n*100),fetch:async(url,options)=>{calls.push({url,options});return {ok,json:async()=>({order_set:{id:'os_fixture',customer:{email:'private@example.invalid'}}})}}});
 vm.runInContext(stripTypeScriptTypes(source).replace(/^export /gm,''),context);
 return {context,calls};
}
test('guest order confirmation uses native Basic API-key auth without exposing buyer details',async()=>{
 const{context,calls}=fixture('sk_local_fixture');const result=await context.verifyCheckoutSuccessOrder('os_fixture');
 assert.equal(result.verified,true);assert.equal(result.order,null);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'http://localhost:9008/admin/order-sets/os_fixture');
 assert.equal(calls[0].options.headers.Authorization,'Basic '+Buffer.from('sk_local_fixture:').toString('base64'));
 assert.equal(calls[0].options.cache,'no-store');
});
test('existing user JWT admin configuration keeps Bearer authentication',async()=>{
 const{context,calls}=fixture('header.payload.signature');assert.equal((await context.verifyCheckoutSuccessOrder('os_fixture')).verified,true);
 assert.equal(calls[0].options.headers.Authorization,'Bearer header.payload.signature');
});
test('failed backend verification does not confirm an order',async()=>{
 const{context}=fixture('sk_local_fixture',false);assert.equal((await context.verifyCheckoutSuccessOrder('os_fixture')).verified,false);
});
test('missing admin credentials never fabricate confirmation',async()=>{
 const{context,calls}=fixture('');assert.equal((await context.verifyCheckoutSuccessOrder('os_fixture')).verified,false);assert.equal(calls.length,0);
});
