// Real shared ALS/SQL-helper source; synthetic session adapters, NOT live provider/DB acceptance.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict'),{test}=require('node:test'),{EventEmitter}=require('events'),swc=require('@swc/core')
const root=path.resolve(__dirname,'../..');Module._extensions['.ts']=(m,f)=>{m.paths=[...module.paths,...m.paths];m._compile(swc.transformSync(fs.readFileSync(f,'utf8'),{filename:f,jsc:{target:'es2022',parser:{syntax:'typescript',decorators:true},transform:{legacyDecorator:true,decoratorMetadata:true}},module:{type:'commonjs'}}).code,f)}
const lock=require(root+'/packages/modules/b2c-core/src/utils/commerce-cart-lock.ts'),financial=require(root+'/packages/modules/b2c-core/src/utils/commerce-financial-lock.ts')
function fixture(opts={}){let conn,held=false;const writes=[];const row={cart_id:'cart-a',payment_collection_id:'pc-a'};const knex={client:{acquireConnection:async()=>conn=new EventEmitter(),releaseConnection:async()=>{},destroyRawConnection:async()=>{}},raw:(sql,args=[])=>{const run=async()=>{writes.push(sql);if(sql.includes('pg_try_advisory_lock')){if(held)return {rows:[{locked:false}]};held=true;return {rows:[{locked:true}]}}if(sql.includes('pg_advisory_unlock')){held=false;return{rows:[{unlocked:true}]}}if(sql.startsWith('SET SESSION'))return{rows:[]};if(conn && (opts.loss===sql || opts.loss==='binding'&&sql.startsWith('SELECT s.cart_id')))conn.emit('end');if(sql.startsWith('SELECT s.cart_id'))return{rows:opts.ambiguous?[row,row]:opts.missing?[]:[{...row,cart_id:opts.cart||row.cart_id}]};if(sql.startsWith('SELECT 1'))return{rows:[{bound:1}]};if(sql.includes('FROM payment_session'))return{rows:[{id:args[0],...row,cart_id:opts.cart||row.cart_id}]};if(sql.includes('FROM refund_settlement')){
  // Interpret the actual query: old SQL returns the completed row even with another unfinished row.
  let rows=opts.noSettlement?[]:[{operation_id:opts.badOperation?'other':args[0],order_id:opts.badOrder?'other':args[1],scope_id:opts.badScope?'other':args[2],phase:opts.phase||'completed'}]
  if(/NOT EXISTS/i.test(sql)){
    assert.match(sql,/other\.scope_id\s*=\s*refund_settlement\.scope_id/)
    assert.match(sql,/other\.operation_id\s*<>\s*refund_settlement\.operation_id/)
    assert.match(sql,/other\.phase\s*<>\s*'completed'/)
    rows=rows.filter(saved=>!(opts.unfinished||[]).some(other=>other.scope_id===saved.scope_id&&other.operation_id!==saved.operation_id&&other.phase!=='completed'))
    if(sql.includes('commerce_refund_dispatch')) rows=rows.filter(saved=>!(opts.dispatch||[]).some(other=>other.scope_id===saved.scope_id&&other.state==='started'))
  }
  return{rows}
};assert.fail(sql)};return{connection:async c=>{assert.equal(c,conn);return run()},then:(yes,no)=>run().then(yes,no)}}};return{container:{resolve:()=>knex},writes,loss:()=>conn.emit('end')}}
test('order lock helper requires private capability',async()=>{await assert.rejects(financial.assertCommerceOrderLock('ord-a'),/not held/)})
for(const operation of ['assertCommerceOrderLock','assertCommerceOrderCancellation','assertCommerceSessionLock']){
 test(operation+' accepts authoritative same-cart unique link',async()=>{const f=fixture();await lock.withCommerceCartLock(f.container,'cart-a',()=>financial[operation]('identity-a'))})
 test(operation+' refuses mismatched cart',async()=>{const f=fixture({cart:'cart-b'});await assert.rejects(lock.withCommerceCartLock(f.container,'cart-a',()=>financial[operation]('identity-a')),/different cart/)})
}
for(const opts of [{missing:true},{ambiguous:true},{loss:'binding'}])test('order key discovery rejects '+JSON.stringify(opts),async()=>{const f=fixture(opts);await assert.rejects(financial.withCommerceOrderLock(f.container,'ord-a',()=>assert.fail('effect')),/Commerce/)})
for(const phase of ['pending','refund_started','refund_completed','reversal_started'])test('cancel ledger '+phase+' rejects',async()=>{const f=fixture({phase});await assert.rejects(lock.withCommerceCartLock(f.container,'cart-a',()=>financial.assertCommerceOrderCancellation('ord-a')),/settlement/)})
for(const opts of [{noSettlement:true},{badScope:true},{badOperation:true},{badOrder:true}])test('missing/mismatched ledger '+JSON.stringify(opts),async()=>{const f=fixture(opts);await assert.rejects(lock.withCommerceCartLock(f.container,'cart-a',()=>financial.assertCommerceOrderCancellation('ord-a')),/settlement/)})
for(const phase of ['pending','refund_started','refund_completed','reversal_started'])test('old completed cancellation rejects other unfinished '+phase+' without cancellation effect',async()=>{
  const f=fixture({unfinished:[{operation_id:'return-other',scope_id:'pc-a',phase}]});let count=0
  await assert.rejects(lock.withCommerceCartLock(f.container,'cart-a',async()=>{await financial.assertCommerceOrderCancellation('ord-a');count++}),/settlement/)
  assert.equal(count,0)
})
for(const other of [
  {operation_id:'return-other',scope_id:'pc-a',phase:'completed'},
  {operation_id:'return-other',scope_id:'pc-b',phase:'refund_started'},
  {operation_id:'cancel:ord-a',scope_id:'pc-a',phase:'completed'},
])test('completed cancellation permits nonblocking ledger '+JSON.stringify(other),async()=>{
  const f=fixture({unfinished:[other]});let count=0
  await lock.withCommerceCartLock(f.container,'cart-a',async()=>{await financial.assertCommerceOrderCancellation('ord-a');count++})
  assert.equal(count,1)
})
test('old completed cancellation refuses a later uncertain native refund dispatch',async()=>{
  const f=fixture({dispatch:[{scope_id:'pc-a',state:'started'}]});let effects=0
  await assert.rejects(lock.withCommerceCartLock(f.container,'cart-a',async()=>{await financial.assertCommerceOrderCancellation('ord-a');effects++}),/settlement/)
  assert.equal(effects,0)
})
for(const dispatch of [{scope_id:'pc-b',state:'started'},{scope_id:'pc-a',state:'completed'}])test('completed cancellation permits nonblocking dispatch '+JSON.stringify(dispatch),async()=>{
  const f=fixture({dispatch:[dispatch]});let effects=0
  await lock.withCommerceCartLock(f.container,'cart-a',async()=>{await financial.assertCommerceOrderCancellation('ord-a');effects++})
  assert.equal(effects,1)
})
test('whole order invocation reuses same-cart capability and checks release/loss',async()=>{const f=fixture();let count=0;await financial.withCommerceOrderLock(f.container,'ord-a',async()=>{await financial.withCommerceOrderLock(f.container,'ord-a',async()=>{count++;lock.assertCommerceFinancialLock()})});assert.equal(count,1);assert.equal(f.writes.filter(x=>x.includes('pg_try_advisory_lock')).length,1);assert.throws(()=>lock.assertCommerceFinancialLock(),/not held/)})
test('loss during business callback cannot silently succeed',async()=>{const f=fixture();await assert.rejects(financial.withCommerceOrderLock(f.container,'ord-a',async()=>{f.loss();return true}),/lock/)})
