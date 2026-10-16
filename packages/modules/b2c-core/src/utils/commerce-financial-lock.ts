import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { assertCommerceFinancialLock, commerceFinancialLockQuery, withCommerceCartLock } from './commerce-cart-lock'

const fail = (): never => { throw new MedusaError(MedusaError.Types.CONFLICT, 'Commerce financial identity or completed cancellation settlement unavailable') }
const valid = (id: unknown): id is string => typeof id === 'string' && !!id && id.length <= 255 && id.trim() === id && !/[\u0000-\u001f\u007f]/.test(id)
// Native link table names verified against the installed, migrated sandbox schema.
const orderSQL = 'SELECT s.cart_id,s.payment_collection_id FROM marketplace_order_set_order_order l JOIN order_set s ON s.id=l.order_set_id JOIN cart_payment_collection c ON c.cart_id=s.cart_id AND c.payment_collection_id=s.payment_collection_id WHERE l.order_id=? AND l.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL'
function identity(result: any): { cart_id: string; payment_collection_id: string } {
  if (!Array.isArray(result?.rows) || result.rows.length !== 1 || !valid(result.rows[0].cart_id) || !valid(result.rows[0].payment_collection_id)) return fail()
  return result.rows[0]
}
export async function assertCommerceOrderLock(orderId: string): Promise<void> {
  assertCommerceFinancialLock(); if (!valid(orderId)) fail()
  const row = identity(await commerceFinancialLockQuery(orderSQL, [orderId]))
  await commerceFinancialLockQuery('SELECT 1 AS bound FROM cart_payment_collection WHERE cart_id=? AND payment_collection_id=? AND deleted_at IS NULL', [row.cart_id, row.payment_collection_id], row.cart_id)
  assertCommerceFinancialLock()
}
export async function assertCommerceOrderCancellation(orderId: string): Promise<void> {
  await assertCommerceOrderLock(orderId)
  const row = identity(await commerceFinancialLockQuery(orderSQL, [orderId]))
  // A historical completed cancellation cannot authorize effects past a newer unfinished settlement.
  const saved = await commerceFinancialLockQuery("SELECT operation_id,order_id,scope_id,phase FROM refund_settlement WHERE operation_id=? AND order_id=? AND scope_id=? AND NOT EXISTS (SELECT 1 FROM refund_settlement other WHERE other.scope_id=refund_settlement.scope_id AND other.operation_id<>refund_settlement.operation_id AND other.phase<>'completed') AND NOT EXISTS (SELECT 1 FROM commerce_refund_dispatch dispatch WHERE dispatch.scope_id=refund_settlement.scope_id AND dispatch.state='started')", [`cancel:${orderId}`, orderId, row.payment_collection_id], row.cart_id)
  assertCommerceFinancialLock()
  if (!Array.isArray(saved?.rows) || saved.rows.length !== 1 || saved.rows[0]?.operation_id !== `cancel:${orderId}` || saved.rows[0].order_id !== orderId || saved.rows[0].scope_id !== row.payment_collection_id || saved.rows[0].phase !== 'completed') fail()
}
export async function assertCommerceSessionLock(sessionId: string): Promise<void> {
  assertCommerceFinancialLock(); if (!valid(sessionId)) fail()
  const result = await commerceFinancialLockQuery('SELECT s.id,c.cart_id,s.payment_collection_id FROM payment_session s JOIN cart_payment_collection c ON c.payment_collection_id=s.payment_collection_id WHERE s.id=? AND s.deleted_at IS NULL AND c.deleted_at IS NULL', [sessionId])
  if (result?.rows?.length !== 1 || result.rows[0].id !== sessionId || !valid(result.rows[0].cart_id) || !valid(result.rows[0].payment_collection_id)) fail()
  await commerceFinancialLockQuery('SELECT 1 AS bound FROM cart_payment_collection WHERE cart_id=? AND payment_collection_id=? AND deleted_at IS NULL', [result.rows[0].cart_id, result.rows[0].payment_collection_id], result.rows[0].cart_id)
  assertCommerceFinancialLock()
}
/** Locate only the lock key before acquisition; ALL financial snapshots are read again under it.
 * Missing/ambiguous native links fail closed (including standalone non-marketplace orders).
 */
export async function withCommerceOrderLock<T>(container: any, orderId: string, work: () => Promise<T>): Promise<T> {
  if (!valid(orderId)) fail()
  const row = identity(await container.resolve(ContainerRegistrationKeys.PG_CONNECTION).raw(orderSQL, [orderId]))
  return withCommerceCartLock(container, row.cart_id, async () => {
    await assertCommerceOrderLock(orderId)
    const value = await work()
    assertCommerceFinancialLock()
    return value
  })
}
