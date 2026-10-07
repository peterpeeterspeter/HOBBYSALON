'use strict'
/** Adapted behavioral harness from candidate/scripts/tests/helpers/native-return-postgres.cjs.
 * REAL candidate admission/kernel/consumer/replay/locks/migrations and native PG transport.
 * Explicit fixture adapters: QUERY.graph cart/order-set DTOs; SQL read-only domain facades.
 * Parent completed financial state is SEEDED through the actual transaction kernel, not
 * through completeMarketplaceWebhookDb / checkout workflows. No replacement protocol/SQL.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const { spawn } = require('node:child_process'), { createRequire } = require('node:module')
const { specifier, identity, STAGES, errorCode } = require('./dependency-identity.cjs')
const diagnosticRole = process.argv[2] === '--preflight' ? 'preflight' : process.argv[2]?.startsWith('--') ? 'worker' : 'main'
let diagnosticStage, diagnosticSequence = 0
function checkpoint(stage) {
  assert(STAGES.includes(stage), 'unknown diagnostic stage')
  diagnosticStage = stage
  fs.writeSync(1, 'PG_CHECKPOINT ' + JSON.stringify({stage, role: diagnosticRole, sequence: ++diagnosticSequence}) + '\n')
}
function diagnosticFailure(error) {
  fs.writeSync(1, 'PG_NODE_DIAGNOSTIC ' + JSON.stringify({stage: diagnosticStage, role: diagnosticRole, code: errorCode(error)}) + '\n')
}
process.on('uncaughtExceptionMonitor', diagnosticFailure)
checkpoint('PG_DEPENDENCY_IDENTITIES')
const dep = createRequire(process.env.ACK_DEPENDENCY_ANCHOR || '/app/apps/backend/package.json')
const source = process.env.ACK_CANDIDATE_ROOT || '/candidate'
const inventory = require('./inventory.json')
const stable = v => JSON.stringify(v, (_k,x) => x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Date)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k,x[k]])) : x)
const hash = s => crypto.createHash('sha256').update(s).digest('hex')
const identities = Object.fromEntries(Object.entries(inventory.expected_versions).map(([n,version])=>[n,identity(dep,n,version)]))
checkpoint('PG_NATIVE_INVENTORY')
const nativeInventory = ['payment','order'].flatMap(module=>{
  const dir=path.join(path.dirname(identities['@medusajs/'+module].package_json),'dist/migrations')
  return fs.readdirSync(dir).filter(n=>/^Migration\d+\.js$/.test(n)).sort().map(name=>({module,name,sha256:hash(fs.readFileSync(path.join(dir,name)))}))
})
assert.deepEqual(nativeInventory,inventory.native_migrations,'full native migration inventory')
assert.equal(hash(stable(nativeInventory)),inventory.native_migrations_sha256)
const identityEdges=[]
checkpoint('PG_IDENTITY_EDGES')
const nativeAnchors=[dep.resolve('@medusajs/framework/utils'),identities['@medusajs/deps'].entry]
for(const module of ['payment','order']) nativeAnchors.push(path.join(path.dirname(identities['@medusajs/'+module].package_json),'dist/migrations',nativeInventory.find(m=>m.module===module).name))
nativeAnchors.push(path.join(path.dirname(identities['@medusajs/link-modules'].package_json),'dist/utils/generate-entity.js'))
for(const anchor of nativeAnchors) for(const name of ['@mikro-orm/core','@mikro-orm/migrations','@mikro-orm/postgresql','@mikro-orm/knex']) {
  const resolved=fs.realpathSync(createRequire(anchor).resolve(name))
  assert.equal(resolved,identities[name].entry,'native realpath identity: '+anchor+' -> '+name)
  identityEdges.push({anchor:fs.realpathSync(anchor),package:name,resolved,expected:identities[name].entry})
}
const loadedTs=new Set(), helperIdentityEdges=[]
checkpoint('PG_NATIVE_CONSTRUCTORS')
const swc = dep('@swc/core'), knexFactory = dep('knex'), { Client } = dep('pg')
const { MikroORM } = dep('@mikro-orm/postgresql')
const { Migration, MigrationRunner } = dep('@mikro-orm/migrations')
const { EntitySchema } = dep('@mikro-orm/core')
assert.equal(dep('@medusajs/framework/mikro-orm/migrations').Migration,Migration,'framework Migration constructor identity')
assert.equal(dep('@medusajs/deps/mikro-orm/migrations').Migration,Migration,'deps Migration constructor identity')
assert.equal(dep('@medusajs/framework/mikro-orm/core').EntitySchema,EntitySchema,'framework EntitySchema constructor identity')
assert.equal(dep('@medusajs/deps/mikro-orm/core').EntitySchema,EntitySchema,'deps EntitySchema constructor identity')
const { ContainerRegistrationKeys, PaymentActions } = dep('@medusajs/framework/utils')
const dependencyPaths = dep.resolve.paths('@medusajs/framework/utils')
require.extensions['.ts'] = (m, f) => {
  assert(f.startsWith(source + '/'), 'only candidate TypeScript')
  const relative=path.relative(source,f);assert(inventory.candidate_files.includes(relative),'unhashed transitive candidate source: '+relative)
  assert.equal(hash(fs.readFileSync(f)),inventory.candidate_sha256[relative],'candidate source pin: '+relative)
  loadedTs.add(relative)
  m.paths = [...dependencyPaths, ...m.paths]
  for(const name of Object.keys(identities)) {
    const resolved=fs.realpathSync(require.resolve(specifier(name),{paths:m.paths}))
    assert.equal(resolved,identities[name].entry,'helper dependency realpath identity: '+relative+' -> '+name)
    helperIdentityEdges.push({source:relative,package:name,resolved,expected:identities[name].entry})
  }
  m._compile(swc.transformSync(fs.readFileSync(f, 'utf8'), { filename:f,
    jsc:{parser:{syntax:'typescript',decorators:true},target:'es2022',transform:{legacyDecorator:true,decoratorMetadata:true}},
    module:{type:'commonjs'} }).code, f)
}
const backend = source + '/apps/backend/src/utils/', utils = source + '/packages/modules/b2c-core/src/utils/'
checkpoint('PG_CANDIDATE_HELPERS')
const { persistMarketplaceWebhookAdmission: admit } = require(backend + 'marketplace-webhook-admission.ts')
const { applyMarketplaceWebhookTransaction: apply, readCommittedMarketplaceWebhookReceipt: committed } = require(backend + 'marketplace-webhook-transaction.ts')
const { consumeAtomicMarketplaceOrderSetPlaced: consume } = require(utils + 'marketplace-webhook-consumer-ack.ts')
const { replayMarketplaceWebhookFinancialAck: replay } = require(utils + 'marketplace-webhook-consumer-replay.ts')
const { commerceCartLockKey, withCommerceCartLock } = require(utils + 'commerce-cart-lock.ts')
const emit = (tag, value) => console.log(tag + ' ' + JSON.stringify(value))
const hashes = () => Object.fromEntries(inventory.candidate_files.map(f => [f,crypto.createHash('sha256').update(fs.readFileSync(source + '/' + f)).digest('hex')]))

const connection = {host:'127.0.0.1',port:5432,user:'postgres',database:'webhook_ack_acceptance',connectionTimeoutMillis:4000,statement_timeout:6000}
const children = new Set(), pools = new Set()
let observer
function pool(extra={}) {
  const k = knexFactory({client:'pg',connection:{...connection,...extra},searchPath:['public'],pool:{min:0,max:2},acquireConnectionTimeout:5000})
  pools.add(k); return k
}
async function ormFor(database=connection.database) {
  return MikroORM.init({entities:[],discovery:{warnWhenNoEntities:false},host:connection.host,port:connection.port,user:connection.user,
    dbName:database,schema:'public',pool:{min:0,max:2},driverOptions:{searchPath:['public'],connection:{connectionTimeoutMillis:4000,statement_timeout:6000}},
    allowGlobalContext:true})
}
async function sql(q,args=[]) {return (await observer.query(q,args)).rows}
async function bounded(p,ms=20000) {let t; try {return await Promise.race([p,new Promise((_,r)=>{t=setTimeout(()=>r(Error('fixture barrier timeout')),ms)})])} finally{clearTimeout(t)}}
async function until(work) {const end=Date.now()+6000; while(!await work()){if(Date.now()>end)throw Error('physical session cleanup timeout');await new Promise(r=>setTimeout(r,40))}}
function eventIdentity(n) {return {event_id:'evt_pg_'+n,provider_id:'pp_card_stripe-connect',action:PaymentActions.SUCCESSFUL,
  data:{cart_id:'cart_pg_'+n,session_id:'ps_pg_'+n,payment_collection_id:'pc_pg_'+n,payment_intent_id:'pi_pg_'+n,amount:'10',currency_code:'eur'}}}
function fixture(n) {
  const input=eventIdentity(n), d=input.data, stamp='2026-10-06T10:00:00.000Z'
  const paymentId='pay_pg_'+n,captureId='cap_pg_'+n,orderId='order_pg_'+n,splitId='split_pg_'+n,setId='os_pg_'+n
  const item={id:'ci_pg_'+n,variant_id:'variant_pg_'+n,quantity:1,unit_price:'10'}
  const cart={id:d.cart_id,currency_code:'eur',total:'10',items:[item],shipping_methods:[]}
  const allocation={order_id:orderId,split_id:splitId,amount:'10',currency_code:'eur'}
  const snapshot={version:1,protocol:'atomic-stripe-event',payment_id:paymentId,cart_id:d.cart_id,session_id:d.session_id,collection_id:d.payment_collection_id,
    intent_id:d.payment_intent_id,provider_id:input.provider_id,amount:'10',currency_code:'eur',allocations:[],cart_snapshot:cart}
  const outboxId=hash('fixture-outbox:'+n), payload={name:'order_set.placed',data:{id:setId},metadata:{source:'isolated-pg-fixture'},options:{attempts:1}}
  const order={id:orderId,version:1,status:'pending',currency_code:'eur',items:[{...item,id:'oi_pg_'+n}],payment_collections:[{id:d.payment_collection_id}],
    summary:{accounting_total:'10',paid_total:'10',transaction_total:'10',refunded_total:'0',credit_line_total:'0',pending_difference:'0'},
    split_order_payment:{id:splitId,payment_collection_id:d.payment_collection_id,currency_code:'eur',status:'captured',authorized_amount:'10',captured_amount:'10',refunded_amount:'0'}}
  return {n,input,stamp,paymentId,captureId,orderId,splitId,setId,snapshot,outboxId,payload,cart:{...cart,completed_at:stamp},
    orderSet:{id:setId,cart_id:d.cart_id,payment_collection_id:d.payment_collection_id,orders:[order]},allocation}
}
async function seedNative(f,scope) {
  const exec=(q,v=[])=>scope.execute(q,v), d=f.input.data, raw=JSON.stringify({value:'10',precision:20}), zero=JSON.stringify({value:'0',precision:20})
  const data=JSON.stringify({id:d.payment_intent_id,status:'succeeded'})
  await exec(`INSERT INTO payment_collection(id,currency_code,amount,raw_amount,authorized_amount,raw_authorized_amount,captured_amount,raw_captured_amount,refunded_amount,raw_refunded_amount,status,completed_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[d.payment_collection_id,'eur','10',raw,'10',raw,'10',raw,'0',zero,'completed',f.stamp])
  await exec(`INSERT INTO payment_session(id,currency_code,amount,raw_amount,provider_id,data,status,authorized_at,payment_collection_id)
    VALUES(?,?,?,?,?,?::jsonb,?,?,?)`,[d.session_id,'eur','10',raw,f.input.provider_id,data,'captured',f.stamp,d.payment_collection_id])
  await exec(`INSERT INTO payment(id,amount,raw_amount,currency_code,provider_id,data,captured_at,payment_collection_id,payment_session_id)
    VALUES(?,?,?,?,?,?::jsonb,?,?,?)`,[f.paymentId,'10',raw,'eur',f.input.provider_id,data,f.stamp,d.payment_collection_id,d.session_id])
  await exec('INSERT INTO capture(id,amount,raw_amount,payment_id) VALUES(?,?,?,?)',[f.captureId,'10',raw,f.paymentId])
  await exec('INSERT INTO cart_payment_collection(id,cart_id,payment_collection_id) VALUES(?,?,?)',['link_pg_'+f.n,d.cart_id,d.payment_collection_id])
  await exec('INSERT INTO "order"(id,status,currency_code,version) VALUES(?,?,?,?)',[f.orderId,'pending','eur',1])
  await exec(`INSERT INTO order_transaction(id,order_id,version,amount,raw_amount,currency_code,reference,reference_id)
    VALUES(?,?,?,?,?,?,?,?)`,['tx_pg_'+f.n,f.orderId,1,'10',raw,'eur','capture',f.captureId])
  await exec(`INSERT INTO split_order_payment(id,status,currency_code,authorized_amount,captured_amount,refunded_amount,payment_collection_id,raw_authorized_amount,raw_captured_amount,raw_refunded_amount)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,[f.splitId,'captured','eur','10','10','0',d.payment_collection_id,raw,raw,zero])
  await exec(`INSERT INTO marketplace_capture_tail(payment_id,cart_id,capture_id,snapshot,event_id,accounting_at)
    VALUES(?,?,?,?::jsonb,?,?)`,[f.paymentId,d.cart_id,f.captureId,JSON.stringify(f.snapshot),'marketplace-captured-'+hash(stable(f.snapshot)),f.stamp])
  await exec('INSERT INTO fixture_graph(entity,id,cart_id,data) VALUES(?,?,?,?::jsonb)', ['cart',d.cart_id,d.cart_id,JSON.stringify(f.cart)])
  await exec('INSERT INTO fixture_graph(entity,id,cart_id,data) VALUES(?,?,?,?::jsonb)', ['order_set',f.setId,d.cart_id,JSON.stringify(f.orderSet)])
}
async function seedParent(f,manager) {
  await admit(manager,f.input)
  return apply(manager,f.input,async scope=>{
    await seedNative(f,scope)
    await scope.execute('INSERT INTO marketplace_webhook_outbox(id,event_id,event_name,payload) VALUES(?,?,?,?::jsonb)',[f.outboxId,f.input.event_id,f.payload.name,JSON.stringify(f.payload)])
    await scope.execute(`INSERT INTO marketplace_webhook_commit(event_id,payment_id,capture_id,cart_id,order_set_id,allocations,outbox_ids)
      VALUES(?,?,?,?,?,?::jsonb,?::jsonb)`,[f.input.event_id,f.paymentId,f.captureId,f.input.data.cart_id,f.setId,JSON.stringify([f.allocation]),JSON.stringify([f.outboxId])])
  })
}
function transport(f) {return {name:f.payload.name,data:f.payload.data,metadata:{...f.payload.metadata,marketplace_webhook_outbox_id:f.outboxId,marketplace_webhook_event_id:f.input.event_id}}}
async function envFor(f,options={}) {
  const orm=await ormFor(), em=orm.em.fork({clear:true,useContext:false}), native=em.getConnection().getKnex(), pg=pool()
  const read=async(q,args=[]) => (await pg.raw(q,args)).rows
  // Explicit test-only read facades over native migrated tables, not MedusaService.
  const paymentService={baseRepository_:{manager_:em},
    async retrievePayment(id){const p=(await read('SELECT * FROM payment WHERE id=?',[id]))[0];if(!p)return p;
      return {...p,captures:await read('SELECT * FROM capture WHERE payment_id=?',[id]),refunds:await read('SELECT * FROM refund WHERE payment_id=?',[id])}},
    async retrievePaymentSession(id){return (await read('SELECT * FROM payment_session WHERE id=?',[id]))[0]},
    async retrievePaymentCollection(id){const pc=(await read('SELECT * FROM payment_collection WHERE id=?',[id]))[0];if(!pc)return pc;
      return {...pc,payment_sessions:await read('SELECT * FROM payment_session WHERE payment_collection_id=?',[id]),payments:await read('SELECT * FROM payment WHERE payment_collection_id=?',[id])}}
  }
  const container={resolve(name){
    if(name===ContainerRegistrationKeys.PG_CONNECTION)return options.bootstrap || pg
    if(name===ContainerRegistrationKeys.QUERY)return {graph:async({entity,filters})=>{
      if(options.beforeGraph)await options.beforeGraph(entity)
      if(entity==='payment')return {data:await read('SELECT * FROM payment WHERE payment_collection_id=?',[filters.payment_collection_id])}
      const key=filters.id?'id':'cart_id';assert(['cart','order_set'].includes(entity))
      const data=(await read(`SELECT data FROM fixture_graph WHERE entity=? AND ${key}=?`,[entity,filters.id || filters.cart_id])).map(x=>x.data)
      if(entity==='cart')for(const cart of data)cart.payment_collection=await paymentService.retrievePaymentCollection(f.input.data.payment_collection_id)
      return {data}
    }}
    if(name==='payment')return paymentService
    if(name==='order')return {listOrderTransactions:async filter=>read('SELECT * FROM order_transaction WHERE order_id=? ORDER BY id',[filter.order_id])}
    if(name==='split_order_payment')return {listSplitOrderPayments:async filter=>read('SELECT * FROM split_order_payment WHERE id=? ORDER BY id',[filter.id])}
    throw Error('No provider/broker/workflow dependency allowed: '+name)
  }}
  return {orm,em,native,pg,container,close:async()=>{await orm.close(true);await pg.destroy();pools.delete(pg)}}
}
async function fresh(f,fn,options={}) {const e=await envFor(f,options);try{return await fn(e)}finally{await e.close()}}
async function ack(f) {return sql('SELECT * FROM marketplace_webhook_consumer_ack WHERE outbox_id=$1',[f.outboxId])}
async function financialSnapshot(f) {
  const out={};for(const [table,key,val] of [['payment','id',f.paymentId],['capture','id',f.captureId],['payment_collection','id',f.input.data.payment_collection_id],
    ['payment_session','id',f.input.data.session_id],['order_transaction','order_id',f.orderId],['split_order_payment','id',f.splitId],['marketplace_capture_tail','payment_id',f.paymentId],['marketplace_webhook_outbox','id',f.outboxId],['marketplace_webhook_commit','event_id',f.input.event_id]])
    out[table]=await sql(`SELECT * FROM ${table} WHERE ${key}=$1`,[val])
  return out
}
async function advisory(cartId) {return sql(`SELECT l.pid,a.state,a.xact_start FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
  WHERE l.locktype='advisory' AND l.granted AND l.objsubid=1
  AND l.classid::bigint=(($1::bigint >> 32) & 4294967295) AND l.objid::bigint=($1::bigint & 4294967295)`,[commerceCartLockKey(cartId)])}
function worker(mode,n) {
  const c=spawn(process.execPath,['--max-old-space-size=96',__filename,mode,n],{stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,NODE_OPTIONS:''}})
  children.add(c);let output='',errors=''
  c.stdout.on('data',x=>output+=x);c.stderr.on('data',x=>errors+=x)
  const exited=new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',(code,signal)=>{children.delete(c);resolve({code,signal,output,errors})})})
  const ready=new Promise((resolve,reject)=>{c.once('message',resolve);c.once('error',reject);c.once('close',()=>reject(Error('worker before barrier: '+errors)))})
  ready.catch(()=>{});return {child:c,ready,exited}
}
function die(point){fs.writeSync(1,'CRASH_POINT '+JSON.stringify(point)+'\n');process.kill(process.pid,'SIGKILL')}
async function workerMain(mode,n) {
  const f=fixture(n), e=await envFor(f,{beforeGraph:mode==='--crash-claim'?async()=>{
    const locks=(await e.pg.raw('SELECT pg_backend_pid() pid')).rows // second root connection, NOT lock-holder proof
    die({phase:'consumer-claim-before-ack',event_id:f.input.event_id,probe_pid:locks[0].pid})
  }:undefined})
  try {
    if(mode==='--hold')await withCommerceCartLock(e.container,f.input.data.cart_id,async()=>{
      const locks=await e.pg.raw('SELECT pid FROM pg_locks WHERE locktype=\'advisory\' AND granted')
      process.send({held:true,locks:locks.rows});await bounded(new Promise(r=>process.once('message',r)))
    })
    else if(mode==='--crash-admission'){
      await admit(e.em,f.input)
      await apply(e.em,f.input,async scope=>{await scope.execute('INSERT INTO fixture_sentinel(id,payload) VALUES(?,?::jsonb)',['crash-uncommitted','{}']);die({phase:'admission-committed-business-uncommitted',event_id:f.input.event_id})})
    } else if(mode==='--crash-claim')await replay(e.container,f.outboxId,f.input.event_id)
    else if(mode==='--crash-ack'){await consume(e.container,transport(f));die({phase:'ack-committed',event_id:f.input.event_id})}
    else if(mode==='--replay'){await replay(e.container,f.outboxId,f.input.event_id);process.send({done:true,native_pid:(await e.em.execute('SELECT pg_backend_pid() pid'))[0].pid})}
    else throw Error('Unknown worker mode')
  } finally {await e.close();if(process.connected)process.disconnect()}
}
async function crashed(w,phase){const result=await bounded(w.exited);assert.equal(result.signal,'SIGKILL',result.errors);assert.equal(result.code,null);
  const markers=result.output.split('\n').filter(x=>x.startsWith('CRASH_POINT '));assert.equal(markers.length,1)
  const point=JSON.parse(markers[0].slice(12));assert.equal(point.phase,phase);emit('CRASH_OBSERVED',{...point,code:result.code,signal:result.signal});return point}
const cases=[];const test=(name,run)=>cases.push({name,run})
let mainOrm, manager, base
const nativeMigrations=[]
checkpoint('PG_CANDIDATE_MIGRATIONS')
for(const file of inventory.candidate_migrations)require(source+'/'+file)
async function runMigration(file,orm) {
  const name=path.basename(file,path.extname(file)), C=(file.startsWith(source+'/')?require(file):dep(file))[name]
  const migration=new C(orm.em.getDriver(),orm.config);assert(migration instanceof Migration)
  const runner=new MigrationRunner(orm.em.getDriver(),{transactional:true,disableForeignKeys:false},orm.config)
  await runner.run(migration,'up')
  emit('MIGRATION_SQL',{name,file,realpath:fs.realpathSync(file),sha256:hash(fs.readFileSync(file)),candidate:file.startsWith(source+'/'),direction:'up',queries:migration.getQueries(),real_runner:true})
}
test('actual_native_and_candidate_migrations',async()=>{
  assert.deepEqual(await sql("SELECT tablename FROM pg_tables WHERE schemaname='public'"),[])
  mainOrm=await ormFor();manager=mainOrm.em.fork()
  for(const module of ['payment','order']) {
    const dir=path.join(path.dirname(identities['@medusajs/'+module].package_json),'dist/migrations')
    for(const name of fs.readdirSync(dir).filter(n=>/^Migration\d+\.js$/.test(n)).sort()){
      const file=path.join(dir,name);nativeMigrations.push({module,name,sha256:hash(fs.readFileSync(file))});await runMigration(file,mainOrm)
    }
  }
  const linkRoot=path.dirname(identities['@medusajs/link-modules'].package_json)
  const { CartPaymentCollection }=dep(linkRoot+'/dist/definitions/cart-payment-collection.js')
  const { generateEntity }=dep(linkRoot+'/dist/utils/generate-entity.js')
  const [primary,foreign]=CartPaymentCollection.relationships
  const linkEntity=generateEntity(CartPaymentCollection,primary,foreign)
  assert(linkEntity instanceof EntitySchema,'generated native link EntitySchema identity')
  const linkOrm=await MikroORM.init({entities:[linkEntity],host:connection.host,port:connection.port,user:connection.user,
    dbName:connection.database,schema:'public',driverOptions:{searchPath:['public']},pool:{min:0,max:1}})
  try {const generated=await linkOrm.schema.getCreateSchemaSQL({wrap:false});emit('NATIVE_LINK_SCHEMA',{table:CartPaymentCollection.databaseConfig.tableName,sql:generated,origin:'installed generateEntity + real MikroORM SchemaGenerator'});await linkOrm.schema.createSchema({wrap:false})}
  finally {await linkOrm.close(true)}
  for(const file of inventory.candidate_migrations)await runMigration(source+'/'+file,mainOrm)
  await sql('CREATE TABLE fixture_graph(entity text NOT NULL,id text NOT NULL,cart_id text NOT NULL,data jsonb NOT NULL,PRIMARY KEY(entity,id)); CREATE TABLE fixture_sentinel(id text PRIMARY KEY,payload jsonb NOT NULL)')
  const fk=await sql("SELECT conname,convalidated FROM pg_constraint WHERE contype='f' AND conrelid IN ('marketplace_webhook_commit'::regclass,'marketplace_webhook_consumer_ack'::regclass)")
  assert.equal(fk.length,5);assert(fk.every(x=>x.convalidated));assert.deepEqual(nativeMigrations,nativeInventory);emit('MIGRATION_ORDER',{native:nativeMigrations,native_sha256:hash(stable(nativeMigrations)),candidate:inventory.candidate_migrations,candidate_sha256:Object.fromEntries(inventory.candidate_migrations.map(f=>[f,hash(fs.readFileSync(source+'/'+f))]))})
})
test('durable_admission_distinct_from_commit_and_collision',async()=>{
  const input=eventIdentity('admission');await admit(manager,input)
  const before=await sql('SELECT * FROM marketplace_webhook_admission WHERE event_id=$1',[input.event_id]);assert.equal(before.length,1)
  assert.equal(await committed(manager,input),false);await admit(manager,input);assert.deepEqual(await sql('SELECT * FROM marketplace_webhook_admission WHERE event_id=$1',[input.event_id]),before)
  await assert.rejects(admit(manager,{...input,data:{...input.data,amount:'11'}}),/identity collision/)
  assert.deepEqual(await sql('SELECT * FROM marketplace_webhook_admission WHERE event_id=$1',[input.event_id]),before)
})
test('physical_transaction_context_and_atomic_rollback',async()=>{
  const input=eventIdentity('rollback');await admit(manager,input);let expired
  await assert.rejects(apply(manager,input,async scope=>{
    expired=scope;const local=scope.context(mainOrm.em).transactionManager
    const [{pid:ownerPid,txid:ownerTxid}]=await scope.execute('SELECT pg_backend_pid() pid,txid_current()::text txid')
    const [{pid:forkPid,txid:forkTxid}]=await local.execute('SELECT pg_backend_pid() pid,txid_current()::text txid')
    assert.equal(ownerPid,forkPid);assert.equal(ownerTxid,forkTxid);assert.notEqual(ownerPid,observer.processID)
    const trx=local.getTransactionContext();assert(trx.isTransaction && !trx.isCompleted());assert.equal(mainOrm.em.getTransactionContext(),undefined)
    await local.execute('INSERT INTO fixture_sentinel(id,payload) VALUES(?,?::jsonb)',['rollback','{}'])
    assert.equal((await sql('SELECT * FROM fixture_sentinel WHERE id=$1',['rollback'])).length,0)
    const foreign=await ormFor('postgres');try{assert.throws(()=>scope.context(foreign.em),/database mismatch/)}finally{await foreign.close(true)}
    emit('PHYSICAL_TRANSACTION',{owner_pid:ownerPid,fork_pid:forkPid,observer_pid:observer.processID,txid:ownerTxid})
    throw Error('intentional rollback')
  }),/intentional rollback/)
  assert.equal(await committed(manager,input),false);assert.equal((await sql('SELECT * FROM fixture_sentinel WHERE id=$1',['rollback'])).length,0)
  assert.equal((await sql('SELECT * FROM marketplace_webhook_admission WHERE event_id=$1',[input.event_id])).length,1)
  assert.throws(()=>expired.context(mainOrm.em),/authority expired/)
})
test('committed_parent_fixture_duplicate_no_reapply',async()=>{
  base=fixture('base');await seedParent(base,manager);assert.equal(await committed(manager,base.input),true)
  const before=await financialSnapshot(base);const duplicate=await apply(manager,base.input,async()=>{throw Error('duplicate callback forbidden')})
  assert.equal(duplicate.duplicate,true);assert.deepEqual(await financialSnapshot(base),before)
  await assert.rejects(apply(manager,{...base.input,data:{...base.input.data,amount:'11'}},async()=>{}),/identity collision/)
})
test('admission_commit_ack_composite_binding',async()=>{
  const other=fixture('binding');await seedParent(other,manager)
  await assert.rejects(observer.query('INSERT INTO marketplace_webhook_consumer_ack(outbox_id,subscriber_id,event_id) VALUES($1,$2,$3)',[base.outboxId,'order-set-placed-payment-capture',other.input.event_id]),e=>e.code==='23503')
  await assert.rejects(observer.query('INSERT INTO marketplace_webhook_consumer_ack(outbox_id,subscriber_id,event_id) VALUES($1,$2,$3)',[base.outboxId,'other-member',base.input.event_id]),e=>e.code==='23514')
  assert.deepEqual(await ack(base),[])
})
test('actual_consumer_durable_ack_and_immutable_duplicate',async()=>{
  const before=await financialSnapshot(base)
  await fresh(base,e=>consume(e.container,transport(base)));const first=await ack(base);assert.equal(first.length,1);assert.equal(first[0].event_id,base.input.event_id)
  await fresh(base,e=>consume(e.container,transport(base)));assert.deepEqual(await ack(base),first);assert.deepEqual(await financialSnapshot(base),before)
})
test('missing_commit_and_changed_payload_fail_closed',async()=>{
  const f=fixture('invalid');await seedParent(f,manager);const changed=transport(f);changed.metadata.extra='unapproved'
  await fresh(f,e=>assert.rejects(consume(e.container,changed),/binding unavailable/));assert.deepEqual(await ack(f),[])
  const missing=fixture('no_commit');await admit(manager,missing.input)
  await apply(manager,missing.input,s=>s.execute('INSERT INTO marketplace_webhook_outbox(id,event_id,event_name,payload) VALUES(?,?,?,?::jsonb)',[missing.outboxId,missing.input.event_id,missing.payload.name,JSON.stringify(missing.payload)]))
  await fresh(missing,e=>assert.rejects(consume(e.container,transport(missing)),/binding unavailable/));assert.deepEqual(await ack(missing),[])
})
test('ack_commit_failure_rolls_back_insert',async()=>{
  const f=fixture('commit_failure');await seedParent(f,manager)
  await sql(`CREATE TABLE fixture_allowed(id text PRIMARY KEY); CREATE TABLE fixture_deferred(id text REFERENCES fixture_allowed(id) DEFERRABLE INITIALLY DEFERRED);
    CREATE FUNCTION fixture_reject_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_id='evt_pg_commit_failure' THEN INSERT INTO fixture_deferred VALUES('not-allowed'); END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_ack_commit_failure AFTER INSERT ON marketplace_webhook_consumer_ack FOR EACH ROW EXECUTE FUNCTION fixture_reject_commit()`)
  try {await fresh(f,e=>assert.rejects(consume(e.container,transport(f)),e=>String(e.message).includes('fixture_deferred')));assert.deepEqual(await ack(f),[]);assert.deepEqual(await sql('SELECT * FROM fixture_deferred'),[])}
  finally{await sql('DROP TRIGGER fixture_ack_commit_failure ON marketplace_webhook_consumer_ack; DROP FUNCTION fixture_reject_commit(); DROP TABLE fixture_deferred; DROP TABLE fixture_allowed')}
  await fresh(f,e=>consume(e.container,transport(f)));assert.equal((await ack(f)).length,1)
})
test('native_connection_url_equivalence_and_physical_identity',async()=>{
  const f=fixture('identity');await seedParent(f,manager)
  await fresh(f,async e=>{
    const bootstrap=knexFactory({client:'pg',connection:{connectionString:'postgresql://postgres@127.0.0.1:5432/webhook_ack_acceptance'},searchPath:['public'],pool:{min:0,max:2}})
    try{
      const lockIdentity=(await bootstrap.raw('SELECT pg_backend_pid() pid,current_database() db,current_user usr,current_setting(\'search_path\') path')).rows[0]
      const nativeIdentity=(await e.em.execute('SELECT pg_backend_pid() pid,current_database() db,current_user usr,current_setting(\'search_path\') path'))[0]
      assert.notEqual(lockIdentity.pid,nativeIdentity.pid);assert.notEqual(nativeIdentity.pid,observer.processID)
      assert.deepEqual({...lockIdentity,pid:0},{...nativeIdentity,pid:0});assert.equal(nativeIdentity.db,connection.database)
      const c={resolve:n=>n===ContainerRegistrationKeys.PG_CONNECTION?bootstrap:e.container.resolve(n)}
      await consume(c,transport(f));assert.equal((await ack(f)).length,1)
      emit('NATIVE_CONNECTION_IDENTITY',{lock:lockIdentity,native:nativeIdentity,observer_pid:observer.processID,distinct_real_clients:true})
    }finally{await bootstrap.destroy()}
  })
})
test('native_connection_ambiguity_rejected_before_sql',async()=>{
  const f=fixture('ambiguity');await seedParent(f,manager)
  await fresh(f,async e=>{
    const old=e.native.client.config.connection.port;let queries=0;const onQuery=()=>queries++;e.native.on('query',onQuery)
    try{for(const port of ['5.432e3','05432','5432junk',{toString:()=> '5',valueOf:()=>5432}]){
      e.native.client.config.connection.port=port;await assert.rejects(consume(e.container,transport(f)),/binding unavailable/)
    }}finally{e.native.client.config.connection.port=old;e.native.removeListener('query',onQuery)}
    assert.equal(queries,0)
    for(const override of [{database:'postgres'},{host:'other.invalid'},{port:5433},{user:'other'}]){
      const k=pool(override);try{let n=0;k.on('query',()=>n++);const c={resolve:key=>key===ContainerRegistrationKeys.PG_CONNECTION?k:e.container.resolve(key)}
        await assert.rejects(consume(c,transport(f)),/binding unavailable/);assert.equal(n,0)}finally{await k.destroy();pools.delete(k)}
    }
    assert.deepEqual(await ack(f),[])
  })
})
test('cross_process_same_cart_contention_other_cart_progress',async()=>{
  const f=fixture('contention');await seedParent(f,manager);const w=worker('--hold',f.n)
  try{await bounded(w.ready);const locks=await advisory(f.input.data.cart_id);assert.equal(locks.length,1);assert.equal(locks[0].xact_start,null)
    await fresh(f,e=>assert.rejects(consume(e.container,transport(f)),/cart is busy/));assert.deepEqual(await ack(f),[])
    const other=fixture('independent');await seedParent(other,manager);await fresh(other,e=>consume(e.container,transport(other)))
    assert.equal((await ack(other)).length,1);assert.equal((await advisory(f.input.data.cart_id)).length,1)
    emit('PROCESS_CONCURRENCY',{lock_pid:locks[0].pid,observer_pid:observer.processID,same_cart_rejected:true,other_cart_progress:true})
  }finally{if(w.child.connected)w.child.send('release')}
  const exit=await bounded(w.exited);assert.equal(exit.code,0,exit.errors);assert.equal(exit.signal,null)
})
test('consumer_attempt_skip_locked',async()=>{
  const f=fixture('skip_locked');await seedParent(f,manager);await sql('INSERT INTO marketplace_webhook_consumer_attempt(outbox_id) VALUES($1)',[f.outboxId])
  const holder=new Client(connection);await holder.connect()
  try{await holder.query('BEGIN');await holder.query('SELECT * FROM marketplace_webhook_consumer_attempt WHERE outbox_id=$1 FOR UPDATE',[f.outboxId])
    await fresh(f,e=>bounded(replay(e.container,f.outboxId,f.input.event_id),4000));assert.deepEqual(await ack(f),[])
    assert.equal((await sql('SELECT attempts FROM marketplace_webhook_consumer_attempt WHERE outbox_id=$1',[f.outboxId]))[0].attempts,0)
  }finally{await holder.query('ROLLBACK');await holder.end()}
  await fresh(f,e=>replay(e.container,f.outboxId,f.input.event_id));assert.equal((await ack(f)).length,1)
})
test('replay_failure_cursor_survives_consumer_rollback',async()=>{
  const f=fixture('replay_failure');await seedParent(f,manager);await sql('UPDATE payment SET captured_at=NULL WHERE id=$1',[f.paymentId])
  await fresh(f,e=>assert.rejects(replay(e.container,f.outboxId,f.input.event_id),/ACK replay requires reconciliation/))
  const cursor=(await sql('SELECT * FROM marketplace_webhook_consumer_attempt WHERE outbox_id=$1',[f.outboxId]))[0]
  assert.equal(cursor.attempts,1);assert.equal(cursor.last_error,'Financial member ACK reconciliation required; no automatic financial retry');assert.deepEqual(await ack(f),[])
  await sql('UPDATE payment SET captured_at=$2 WHERE id=$1',[f.paymentId,f.stamp]);await fresh(f,e=>replay(e.container,f.outboxId,f.input.event_id));assert.deepEqual(await ack(f),[])
  assert.deepEqual((await sql('SELECT * FROM marketplace_webhook_consumer_attempt WHERE outbox_id=$1',[f.outboxId]))[0],cursor)
  await sql("UPDATE marketplace_webhook_consumer_attempt SET available_at=now()-interval '1 second' WHERE outbox_id=$1",[f.outboxId])
  await fresh(f,e=>replay(e.container,f.outboxId,f.input.event_id));assert.equal((await ack(f)).length,1)
})
test('crash_after_admission_before_business_commit',async()=>{
  const f=fixture('crash_admission');await crashed(worker('--crash-admission',f.n),'admission-committed-business-uncommitted')
  await until(async()=>!(await sql("SELECT pid FROM pg_stat_activity WHERE datname=$1 AND state='idle in transaction'",[connection.database])).length)
  assert.equal((await sql('SELECT * FROM marketplace_webhook_admission WHERE event_id=$1',[f.input.event_id])).length,1)
  assert.equal(await committed(manager,f.input),false);assert.deepEqual(await sql("SELECT * FROM fixture_sentinel WHERE id='crash-uncommitted'"),[])
  await seedParent(f,manager);assert.equal(await committed(manager,f.input),true)
})
test('crash_after_replay_claim_before_ack_then_fresh_process_replay',async()=>{
  const f=fixture('crash_claim');await seedParent(f,manager);const before=await financialSnapshot(f)
  await crashed(worker('--crash-claim',f.n),'consumer-claim-before-ack');await until(async()=>!(await advisory(f.input.data.cart_id)).length)
  const cursor=(await sql('SELECT * FROM marketplace_webhook_consumer_attempt WHERE outbox_id=$1',[f.outboxId]))[0];assert.equal(cursor.attempts,1);assert.equal(cursor.last_error,null);assert.deepEqual(await ack(f),[])
  await fresh(f,e=>replay(e.container,f.outboxId,f.input.event_id));assert.deepEqual(await ack(f),[])
  // Fixture-only eligibility advancement avoids a five-minute sleep; NEVER financial authority.
  await sql("UPDATE marketplace_webhook_consumer_attempt SET available_at=now()-interval '1 second' WHERE outbox_id=$1",[f.outboxId])
  const w=worker('--replay',f.n);const ready=await bounded(w.ready), exit=await bounded(w.exited);assert(ready.done);assert.equal(exit.code,0,exit.errors);assert.equal(exit.signal,null)
  assert.equal((await ack(f)).length,1);assert.deepEqual(await financialSnapshot(f),before)
})
test('crash_after_ack_commit_duplicate_replay_unchanged',async()=>{
  const f=fixture('crash_ack');await seedParent(f,manager);await crashed(worker('--crash-ack',f.n),'ack-committed')
  await until(async()=>!(await advisory(f.input.data.cart_id)).length);const before=await ack(f);assert.equal(before.length,1)
  const finances=await financialSnapshot(f), w=worker('--replay',f.n);await bounded(w.ready);const exit=await bounded(w.exited);assert.equal(exit.code,0,exit.errors)
  assert.deepEqual(await ack(f),before);assert.deepEqual(await financialSnapshot(f),finances)
  assert.equal((await sql('SELECT attempts FROM marketplace_webhook_consumer_attempt WHERE outbox_id=$1',[f.outboxId]))[0].attempts,0)
})
test('append_only_admission_commit_ack_and_down_refusal',async()=>{
  for(const table of ['marketplace_webhook_admission','marketplace_webhook_commit','marketplace_webhook_consumer_ack']){
    const before=await sql(`SELECT * FROM ${table} ORDER BY event_id`)
    for(const query of [`UPDATE ${table} SET event_id=event_id WHERE event_id=$1`,`DELETE FROM ${table} WHERE event_id=$1`])
      await assert.rejects(observer.query(query,[base.input.event_id]),e=>e.code==='23514' && e.message==='Durable webhook identity rows are append-only')
    assert.deepEqual(await sql(`SELECT * FROM ${table} ORDER BY event_id`),before)
  }
  const file=inventory.candidate_migrations.at(-1), C=require(source+'/'+file).Migration20261006220000,m=new C(mainOrm.em.getDriver(),mainOrm.config)
  await assert.rejects(m.down(),/cannot be destructively rolled back/);assert.deepEqual(m.getQueries(),[])
  emit('MIGRATION_DOWN_REFUSED',{name:'Migration20261006220000',emitted_queries:0,preserved_ack_rows:(await sql('SELECT * FROM marketplace_webhook_consumer_ack')).length})
})
async function main(){
  checkpoint('PG_CASE_INVENTORY')
  assert.equal(process.env.ACK_ISOLATED_FIXTURE,'1');assert.deepEqual(cases.map(c=>c.name),inventory.cases)
  checkpoint('PG_OBSERVER_CONNECT')
  observer=new Client(connection);await observer.connect()
  checkpoint('PG_RUNTIME_METADATA')
  emit('RUNTIME_METADATA',{node:process.version,postgres:(await sql('SELECT version() version'))[0].version,
    versions:Object.fromEntries(Object.entries(identities).map(([n,v])=>[n,v.version])),
    dependency_identities:identities,identity_edges:identityEdges,helper_identity_edges:helperIdentityEdges,native_migrations:nativeInventory,native_migrations_sha256:hash(stable(nativeInventory)),loaded_candidate_sources:[...loadedTs].sort(),
    source_hashes:hashes(),expected_tests:inventory.cases.length,boundary:'real candidate PG storage; seeded parent completed state and explicit DB-backed domain/graph fixture adapters; NOT native checkout/provider/broker/host-power-loss'})
  const results=[]
  checkpoint('PG_TEST_EXECUTION')
  try{for(const c of cases){try{await c.run();results.push({name:c.name,status:'passed'})}catch(e){results.push({name:c.name,status:'failed',error:String(e.stack)});process.exitCode=1}emit('TEST_RESULT',results.at(-1))}}
  finally{
    for(const child of children)child.kill('SIGKILL')
    for(const p of pools)await p.destroy();if(mainOrm)await mainOrm.close(true);await observer.end()
  }
  emit('ACK_PG_RESULT',{expected:inventory.cases.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,skipped:0,results})
  checkpoint('PG_NODE_COMPLETE')
}
if(process.argv[2]==='--preflight'){
  checkpoint('PG_CASE_INVENTORY')
  assert.deepEqual(cases.map(c=>c.name),inventory.cases)
  for(const f of inventory.candidate_migrations){const C=require(source+'/'+f)[path.basename(f,'.ts')];assert(new C(undefined,undefined) instanceof Migration)}
  emit('NO_LAUNCH_PREFLIGHT',{status:'passed',candidate_hashes:hashes(),dependency_identities:identities,identity_edges:identityEdges,helper_identity_edges:helperIdentityEdges,native_migrations_sha256:hash(stable(nativeInventory)),cases:inventory.cases.length,imports:'real candidate helpers and real dependencies; no connect/up/test execution'})
  checkpoint('PG_PREFLIGHT_COMPLETE')
}else if(process.argv[2]?.startsWith('--'))workerMain(process.argv[2],process.argv[3]).catch(e=>{diagnosticFailure(e);console.error(e.stack);process.exitCode=1;if(process.connected)process.disconnect()})
else main().catch(e=>{diagnosticFailure(e);emit('FATAL_ERROR',{error:String(e.stack)});process.exitCode=1})
