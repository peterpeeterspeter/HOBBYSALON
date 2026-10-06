import { ContainerRegistrationKeys, MathBN, MedusaError, Modules, PaymentEvents } from '@medusajs/framework/utils'
import { createHash } from 'node:crypto'
import { splitAndCompleteCartWorkflow } from '../workflows/cart/workflows/split-and-complete-cart'
import { assertCommerceCartLock, commerceCartLockQuery } from './commerce-cart-lock'
import { assertCompletedCartOrderSet, completedCartFields, completedOrderSetFields } from './completed-cart-order-set'
import type { ExpectedCartPayment } from './expected-cart-payment'
import { SPLIT_ORDER_PAYMENT_MODULE } from '../modules/split-order-payment'

const invalid = (message: string): never => { throw new MedusaError(MedusaError.Types.INVALID_DATA, message) }
const id = (value: any): string => {
  if (typeof value !== 'string' || !value || value.length > 255 || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) invalid('Invalid marketplace operation identity')
  return value
}
const amount = (value: any): string => {
  if (value === null || value === undefined) invalid('Missing marketplace amount')
  const n = MathBN.convert(value)
  if (!Number.isFinite(n.toNumber()) || MathBN.lt(n, 0)) invalid('Invalid marketplace amount')
  return n.toString()
}
// Recursive semantic comparison includes every field, not a whitelist that can
// silently accept a changed immutable operation. PostgreSQL jsonb reorders keys.
export function marketplaceSnapshotKey(value: any): string {
  if (Array.isArray(value)) return `[${value.map(marketplaceSnapshotKey).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${marketplaceSnapshotKey(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}
export async function marketplaceGraph(container: any, entity: string, fields: string[], filters: any) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({ entity, fields, filters })
  if (!Array.isArray(data)) invalid('Marketplace graph unavailable')
  return data
}
export async function readCompletedMarketplaceCart(container: any, cartId: string, expected?: ExpectedCartPayment) {
  assertCommerceCartLock(container, cartId)
  const carts = await marketplaceGraph(container, 'cart', completedCartFields, { id: cartId })
  const sets = await marketplaceGraph(container, 'order_set', [...completedOrderSetFields,
    'orders.items.tax_lines.*', 'orders.items.adjustments.*', 'orders.shipping_methods.*',
    'orders.shipping_methods.tax_lines.*', 'orders.shipping_methods.adjustments.*',
    'orders.version', 'orders.split_order_payment.status', 'orders.split_order_payment.captured_amount', 'orders.split_order_payment.refunded_amount'], { cart_id: cartId })
  if (carts.length !== 1) invalid('Marketplace cart unavailable')
  assertCompletedCartOrderSet(carts[0], sets, cartId, expected)
  return { cart: carts[0], orderSet: sets[0] }
}
export async function completeMarketplaceCartUnderLock(container: any, cartId: string, expected?: ExpectedCartPayment) {
  assertCommerceCartLock(container, cartId)
  const carts = await marketplaceGraph(container, 'cart', ['id', 'completed_at'], { id: cartId })
  const sets = await marketplaceGraph(container, 'order_set', ['id'], { cart_id: cartId })
  assertCommerceCartLock(container, cartId)
  if (carts.length !== 1) invalid('Marketplace cart unavailable')
  // Partial completion never re-enters authorization compensation. A durable
  // completed cart also never depends on a cached workflow DONE result.
  if (carts[0].completed_at || sets.length) return readCompletedMarketplaceCart(container, cartId, expected)
  const result = await splitAndCompleteCartWorkflow(container).run({ input: { id: cartId, expected_payment: expected }, context: { transactionId: cartId } })
  assertCommerceCartLock(container, cartId)
  if (result.errors?.length || !result.result?.id || result.transaction.getState() !== 'done') invalid('Marketplace completion did not finish')
  return readCompletedMarketplaceCart(container, cartId, expected)
}

async function operation(container: any, cartId: string, expected?: ExpectedCartPayment) {
  const { cart, orderSet } = await readCompletedMarketplaceCart(container, cartId, expected)
  const collectionId = id(cart.payment_collection.id)
  const payments = await marketplaceGraph(container, 'payment', ['id', 'payment_session_id', 'payment_collection_id', 'amount', 'currency_code', 'provider_id', 'captured_at', 'canceled_at', 'data'], { payment_collection_id: collectionId })
  if (payments.length !== 1 || payments[0].canceled_at) invalid('Marketplace payment selection is ambiguous')
  const payment = payments[0]
  const sessions = cart.payment_collection.payment_sessions?.filter((s: any) => s.id === payment.payment_session_id)
  if (!sessions || sessions.length !== 1) invalid('Marketplace payment session is ambiguous')
  const session = sessions[0]
  const total = amount(cart.total)
  if (!MathBN.gt(total, 0) || payment.payment_collection_id !== collectionId ||
      payment.currency_code !== cart.currency_code || amount(payment.amount) !== total ||
      session.payment_collection_id !== collectionId || session.currency_code !== cart.currency_code ||
      amount(session.amount) !== total || payment.provider_id !== session.provider_id ||
      session.provider_id !== 'pp_card_stripe-connect' || id(session.data?.id) !== id(payment.data?.id) ||
      (expected && payment.payment_session_id !== expected.session_id)) invalid('Marketplace payment binding is inconsistent')
  const splitIds = new Set<string>()
  const allocations = orderSet.orders.map((order: any) => {
    const split = order.split_order_payment
    if (splitIds.has(id(split.id)) || !Number.isSafeInteger(order.version) || order.version < 1 ||
        amount(split.refunded_amount) !== '0' || !['pending', 'captured'].includes(split.status) ||
        !['0', amount(split.authorized_amount)].includes(amount(split.captured_amount))) invalid('Marketplace split accounting is inconsistent')
    splitIds.add(split.id)
    return { order_id: id(order.id), version: order.version, split_id: split.id,
      amount: amount(split.authorized_amount), currency_code: order.currency_code }
  }).sort((a: any, b: any) => a.order_id.localeCompare(b.order_id))
  const taxes = (values: any[] = []) => values.map(t => ({ id: id(t.id), rate: amount(t.rate),
    code: t.code ?? null, provider_id: t.provider_id ?? null })).sort((a, b) => a.id.localeCompare(b.id))
  const adjustments = (values: any[] = []) => values.map(a => ({ id: id(a.id), amount: amount(a.amount),
    code: a.code ?? null, promotion_id: a.promotion_id ?? null })).sort((a, b) => a.id.localeCompare(b.id))
  const items = (values: any[]) => values.map(item => ({ id: id(item.id), variant_id: id(item.variant_id),
    quantity: amount(item.quantity), unit_price: amount(item.unit_price), is_tax_inclusive: item.is_tax_inclusive ?? false,
    tax_lines: taxes(item.tax_lines), adjustments: adjustments(item.adjustments) })).sort((a, b) => a.id.localeCompare(b.id))
  const shipping = (values: any[] = []) => values.map(s => ({ id: id(s.id), amount: amount(s.amount),
    shipping_option_id: s.shipping_option_id ?? null, is_tax_inclusive: s.is_tax_inclusive ?? false,
    tax_lines: taxes(s.tax_lines), adjustments: adjustments(s.adjustments) })).sort((a, b) => a.id.localeCompare(b.id))
  const snapshot = { version: 1, cart_id: id(cartId), order_set_id: id(orderSet.id), collection_id: collectionId,
    payment_id: id(payment.id), session_id: id(session.id), intent_id: id(session.data.id), provider_id: session.provider_id,
    currency_code: cart.currency_code, amount: total, allocations,
    cart_items: items(cart.items), cart_shipping: shipping(cart.shipping_methods),
    order_items: orderSet.orders.map((o: any) => ({ order_id: o.id, items: items(o.items), shipping: shipping(o.shipping_methods) })).sort((a: any, b: any) => a.order_id.localeCompare(b.order_id)) }
  return { payment, snapshot }
}

/** No compensation or native single-order projection. The durable operation is
 * written BEFORE capture. Payment recovery override registration is mandatory.
 * captured-only is safe for storefront repair/workers: never dispatch uncaptured
 * payments, never authorize/refund, even if a pending capture row exists.
 */
export async function captureMarketplacePaymentUnderLock(container: any, cartId: string, expected?: ExpectedCartPayment, mode: 'capture' | 'captured-only' = 'capture') {
  const { payment: selected, snapshot } = await operation(container, cartId, expected)
  const query = (sql: string, values: any[] = []) => commerceCartLockQuery(container, cartId, sql, values)
  if (mode === 'captured-only' && !selected.captured_at) return null
  const serialized = marketplaceSnapshotKey(snapshot)
  const eventId = `marketplace-captured-${createHash('sha256').update(serialized).digest('hex')}`
  await query(`INSERT INTO marketplace_capture_tail (payment_id, cart_id, snapshot, event_id) VALUES (?, ?, ?::jsonb, ?) ON CONFLICT (payment_id) DO NOTHING`, [selected.id, cartId, serialized, eventId])
  const rows = (await query('SELECT * FROM marketplace_capture_tail WHERE payment_id = ?', [selected.id])).rows
  const saved = rows?.[0]
  if (rows?.length !== 1 || saved.cart_id !== cartId || saved.event_id !== eventId ||
      marketplaceSnapshotKey(saved.snapshot) !== serialized) invalid('Marketplace capture tail snapshot changed')
  assertCommerceCartLock(container, cartId)
  const service = container.resolve(Modules.PAYMENT)
  const before = await service.retrievePayment(selected.id, { relations: ['captures', 'refunds'] })
  if (before.id !== snapshot.payment_id || before.canceled_at ||
      before.payment_collection_id !== snapshot.collection_id || before.payment_session_id !== snapshot.session_id ||
      before.provider_id !== snapshot.provider_id || before.data?.id !== snapshot.intent_id ||
      before.currency_code !== snapshot.currency_code || amount(before.amount) !== snapshot.amount ||
      Boolean(before.captured_at) !== Boolean(selected.captured_at) ||
      !Array.isArray(before.refunds) || before.refunds.length || !Array.isArray(before.captures) ||
      before.captures.length > 1 || (before.captured_at && before.captures.length !== 1) ||
      before.captures.some((c: any) => !id(c.id) || c.payment_id !== before.id || amount(c.amount) !== snapshot.amount) ||
      (saved.capture_id && before.captures[0]?.id !== saved.capture_id)) invalid('Marketplace pre-capture ledger is inconsistent')
  // Use the native API directly, not a cached workflow result. Its reviewed
  // override returns a fresh receipt and skips the provider on captured_at.
  await service.capturePayment({ payment_id: selected.id, amount: snapshot.amount })
  assertCommerceCartLock(container, cartId)
  const payment = await service.retrievePayment(selected.id, { relations: ['captures', 'refunds'] })
  if (payment.id !== snapshot.payment_id || !payment.captured_at || payment.canceled_at ||
      payment.payment_collection_id !== snapshot.collection_id || payment.payment_session_id !== snapshot.session_id ||
      payment.provider_id !== snapshot.provider_id || payment.data?.id !== snapshot.intent_id ||
      payment.currency_code !== snapshot.currency_code || amount(payment.amount) !== snapshot.amount ||
      !Array.isArray(payment.captures) || payment.captures.length !== 1 ||
      !Array.isArray(payment.refunds) || payment.refunds.length ||
      payment.captures[0].payment_id !== payment.id || amount(payment.captures[0].amount) !== snapshot.amount) invalid('Marketplace full capture receipt missing; reconciliation required')
  const captureId = id(payment.captures[0].id)
  if (saved.capture_id && saved.capture_id !== captureId) invalid('Marketplace capture identity changed')
  // Revalidate the entire operation after the provider boundary, before tails.
  const current = await operation(container, cartId, expected)
  if (marketplaceSnapshotKey(current.snapshot) !== serialized) invalid('Marketplace capture operation changed')
  const collection = await service.retrievePaymentCollection(snapshot.collection_id)
  if (collection.id !== snapshot.collection_id || collection.currency_code !== snapshot.currency_code ||
      amount(collection.amount) !== snapshot.amount || amount(collection.captured_amount) !== snapshot.amount ||
      amount(collection.refunded_amount) !== '0' || !collection.completed_at || collection.status !== 'completed') invalid('Marketplace captured collection is inconsistent')
  await query('UPDATE marketplace_capture_tail SET capture_id = COALESCE(capture_id, ?), updated_at = now() WHERE payment_id = ? RETURNING payment_id', [captureId, payment.id])
  const orderService = container.resolve(Modules.ORDER)
  // DB uniqueness is the final guard against nonparticipating writers. Native
  // addOrderTransactions atomically maintains transactions AND order summaries.
  for (const allocation of snapshot.allocations) {
    assertCommerceCartLock(container, cartId)
    const existing = await orderService.listOrderTransactions({ order_id: allocation.order_id, reference: 'capture', reference_id: captureId }, { take: 2, withDeleted: true })
    assertCommerceCartLock(container, cartId)
    if (existing.length > 1 || existing.some((t: any) => !t.id || t.deleted_at || t.order_id !== allocation.order_id ||
        t.reference !== 'capture' || t.reference_id !== captureId || t.version !== allocation.version ||
        amount(t.amount) !== allocation.amount || t.currency_code !== allocation.currency_code)) invalid('Marketplace capture accounting mismatch')
    if (!existing.length) await orderService.addOrderTransactions({ order_id: allocation.order_id, amount: allocation.amount,
      currency_code: allocation.currency_code, reference: 'capture', reference_id: captureId })
    assertCommerceCartLock(container, cartId)
  }
  const splitService = container.resolve(SPLIT_ORDER_PAYMENT_MODULE)
  for (const allocation of snapshot.allocations) {
    assertCommerceCartLock(container, cartId)
    await splitService.updateSplitOrderPayments({ id: allocation.split_id, status: 'captured', captured_amount: allocation.amount })
  }
  await query('UPDATE marketplace_capture_tail SET accounting_at = COALESCE(accounting_at, now()), updated_at = now() WHERE payment_id = ?', [payment.id])
  if (!saved.event_enqueued_at) {
    assertCommerceCartLock(container, cartId)
    // Real RedisEventBus buildEvents preserves data+metadata and event.options.
    // Retained BullMQ ID closes emit/ACK gap. No eventGroupId (immediate enqueue).
    await container.resolve(Modules.EVENT_BUS).emit({ name: PaymentEvents.CAPTURED, data: { id: payment.id },
      metadata: { marketplace_capture_event_id: eventId, marketplace_capture_id: captureId },
      options: { jobId: eventId, removeOnComplete: false, removeOnFail: false, attempts: 10 } })
    await query('UPDATE marketplace_capture_tail SET event_enqueued_at = COALESCE(event_enqueued_at, now()), completed_at = COALESCE(completed_at, now()), updated_at = now() WHERE payment_id = ?', [payment.id])
  } else if (!saved.completed_at) {
    await query('UPDATE marketplace_capture_tail SET completed_at = COALESCE(completed_at, now()), updated_at = now() WHERE payment_id = ?', [payment.id])
  }
  return payment
}
