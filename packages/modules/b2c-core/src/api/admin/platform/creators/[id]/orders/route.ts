import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { ensureSellerForCreatorRoutes } from '../../../../../../shared/platform/ensure-seller-for-creator-routes'

import sellerOrderLink from '../../../../../../links/seller-order'
import { getVendorOrdersListWorkflow } from '../../../../../../workflows/order/workflows'
import { vendorOrderFields } from '../../../../../vendor/orders/query-config'

const toPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const toNullableString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const ensureCreatorSeller = ensureSellerForCreatorRoutes

/**
 * @oas [get] /admin/platform/creators/{id}/orders
 * operationId: "AdminListCreatorOrders"
 * summary: "List Creator Orders"
 * description: "Returns creator-owned marketplace orders for dashboard order management."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sellerId = req.params.id
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  await ensureCreatorSeller(knex, sellerId)

  const limit = Math.min(toPositiveInt(req.query.limit, 20), 100)
  const offset = toPositiveInt(req.query.offset, 0)
  const status = toNullableString(req.query.status)
  const paymentStatus = toNullableString(req.query.payment_status)
  const fulfillmentStatus = toNullableString(req.query.fulfillment_status)

  const { data: relationRows } = await query.graph({
    entity: sellerOrderLink.entryPoint,
    fields: ['order_id'],
    filters: {
      seller_id: sellerId,
      deleted_at: { $eq: null },
    },
  })

  const allOrderIds = Array.from(
    new Set((relationRows || []).map((row: any) => row.order_id).filter(Boolean))
  )

  if (!allOrderIds.length) {
    res.json({
      orders: [],
      count: 0,
      offset,
      limit,
    })
    return
  }

  const filters: Record<string, unknown> = { id: allOrderIds }
  if (status) filters.status = status
  if (paymentStatus) filters.payment_status = paymentStatus
  if (fulfillmentStatus) filters.fulfillment_status = fulfillmentStatus

  const { result } = await getVendorOrdersListWorkflow(req.scope).run({
    input: {
      fields: vendorOrderFields,
      variables: {
        filters,
      },
    },
  })

  const rows = Array.isArray(result)
    ? result
    : ((result as any)?.rows ?? [])

  const sortedRows = [...rows].sort((a: any, b: any) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )
  const pagedRows = sortedRows.slice(offset, offset + limit)

  res.json({
    orders: pagedRows,
    count: sortedRows.length,
    offset,
    limit,
  })
}
