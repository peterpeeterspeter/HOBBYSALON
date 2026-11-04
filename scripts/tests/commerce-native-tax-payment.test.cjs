const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const swc = require('@swc/core');
const {decorateCartTotals, MathBN, BigNumber} = require('@medusajs/framework/utils');
Module._extensions['.ts'] = (mod, filename) => {
  mod.paths = [...module.paths, ...mod.paths];
  mod._compile(swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: {parser: {syntax: 'typescript'}, target: 'es2021'}, module: {type: 'commonjs'}
  }).code, filename);
};
const root = path.resolve(__dirname, '../..');
const {assertCompletedCartOrderSet} = require(path.join(root, 'packages/modules/b2c-core/src/utils/completed-cart-order-set.ts'));
const {assertExpectedCartPayment} = require(path.join(root, 'packages/modules/b2c-core/src/utils/expected-cart-payment.ts'));
function fixture(){
 const session={id:'ps',payment_collection_id:'pc',provider_id:'pp_card_stripe-connect',data:{id:'pi'},currency_code:'eur',amount:80};
 const cart=decorateCartTotals({id:'cart',completed_at:'done',currency_code:'eur',payment_collection:{id:'pc',currency_code:'eur',payment_sessions:[session]},items:[{id:'ci',variant_id:'v',unit_price:40,quantity:2,is_tax_inclusive:true,tax_lines:[{rate:21}],adjustments:[]}],shipping_methods:[{amount:0,is_tax_inclusive:true,tax_lines:[{rate:21}],adjustments:[]}]});
 const sets=[{id:'os',cart_id:'cart',payment_collection_id:'pc',orders:[{id:'o',currency_code:'eur',items:[{variant_id:'v',quantity:2}],summary:{accounting_total:80},payment_collections:[{id:'pc'}],split_order_payment:{id:'split',payment_collection_id:'pc',currency_code:'eur',authorized_amount:80}}]}];
 const expected={session_id:'ps',collection_id:'pc',intent_id:'pi',amount:'80',currency_code:'eur'};
 return {cart,sets,expected,session};
}
test('real Medusa21% inclusive tax residue binds to the public EUR80 payment',()=>{
 const{cart,sets,expected,session}=fixture();
 assert.notEqual(MathBN.convert(cart.total).toString(),'80');
 assert.equal(Number(cart.total),80);
 assert.equal(assertCompletedCartOrderSet(cart,sets,'cart',expected),'os');
 assertExpectedCartPayment(cart,[session],expected,'cart');
});
test('computed cart cent mismatch and missing total still refuse recovery',()=>{
 for(const value of [new BigNumber('80.01'),null,undefined]){
  const{cart,sets,expected,session}=fixture();cart.total=value;
  assert.throws(()=>assertCompletedCartOrderSet(cart,sets,'cart',expected));
  assert.throws(()=>assertExpectedCartPayment(cart,[session],expected,'cart'));
 }
});
test('stored session and accounting amounts remain exact',()=>{
 const{cart,sets,expected,session}=fixture();session.amount=new BigNumber('80.0000000000000001');
 assert.throws(()=>assertExpectedCartPayment(cart,[session],expected,'cart'));
 sets[0].orders[0].split_order_payment.authorized_amount=new BigNumber('80.0000000000000001');
 assert.throws(()=>assertCompletedCartOrderSet(cart,sets,'cart'));
});
