import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import Stripe from "stripe"

const TERMINAL_PI_STATUSES = ["succeeded", "canceled"] as const

/**
 * GET /store/carts/:id/payment-client-secret
 *
 * Returns the Stripe client_secret for the cart's active payment session.
 */
export async function GET(
  req: MedusaRequest<{ id: string }>,
  res: MedusaResponse<{ client_secret?: string } | { message: string }>
) {
  const cartId = req.params.id
  if (!cartId) {
    return res.status(400).json({ message: "Cart ID required" })
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const paymentModuleService = req.scope.resolve(Modules.PAYMENT)
    const stripeKey = process.env.STRIPE_SECRET_API_KEY

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "total",
        "currency_code",
        "region_id",
        "email",
        "payment_collection.id",
        "payment_collection.amount",
        "payment_collection.currency_code",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.data",
      ],
      filters: { id: cartId },
    })
    const cart = carts?.[0]

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" })
    }

    const paymentCollection = (cart as {
      payment_collection?: {
        id: string
        amount?: number | { valueOf?: () => number; numeric?: number }
        currency_code?: string
        payment_sessions?: Array<{
          id: string
          provider_id?: string
          data?: Record<string, unknown>
        }>
      }
    })?.payment_collection

    const paymentCollectionId = paymentCollection?.id
    let session = paymentCollection?.payment_sessions?.[0]

    if (!session && paymentCollectionId) {
      const sessions = await paymentModuleService.listPaymentSessions(
        { payment_collection_id: paymentCollectionId },
        { take: 1 }
      )
      session = sessions[0]
    }

    if (!session) {
      return res.status(400).json({
        message: "No payment session found. Initiate payment first.",
      })
    }

    const data = session.data as Record<string, unknown> | undefined
    let clientSecret = (data?.client_secret ?? data?.clientSecret) as string | undefined

    const paymentIntentId =
      (data?.id as string) ?? (typeof session.id === "string" && session.id.startsWith("pi_") ? session.id : null)

    const recreatePaymentSession = async (providerIdOverride?: string) => {
      if (!paymentCollectionId) {
        return
      }

      const c = cart as { total?: number; currency_code?: string; email?: string }
      const amountRaw = (paymentCollection as { amount?: number })?.amount ?? c.total ?? 0
      const currency = (paymentCollection as { currency_code?: string })?.currency_code ?? c.currency_code ?? "eur"
      const amount = typeof amountRaw === "object" && amountRaw !== null && "valueOf" in amountRaw
        ? Number((amountRaw as { valueOf: () => number }).valueOf?.())
        : Number(amountRaw)
      const providerId =
        providerIdOverride ??
        (session as { provider_id?: string })?.provider_id ??
        "pp_stripe_stripe-connect"

      if (session?.id) {
        await paymentModuleService.deletePaymentSession(session.id)
      }

      const newSession = await paymentModuleService.createPaymentSession(
        paymentCollectionId,
        {
          provider_id: providerId,
          currency_code: currency,
          amount,
          data: {},
          context: { customer: { email: c.email } },
        } as Parameters<typeof paymentModuleService.createPaymentSession>[1]
      )

      session = newSession as typeof session
      const newData = (newSession as { data?: Record<string, unknown> })?.data
      clientSecret = (newData?.client_secret ?? newData?.clientSecret) as string | undefined
    }

    // Check if PaymentIntent is terminal; if refresh requested, delete and create new session
    if (paymentIntentId && stripeKey) {
      try {
        const stripe = new Stripe(stripeKey)
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (!clientSecret) clientSecret = pi.client_secret ?? undefined

        const isTerminal = TERMINAL_PI_STATUSES.includes(pi.status as (typeof TERMINAL_PI_STATUSES)[number])
        if (isTerminal) {
          await recreatePaymentSession((session as { provider_id?: string })?.provider_id)
        }
      } catch (e) {
        if (!clientSecret) {
          console.error("[payment-client-secret] Stripe retrieve:", e)
        }
      }
    }

    // Deterministic fallback: regenerate session for this payment collection.
    if (!clientSecret) {
      try {
        await recreatePaymentSession((session as { provider_id?: string })?.provider_id)
      } catch (e) {
        console.error("[payment-client-secret] Recreate payment session fallback:", e)
      }
    }

    if (!clientSecret) {
      console.warn("[payment-client-secret] FAILED - no client_secret found after all fallbacks")
      return res.status(400).json({
        message: "Payment session has no client_secret",
      })
    }

    return res.json({ client_secret: clientSecret })
  } catch (err) {
    console.error("[payment-client-secret]", err)
    return res.status(500).json({
      message: "Failed to retrieve payment client secret",
    })
  }
}
