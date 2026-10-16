import { Modules, PaymentActions } from "@medusajs/framework/utils"
import { MARKETPLACE_PAYMENT_WEBHOOK, marketplacePaymentContext } from "../../utils/marketplace-payment-webhook"
import { sealMarketplacePayment, openMarketplacePayment } from "../../utils/marketplace-payment-envelope"

export async function routeMarketplacePaymentWebhook(req: any, res: any, next: any) {
  // This app is Mercur-first. Card payments linked to carts must never enter
  // native process-payment/complete-cart. Other providers retain native routing.
  if (req.params.provider !== "card_stripe-connect") return next()
  const input = {
    provider: req.params.provider,
    payload: { data: req.body, rawData: req.rawBody, headers: req.headers },
  }
  let processed: any
  try {
    processed = await req.scope.resolve(Modules.PAYMENT).getWebhookActionAndData(input)
  } catch {
    return res.status(400).json({ message: "Invalid payment webhook signature" })
  }
  if (![PaymentActions.AUTHORIZED, PaymentActions.SUCCESSFUL].includes(processed.action)) return res.sendStatus(200)
  try {
    const rawEvent = JSON.parse(Buffer.from(req.rawBody).toString("utf8"))
    const ingressInput = { ...processed, provider_id: "pp_card_stripe-connect", data: { ...processed.data,
      currency_code: rawEvent.data.object.currency, payment_intent_id: rawEvent.data.object.id } }
    const context = await marketplacePaymentContext(req.scope, ingressInput)
    if (!context.cart) {
      // Absence of a marketplace link is not proof of a native checkout.
      // Only positively bound card payments may be dispatched by this route.
      return res.status(409).json({ message: "Payment webhook binding requires reconciliation" })
    }
    const envelope = sealMarketplacePayment(processed, rawEvent, { cart_id: context.cart.id,
      payment_collection_id: context.session.payment_collection_id, payment_intent_id: rawEvent.data.object.id })
    await marketplacePaymentContext(req.scope, openMarketplacePayment(envelope))
    await req.scope.resolve(Modules.EVENT_BUS).emit({ name: MARKETPLACE_PAYMENT_WEBHOOK, data: envelope }, { delay: 5000, attempts: 3 })
    return res.sendStatus(200)
  } catch {
    // Never fall back to native completion when financial bindings are missing.
    return res.status(409).json({ message: "Payment webhook binding requires reconciliation" })
  }
}
