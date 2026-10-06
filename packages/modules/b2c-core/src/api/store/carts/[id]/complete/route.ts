import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

import { withCommerceCartLock } from '../../../../../utils/commerce-cart-lock'
import { completeMarketplaceCartUnderLock, captureMarketplacePaymentUnderLock } from '../../../../../utils/marketplace-capture'
import { getFormattedOrderSetListWorkflow } from '../../../../../workflows/order-set/workflows'

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const cart_id = req.params.id

  const data = await withCommerceCartLock(req.scope, cart_id, async () => {
    const { orderSet } = await completeMarketplaceCartUnderLock(req.scope, cart_id)
    // Preserve authorization-only checkout; repair an existing capture tail,
    // never initiate capture just because a storefront completion is retried.
    await captureMarketplacePaymentUnderLock(req.scope, cart_id, undefined, 'captured-only')
    const { result } = await getFormattedOrderSetListWorkflow(req.scope).run({
      input: { filters: { id: orderSet.id } }
    })
    return result.data
  })

  res.json({
    order_set: data[0]
  })
}
