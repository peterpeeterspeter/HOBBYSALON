import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'

const root = new URL('../../apps/backend/src/', import.meta.url)
const modules = new Map()
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href)
  const mod = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(url, 'utf8')), { identifier: url.href })
  modules.set(url.href, mod)
  await mod.link((name, parent) => {
    if (name.startsWith('.')) return load(new URL(name + '.ts', parent.identifier))
    assert.equal(name, '@medusajs/framework/utils')
    return new vm.SyntheticModule(['ContainerRegistrationKeys'], function () { this.setExport('ContainerRegistrationKeys', { PG_CONNECTION: 'pg_connection' }) })
  })
  return mod
}
const route = await load(new URL('api/admin/platform/commerce-recovery/route.ts', root))
await route.evaluate()
const helper = modules.get(new URL('utils/commerce-recovery-report.ts', root).href).namespace
const auth = { actor_type: 'user', actor_id: 'user_operator' }
const phases = {
  refund_settlement: ['pending', 'refund_started', 'refund_completed', 'reversal_started', 'completed'],
  native_return_execution: ['pending', 'begin_started', 'begun', 'items_started', 'items_done', 'confirm_started', 'confirmed'],
  payout_execution: ['started', 'completed'],
}
function row(type = 'refund_settlement', phase = 'pending', i = 0) {
  return { type, operation_id: type !== 'native_return_execution' ? `op_${i}` : null,
    request_id: type === 'native_return_execution' ? `req_${i}` : null, order_id: 'order_1', phase,
    created_at: '2026-10-02T10:00:00.000Z', updated_at: '2026-10-02T11:00:00.000Z',
    plan: { secret: 'provider_SECRET' }, email: 'private@example.test', fingerprint: 'SECRET', reversal_receipt_id: 'SECRET', notes: 'SECRET' }
}
async function dispatch(query = {}, rows = [], auth_context = auth) {
  const calls = []; let resolves = 0; let status = 200; let body; const headers = {}
  const db = { async raw(sql, bindings) { calls.push({ sql, bindings }); assert.match(sql.trim(), /^SELECT/); assert.doesNotMatch(sql, /\b(UPDATE|INSERT|DELETE|TRUNCATE|CALL|FOR UPDATE)\b/i); if (rows instanceof Error) throw rows; return { rows } } }
  const req = { query, auth_context, body: { repair: true }, scope: { resolve(key) { resolves++; assert.equal(key, 'pg_connection'); return db } } }
  const res = { status(n) { status = n; return this }, json(value) { body = JSON.parse(JSON.stringify(value)); return this }, setHeader(k, v) { headers[k] = v } }
  await route.namespace.GET(req, res)
  return { calls, resolves, status, body, headers }
}
test('read-only GET export and native authentication not disabled', () => {
  assert.deepEqual(Object.keys(route.namespace), ['GET'])
  const source = readFileSync(new URL('api/admin/platform/commerce-recovery/route.ts', root), 'utf8')
  assert.doesNotMatch(source, /AUTHENTICATE\s*=\s*false|allowUnauthenticated/)
})
for (const context of [undefined, {}, { actor_type: 'user' }, { actor_type: 'user', actor_id: '' }]) test(`missing authentication ${JSON.stringify(context)}`, async () => {
  // Explicit undefined must not trigger the fixture's default argument.
  const r = await dispatch({}, [], context ?? null); assert.equal(r.status, 401); assert.equal(r.resolves, 0)
})
for (const actor_type of ['customer', 'seller', 'api-key', 'ADMIN']) test(`reject non-user ${actor_type}`, async () => {
  const r = await dispatch({}, [], { actor_type, actor_id: 'actor' }); assert.equal(r.status, 403); assert.equal(r.resolves, 0)
})
for (const query of [{limit:'0'}, {limit:'51'}, {limit:'1.5'}, {limit:['1']}, {offset:'-1'}, {offset:'10001'}, {offset:'1e2'}, {type:'unknown_ledger'}, {phase:'unknown'}, {type:'native_return_execution',phase:'refund_started'}, {order_id:[]}, {order_id:''}, {order_id:'x'.repeat(256)}, {fields:'plan'}, {sort:'email'}, {repair:'true'}]) test(`reject bad filters ${JSON.stringify(query)}`, async () => {
  const r = await dispatch(query); assert.equal(r.status, 400); assert.equal(r.resolves, 0)
})
test('default and maximum pages are bounded with stable immutable tie breakers', async () => {
  const r = await dispatch({}, Array.from({length:60}, (_,i) => row('refund_settlement','pending',i)))
  assert.equal(r.status,200); assert.equal(r.body.items.length,25); assert.equal(r.body.next_offset,25)
  assert.equal(r.body.limit,25); assert.equal(r.body.offset,0); assert.equal(r.body.read_only,true); assert.equal(r.body.money_repair_authorized,false)
  assert.deepEqual(r.calls[0].bindings,[26,0]); assert.match(r.calls[0].sql,/ORDER BY created_at ASC, type ASC, operation_id ASC NULLS LAST, request_id ASC NULLS LAST/)
  const max = await dispatch({limit:'50',offset:'10000'}, Array.from({length:51},(_,i)=>row('refund_settlement','pending',i)))
  assert.equal(max.body.items.length,50); assert.equal(max.body.next_offset,null); assert.equal(max.body.pagination_bound_reached,true)
  assert.deepEqual(max.calls[0].bindings,[51,10000]); assert.equal(r.headers['Cache-Control'],'no-store')
})
test('empty result is no records, not proof of refund absence', async () => {
  const r = await dispatch(); assert.deepEqual(r.body.items,[]); assert.equal(r.body.next_offset,null)
  assert.match(r.body.limitations,/not.*proof|does not.*prove/i)
})
test('SQL injection is bound, projections never include sensitive columns, output allowlisted', async () => {
  const attack = "order_' OR 1=1 --"
  const r = await dispatch({order_id:attack,type:'refund_settlement',phase:'refund_started'},[row('refund_settlement','refund_started')])
  assert.equal(r.status,200); assert.equal(r.calls.length,1); assert.ok(r.calls[0].bindings.includes(attack)); assert.ok(!r.calls[0].sql.includes(attack))
  assert.ok(r.calls[0].bindings.includes('refund_settlement')); assert.ok(r.calls[0].bindings.includes('refund_started'))
  assert.doesNotMatch(r.calls[0].sql,/\b(plan|fingerprint|email|notes|reversal_receipt_id)\b|SELECT\s+\*/i)
  assert.doesNotMatch(JSON.stringify(r.body),/SECRET|private@example|fingerprint|reversal_receipt_id/)
  assert.deepEqual(Object.keys(r.body.items[0]).sort(),['action_classification','created_at','evidence_required','operation_id','order_id','phase','request_id','type','updated_at'].sort())
})
for (const [type, list] of Object.entries(phases)) for (const phase of list) test(`classification ${type} ${phase}`, async () => {
  const r = await dispatch({type,phase},[row(type,phase)])
  assert.equal(r.status,200)
  const item = r.body.items[0]
  assert.equal(item.action_classification, phase === 'started' || phase.endsWith('_started') ? 'manual_reconciliation_required' : ['completed','confirmed'].includes(phase) ? 'recorded_terminal_verify_evidence' : 'inspect_before_any_resume')
  assert.ok(item.evidence_required.includes(type === 'refund_settlement' ? 'customer_refund_and_accounting_proof' : type === 'payout_execution' ? 'provider_transfer_and_local_payout_proof' : 'native_identity_action_item_proof'))
})
test('unknown persisted phase fails closed without reflection', async () => {
  const r = await dispatch({},[row('refund_settlement','SECRET')]); assert.equal(r.status,503); assert.doesNotMatch(JSON.stringify(r.body),/SECRET/)
})
test('DB error is sanitized', async () => {
  const r = await dispatch({},new Error('SELECT plan password=SECRET postgres://private')); assert.equal(r.status,503)
  assert.deepEqual(r.body,{code:'recovery_inspection_unavailable',message:'Recovery inspection unavailable.'})
})
test('helper also sanitizes storage errors', async () => {
  await assert.rejects(helper.readCommerceRecoveryReport({raw:async()=>{throw new Error('SECRET')}},{}), error=>error.message==='Recovery inspection unavailable.')
})
