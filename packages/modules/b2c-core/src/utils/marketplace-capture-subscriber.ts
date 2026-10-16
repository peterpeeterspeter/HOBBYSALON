import { createHash } from 'node:crypto'
import { ContainerRegistrationKeys, MathBN, MedusaError, Modules } from '@medusajs/framework/utils'
import { assertCommerceCartLock, commerceFinancialLockQuery, withCommerceCartLock } from './commerce-cart-lock'
import { createMarketplaceCaptureAckConsumer, MARKETPLACE_CAPTURE_ACK_SUBSCRIBER } from './marketplace-capture-ack'
import { marketplaceGraph, marketplaceSnapshotKey } from './marketplace-capture'

const invalid = (): never => { throw new MedusaError(MedusaError.Types.CONFLICT, 'Marketplace capture event inconsistent or pending; reconciliation/retry required') }
const identity = (v: any): string => {
  if (typeof v !== 'string' || !v || v.length > 255 || v.trim() !== v || /[\u0000-\u001f\u007f]/.test(v)) invalid()
  return v
}
const number = (v: any) => {
  if (v === null || v === undefined) invalid()
  try { const n = MathBN.convert(v); if (!Number.isFinite(n.toNumber()) || MathBN.lt(n, 0)) invalid(); return n }
  catch { return invalid() }
}
const equal = (a: any, b: any) => MathBN.eq(number(a), number(b))

/** Financially read-only consumer, never a second capture/accounting writer.
 * Ready tagged events insert/read back only the durable ACK; untagged native
 * EmitEvents may arrive before explicit outbox completion. The SAME fail-fast
 * session lock either reuses the active capability or throws for queue retry;
 * it never waits for an emitter holding the lock. Pending untagged receipts are
 * left to the existing durable recovery job, not an unsafe snapshot replay.
 */
export async function acknowledgeMarketplaceCapture(container: any, event: any): Promise<void> {
  const paymentId = identity(event?.data?.id)
  const root = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const found = (await root.raw('SELECT cart_id FROM marketplace_capture_tail WHERE payment_id = ?', [paymentId])).rows
  // Nonmarketplace captures deliberately fail closed: no unconditional legacy
  // full-authorized snapshot, no status writes, no provider effects.
  if (!Array.isArray(found) || found.length !== 1) invalid()
  const cartId = identity(found[0].cart_id)
  await withCommerceCartLock(container, cartId, async () => {
    const metadata = event.metadata ?? {}
    const tagged = metadata.marketplace_capture_event_id !== undefined || metadata.marketplace_capture_id !== undefined
    if (tagged) await consumeTaggedCaptureUnderLock(container, cartId, event)
    else await validateMarketplaceCaptureUnderLock(container, event)
  })
}

/** Private business validation; never calls the public entrypoint/root pool.
 * Read through the live owner, then bind the caller container to that cart.
 * The static ACK factory below captures this function, not caller input.
 */
async function validateMarketplaceCaptureUnderLock(container: any, event: any): Promise<void> {
    const paymentId = identity(event?.data?.id)
    const rows = (await commerceFinancialLockQuery('SELECT * FROM marketplace_capture_tail WHERE payment_id = ?', [paymentId])).rows
    if (!Array.isArray(rows) || rows.length !== 1) invalid()
    const row = rows[0], s = row.snapshot
    const cartId = identity(row.cart_id)
    assertCommerceCartLock(container, cartId)
    if (!s || s.version !== 1 || row.cart_id !== cartId || row.payment_id !== paymentId ||
        s.cart_id !== cartId || s.payment_id !== paymentId || !Array.isArray(s.allocations) || !s.allocations.length ||
        row.event_id !== `marketplace-captured-${createHash('sha256').update(marketplaceSnapshotKey(s)).digest('hex')}`) invalid()
    for (const key of ['order_set_id', 'collection_id', 'session_id', 'intent_id', 'provider_id', 'currency_code']) identity(s[key])
    if (!MathBN.gt(number(s.amount), 0) || s.provider_id !== 'pp_card_stripe-connect') invalid()
    const metadata = event.metadata ?? {}
    const tagged = metadata.marketplace_capture_event_id !== undefined || metadata.marketplace_capture_id !== undefined
    if (tagged && (metadata.marketplace_capture_event_id !== row.event_id ||
        metadata.marketplace_capture_id !== row.capture_id || !row.capture_id)) invalid()
    const service = container.resolve(Modules.PAYMENT)
    const payment = await service.retrievePayment(paymentId, { relations: ['captures', 'refunds'] })
    assertCommerceCartLock(container, cartId)
    if (payment.id !== paymentId || payment.payment_collection_id !== s.collection_id ||
        payment.payment_session_id !== s.session_id || payment.provider_id !== s.provider_id ||
        payment.data?.id !== s.intent_id || payment.currency_code !== s.currency_code || !equal(payment.amount, s.amount)) invalid()
    if (!row.completed_at || !row.accounting_at || !row.event_enqueued_at) {
      if (tagged) invalid()
      // Do not project pre-tail native captures onto possibly newer split state.
      return
    }
    if (!payment.captured_at || !Array.isArray(payment.captures) || payment.captures.length !== 1 ||
        payment.captures[0].id !== identity(row.capture_id) || payment.captures[0].payment_id !== paymentId ||
        !equal(payment.captures[0].amount, s.amount) || !Array.isArray(payment.refunds)) invalid()
    const sets = await marketplaceGraph(container, 'order_set', ['id', 'cart_id', 'payment_collection_id',
      'orders.id', 'orders.currency_code', 'orders.split_order_payment.*'], { id: s.order_set_id })
    assertCommerceCartLock(container, cartId)
    const carts = await marketplaceGraph(container, 'cart', ['id', 'completed_at', 'payment_collection.id'], { id: cartId })
    assertCommerceCartLock(container, cartId)
    if (sets.length !== 1 || sets[0].id !== s.order_set_id || sets[0].cart_id !== cartId ||
        sets[0].payment_collection_id !== s.collection_id || !Array.isArray(sets[0].orders) ||
        sets[0].orders.length !== s.allocations.length || carts.length !== 1 || carts[0].id !== cartId ||
        !carts[0].completed_at || carts[0].payment_collection?.id !== s.collection_id) invalid()
    const orders = new Set<string>(), splits = new Set<string>(), refunds = new Set<string>()
    let authorized = MathBN.convert(0), refunded = MathBN.convert(0), nativeRefunded = MathBN.convert(0)
    for (const a of s.allocations) {
      identity(a.order_id); identity(a.split_id)
      if (orders.has(a.order_id) || splits.has(a.split_id) || a.currency_code !== s.currency_code ||
          !Number.isSafeInteger(a.version) || a.version < 1) invalid()
      orders.add(a.order_id); splits.add(a.split_id)
      const matched = sets[0].orders.filter((o: any) => o.id === a.order_id)
      if (matched.length !== 1) invalid()
      const order = matched[0], split = order.split_order_payment
      if (!split || split.id !== a.split_id || split.payment_collection_id !== s.collection_id ||
          split.currency_code !== s.currency_code || order.currency_code !== s.currency_code ||
          !equal(split.authorized_amount, a.amount) || !equal(split.captured_amount, a.amount) ||
          MathBN.gt(number(split.refunded_amount), number(split.captured_amount))) invalid()
      // Status is deliberately never rewritten (including refund/cancellation).
      authorized = MathBN.add(authorized, number(a.amount))
      refunded = MathBN.add(refunded, number(split.refunded_amount))
      const transactions = await container.resolve(Modules.ORDER).listOrderTransactions({
        order_id: a.order_id, reference: 'capture', reference_id: row.capture_id
      }, { take: 2, withDeleted: true })
      assertCommerceCartLock(container, cartId)
      if (!Array.isArray(transactions) || transactions.length !== 1) invalid()
      const t = transactions[0]
      if (!t.id || t.deleted_at || t.order_id !== a.order_id || t.reference !== 'capture' ||
          t.reference_id !== row.capture_id || t.version !== a.version || t.currency_code !== a.currency_code || !equal(t.amount, a.amount)) invalid()
    }
    for (const r of payment.refunds) {
      identity(r.id)
      if (refunds.has(r.id) || r.payment_id !== paymentId) invalid()
      refunds.add(r.id); nativeRefunded = MathBN.add(nativeRefunded, number(r.amount))
    }
    const collection = await service.retrievePaymentCollection(s.collection_id)
    if (!equal(authorized, s.amount) || !equal(refunded, nativeRefunded) || MathBN.gt(nativeRefunded, authorized) ||
        collection.id !== s.collection_id || collection.currency_code !== s.currency_code ||
        !equal(collection.amount, authorized) || !equal(collection.captured_amount, authorized) ||
        !equal(collection.refunded_amount, nativeRefunded)) invalid()
    assertCommerceCartLock(container, cartId)
}

// Trusted module startup wiring only. No exported validator/factory/options and
// no event/container-provided callback. Kernel replays always run the actual
// current native ledger checks above before INSERT and mandatory readback.
const consumeTaggedCaptureUnderLock = createMarketplaceCaptureAckConsumer({
  subscriberId: MARKETPLACE_CAPTURE_ACK_SUBSCRIBER,
  validateUnderLock: validateMarketplaceCaptureUnderLock
})