import { createHmac, timingSafeEqual } from "node:crypto"
import { MathBN, PaymentActions, MedusaError } from "@medusajs/framework/utils"

export interface VerifiedMarketplacePayment {
  version: 2
  cart_id: string
  payment_collection_id: string
  payment_intent_id: string
  provider_id: "pp_card_stripe-connect"
  action: typeof PaymentActions.AUTHORIZED | typeof PaymentActions.SUCCESSFUL
  session_id: string
  amount: string
  currency_code: string
  event_id: string
  accepted_at: number
  mac: string
}
function key(): string {
  const value = process.env.STRIPE_PAYMENT_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET
  if (!value) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Webhook envelope signing key unavailable")
  return value
}
function material(e: Omit<VerifiedMarketplacePayment, "mac">): string {
  return JSON.stringify(["hobbysalon.marketplace-payment-envelope.v2", e.version, e.provider_id, e.action, e.session_id, e.amount, e.currency_code, e.event_id, e.accepted_at, e.cart_id, e.payment_collection_id, e.payment_intent_id])
}
// Domain-separated authentication of a validated ingress decision. The worker
// does not reapply Stripe's delivery-time tolerance to a durably queued event.
export function sealMarketplacePayment(processed: any, rawEvent: any, binding: { cart_id: string; payment_collection_id: string; payment_intent_id: string }): VerifiedMarketplacePayment {
  if (binding.payment_intent_id !== rawEvent.data.object.id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment intent binding mismatch")
  const value: Omit<VerifiedMarketplacePayment, "mac"> = {
    version: 2, ...binding, provider_id: "pp_card_stripe-connect", action: processed.action,
    session_id: processed.data.session_id,
    amount: MathBN.convert(processed.data.amount).toString(),
    currency_code: rawEvent.data.object.currency,
    event_id: rawEvent.id, accepted_at: Date.now(),
  }
  return { ...value, mac: createHmac("sha256", key()).update(material(value)).digest("hex") }
}
export function openMarketplacePayment(value: VerifiedMarketplacePayment) {
  const invalid = () => { throw new MedusaError(MedusaError.Types.INVALID_DATA, "Untrusted marketplace payment envelope") }
  if (!value || value.version !== 2 || value.provider_id !== "pp_card_stripe-connect" ||
      ![value.cart_id, value.payment_collection_id, value.payment_intent_id].every(v => typeof v === "string" && v.length > 0) ||
      ![PaymentActions.AUTHORIZED, PaymentActions.SUCCESSFUL].includes(value.action) ||
      typeof value.session_id !== "string" || !value.session_id ||
      typeof value.event_id !== "string" || !value.event_id ||
      typeof value.amount !== "string" || !/^\d+(?:\.\d+)?$/.test(value.amount) ||
      typeof value.currency_code !== "string" || !/^[a-z]{3}$/.test(value.currency_code) ||
      !Number.isSafeInteger(value.accepted_at) || value.accepted_at <= 0 ||
      typeof value.mac !== "string" || !/^[a-f0-9]{64}$/.test(value.mac)) invalid()
  const expected = createHmac("sha256", key()).update(material(value)).digest()
  if (!timingSafeEqual(expected, Buffer.from(value.mac, "hex"))) invalid()
  return { action: value.action, provider_id: value.provider_id,
    data: { session_id: value.session_id, amount: value.amount, currency_code: value.currency_code,
      cart_id: value.cart_id, payment_collection_id: value.payment_collection_id, payment_intent_id: value.payment_intent_id } }
}
