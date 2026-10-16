import { MathBN, MedusaError } from "@medusajs/framework/utils"
import { assertExpectedCartPayment, ExpectedCartPayment } from "./expected-cart-payment"
import { completeCartFields } from "../workflows/cart/utils/complete-cart-fields"

// Native totals depend on prices, tax lines, adjustments and shipping methods.
// A scalar total with a narrow item projection silently computes as zero.
export const completedCartFields = completeCartFields
export const completedOrderSetFields = [
  "id", "cart_id", "payment_collection_id", "orders.id", "orders.currency_code",
  "orders.items.*", "orders.summary.*",
  "orders.payment_collections.id", "orders.split_order_payment.id",
  "orders.split_order_payment.payment_collection_id", "orders.split_order_payment.currency_code",
  "orders.split_order_payment.authorized_amount",
]

function invalid(): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, "Marketplace checkout is incomplete or inconsistent; reconciliation required")
}
function amount(value: any) {
  if (value === undefined || value === null) invalid()
  try {
    const n = MathBN.convert(value)
    if (!Number.isFinite(n.toNumber()) || MathBN.lt(n, 0)) invalid()
    return n
  } catch { return invalid() }
}
function quantities(items: any[]) {
  if (!Array.isArray(items) || !items.length) invalid()
  const result = new Map<string, ReturnType<typeof MathBN.convert>>()
  for (const item of items) {
    if (!item?.variant_id || !MathBN.gt(amount(item.quantity), 0)) invalid()
    result.set(item.variant_id, MathBN.add(result.get(item.variant_id) ?? 0, amount(item.quantity)))
  }
  return result
}

// Existence of an order-set is not completion. Refuse partial state without
// replaying authorization or trying financially destructive compensation.
export function assertCompletedCartOrderSet(cart: any, sets: any[], cartId: string, expected?: ExpectedCartPayment): string {
  if (!cart || cart.id !== cartId || !cart.completed_at || !cart.currency_code ||
      !cart.payment_collection?.id || cart.payment_collection.currency_code !== cart.currency_code ||
      !Array.isArray(sets) || sets.length !== 1) invalid()
  const set = sets[0], collection = cart.payment_collection.id
  if (!set?.id || set.cart_id !== cartId || set.payment_collection_id !== collection ||
      !Array.isArray(set.orders) || !set.orders.length) invalid()
  const ids = new Set<string>(), orderItems: any[] = []
  let total = MathBN.convert(0)
  for (const order of set.orders) {
    if (!order?.id || ids.has(order.id) || order.currency_code !== cart.currency_code) invalid()
    ids.add(order.id)
    const split = order.split_order_payment, links = order.payment_collections
    if (!Array.isArray(links) || links.length !== 1 || links[0]?.id !== collection ||
        !split?.id || Array.isArray(split) || split.payment_collection_id !== collection ||
        split.currency_code !== cart.currency_code) invalid()
    const accounting = amount(order.summary?.accounting_total)
    if (!MathBN.eq(accounting, amount(split.authorized_amount))) invalid()
    total = MathBN.add(total, accounting)
    quantities(order.items)
    orderItems.push(...order.items)
  }
  if (!MathBN.eq(total, amount(cart.total))) invalid()
  const wanted = quantities(cart.items), actual = quantities(orderItems)
  if (wanted.size !== actual.size) invalid()
  for (const [variant, quantity] of wanted) {
    if (!actual.has(variant) || !MathBN.eq(quantity, actual.get(variant)!)) invalid()
  }
  if (expected) {
    const sessions = cart.payment_collection.payment_sessions
    if (!Array.isArray(sessions)) invalid()
    assertExpectedCartPayment(cart, sessions.filter((s: any) => s.id === expected.session_id), expected, cartId)
  }
  return set.id
}
