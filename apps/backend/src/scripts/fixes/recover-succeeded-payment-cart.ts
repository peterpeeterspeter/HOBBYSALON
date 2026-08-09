/**
 * Recover a cart whose Stripe PaymentIntent succeeded but Medusa never
 * authorized the payment session / completed the order (missing session_id
 * metadata on the PI broke the webhook).
 *
 * Usage (in backend container):
 *   npx medusa exec ./src/scripts/fixes/recover-succeeded-payment-cart.ts \
 *     cart_01KZH5PMPSCT7MA5WKK4QRXPS0 payses_01KZH773AV6FSKGVSV9R8EMFE6
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { splitAndCompleteCartWorkflow } from "@mercurjs/b2c-core/workflows"
import Stripe from "stripe"

export default async function recoverSucceededPaymentCart({
  container,
  args,
}: ExecArgs) {
  const cartId = args?.[0]
  const sessionId = args?.[1]

  if (!cartId || !sessionId) {
    throw new Error(
      "Usage: medusa exec ...recover-succeeded-payment-cart.ts <cart_id> <payment_session_id>"
    )
  }

  const payment = container.resolve(Modules.PAYMENT)
  const stripeKey = process.env.STRIPE_SECRET_API_KEY
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_API_KEY missing")
  }

  const sessions = await payment.listPaymentSessions({ id: sessionId })
  const session = sessions?.[0]
  if (!session) {
    throw new Error(`Payment session not found: ${sessionId}`)
  }

  const piId = (session.data as { id?: string } | undefined)?.id
  if (!piId) {
    throw new Error("Payment session has no Stripe PaymentIntent id")
  }

  const stripe = new Stripe(stripeKey)
  const pi = await stripe.paymentIntents.retrieve(piId)
  console.log(`PI ${piId} status=${pi.status}`)

  if (pi.status !== "succeeded") {
    throw new Error(`Expected succeeded PaymentIntent, got ${pi.status}`)
  }

  if (pi.metadata?.session_id !== sessionId) {
    await stripe.paymentIntents.update(piId, {
      metadata: { ...pi.metadata, session_id: sessionId },
    })
    console.log(`Updated PI metadata.session_id=${sessionId}`)
  }

  await payment.authorizePaymentSession(sessionId, {})
  console.log(`Authorized payment session ${sessionId}`)

  const { result } = await splitAndCompleteCartWorkflow(container).run({
    input: { id: cartId },
    context: { transactionId: cartId },
  })

  console.log("Order set:", JSON.stringify(result, null, 2))
}
