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
    return new vm.SyntheticModule(['ContainerRegistrationKeys'], function () {
      this.setExport('ContainerRegistrationKeys', { PG_CONNECTION: 'pg_connection' })
    })
  })
  return mod
}
const route = await load(new URL('api/admin/platform/commerce-recovery/legacy-payouts/route.ts', root))
await route.evaluate()
const auth = { actor_type: 'user', actor_id: 'user_operator' }
function row(gap_kind = 'linked_payout_without_execution', i = 0) {
  return {
    gap_kind,
    order_id: gap_kind === 'linked_payout_without_execution' ? `order_${i}` : null,
    payout_id: `payout_${i}`,
    transfer_id: 'tr_SECRET',
    amount: '100.00',
    data: { secret: 'provider_SECRET' },
  }
}
async function dispatch(query = {}, rows = [], auth_context = auth) {
  const calls = []
  let resolves = 0
  let status = 200
  let body
  const headers = {}
  const db = { async raw(sql, bindings) {
    calls.push({ sql, bindings })
    assert.match(sql.trim(), /^SELECT/)
    assert.doesNotMatch(sql, /\b(UPDATE|INSERT|DELETE|TRUNCATE|CALL|FOR UPDATE)\b/i)
    if (rows instanceof Error) throw rows
    return { rows }
  } }
  const req = { query, auth_context, body: { repair: true }, scope: { resolve(key) {
    resolves++
    assert.equal(key, 'pg_connection')
    return db
  } } }
  const res = { status(n) { status = n; return this }, json(value) { body = JSON.parse(JSON.stringify(value)); return this }, setHeader(k, v) { headers[k] = v } }
  await route.namespace.GET(req, res)
  return { calls, resolves, status, body, headers }
}

test('legacy payout inspection is GET-only and authenticated', () => {
  assert.deepEqual(Object.keys(route.namespace), ['GET'])
  const source = readFileSync(new URL('api/admin/platform/commerce-recovery/legacy-payouts/route.ts', root), 'utf8')
  assert.doesNotMatch(source, /AUTHENTICATE\s*=\s*false|stripe\.|transfers\.create/)
})

test('missing authentication does not query', async () => {
  const r = await dispatch({}, [], null)
  assert.equal(r.status, 401)
  assert.equal(r.resolves, 0)
})

test('non-admin actors are rejected', async () => {
  const r = await dispatch({}, [], { actor_type: 'api-key', actor_id: 'key' })
  assert.equal(r.status, 403)
  assert.equal(r.resolves, 0)
})

test('lists linked payouts the execution ledger does not cover', async () => {
  const r = await dispatch({}, [row()])
  assert.equal(r.status, 200)
  assert.equal(r.body.read_only, true)
  assert.equal(r.body.money_repair_authorized, false)
  assert.equal(r.body.items[0].action_classification, 'historical_transfer_without_ledger')
  assert.equal(r.body.items[0].gap_kind, 'linked_payout_without_execution')
  assert.equal(r.calls.length, 1)
  assert.match(r.calls[0].sql, /LEFT JOIN payout_execution/)
  assert.doesNotMatch(JSON.stringify(r.body), /SECRET|tr_SECRET|100\.00/)
  assert.match(r.body.limitations, /not proof/i)
  assert.equal(r.headers['Cache-Control'], 'no-store')
})

test('order filter is bound and unlinked payouts are omitted for that filter', async () => {
  const r = await dispatch({ order_id: 'order_9' }, [row()])
  assert.equal(r.status, 200)
  assert.ok(r.calls[0].bindings.includes('order_9'))
  assert.match(r.calls[0].sql, /AND false/)
})

test('database failure stays unavailable', async () => {
  const r = await dispatch({}, new Error('relation payout_execution does not exist'))
  assert.equal(r.status, 503)
  assert.equal(r.body.code, 'legacy_payout_inspection_unavailable')
})
