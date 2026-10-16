import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { MARKETPLACE_PAYMENT_WEBHOOK, processMarketplacePaymentWebhook } from "../utils/marketplace-payment-webhook"
import { openMarketplacePayment, VerifiedMarketplacePayment } from "../utils/marketplace-payment-envelope"

export default async function marketplacePaymentWebhookHandler({ event, container }: SubscriberArgs<VerifiedMarketplacePayment>) {
  await processMarketplacePaymentWebhook(container, openMarketplacePayment(event.data))
}
export const config: SubscriberConfig = {
  event: MARKETPLACE_PAYMENT_WEBHOOK,
  context: { subscriberId: "hobbysalon-marketplace-payment-webhook" },
}
