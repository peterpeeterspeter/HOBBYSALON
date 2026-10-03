import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'

import { PayoutWorkflowEvents } from '@mercurjs/framework'

import { processPayoutForOrderWorkflow } from '../workflows/order/workflows'
import { areSellerPayoutsReleased } from '../utils/payout-release-gate'

export default async function payoutOrderHandler({
  event,
  container
}: SubscriberArgs<{ order_id: string }>) {
  if (!areSellerPayoutsReleased()) return
  await processPayoutForOrderWorkflow(container).run({
    input: {
      order_id: event.data.order_id
    },
    context: {
      transactionId: event.data.order_id
    }
  })
}

export const config: SubscriberConfig = {
  event: PayoutWorkflowEvents.RECEIVED,
  context: {
    subscriberId: 'payout-order-handler'
  }
}
