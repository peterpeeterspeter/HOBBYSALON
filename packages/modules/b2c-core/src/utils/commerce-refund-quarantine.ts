import { AsyncLocalStorage } from 'node:async_hooks'
import { MathBN, MedusaError } from '@medusajs/framework/utils'
import { assertCommerceFinancialLock, commerceFinancialLockQuery } from './commerce-cart-lock'

type Amount = Parameters<typeof MathBN.convert>[0]
export type CommerceRefundIntent = {
  operation_id: string; scope_id: string; payment_id: string; customerRefund: Amount; currency_code: string
  order_id?: string; split_order_payment_id?: string | null; payout_id?: string | null; sellerReversal?: Amount
}
export type CommerceRefundDispatch = {
  refund_id: string; payment_id: string; scope_id: string; provider_id: string
  provider_payment_id: string; amount: Amount; currency_code: string
}
type Snapshot = Readonly<Omit<CommerceRefundDispatch, 'amount'> & { amount: string }>
type Intent = {
  active: boolean; preparing: boolean; plan: Readonly<CommerceRefundIntent>
  preparedRefundId?: string; prepared?: Snapshot
}
// Neither caller metadata nor a returned receipt is a capability. Detached branches
// retain this object, but lose its authority irrevocably when the callback exits.
const intents = new AsyncLocalStorage<Intent>()
type DispatchContext = {
  active: boolean; preparing: boolean; completing: boolean
  prepared?: Snapshot; operation?: string; nativeCompleted?: Snapshot
}
const dispatches = new AsyncLocalStorage<DispatchContext>()

/** Invocation-only receipt. nativeAccounting must enclose the ENTIRE native
 * public refund (reservation, provider, payment and collection accounting),
 * never provider-only work. Its validated DTO registers the prepared identity;
 * no automatic finish, serialized authority, or later-lock recovery exists.
 */
export async function withCommerceRefundDispatchContext<T>(
  work: (nativeAccounting: <R>(nativeWork: () => Promise<R>) => Promise<R>) => Promise<T>
): Promise<T> {
  current()
  if (dispatches.getStore() || typeof work !== 'function') return fail()
  const context: DispatchContext = { active: true, preparing: false, completing: false }
  return dispatches.run(context, async () => {
    const nativeAccounting = async <R>(nativeWork: () => Promise<R>): Promise<R> => {
      current()
      if (!context.active || context.completing || context.nativeCompleted || typeof nativeWork !== 'function') return fail()
      context.completing = true
      try {
        const result = await nativeWork()
        current()
        const expected = context.prepared
        const dto = result as any
        if (!context.active || !expected || dto?.id !== expected.payment_id ||
            !Array.isArray(dto.refunds) || dto.err || dto.error || (Array.isArray(dto.errors) && dto.errors.length)) return fail()
        const refunds = dto.refunds.filter((row: any) => row?.id === expected.refund_id)
        if (refunds.length !== 1 || !equalAmount(refunds[0].raw_amount?.value ?? refunds[0].amount, expected.amount)) return fail()
        context.nativeCompleted = expected
        return result
      } finally { context.completing = false }
    }
    try { const result = await work(nativeAccounting); current(); return result }
    finally { context.active = false }
  })
}
const fail = (): never => { throw new MedusaError(MedusaError.Types.CONFLICT, 'Commerce refund quarantine; reconciliation required') }
function valid(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value)
}
function decimal(value: Amount): string {
  try {
    if (value == null) return fail()
    const n = MathBN.convert(value)
    if (!n.isFinite() || MathBN.lt(n, 0)) return fail()
    return n.toString()
  } catch { return fail() }
}
function equalAmount(a: Amount, b: Amount): boolean {
  try { return MathBN.eq(decimal(a), decimal(b)) } catch { return false }
}
function current(): Intent | undefined {
  assertCommerceFinancialLock()
  if (dispatches.getStore() && !dispatches.getStore()!.active) return fail()
  const own = intents.getStore()
  if (own && !own.active) return fail()
  return own
}
function object(value: any): boolean { return !!value && typeof value === 'object' && !Array.isArray(value) }
function snapshot(value: CommerceRefundDispatch): Snapshot {
  if (!object(value)) return fail()
  const { refund_id, payment_id, scope_id, provider_id, provider_payment_id, currency_code } = value
  if (![refund_id, payment_id, scope_id, provider_id, provider_payment_id].every(valid) || !/^[a-z]{3}$/.test(currency_code)) return fail()
  const amount = decimal(value.amount)
  if (!MathBN.gt(amount, 0)) return fail()
  return Object.freeze({ refund_id, payment_id, scope_id, provider_id, provider_payment_id, amount, currency_code })
}
function rows(result: any): any[] {
  if (!Array.isArray(result?.rows)) return fail()
  return result.rows
}
function one(result: any, write = false): any {
  const found = rows(result)
  if (found.length !== 1 || !object(found[0]) || (write && result.rowCount !== 1)) return fail()
  return found[0]
}
const fields = ['refund_id', 'payment_id', 'scope_id', 'provider_id', 'provider_payment_id', 'currency_code'] as const
function sameNative(a: any, b: Snapshot): boolean {
  return object(a) && fields.every(key => a[key] === b[key]) && equalAmount(a.amount, b.amount)
}
function sameDispatch(row: any, expected: Snapshot, operation: string, state: string): boolean {
  return sameNative(row, expected) && row.operation_id === operation && row.idempotency_key === expected.refund_id && row.state === state
}
function samePlan(value: any, expected: Readonly<CommerceRefundIntent>): boolean {
  if (!object(value) || value.operation_id !== expected.operation_id || value.scope_id !== expected.scope_id ||
      value.payment_id !== expected.payment_id || value.currency_code !== expected.currency_code ||
      !equalAmount(value.customerRefund, expected.customerRefund)) return false
  for (const key of ['order_id', 'split_order_payment_id', 'payout_id'] as const) {
    if (expected[key] !== undefined && value[key] !== expected[key]) return false
  }
  return expected.sellerReversal === undefined || equalAmount(value.sellerReversal, expected.sellerReversal)
}
async function bindScope(scopeId: string): Promise<{ cart_id: string; scope_id: string; currency_code: string }> {
  current()
  if (!valid(scopeId)) return fail()
  const linked = one(await commerceFinancialLockQuery(
    `SELECT c.cart_id,pc.id AS scope_id,pc.currency_code FROM payment_collection pc
     JOIN cart_payment_collection c ON c.payment_collection_id=pc.id
     WHERE pc.id=? AND pc.deleted_at IS NULL AND c.deleted_at IS NULL`, [scopeId]))
  if (!valid(linked.cart_id) || linked.scope_id !== scopeId || !/^[a-z]{3}$/.test(linked.currency_code)) return fail()
  // Subsequent owner-bound statement checks this native cart against the private owner.
  return linked
}
/** Read-only scope binding for a blocked reconciliation candidate; NOT a clear
 * check or closure capability. Proves the native cart matches the private owner. */
export async function assertCommerceRefundScopeOwnership(scopeId: string): Promise<void> {
  const link = await bindScope(scopeId)
  const verified = one(await commerceFinancialLockQuery(
    `SELECT c.cart_id,pc.id AS scope_id,pc.currency_code FROM payment_collection pc
     JOIN cart_payment_collection c ON c.payment_collection_id=pc.id
     WHERE pc.id=? AND pc.deleted_at IS NULL AND c.deleted_at IS NULL`, [scopeId], link.cart_id))
  current()
  if (verified.cart_id !== link.cart_id || verified.scope_id !== link.scope_id ||
      verified.currency_code !== link.currency_code) return fail()
}
async function clearBound(scopeId: string, mode?: string): Promise<{ cart_id: string; scope_id: string; currency_code: string }> {
  const own = current()
  const link = await bindScope(scopeId)
  const unfinished = rows(await commerceFinancialLockQuery(
    `SELECT operation_id,scope_id,phase,plan,
       to_jsonb(refund_settlement)->>'no_effect_receipt_id' AS no_effect_receipt_id
     FROM refund_settlement WHERE scope_id=? AND
       (phase <> 'completed' OR to_jsonb(refund_settlement)->>'no_effect_receipt_id' IS NOT NULL)`,
    [scopeId], link.cart_id))
  current()
  for (const record of unfinished) {
    // No receipt/authority verifier is installed in this candidate. NO-EFFECT
    // and closure markers on 'completed' fail closed, including the own intent.
    if (record.phase === 'refund_no_effect' || record.no_effect_receipt_id != null) return fail()
    if (mode !== 'refund' || !own || !own.active || record.scope_id !== scopeId || record.phase !== 'refund_started' ||
        record.operation_id !== own.plan.operation_id || own.plan.scope_id !== scopeId ||
        !samePlan(record.plan, own.plan) || own.plan.currency_code !== link.currency_code) return fail()
  }
  const started = rows(await commerceFinancialLockQuery(
    `SELECT * FROM commerce_refund_dispatch WHERE scope_id=? AND state = 'started'`, [scopeId], link.cart_id))
  current()
  for (const record of started) {
    const context = dispatches.getStore()
    const expected = context?.active ? context.prepared : own?.prepared
    const operation = context?.active ? context.operation : own?.plan.operation_id
    if (mode !== 'refund' || !expected || !operation ||
        !sameDispatch(record, expected, operation, 'started')) return fail()
  }
  return link
}
export async function assertCommerceRefundQuarantineClear(collectionId: string, mode?: string): Promise<void> {
  await clearBound(collectionId, mode)
  current()
}
export async function withCommerceRefundIntent<T>(value: CommerceRefundIntent, work: () => Promise<T>): Promise<T> {
  current()
  if (intents.getStore() || !object(value) || typeof work !== 'function') return fail()
  if (![value.operation_id, value.scope_id, value.payment_id].every(valid) || !/^[a-z]{3}$/.test(value.currency_code)) return fail()
  const plan: CommerceRefundIntent = {
    operation_id: value.operation_id, scope_id: value.scope_id, payment_id: value.payment_id,
    customerRefund: decimal(value.customerRefund), currency_code: value.currency_code,
  }
  for (const key of ['order_id', 'split_order_payment_id', 'payout_id'] as const) {
    if (value[key] !== undefined) {
      if (value[key] !== null && !valid(value[key])) return fail()
      plan[key] = value[key] as any
    }
  }
  if (value.sellerReversal !== undefined) plan.sellerReversal = decimal(value.sellerReversal)
  const own: Intent = { active: true, preparing: false, plan: Object.freeze(plan) }
  return intents.run(own, async () => {
    try { const result = await work(); current(); return result }
    finally { own.active = false }
  })
}
const nativeFrom = `FROM refund r JOIN payment p ON p.id=r.payment_id
  JOIN payment_collection pc ON pc.id=p.payment_collection_id
  JOIN cart_payment_collection c ON c.payment_collection_id=pc.id`
const nativeLive = `r.deleted_at IS NULL AND p.deleted_at IS NULL AND pc.deleted_at IS NULL AND c.deleted_at IS NULL`
const nativeAmount = `COALESCE(r.raw_amount->>'value',r.amount::text)::numeric`
async function nativeRefund(expected: Snapshot, cartId: string): Promise<void> {
  const native = one(await commerceFinancialLockQuery(
    `SELECT r.id AS refund_id,p.id AS payment_id,pc.id AS scope_id,c.cart_id,
     p.provider_id,p.data->>'id' AS provider_payment_id,${nativeAmount} AS amount,p.currency_code
     ${nativeFrom} WHERE r.id=? AND ${nativeLive}`, [expected.refund_id], cartId))
  current()
  if (!sameNative(native, expected) || native.cart_id !== cartId) return fail()
}
/** Autocommit on the advisory-lock owner: never an SDK/provider call or an ambient transaction. */
export async function prepareCommerceRefundDispatch(value: CommerceRefundDispatch): Promise<void> {
  const own = current()
  const context = dispatches.getStore()
  if ((!own && !context?.active) || (context && (context.preparing || context.prepared))) return fail()
  if (!object(value) || Object.prototype.hasOwnProperty.call(value, 'operation_id')) return fail()
  const expected = snapshot(value)
  if (own && (own.preparing || own.preparedRefundId || own.plan.scope_id !== expected.scope_id ||
      own.plan.payment_id !== expected.payment_id || own.plan.currency_code !== expected.currency_code ||
      !equalAmount(own.plan.customerRefund, expected.amount))) return fail()
  if (own) own.preparing = true
  if (context) context.preparing = true
  try {
    const link = await clearBound(expected.scope_id, own ? 'refund' : undefined)
    if (link.currency_code !== expected.currency_code) return fail()
    await nativeRefund(expected, link.cart_id)
    current()
    const operation = own?.plan.operation_id ?? expected.refund_id
    // The first eight bindings are the explicit requested identity. INSERT SELECT
    // revalidates that identity against the committed native source atomically.
    const result = await commerceFinancialLockQuery(
      `INSERT INTO commerce_refund_dispatch
       (operation_id,refund_id,payment_id,scope_id,provider_id,provider_payment_id,amount,currency_code,idempotency_key,state)
       SELECT wanted.operation_id,r.id,p.id,pc.id,p.provider_id,p.data->>'id',${nativeAmount},p.currency_code,r.id,'started'
       ${nativeFrom}
       CROSS JOIN (SELECT ?::text AS operation_id,?::text AS refund_id,?::text AS payment_id,?::text AS scope_id,
         ?::text AS provider_id,?::text AS provider_payment_id,?::numeric AS amount,?::text AS currency_code) wanted
       WHERE r.id=wanted.refund_id AND p.id=wanted.payment_id AND pc.id=wanted.scope_id
         AND p.provider_id=wanted.provider_id AND p.data->>'id'=wanted.provider_payment_id
         AND ${nativeAmount}=wanted.amount AND p.currency_code=wanted.currency_code
         AND pc.currency_code=wanted.currency_code AND c.cart_id=? AND ${nativeLive}
       ON CONFLICT (refund_id) DO NOTHING RETURNING *`,
      [operation, expected.refund_id, expected.payment_id, expected.scope_id, expected.provider_id,
        expected.provider_payment_id, expected.amount, expected.currency_code, link.cart_id], link.cart_id)
    current()
    if (!sameDispatch(one(result, true), expected, operation, 'started')) return fail()
    // Publish the allowance ONLY after verified committed RETURNING and owner fence.
    if (own) { own.prepared = expected; own.preparedRefundId = expected.refund_id }
    if (context) { context.prepared = expected; context.operation = operation }
  } finally { if (own) own.preparing = false; if (context) context.preparing = false }
}
/** Only the SAME live public-native accounting invocation may complete its row.
 * Protected/provider-only work and later invocations have no completion receipt.
 * Deliberately does not clear settlement quarantine.
 */
export async function finishCommerceRefundDispatch(refundId: string): Promise<void> {
  current()
  const context = dispatches.getStore()
  if (!valid(refundId) || !context?.active || !context.prepared ||
      context.nativeCompleted !== context.prepared || context.prepared.refund_id !== refundId || !context.operation) return fail()
  const saved = one(await commerceFinancialLockQuery(`SELECT * FROM commerce_refund_dispatch WHERE refund_id=?`, [refundId]))
  current()
  const expected = context.prepared
  const operation = context.operation
  if (!['started', 'completed'].includes(saved.state) || !sameDispatch(saved, expected, operation, saved.state)) return fail()
  const link = await bindScope(expected.scope_id)
  if (link.currency_code !== expected.currency_code) return fail()
  await nativeRefund(expected, link.cart_id)
  current()
  if (saved.state === 'completed') return
  const result = await commerceFinancialLockQuery(
    `UPDATE commerce_refund_dispatch SET state = 'completed',updated_at=now()
     WHERE refund_id=? AND scope_id=? AND state='started' AND operation_id=? AND idempotency_key=?
       AND payment_id=? AND provider_id=? AND provider_payment_id=? AND amount=?::numeric AND currency_code=?
     RETURNING *`,
    [refundId, expected.scope_id, operation, refundId, expected.payment_id, expected.provider_id,
      expected.provider_payment_id, expected.amount, expected.currency_code], link.cart_id)
  current()
  if (!sameDispatch(one(result, true), expected, operation, 'completed')) return fail()
}

export async function finishCurrentCommerceRefundDispatch(): Promise<void> {
  current()
  const refundId = dispatches.getStore()?.prepared?.refund_id
  if (!refundId) return fail()
  await finishCommerceRefundDispatch(refundId)
}
