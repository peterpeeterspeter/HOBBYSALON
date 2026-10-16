import { MathBN, MedusaError } from "@medusajs/framework/utils"

export type ExpectedCartPayment = {
  session_id: string
  collection_id: string
  intent_id: string
  amount: string
  currency_code: string
}
// Validation happens on the exact sessions returned by native
// validateCartPaymentsStep, before authorization (and its compensation).
export function assertExpectedCartPayment(cart: any, sessions: any[], expected?: ExpectedCartPayment, expectedCartId?: string): void {
  if (!expected) return
  const invalid = () => { throw new MedusaError(MedusaError.Types.INVALID_DATA, "Authenticated cart payment selection changed; reconciliation required") }
  if ((expectedCartId && cart.id !== expectedCartId) || cart.payment_collection?.id !== expected.collection_id ||
      cart.currency_code !== expected.currency_code || !MathBN.eq(cart.total, expected.amount) || sessions.length !== 1) invalid()
  const session = sessions[0]
  if (session.id !== expected.session_id || session.payment_collection_id !== expected.collection_id ||
      session.provider_id !== "pp_card_stripe-connect" || session.data?.id !== expected.intent_id ||
      session.currency_code !== expected.currency_code || !MathBN.eq(session.amount, expected.amount)) invalid()
}
