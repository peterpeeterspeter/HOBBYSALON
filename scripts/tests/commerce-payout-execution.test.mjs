import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { loadMedusaNumeric } from './helpers/medusa-numeric.mjs'
const { MathBN, BigNumber } = loadMedusaNumeric()
const root = new URL('../../', import.meta.url)
const read = p => readFileSync(new URL(p, root), 'utf8')
const base = 'packages/modules/b2c-core/src/'
const source = read(base + 'modules/payout/services/provider.ts')
const methods = source.slice(source.indexOf('  async createPayout('), source.indexOf('  async createPayoutAccount('))
const Provider = vm.runInNewContext(stripTypeScriptTypes(`class Provider { ${methods} }; Provider`, {mode:'strip'}), {
  MathBN, currentPayoutDispatchPlan: () => currentPayoutDispatchPlan(), getSmallestUnit: (a) => Number(MathBN.mult(a,100).toString()), getAmountFromSmallestUnit: a => a/100,
  MedusaError: class extends Error { static Types = {UNEXPECTED_STATE:'unexpected'}; constructor(_t,m){super(m)} },
})
const input = { amount: 9, currency:'eur', account_reference_id:'acct_a', transaction_id:'order_a', source_transaction:'ch_a' }
const transfer = {id:'tr_a', amount:900, currency:'eur', destination:'acct_a', source_transaction:'ch_a', metadata:{transaction_id:'order_a'}}
function provider(result, recover=false) {
 const p = new Provider(); p.logger_ = {info(){},error(){}}
 p.client_ = {transfers:{create:async()=>{if(recover)throw new Error('Idempotency conflict'); return result},list:async()=>({data:Array.isArray(result)?result:[result],has_more:false})}}
 return p
}
for (const change of [{amount:901},{currency:'usd'},{destination:'acct_b'},{source_transaction:'ch_b'},{metadata:{transaction_id:'other'}},{id:''}]) {
 test(`created transfer rejects mismatched evidence ${JSON.stringify(change)}`, async()=>{
  await assert.rejects(provider({...transfer,...change}).createPayout(input))
 })
 test(`recovered transfer rejects mismatched evidence ${JSON.stringify(change)}`, async()=>{
  await assert.rejects(provider({...transfer,...change},true).createPayout(input))
 })
}
test('matching transfer accepted',async()=>assert.equal((await provider(transfer).createPayout(input)).data.id,'tr_a'))
test('ambiguous metadata matches are rejected',async()=>await assert.rejects(provider([transfer,{...transfer,id:'tr_b'}],true).createPayout(input)))

function load(path, names, bindings={}) {
 const code=read(base+path).replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm,'').replace(/^export /gm,'')
 return vm.runInNewContext(stripTypeScriptTypes(code+`;({${names}})`,{mode:'strip'}),bindings)
}
const { executePayout, withPayoutDispatchPlan, currentPayoutDispatchPlan } = load('utils/payout-execution.ts','executePayout,withPayoutDispatchPlan,currentPayoutDispatchPlan',{AsyncLocalStorage})
const plan = {amount:9,currency:'eur',account_id:'pa_a',account_reference_id:'acct_a',source_transaction:'ch_a',transaction_id:'order_a'}
test('frozen dispatch rejects account reload drift before transfer request',async()=>{
 let calls=0;const p=provider(transfer);p.client_.transfers.create=async()=>{calls++;return transfer}
 await withPayoutDispatchPlan(plan,async()=>{
   await Promise.resolve()
   await assert.rejects(p.createPayout({...input,account_reference_id:'acct_replaced'}),/changed after durable planning/)
   await p.createPayout(input)
 })
 assert.equal(calls,1);assert.equal(currentPayoutDispatchPlan(),undefined)
})
function executionHarness(fail) {
 let record=null,locked=false,unfinished=null;const calls=[]
 const store={get:async()=>record,assertScopeResolved:async()=>{if(record?.phase==='started')throw Error('unresolved')},
 start:async row=>{calls.push('start');record=structuredClone(row)},
 complete:async(_order,_scope,payoutId,transferId)=>{calls.push('complete');if(fail==='complete')throw Error('crash');record.phase='completed';record.payout_id=payoutId;record.transfer_id=transferId}}
 const locks={withScopeLock:async(_,fn)=>{assert.equal(locked,false);locked=true;try{return await fn({findUnfinished:async()=>unfinished,getOperation:async()=>null})}finally{locked=false}}}
 const callbacks={plan:async()=>{assert.ok(locked);calls.push('plan');return plan},
 transfer:async()=>{assert.ok(locked);assert.equal(record.phase,'started');calls.push('transfer');if(fail==='transfer')throw Error('crash');return {payout_id:'pout_a',transfer_id:'tr_a'}},
 link:async()=>{assert.ok(locked);calls.push('link');if(fail==='link')throw Error('crash')},
 verify:async()=>{calls.push('verify');if(fail==='verify')throw Error('mismatch')}}
 return {calls,store,locks,callbacks,run:()=>executePayout(locks,store,{order_id:'order_a',scope_id:'collection_a'},callbacks),record:()=>record,unfinished:()=>{unfinished={phase:'refund_started'}}}
}
for(const fail of ['transfer','link','complete','verify'])test(`durable started blocks redispatch after ${fail} failure`,async()=>{
 const h=executionHarness(fail);await assert.rejects(h.run());assert.equal(h.record().phase,'started');const before=[...h.calls];await assert.rejects(h.run());assert.deepEqual(h.calls,before)
})
test('completed replay verifies without recalculation or financial dispatch',async()=>{
 const h=executionHarness();await h.run();assert.deepEqual(h.calls,['plan','start','transfer','link','verify','complete']);h.calls.length=0;await h.run();assert.deepEqual(h.calls,['verify'])
})
test('unfinished refund blocks payout before planning',async()=>{
 const h=executionHarness();h.unfinished();await assert.rejects(h.run());assert.deepEqual(h.calls,[])
})
test('zero entitlement records completion with no transfer or link',async()=>{
 const h=executionHarness();h.callbacks.plan=async()=>({...plan,amount:0});await h.run();assert.deepEqual(h.calls,['start','verify','complete'])
})
test('completed payout with changed collection cannot replay',async()=>{
 const h=executionHarness();await h.run();await assert.rejects(executePayout(h.locks,h.store,{order_id:'order_a',scope_id:'other'},h.callbacks))
})
const payoutMoney=load('utils/refund-money.ts','refundMoney,remainingSellerEntitlement')
const amounts=load('workflows/order/steps/settle-order-payout.ts','scalar,minor',{MathBN,...payoutMoney,createStep:()=>null})
for(const currency of ['eur','jpy','kwd'])test(`real Medusa decimal conversion is currency exact ${currency}`,()=>{
 const value=currency==='jpy'?9:currency==='kwd'?9.123:9.12
 assert.equal(amounts.scalar(new BigNumber(value)),value)
 assert.equal(amounts.minor(new BigNumber(value),currency),payoutMoney.refundMoney(currency).toMinor(value))
 assert.throws(()=>amounts.minor(new BigNumber('1.0001'),currency))
})

function adapterHarness(change=()=>{}) {
 const h=executionHarness(), records=[],events=[], financial=[]
 const order={id:'order_a',status:'pending',currency_code:'eur',seller:{id:'seller_a'},items:[{id:'item_a'}],
   split_order_payment:{id:'split_a',payment_collection_id:'collection_a',currency_code:'eur',captured_amount:new BigNumber(10),refunded_amount:new BigNumber(0)},payment_collections:[{id:'collection_a'}]}
 const payment={id:'payment_a',currency_code:'eur',data:{latest_charge:'ch_a'},captures:[{amount:new BigNumber(10)}],refunds:[]}
 const commission=[{item_line_id:'item_a',value:new BigNumber(1)}]
 const account={id:'pa_a',reference_id:'acct_a',status:'active'}
 const splits=[order.split_order_payment]
 change({order,payment,commission,account,splits})
 const query={graph:async({entity})=>({data:entity==='order'?[order]:entity==='order_payout'?records:entity==='payment_collection'?
  [{id:'collection_a',currency_code:'eur',payments:[{id:'payment_a'}]}]:entity==='payment'?[payment]:entity==='split_order_payment'?splits:commission})}
 let payout
 const service={retrievePayoutAccount:async()=>account,createPayout:async input=>{financial.push(input);payout={id:'pout_a',payout_account_id:account.id,amount:input.amount,currency_code:input.currency_code,data:{...transfer,amount:Math.round(input.amount*100)}};return payout},retrievePayout:async()=>payout}
 const bindings={MathBN,...payoutMoney,executePayout,withPayoutDispatchPlan,ContainerRegistrationKeys:{QUERY:'query',PG_CONNECTION:'pg',LINK:'link'},Modules:{ORDER:'order',EVENT_BUS:'events'},PAYOUT_MODULE:'payout',
  PayoutAccountStatus:{ACTIVE:'active'},PayoutWorkflowEvents:{SUCCEEDED:'succeeded',FAILED:'failed'},orderPayoutLink:{entryPoint:'order_payout'},
  resolveSellerPayoutAccountRelation:async()=>({payout_account_id:'pa_a',payout_account:account}),
  createPostgresSettlementStore:()=>h.locks,createPostgresPayoutExecutionStore:()=>h.store,createStep:(_,fn)=>fn,StepResponse:class{constructor(value){this.value=value}}}
 const {settleOrderPayoutStep}=load('workflows/order/steps/settle-order-payout.ts','settleOrderPayoutStep',bindings)
 const deps={query,pg:{},payout:service,link:{create:async rows=>{assert.equal(h.record().phase,'started');records.push({order_id:rows[0].order.order_id,payout_id:rows[0].payout.payout_id})}},events:{emit:async e=>{if(e.name==='succeeded')assert.equal(h.record().phase,'completed');events.push(e)}}}
 return {run:()=>settleOrderPayoutStep({order_id:'order_a'},{container:{resolve:k=>deps[k]}}),financial,events,records,h}
}
test('actual coordinated step creates scalar payout, commits exact link, then succeeds; replay is read-only financially',async()=>{
 const a=adapterHarness();assert.equal((await a.run()).value.phase,'completed');assert.equal(a.financial[0].amount,9);await a.run();assert.equal(a.financial.length,1);assert.equal(a.records.length,1)
})
test('actual zero entitlement completes without transfer, link, or fictitious success event',async()=>{
 const a=adapterHarness(({commission})=>commission[0].value=new BigNumber(10))
 assert.equal((await a.run()).value.phase,'completed');await a.run()
 assert.equal(a.financial.length,0);assert.equal(a.records.length,0);assert.equal(a.events.length,0)
 assert.equal(a.h.record().payout_id,null);assert.equal(a.h.record().transfer_id,null)
})
for(const [label,change]of [
 ['uncaptured',({payment})=>payment.captures=[]],
 ['multiple captures',({payment})=>payment.captures.push({amount:1})],
 ['missing source',({payment})=>payment.data={}],
 ['uncovered commission',({commission})=>commission.length=0],
 ['inactive account',({account})=>account.status='pending'],
 ['mismatched balances',({order})=>order.split_order_payment.captured_amount=9],
])test(`actual payout adapter refuses ${label} before financial dispatch`,async()=>{
 const a=adapterHarness(change);await assert.rejects(a.run());assert.equal(a.financial.length,0);assert.equal(a.events.at(-1).name,'failed')
})
test('multi-seller collection reconciles aggregate captures/refunds but transfers only this seller entitlement',async()=>{
 const a=adapterHarness(({payment,splits})=>{
  payment.captures[0].amount=new BigNumber(30);payment.refunds=[{amount:new BigNumber(5)}]
  splits.push({id:'split_b',payment_collection_id:'collection_a',currency_code:'eur',captured_amount:new BigNumber(20),refunded_amount:new BigNumber(5)})
 })
 await a.run();assert.equal(a.financial.length,1);assert.equal(a.financial[0].amount,9)
})
for(const defect of ['missing','duplicate','wrong-currency','over-refunded'])test(`aggregate split ${defect} cannot authorize payout`,async()=>{
 const a=adapterHarness(({splits})=>{
  if(defect==='missing')splits.length=0
  if(defect==='duplicate')splits.push({...splits[0]})
  if(defect==='wrong-currency')splits[0].currency_code='usd'
  if(defect==='over-refunded')splits[0].refunded_amount=new BigNumber(11)
 })
 await assert.rejects(a.run());assert.equal(a.financial.length,0)
})
test('queued payout snapshots caller identity and effect functions before taking scope lock',async()=>{
 const h=executionHarness(),input={order_id:'order_a',scope_id:'collection_a'}
 const original=h.locks.withScopeLock;let resume
 h.locks.withScopeLock=(scope,fn)=>new Promise((resolve,reject)=>{resume=()=>original(scope,fn).then(resolve,reject)})
 const running=executePayout(h.locks,h.store,input,h.callbacks)
 input.order_id='changed_order';input.scope_id='changed_scope';h.callbacks.plan=async()=>{throw Error('changed callback')}
 await resume();await running
 assert.equal(h.record().order_id,'order_a');assert.equal(h.record().scope_id,'collection_a')
})

test('actual refund wrapper checks unresolved payouts before existing settlement dispatch',async()=>{
 let locked=false,dispatch=0,checks=0
 const bindings={ContainerRegistrationKeys:{QUERY:'query',PG_CONNECTION:'pg'},OrderStatus:{CANCELED:'canceled'},MathBN,
  createStep:(_,fn)=>fn,StepResponse:class{},snapshotOrderRefundRequest:input=>({request:input,operation_id:'refund_a',fingerprint:'f'}),
  orderRefundScope:()=> 'collection_a',createPostgresSettlementStore:()=>({withScopeLock:async(_,fn)=>{locked=true;try{return await fn({})}finally{locked=false}}}),
  createPostgresPayoutExecutionStore:()=>({assertScopeResolved:async()=>{assert.ok(locked);checks++;throw Error('unresolved payout')},get:async()=>null}),
  executeSettlement:async(store,input)=>store.withScopeLock(input.scope_id,async()=>{dispatch++})}
 const {settleOrderRefundStep}=load('workflows/order/steps/settle-order-refund.ts','settleOrderRefundStep',bindings)
 for(let retry=0;retry<2;retry++)await assert.rejects(settleOrderRefundStep({kind:'return',order_id:'order_a',scope_order:{id:'order_a'}},{container:{resolve:()=>({})}}))
 assert.equal(checks,2);assert.equal(dispatch,0)
})
test('migration emits permanent append-only ledger and refuses rollback',async()=>{
 const statements=[]
 const {Migration20261002170000}=load('modules/payout/migrations/Migration20261002170000.ts','Migration20261002170000',{Migration:class{addSql(sql){statements.push(sql)}}})
 const migration=new Migration20261002170000();await migration.up();await assert.rejects(migration.down())
 assert.ok(statements.some(sql=>sql.includes('order_id text PRIMARY KEY')))
 assert.ok(statements.some(sql=>sql.includes('NEW.plan IS DISTINCT FROM OLD.plan')))
 assert.ok(statements.some(sql=>sql.includes("TG_OP = 'DELETE'")))
 assert.ok(statements.some(sql=>sql.includes('payout_execution_transfer_receipt')))
})
