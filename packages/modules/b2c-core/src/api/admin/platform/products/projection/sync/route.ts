import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  Modules,
} from '@medusajs/framework/utils'

import { AlgoliaEvents } from '@mercurjs/framework'

type SyncBody = {
  seller_id?: string
  limit?: number
}

const chunk = <T>(items: T[], size: number): T[][] => {
  if (!items.length) {
    return []
  }

  const output: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size))
  }
  return output
}

/**
 * @oas [post] /admin/platform/products/projection/sync
 * operationId: "AdminSyncPlatformProductsProjection"
 * summary: "Sync Platform Product Projection"
 * description: "Queues projection sync events for published merchant and creator products so Medusa products are reflected in platform products."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: MedusaRequest<SyncBody>,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  const body = (req.body || {}) as SyncBody

  const batchSize =
    Number.isFinite(body.limit) && Number(body.limit) > 0
      ? Math.min(Number(body.limit), 500)
      : 200

  let baseQuery = knex('product as p')
    .distinct('p.id')
    .innerJoin('seller_seller_product_product as sspp', function joinSellerProduct() {
      this.on('sspp.product_id', '=', 'p.id').onNull('sspp.deleted_at')
    })
    .innerJoin('seller as s', function joinSeller() {
      this.on('s.id', '=', 'sspp.seller_id').onNull('s.deleted_at')
    })
    .whereNull('p.deleted_at')
    .where('p.status', 'published')
    .whereIn('s.seller_type', ['merchant', 'creator'])

  if (body.seller_id) {
    baseQuery = baseQuery.where('s.id', body.seller_id)
  }

  const rows = (await baseQuery.orderBy('p.id', 'asc')) as Array<{ id: string }>
  const productIds = rows.map((row) => row.id).filter(Boolean)
  const batches = chunk(productIds, batchSize)

  for (const batchIds of batches) {
    await eventBus.emit({
      name: AlgoliaEvents.PRODUCTS_CHANGED,
      data: { ids: batchIds },
    })
  }

  logger.info(
    `Queued ${batches.length} projection sync batch(es) for ${productIds.length} merchant/creator products`
  )

  res.status(202).json({
    message: 'Projection sync queued',
    count: productIds.length,
    batches: batches.length,
    batch_size: batchSize,
  })
}
