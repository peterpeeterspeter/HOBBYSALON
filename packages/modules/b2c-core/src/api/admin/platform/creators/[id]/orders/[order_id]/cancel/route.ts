import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { ensureSellerForCreatorRoutes } from '../../../../../../../../shared/platform/ensure-seller-for-creator-routes'

import sellerOrderLink from '../../../../../../../../links/seller-order'
import { getVendorOrdersListWorkflow } from '../../../../../../../../workflows/order/workflows'
import { cancelOrderWorkflow } from '../../../../../../../../workflows/order/workflows/cancel-order'
import { vendorOrderFields } from '../../../../../../../vendor/orders/query-config'

const ensureCreatorSeller = ensureSellerForCreatorRoutes

const ensureSellerOwnsOrder = async (
  query: any,
  sellerId: string,
  orderId: string
): Promise<void> => {
  const { data } = await query.graph({
    entity: sellerOrderLink.entryPoint,
    fields: ['order_id'],
    filters: {
      seller_id: sellerId,
      order_id: orderId,
      deleted_at: { $eq: null },
    },
  })

  if (!data?.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order ${orderId} not found for creator seller ${sellerId}`
    )
  }
}

/**
 * @oas [post] /admin/platform/creators/{id}/orders/{order_id}/cancel
 * operationId: "AdminCancelCreatorOrder"
 * summary: "Cancel Creator Order"
 * description: "Cancels an order for a creator-owned order."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sellerId = req.params.id
  const orderId = req.params.order_id
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  await ensureCreatorSeller(knex, sellerId)
  await ensureSellerOwnsOrder(query, sellerId, orderId)

  await cancelOrderWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      canceled_by: 'platform_admin',
    },
  })

  const { result } = await getVendorOrdersListWorkflow(req.scope).run({
    input: {
      fields: vendorOrderFields,
      variables: {
        filters: {
          id: orderId,
        },
      },
    },
  })

  const [order] = Array.isArray(result)
    ? result
    : ((result as any)?.rows ?? [])

  res.json({ order })
}
