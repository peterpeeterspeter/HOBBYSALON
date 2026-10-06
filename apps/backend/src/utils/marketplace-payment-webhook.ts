import { ContainerRegistrationKeys, MathBN, PaymentActions, MedusaError } from "@medusajs/framework/utils"
import { withCommerceCartLock } from "@mercurjs/b2c-core/utils/commerce-cart-lock"
import { completeMarketplaceCartUnderLock, captureMarketplacePaymentUnderLock } from "@mercurjs/b2c-core/utils/marketplace-capture"
import { assertCompletedCartOrderSet, completedCartFields, completedOrderSetFields } from "@mercurjs/b2c-core/utils/completed-cart-order-set"

export const MARKETPLACE_PAYMENT_WEBHOOK = "hobbysalon.marketplace_payment_webhook"

async function graph(container: any, entity: string, fields: string[], filters: any) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({ entity, fields, filters })
  return data
}
function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}
export async function marketplacePaymentContext(container: any, input: any) {
  const id = input.data?.session_id
  if (!id) invalid("Payment webhook has no session binding")
  const sessions = await graph(container, "payment_session", ["id", "payment_collection_id", "provider_id", "amount", "currency_code", "data"], { id })
  if (sessions.length !== 1) invalid("Payment webhook session is unavailable; reconciliation required")
  const session = sessions[0]
  if (session.provider_id !== input.provider_id) invalid("Payment webhook provider/session mismatch")
  if (input.data.amount === undefined || !MathBN.eq(input.data.amount, session.amount)) invalid("Payment webhook amount/session mismatch")
  if (input.data.currency_code !== session.currency_code) invalid("Payment webhook currency/session mismatch")
  if (!input.data.payment_intent_id || session.data?.id !== input.data.payment_intent_id) invalid("Payment webhook intent/session mismatch")
  if (input.data.payment_collection_id && session.payment_collection_id !== input.data.payment_collection_id) invalid("Payment webhook collection changed since acceptance")
  const carts = await graph(container, "cart_payment_collection", ["cart_id"], { payment_collection_id: session.payment_collection_id })
  if (!carts.length) return { session, cart: null, orderSet: null }
  if (carts.length !== 1) invalid("Payment webhook cart binding is ambiguous")
  const cartRows = await graph(container, "cart", completedCartFields, { id: carts[0].cart_id })
  if (cartRows.length !== 1) invalid("Payment webhook cart is unavailable")
  if (input.data.cart_id && cartRows[0].id !== input.data.cart_id) invalid("Payment webhook cart changed since acceptance")
  const sets = await graph(container, "order_set", completedOrderSetFields, { cart_id: cartRows[0].id })
  if (sets.length > 1 || sets.some((s: any) => s.payment_collection_id !== session.payment_collection_id)) invalid("Payment webhook order-set binding is inconsistent")
  if (cartRows[0].completed_at && !sets.length) invalid("Completed marketplace cart has no order set; reconciliation required")
  return { session, cart: cartRows[0], orderSet: sets[0] ?? null }
}

export async function processMarketplacePaymentWebhook(container: any, input: any) {
  if (![PaymentActions.AUTHORIZED, PaymentActions.SUCCESSFUL].includes(input.action)) invalid("Unsupported marketplace payment action")
  const initial = await marketplacePaymentContext(container, input)
  if (!initial.cart) invalid("Marketplace webhook has no marketplace cart")
  await withCommerceCartLock(container, initial.cart.id, async () => {
    const { session, cart, orderSet } = await marketplacePaymentContext(container, input)
    if (!cart || cart.id !== initial.cart.id) invalid("Marketplace cart binding changed")
    if (session.provider_id !== input.provider_id) invalid("Payment webhook provider/session mismatch")
    if (input.data.amount === undefined || !MathBN.eq(input.data.amount, session.amount)) invalid("Payment webhook amount/session mismatch")
    // Never call native processPaymentWorkflow here: its unconditional native
    // complete-cart can refund a valid Mercur order when compensation runs.
    const expected = { session_id: input.data.session_id, collection_id: session.payment_collection_id,
      intent_id: input.data.payment_intent_id, amount: input.data.amount, currency_code: input.data.currency_code }
    if (orderSet) {
      assertCompletedCartOrderSet(cart, [orderSet], cart.id, expected)
    } else {
      await completeMarketplaceCartUnderLock(container, cart.id, expected)
    }
    // Re-read durable state even after a cached workflow result. Refusal here
    // is outside completion compensation and before every capture service call.
    const completed = await marketplacePaymentContext(container, input)
    if (!completed.cart || completed.cart.id !== cart.id) invalid("Marketplace cart binding changed")
    assertCompletedCartOrderSet(completed.cart, completed.orderSet ? [completed.orderSet] : [], cart.id, expected)
    if (input.action === PaymentActions.SUCCESSFUL) {
      await captureMarketplacePaymentUnderLock(container, cart.id, expected)
    }
  })
}
