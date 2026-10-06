'use strict'
// Explicit opt-in fresh server only. Uses actual installed SWC/MikroORM migrations.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const Module = require('node:module'), { randomBytes, createHash } = require('node:crypto')
const { test } = require('node:test'), swc = require('@swc/core')
const root = path.resolve(__dirname, '../../..')
assert.equal(process.env.NOEFFECT_CANDIDATE_ACK, 'new-network-none-tmpfs-no-effect-candidate')
assert.equal(process.env.NOEFFECT_CANDIDATE_SOCKET, '/socket')
Module._extensions['.ts'] = (m, filename) => { m.paths = [...module.paths, ...m.paths]; m._compile(swc.transformSync(fs.readFileSync(filename,'utf8'), { filename,
 jsc:{ parser:{syntax:'typescript',decorators:true},transform:{legacyDecorator:true,decoratorMetadata:true},target:'es2022'},module:{type:'commonjs'} }).code,filename) }
const knexFactory = require('knex')
const config = database => ({client:'pg',connection:{host:'/socket',user:'postgres',database},pool:{min:0,max:5}})
const op='cancel:order_fixture', scope='pc_fixture', cart='cart_fixture'
const plan={operation_id:op,order_id:'order_fixture',scope_id:scope,payment_id:'pay_fixture',split_order_payment_id:'split_fixture',payout_id:null,currency_code:'eur',customerRefund:3.21,sellerReversal:0}
const native = `CREATE TABLE payment_collection(id text PRIMARY KEY,currency_code text,amount numeric,raw_amount jsonb,authorized_amount numeric,captured_amount numeric,refunded_amount numeric,deleted_at timestamptz);
CREATE TABLE cart_payment_collection(cart_id text,payment_collection_id text,deleted_at timestamptz);
CREATE TABLE payment(id text PRIMARY KEY,payment_collection_id text,provider_id text,data jsonb,currency_code text,amount numeric,raw_amount jsonb,deleted_at timestamptz);
CREATE TABLE capture(id text PRIMARY KEY,payment_id text,amount numeric,raw_amount jsonb,deleted_at timestamptz);
CREATE TABLE refund(id text PRIMARY KEY,payment_id text,amount numeric,raw_amount jsonb,deleted_at timestamptz);
CREATE TABLE "order"(id text PRIMARY KEY,currency_code text,version integer,deleted_at timestamptz);
CREATE TABLE order_summary(id text PRIMARY KEY,order_id text,totals jsonb,deleted_at timestamptz);
CREATE TABLE order_transaction(id text PRIMARY KEY,order_id text,reference_id text,amount numeric,raw_amount jsonb,deleted_at timestamptz);
CREATE TABLE split_order_payment(id text PRIMARY KEY,payment_collection_id text,currency_code text,authorized_amount numeric,captured_amount numeric,refunded_amount numeric,deleted_at timestamptz);
CREATE TABLE order_payment_collection(order_id text,payment_collection_id text,deleted_at timestamptz);
CREATE TABLE order_order_split_order_payment_split_order_payment(order_id text,split_order_payment_id text,deleted_at timestamptz);`
let db, admin, name, originalGuards={}
const tokens={boundary:'boundary-retained',inventory:'inventory-independent',fence:'fence-independent',operator:'operator-independent'}
async function snapshot(conn=db){return (await conn.raw('SELECT ne.snapshot() AS s')).rows[0].s}
async function authorize(s){for(const [kind,token] of Object.entries(tokens)) {
 const states={boundary:'retained-hard-no-dispatch',inventory:'complete-zero-refunds',fence:'retained-exclusive-writers',operator:'approve-nonsuccess-no-effect'}
 await db.raw(`INSERT INTO ne.authority VALUES(?,?,?,?,?::jsonb) ON CONFLICT(kind) DO UPDATE SET snapshot=excluded.snapshot,details=excluded.details`,[kind,token,op,JSON.stringify(s),JSON.stringify({synthetic_test_only:'isolated-trusted-fixture',state:states[kind],provider_namespace:'stripe',provider_payment_id:'pi_fixture',gross_capture:'10'})])
}}
async function close(s,t=tokens){return db.transaction(async trx=>{await trx.raw('SET LOCAL ROLE ne_executor');return (await trx.raw('SELECT ne.close(?,?::jsonb,?::jsonb) result',[op,JSON.stringify(s),JSON.stringify(t)])).rows[0].result})}
async function rejectedUnchanged(fn){const before=await snapshot();await assert.rejects(fn);assert.deepEqual(await snapshot(),before);assert.equal((await db.raw('SELECT count(*)::int n FROM ne.audit')).rows[0].n,0)}

test('actual PostgreSQL positive NO-EFFECT transactional candidate',async t=>{
 admin=knexFactory(config('postgres')); name='hs_noeffect_it_'+randomBytes(8).toString('hex')
 try {
 await admin.raw(`CREATE DATABASE ${name}`);await admin.raw(`COMMENT ON DATABASE ${name} IS 'new-network-none-tmpfs-no-effect-candidate'`)
 db=knexFactory(config(name));await db.raw(native)
 for(const n of ['Migration20261002152627','Migration20261005193000','Migration20261006100000']){
  const file=path.join(root,'packages/modules/b2c-core/src/modules/split-order-payment/migrations',n+'.ts')
  console.log('SOURCE',path.relative(root,file),createHash('sha256').update(fs.readFileSync(file)).digest('hex'))
  const Cls=require(file)[n],m=new Cls({},{}),sql=[];m.addSql=s=>sql.push(s);await m.up();for(const s of sql)await db.raw(s)
 }
 for(const guard of ['refund_settlement_guard','refund_settlement_no_effect_candidate_guard']) originalGuards[guard]=(await db.raw(`SELECT pg_get_functiondef('${guard}()'::regprocedure) src`)).rows[0].src
 await db.raw(fs.readFileSync(path.join(root,'scripts/reconciliation/no_effect_candidate.sql'),'utf8'))
 await db.raw(`INSERT INTO payment_collection VALUES('pc_fixture','eur',10,'{"value":"10","precision":20}',10,10,0,NULL);
 INSERT INTO cart_payment_collection VALUES('cart_fixture','pc_fixture',NULL);
 INSERT INTO payment VALUES('pay_fixture','pc_fixture','stripe','{"id":"pi_fixture"}','eur',10,'{"value":"10","precision":20}',NULL);
 INSERT INTO capture VALUES('cap_fixture','pay_fixture',10,'{"value":"10","precision":20}',NULL);
 INSERT INTO "order" VALUES('order_fixture','eur',1,NULL);
 INSERT INTO order_summary VALUES('summary_fixture','order_fixture','{"paid":10,"refunded":0}',NULL);
 INSERT INTO order_transaction VALUES('txn_fixture','order_fixture','cap_fixture',10,'{"value":"10","precision":20}',NULL);
 INSERT INTO split_order_payment VALUES('split_fixture','pc_fixture','eur',10,10,0,NULL);
 INSERT INTO order_payment_collection VALUES('order_fixture','pc_fixture',NULL);
 INSERT INTO order_order_split_order_payment_split_order_payment VALUES('order_fixture','split_fixture',NULL);`)
 await db.raw('INSERT INTO refund_settlement(operation_id,order_id,scope_id,fingerprint,plan) VALUES(?,?,?,?,?::jsonb)',[op,'order_fixture',scope,'fixture-v1',JSON.stringify(plan)])
 await db.raw("UPDATE refund_settlement SET phase='refund_started' WHERE operation_id=?",[op])
 let s=await snapshot();await authorize(s)
 await t.test('normal guard bodies and enabled triggers preserved',async()=>{
 for(const [guard,original] of Object.entries(originalGuards)){
 const src=(await db.raw(`SELECT pg_get_functiondef('${guard}()'::regprocedure) src`)).rows[0].src
 assert.equal(src.replace("BEGIN\n IF TG_OP='UPDATE' AND ne.allowed(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;\n",'BEGIN'),original)
 }
 const guards=(await db.raw("SELECT tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('refund_settlement'::regclass,'commerce_refund_dispatch'::regclass,'refund_no_effect_closure'::regclass)")).rows
 assert(guards.every(x=>['O','A'].includes(x.tgenabled)))
 });
 await t.test('unauthorized receipt, boolean authority and direct normal role terminal write denied',async()=>{
 await rejectedUnchanged(()=>close(s,{verified:true,...tokens,inventory:'forged'}))
 await rejectedUnchanged(()=>db.transaction(async trx=>{await trx.raw('SET LOCAL ROLE ne_runtime');await trx.raw("UPDATE refund_settlement SET phase='refund_no_effect',no_effect_receipt_id='forged' WHERE operation_id=?",[op])}))
 await assert.rejects(db.transaction(async trx=>{await trx.raw('SET LOCAL ROLE ne_runtime');await trx.raw('INSERT INTO refund_no_effect_closure DEFAULT VALUES')}))
 await assert.rejects(db.transaction(async trx=>{await trx.raw('SET LOCAL ROLE ne_runtime');await trx.raw('SELECT ne.close(?,?::jsonb,?::jsonb)',[op,JSON.stringify(s),JSON.stringify(tokens)])}))
 });
 await t.test('database marker and all independent capabilities are mandatory',async()=>{
 await admin.raw(`COMMENT ON DATABASE ${name} IS 'wrong-marker'`)
 try {await rejectedUnchanged(()=>close(s))}finally{await admin.raw(`COMMENT ON DATABASE ${name} IS 'new-network-none-tmpfs-no-effect-candidate'`)}
 for(const kind of Object.keys(tokens)){const bad={...tokens};delete bad[kind];await rejectedUnchanged(()=>close(s,bad))}
 await db.raw("UPDATE ne.authority SET details=jsonb_set(details,'{gross_capture}','\"99\"') WHERE kind='inventory'")
 await rejectedUnchanged(()=>close(s));await authorize(s)
 await assert.rejects(db.transaction(async trx=>{await trx.raw('SET LOCAL ROLE ne_runtime');await trx.raw('INSERT INTO ne.context VALUES(1,?,?,?)',[op,JSON.stringify(s),'forged'])}))
 });
 await t.test('plan tamper and actual snapshot tamper deny',async()=>{
 const bad=structuredClone(s);bad.refund_settlement[0].plan.customerRefund=99;await rejectedUnchanged(()=>close(bad))
 const bad2=structuredClone(s);bad2.payment[0].amount=99;await rejectedUnchanged(()=>close(bad2))
 await assert.rejects(db.raw("UPDATE refund_settlement SET plan=jsonb_set(plan,'{customerRefund}','99') WHERE operation_id=?",[op]));
 });
 await t.test('cart and scope physical lock conflict, released for retry',async()=>{
 for(const [ns,id] of [['commerce-cart',cart],['refund-settlement',scope]]){
 const key=createHash('sha256').update(`hobbysalon:${ns}:v1:${id}`).digest().readBigInt64BE(0).toString()
 const c=await db.client.acquireConnection()
 try{await db.raw('SELECT pg_advisory_lock(?::bigint)',[key]).connection(c);await rejectedUnchanged(()=>close(s))}
 finally{await db.raw('SELECT pg_advisory_unlock(?::bigint)',[key]).connection(c);await db.client.releaseConnection(c)}
 }
 });
 await t.test('extra reverse links, soft-deleted refunds, native reservations and valid dispatch denied',async()=>{
 for(const statements of [
 ["INSERT INTO order_payment_collection VALUES('other','pc_fixture',NULL)"],
 ["INSERT INTO order_order_split_order_payment_split_order_payment VALUES('other','split_fixture',NULL)"],
 ["INSERT INTO refund VALUES('ref_extra','pay_fixture',3.21,'{\"value\":\"3.21\",\"precision\":20}',now())"],
 ["INSERT INTO refund VALUES('ref_extra','pay_fixture',3.21,'{\"value\":\"3.21\",\"precision\":20}',NULL)"],
 ["INSERT INTO refund VALUES('ref_extra','pay_fixture',3.21,'{\"value\":\"3.21\",\"precision\":20}',NULL)","INSERT INTO commerce_refund_dispatch(refund_id,idempotency_key,operation_id,scope_id,payment_id,provider_id,provider_payment_id,amount,currency_code) VALUES('ref_extra','ref_extra','cancel:order_fixture','pc_fixture','pay_fixture','stripe','pi_fixture',3.21,'eur')"]
 ]){
 await assert.rejects(db.transaction(async trx=>{for(const sql of statements)await trx.raw(sql);const actual=await snapshot(trx)
 for(const kind of Object.keys(tokens))await trx.raw('UPDATE ne.authority SET snapshot=?::jsonb WHERE kind=?',[JSON.stringify(actual),kind])
 await trx.raw('SET LOCAL ROLE ne_executor');await trx.raw('SELECT ne.close(?,?::jsonb,?::jsonb)',[op,JSON.stringify(actual),JSON.stringify(tokens)])}))
 assert.deepEqual(await snapshot(),s)
 }
 });
 const probes=[
 ['B1 summary absent',"UPDATE order_summary SET totals='{}'"],
 ['B1 summary JSON null',`UPDATE order_summary SET totals='{"paid":null,"refunded":null}'`],
 ['B1 summary SQL null','UPDATE order_summary SET totals=NULL'],
 ['B2 expected SQL null',null,true],
 ['B3 collection gross',`UPDATE payment_collection SET amount=999,raw_amount='{"value":"999","precision":20}'`],
 ['B3 provider wrong',"UPDATE payment SET provider_id='not-stripe'"],
 ['B3 provider null','UPDATE payment SET provider_id=NULL'],
 ['B3 inventory namespace absent',"UPDATE ne.authority SET details=details-'provider_namespace' WHERE kind='inventory'"],
 ['B3 inventory namespace wrong',`UPDATE ne.authority SET details=jsonb_set(details,'{provider_namespace}','"not-stripe"') WHERE kind='inventory'`],
 ['identity provider payment null',"UPDATE payment SET data='{}'"],
 ['identity provider payment empty',`UPDATE payment SET data='{"id":""}'`],
 ['identity cart null','UPDATE cart_payment_collection SET cart_id=NULL'],
 ['identity payment scope null','UPDATE payment SET payment_collection_id=NULL'],
 ['identity capture parent null','UPDATE capture SET payment_id=NULL'],
 ['identity transaction reference null','UPDATE order_transaction SET reference_id=NULL']
 ]
 for(const table of ['payment_collection','payment','capture','order_transaction']){
 for(const assignment of ['amount=NULL,raw_amount=NULL',`raw_amount='{}'`,`raw_amount='{"value":null,"precision":20}'`,`raw_amount='{"value":"10"}'`,`amount=0,raw_amount='{"value":"0","precision":20}'`,`amount='NaN',raw_amount='{"value":"NaN","precision":20}'`])probes.push([`${table} ${assignment}`,`UPDATE ${table} SET ${assignment}`])
 }
 for(const table of ['payment_collection','split_order_payment'])for(const field of ['authorized_amount','captured_amount','refunded_amount'])probes.push([`${table} ${field} null`,`UPDATE ${table} SET ${field}=NULL`])
 for(const [title,sql,nullExpected] of probes)await t.test('reject actual tamper: '+title,async()=>{
 let reached=false
 await assert.rejects(db.transaction(async trx=>{
 if(sql)await trx.raw(sql)
 const actual=await snapshot(trx)
 await trx.raw('UPDATE ne.authority SET snapshot=?::jsonb',[JSON.stringify(actual)])
 await trx.raw('SET LOCAL ROLE ne_executor');reached=true
 await trx.raw('SELECT ne.close(?,?::jsonb,?::jsonb)',[op,nullExpected?null:JSON.stringify(actual),JSON.stringify(tokens)])
 }),e=>e.code==='P0001')
 assert(reached,'must reach executor, not setup failure')
 assert.deepEqual(await snapshot(),s)
 for(const table of ['ne.audit','ne.context','refund_no_effect_closure'])assert.equal((await db.raw(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0)
 console.log('TAMPER_REJECTED',title,'unchanged audit=0 receipt=0 context=0')
 })
 await t.test('postlock cart scope and payment ownership injection rejects atomically',async()=>{
 for(const sql of ["UPDATE cart_payment_collection SET cart_id='changed'","UPDATE cart_payment_collection SET payment_collection_id='changed'","UPDATE payment SET payment_collection_id='changed'","UPDATE payment SET id='changed'"]){
 await db.raw('ALTER FUNCTION ne.snapshot() RENAME TO snapshot_original')
 try{
 await db.raw(`CREATE FUNCTION ne.snapshot() RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$ BEGIN IF current_user='ne_owner' THEN ${sql}; END IF; RETURN ne.snapshot_original(); END $$`)
 await assert.rejects(close(s),e=>e.code==='P0001' && e.message.includes('postlock ownership changed'))
 assert.deepEqual(await snapshot(),s)
 for(const table of ['ne.audit','ne.context','refund_no_effect_closure'])assert.equal((await db.raw(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0)
 console.log('POSTLOCK_REJECTED',sql,'unchanged audit=0 receipt=0')
 }finally{await db.raw('DROP FUNCTION ne.snapshot(); ALTER FUNCTION ne.snapshot_original() RENAME TO snapshot')}
 }
 })
 await t.test('audit failure rolls entire actual terminal and receipt back',async()=>{
 await db.raw("CREATE FUNCTION ne.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'intentional audit failure'; END $$; CREATE TRIGGER ne_fail BEFORE INSERT ON ne.audit FOR EACH ROW EXECUTE FUNCTION ne.fail_audit()")
 await rejectedUnchanged(()=>close(s));assert.equal((await db.raw('SELECT count(*)::int n FROM refund_no_effect_closure')).rows[0].n,0)
 await db.raw('DROP TRIGGER ne_fail ON ne.audit')
 });
 await t.test('positive atomic close derives actual before/after and retains finance',async()=>{
 const result=await close(s);assert.deepEqual(result,{terminal_result:'NO-EFFECT',runtime_success:false,financial_obligation:'unchanged_unresolved',receipt:'ne:'+op})
 const a=(await db.raw('SELECT * FROM ne.audit')).rows[0],r=(await db.raw('SELECT * FROM refund_no_effect_closure')).rows[0]
 assert.deepEqual(a.actual_before,s);assert.deepEqual(a.actual_after,await snapshot());assert.deepEqual(r.actual_before,a.actual_before);assert.deepEqual(r.actual_after,a.actual_after);assert.equal(r.audit_sha256,a.sha256)
 const before=structuredClone(s),after=await snapshot();delete before.refund_settlement;delete after.refund_settlement;assert.deepEqual(after,before)
 assert.deepEqual(await db.transaction(async trx=>{await trx.raw('SET LOCAL ROLE ne_executor');return (await trx.raw('SELECT ne.readback(?) r',['ne:'+op])).rows[0].r}),result)
 await assert.rejects(db.transaction(async trx=>{await trx.raw('SET LOCAL ROLE ne_executor');await trx.raw('SELECT ne.readback(?)',['forged'])}))
 s=await snapshot()
 });
 await t.test('replay, terminal reset/success/delete/truncate and another scope operation denied',async()=>{
 await assert.rejects(close(s));
 for(const sql of ["UPDATE refund_settlement SET phase='completed',no_effect_receipt_id=NULL", "UPDATE refund_settlement SET phase='pending',no_effect_receipt_id=NULL", "UPDATE refund_settlement SET updated_at=now()",'DELETE FROM refund_settlement','TRUNCATE refund_settlement','DELETE FROM refund_no_effect_closure','TRUNCATE refund_no_effect_closure','UPDATE ne.audit SET sha256=sha256','TRUNCATE ne.audit'])await assert.rejects(db.raw(sql))
 await assert.rejects(db.raw('INSERT INTO refund_settlement(operation_id,order_id,scope_id,fingerprint,plan) VALUES(?,?,?,?,?::jsonb)',['other','order_fixture',scope,'other',JSON.stringify({...plan,operation_id:'other'})]))
 assert.deepEqual(await snapshot(),s);assert.equal((await db.raw("SELECT indexdef FROM pg_indexes WHERE indexname='refund_settlement_unfinished_scope'")).rows.length,1)
 });
 await t.test('actual runtime engine/store/quarantine never returns success or dispatches',async()=>{
 const utils=path.join(root,'packages/modules/b2c-core/src/utils'),cartLock=require(path.join(utils,'commerce-cart-lock.ts')),
 engine=require(path.join(utils,'refund-settlement.ts')),quarantine=require(path.join(utils,'commerce-refund-quarantine.ts')),
 store=require(path.join(utils,'refund-settlement-store.ts')).createPostgresSettlementStore(db,cartLock.assertCommerceFinancialLock)
 const container={resolve:()=>db},effects=[];let tails=0
 const request={operation_id:op,order_id:'order_fixture',scope_id:scope,fingerprint:'fixture-v1'}
 for(const operation of [op,'other'])await assert.rejects(cartLock.withCommerceCartLock(container,cart,async()=>{await engine.executeSettlement(store,{...request,operation_id:operation},{plan:async()=>{effects.push('plan');return plan},refund:async()=>effects.push('refund'),reverse:async()=>effects.push('reverse')});tails++}),e=>e.code==='reconciliation_required')
 await assert.rejects(cartLock.withCommerceCartLock(container,cart,()=>quarantine.assertCommerceRefundQuarantineClear(scope)))
 assert.deepEqual(effects,[]);assert.equal(tails,0);assert.deepEqual(await snapshot(),s)
 });
 console.log('POSTGRES', (await db.raw('SELECT version() v')).rows[0].v)
 console.log('ADVISORY_LOCKS',(await db.raw("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory'")).rows[0].n)
 }finally{if(db)await db.destroy();if(name)await admin.raw(`DROP DATABASE ${name} WITH (FORCE)`);await admin.destroy();console.log('FIXTURE_DATABASE_CLEANED')}
})
