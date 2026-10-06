import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { PaymentEvents } from '@medusajs/framework/utils'

import { acknowledgeMarketplaceCapture } from '../utils/marketplace-capture-subscriber'

export default async function paymentCapturedHandler({
  event,
  container
}: SubscriberArgs<{ id: string }>) {
  // The locked capture tail owns accounting. A delayed event must never reset
  // a refunded/canceled split, even when its queue job ID is deterministic.
  await acknowledgeMarketplaceCapture(container, event)
}

export const config: SubscriberConfig = {
  event: PaymentEvents.CAPTURED,
  context: {
    subscriberId: 'split-payment-payment-captured-handler'
  }
}
