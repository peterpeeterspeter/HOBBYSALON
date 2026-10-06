// REAL PostgreSQL/session/process test. Synthetic canary tables only; native
// payment/order ORM, provider and deployed app are NOT claimed by this suite.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const { fork } = require('node:child_process'), { test } = require('node:test')
const swc = require('@swc/core'), knex = require('knex')
const { ContainerRegistrationKeys: K } = require('@medusajs/framework/utils')
Module._extensions['.ts'] = (m, p) => { m.paths = [...module.paths, ...m.paths]; m._compile(swc.transformSync(fs.readFileSync(p,'utf8'),{filename:p,jsc:{parser:{syntax:'typescript',decorators:true},target:'es2021',transform:{legacyDecorator:true,decoratorMetadata:true}},module:{type:'commonjs'}}).code,p) }
const root = path.resolve(__dirname,'../..'), lock = require(path.join(root,'packages/modules/b2c-core/src/utils/commerce-cart-lock.ts'))
const connect = () => knex({ client:'pg', connection:{host:'127.0.0.1',port:5432,user:'postgres',database:process.env.COMMERCE_TEST_DATABASE},pool:{min:0,max:4} })
function container(pg) { return { resolve:n=>{assert.equal(n,K.PG_CONNECTION);return pg} } }
if (process.env.COMMERCE_LOCK_CHILD === '1') {
  const pg=connect(),c=container(pg)
  lock.withCommerceCartLock(c,'cart-process',async()=>{
    await lock.commerceCartLockQuery(c,'cart-process','INSERT INTO lock_process_effects (name) VALUES (?)',['child-held'])
    process.send({held:true})
    await new Promise(resolve=>process.once('message',resolve))
    lock.assertCommerceFinancialLock()
    await lock.commerceCartLockQuery(c,'cart-process','INSERT INTO lock_process_effects (name) VALUES (?)',['child-tail'])
  }).then(()=>pg.destroy()).then(()=>process.exit(0)).catch(async()=>{await pg.destroy();process.exit(2)})
} else {
  const pg=connect(),c=container(pg)
  test('real session lock is shared, fail-fast, reentrant and released (no lease)',async()=>{
    let release,entered
    const signal=new Promise(r=>entered=r),gate=new Promise(r=>release=r)
    const holding=lock.withCommerceCartLock(c,'cart-real',async()=>{
      await lock.withCommerceCartLock(c,'cart-real',async()=>lock.assertCommerceFinancialLock())
      entered();await gate; lock.assertCommerceFinancialLock()
    })
    await signal
    await assert.rejects(lock.withCommerceCartLock(container(pg),'cart-real',async()=>assert.fail('overlap')),/busy/)
    assert.throws(()=>lock.assertCommerceFinancialLock(),/not held/)
    release();await holding
    await lock.withCommerceCartLock(container(pg),'cart-real',async()=>lock.assertCommerceFinancialLock())
  })
  test('physical backend termination invalidates old capability and successor acquires',async()=>{
    let backend,release,entered
    const signal=new Promise(r=>entered=r),gate=new Promise(r=>release=r)
    const old=lock.withCommerceCartLock(c,'cart-dead',async()=>{
      backend=(await lock.commerceCartLockQuery(c,'cart-dead','SELECT pg_backend_pid() AS pid')).rows[0].pid
      entered();await gate
      assert.throws(()=>lock.assertCommerceFinancialLock(),/lock/)
    })
    await signal;await pg.raw('SELECT pg_terminate_backend(?)',[backend])
    await new Promise(r=>setTimeout(r,60))
    await lock.withCommerceCartLock(container(pg),'cart-dead',async()=>lock.assertCommerceFinancialLock())
    release();await assert.rejects(old,/lock/)
  })
  test('independent process crash releases lock; committed canary survives; no tail after SIGKILL',async()=>{
    await pg.raw('CREATE TABLE lock_process_effects (name text PRIMARY KEY)')
    const child=fork(__filename,[],{env:{...process.env,COMMERCE_LOCK_CHILD:'1'},stdio:['ignore','pipe','pipe','ipc']})
    let err='';child.stderr.on('data',b=>{err+=b.toString()})
    try {
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('child hold timeout '+err)),10000);child.once('message',m=>{clearTimeout(timer);assert.equal(m.held,true);resolve()});child.once('exit',code=>{clearTimeout(timer);reject(Error('child exited '+code+' '+err))})})
      await assert.rejects(lock.withCommerceCartLock(c,'cart-process',async()=>assert.fail('overlap')),/busy/)
      const ended=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await ended
      await lock.withCommerceCartLock(c,'cart-process',async()=>{
        const rows=await lock.commerceCartLockQuery(c,'cart-process','SELECT * FROM lock_process_effects ORDER BY name')
        assert.deepEqual(rows.rows,[{name:'child-held'}])
      })
    } finally { if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL') }
  })
  test('actual migration SQL enforces immutable tail and unique capture reservation across sessions',async()=>{
    // Canary shapes explicitly NOT native module migration acceptance.
    await pg.raw('CREATE TABLE order_transaction (order_id text, reference text, reference_id text); CREATE TABLE capture (id text PRIMARY KEY, payment_id text NOT NULL)')
    const migrationPath=path.join(root,'packages/modules/b2c-core/src/modules/marketplace/migrations/Migration20261005190000.ts')
    const Migration=require(migrationPath).Migration20261005190000
    const sql=[];const m=Object.create(Migration.prototype);m.addSql=s=>sql.push(s);await m.up()
    await pg.transaction(async trx=>{for(const s of sql)await trx.raw(s)})
    await pg.raw('INSERT INTO capture VALUES (?,?)',['cap-winner','pay-canary'])
    await assert.rejects(pg.raw('INSERT INTO capture VALUES (?,?)',['cap-other','pay-canary']),e=>e.code==='23505')
    await pg.raw('INSERT INTO order_transaction VALUES (?,?,?)',['ord','capture','cap-winner'])
    await assert.rejects(pg.raw('INSERT INTO order_transaction VALUES (?,?,?)',['ord','capture','cap-winner']),e=>e.code==='23505')
    const snapshot={version:1,payment_id:'pay-canary',cart_id:'cart-canary',allocations:[{order_id:'ord',amount:'12.34'}]}
    await pg.raw('INSERT INTO marketplace_capture_tail (payment_id,cart_id,snapshot,event_id) VALUES (?,?,?::jsonb,?)',['pay-canary','cart-canary',JSON.stringify(snapshot),'marketplace-captured-'+'a'.repeat(64)])
    await assert.rejects(pg.raw('UPDATE marketplace_capture_tail SET snapshot = ?::jsonb WHERE payment_id = ?',[JSON.stringify({...snapshot,extra:'mutation'}),'pay-canary']),e=>e.code==='P0001')
    await assert.rejects(pg.raw('DELETE FROM marketplace_capture_tail'),e=>e.code==='P0001')
    await assert.rejects(pg.raw('UPDATE marketplace_capture_tail SET accounting_at = now()'),e=>e.code==='23514')
    await pg.raw('UPDATE marketplace_capture_tail SET capture_id = ?',['cap-winner'])
    await pg.raw('UPDATE marketplace_capture_tail SET accounting_at=now()')
    await pg.raw('UPDATE marketplace_capture_tail SET event_enqueued_at=now(),completed_at=now()')
    await assert.rejects(pg.raw('UPDATE marketplace_capture_tail SET completed_at=NULL'),e=>e.code==='P0001')
    assert.equal((await pg.raw('SELECT count(*)::integer n FROM marketplace_capture_tail WHERE completed_at IS NOT NULL')).rows[0].n,1)
  })
  require('node:test').after(()=>pg.destroy())
}
