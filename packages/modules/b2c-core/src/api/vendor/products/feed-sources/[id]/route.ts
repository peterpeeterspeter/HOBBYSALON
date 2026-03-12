import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../shared/infra/http/utils'
import { VendorUpdateFeedSourceType } from '../validators'
import { FeedSourceRow, serializeFeedSource } from '../utils'

const getOwnedFeedSource = async (
  req: AuthenticatedMedusaRequest,
  id: string
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope, [
    'id',
    'seller_type',
  ])

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Feed sources are only available for merchant sellers'
    )
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const row = (await knex('merchant_feed_source')
    .select('*')
    .where('id', id)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()) as FeedSourceRow | undefined

  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Feed source not found')
  }

  return { seller, knex, row }
}

/**
 * @oas [get] /vendor/products/feed-sources/{id}
 * operationId: "VendorGetFeedSource"
 * summary: "Get Product Feed Source"
 * description: "Retrieves a product feed source by ID for the authenticated merchant."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { row } = await getOwnedFeedSource(req, req.params.id)
  res.json({ feed_source: serializeFeedSource(row) })
}

/**
 * @oas [put] /vendor/products/feed-sources/{id}
 * operationId: "VendorUpdateFeedSource"
 * summary: "Update Product Feed Source"
 * description: "Updates a product feed source by ID for the authenticated merchant."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const PUT = async (
  req: AuthenticatedMedusaRequest<VendorUpdateFeedSourceType>,
  res: MedusaResponse
) => {
  const { row, knex } = await getOwnedFeedSource(req, req.params.id)
  const updates = req.validatedBody
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date(),
  }

  if (updates.name !== undefined) {
    updatePayload.name = updates.name
  }
  if (updates.provider !== undefined) {
    updatePayload.provider = updates.provider
  }
  if (updates.url !== undefined) {
    updatePayload.url = updates.url
  }
  if (updates.method !== undefined) {
    updatePayload.method = updates.method
  }
  if (updates.headers !== undefined) {
    updatePayload.headers = knex.raw('?::jsonb', [JSON.stringify(updates.headers || {})])
  }
  if (updates.mapping !== undefined) {
    updatePayload.mapping = knex.raw('?::jsonb', [JSON.stringify(updates.mapping || {})])
  }
  if (updates.default_currency !== undefined) {
    updatePayload.default_currency = updates.default_currency || null
  }
  if (updates.default_location_id !== undefined) {
    updatePayload.default_location_id = updates.default_location_id || null
  }
  if (updates.active !== undefined) {
    updatePayload.active = updates.active
  }

  await knex('merchant_feed_source')
    .where('id', row.id)
    .whereNull('deleted_at')
    .update(updatePayload)

  const updated = (await knex('merchant_feed_source')
    .select('*')
    .where('id', row.id)
    .whereNull('deleted_at')
    .first()) as FeedSourceRow | undefined

  if (!updated) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'Failed to retrieve updated feed source'
    )
  }

  res.json({ feed_source: serializeFeedSource(updated) })
}

/**
 * @oas [delete] /vendor/products/feed-sources/{id}
 * operationId: "VendorDeleteFeedSource"
 * summary: "Delete Product Feed Source"
 * description: "Soft deletes a product feed source for the authenticated merchant."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { row, knex } = await getOwnedFeedSource(req, req.params.id)

  await knex('merchant_feed_source')
    .where('id', row.id)
    .whereNull('deleted_at')
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    })

  res.status(200).json({
    id: row.id,
    object: 'feed_source',
    deleted: true,
  })
}
