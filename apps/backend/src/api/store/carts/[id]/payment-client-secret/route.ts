import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getSmallestUnit } from "@mercurjs/framework"
import Stripe from "stripe"

const TERMINAL_PI_STATUSES = ["succeeded", "canceled"] as const

/**
 * GET /store/carts/:id/payment-client-secret
 *
 * Returns the Stripe client_secret for the cart's active payment session.
 * ?refresh=1: If PaymentIntent is terminal, delete session and create a new one.
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

    // Check if PaymentIntent is terminal; if refresh requested, delete and create new session
    if (paymentIntentId && stripeKey) {
      try {
        const stripe = new Stripe(stripeKey)
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (!clientSecret) clientSecret = pi.client_secret ?? undefined

        const isTerminal = TERMINAL_PI_STATUSES.includes(pi.status as (typeof TERMINAL_PI_STATUSES)[number])
        if (isTerminal && paymentCollectionId) {
          await paymentModuleService.deletePaymentSession(session.id)

          const c = cart as { total?: number; currency_code?: string; email?: string }
          const amountRaw = (paymentCollection as { amount?: number })?.amount ?? c.total ?? 0
          const currency = (paymentCollection as { currency_code?: string })?.currency_code ?? c.currency_code ?? "eur"
          const amount = typeof amountRaw === "object" && amountRaw !== null && "valueOf" in amountRaw
            ? Number((amountRaw as { valueOf: () => number }).valueOf?.())
            : Number(amountRaw)
          const providerId = (session as { provider_id?: string }).provider_id ?? "pp_stripe_stripe-connect"

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

          const newData = (newSession as { data?: Record<string, unknown> })?.data
          clientSecret = (newData?.client_secret ?? newData?.clientSecret) as string | undefined
        }
      } catch (e) {
        if (!clientSecret) {
          console.error("[payment-client-secret] Stripe retrieve:", e)
        }
      }
    }

    if (!clientSecret && paymentIntentId && stripeKey) {
      try {
        const stripe = new Stripe(stripeKey)
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        clientSecret = pi.client_secret ?? undefined
      } catch (e) {
        console.error("[payment-client-secret] Stripe retrieve:", e)
      }
    }

    // Fallback 2: List recent PaymentIntents and match by amount/currency
    if (!clientSecret && stripeKey && paymentCollectionId) {
      try {
        const { data: collections } = await query.graph({
          entity: "payment_collection",
          fields: ["id", "amount", "currency_code"],
          filters: { id: paymentCollectionId },
        })
        let collection = collections?.[0] as {
          amount?: number | { valueOf?: () => number; numeric?: number }
          currency_code?: string
        } | undefined
        let amountRaw = collection?.amount
        let currency = collection?.currency_code?.toLowerCase()

        // Fallback: get amount from cart total if payment_collection amount unavailable
        if ((amountRaw == null || !currency) && cart) {
          const c = cart as { total?: number; currency_code?: string }
          amountRaw = c.total
          currency = c.currency_code?.toLowerCase()
        }

        if (amountRaw != null && currency) {
          const amountCents = getSmallestUnit(amountRaw, currency)
          const stripe = new Stripe(stripeKey)
          const list = await stripe.paymentIntents.list({
            limit: 20,
            created: { gte: Math.floor(Date.now() / 1000) - 3600 },
          })
          const match = list.data.find(
            (pi) =>
              pi.amount === amountCents &&
              pi.currency === currency &&
              (pi.status === "requires_payment_method" || pi.status === "requires_confirmation")
          )
          if (match?.client_secret) clientSecret = match.client_secret
        }
      } catch (e) {
        console.error("[payment-client-secret] Stripe list fallback:", e)
      }
    }

    if (!clientSecret) {
      console.log("[payment-client-secret] FAILED - no client_secret found after all fallbacks")
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
