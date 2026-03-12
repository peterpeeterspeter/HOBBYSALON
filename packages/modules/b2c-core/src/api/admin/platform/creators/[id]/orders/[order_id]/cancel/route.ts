import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { SellerType } from '@mercurjs/framework'

import sellerOrderLink from '../../../../../../../../links/seller-order'
import { getVendorOrdersListWorkflow } from '../../../../../../../../workflows/order/workflows'
import { cancelOrderWorkflow } from '../../../../../../../../workflows/order/workflows/cancel-order'
import { vendorOrderFields } from '../../../../../../../vendor/orders/query-config'

type SellerRow = {
  id: string
  seller_type: string | null
}

const ensureCreatorSeller = async (knex: any, sellerId: string): Promise<void> => {
  const seller = (await knex('seller')
    .select('id', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()) as SellerRow | undefined

  if (!seller || seller.seller_type !== SellerType.CREATOR) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Creator seller ${sellerId} not found`
    )
  }
}

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
