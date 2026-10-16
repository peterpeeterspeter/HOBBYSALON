import { SubscriberConfig } from '@medusajs/framework'
import { MedusaError } from '@medusajs/framework/utils'
import { SubscriberArgs } from '@medusajs/medusa'

import { OrderSetWorkflowEvents } from '@mercurjs/framework'

import { withCommerceCartLock } from '../utils/commerce-cart-lock'
import { captureMarketplacePaymentUnderLock, marketplaceGraph } from '../utils/marketplace-capture'

export default async function orderSetPlacedHandler({
  event,
  container
}: SubscriberArgs<{ id: string }>) {
  const { id: orderSetId } = event.data
  const fields = ['id', 'cart_id', 'payment_collection_id']
  const sets = await marketplaceGraph(container, 'order_set', fields, { id: orderSetId })
  const selected = sets[0]
  const invalid = (): never => { throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Marketplace order-set binding changed; reconciliation required') }
  if (sets.length !== 1 || selected.id !== orderSetId || !selected.cart_id || !selected.payment_collection_id) invalid()
  await withCommerceCartLock(container, selected.cart_id, async () => {
    // Event payload and unlocked lookup are routing hints, not permission.
    const current = await marketplaceGraph(container, 'order_set', fields, { id: orderSetId })
    const carts = await marketplaceGraph(container, 'cart', ['id', 'payment_collection.id'], { id: selected.cart_id })
    if (current.length !== 1 || current[0].id !== orderSetId ||
        current[0].cart_id !== selected.cart_id || current[0].payment_collection_id !== selected.payment_collection_id ||
        carts.length !== 1 || carts[0].id !== selected.cart_id || carts[0].payment_collection?.id !== selected.payment_collection_id) invalid()
    const payment = await captureMarketplacePaymentUnderLock(container, selected.cart_id)
    if (!payment?.captured_at) invalid()
  })
}

export const config: SubscriberConfig = {
  event: OrderSetWorkflowEvents.PLACED,
  context: {
    subscriberId: 'order-set-placed-payment-capture'
  }
}
