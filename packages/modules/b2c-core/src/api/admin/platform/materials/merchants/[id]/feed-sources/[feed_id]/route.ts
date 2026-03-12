import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import {
  VendorUpdateFeedSource,
  VendorUpdateFeedSourceType,
} from '../../../../../../../vendor/products/feed-sources/validators'
import {
  FeedSourceRow,
  serializeFeedSource,
} from '../../../../../../../vendor/products/feed-sources/utils'

const getOwnedFeedSource = async (knex: any, sellerId: string, feedId: string) => {
  const seller = await knex('seller')
    .select('id', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Merchant ${sellerId} not found`)
  }

  const row = (await knex('merchant_feed_source')
    .select('*')
    .where('id', feedId)
    .where('seller_id', sellerId)
    .whereNull('deleted_at')
    .first()) as FeedSourceRow | undefined

  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Feed source ${feedId} not found`)
  }

  return row
}

/**
 * @oas [put] /admin/platform/materials/merchants/{id}/feed-sources/{feed_id}
 * operationId: "AdminUpdateMerchantFeedSource"
 * summary: "Update Merchant Feed Source"
 * description: "Updates a feed source for a merchant seller."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const PUT = async (
  req: MedusaRequest<VendorUpdateFeedSourceType>,
  res: MedusaResponse
) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellerId = String(req.params.id || '')
  const feedId = String(req.params.feed_id || '')
  const row = await getOwnedFeedSource(knex, sellerId, feedId)

  const parsed = VendorUpdateFeedSource.safeParse(req.body || {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    )
  }

  const updates = parsed.data
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date(),
  }

  if (updates.name !== undefined) updatePayload.name = updates.name
  if (updates.provider !== undefined) updatePayload.provider = updates.provider
  if (updates.url !== undefined) updatePayload.url = updates.url
  if (updates.method !== undefined) updatePayload.method = updates.method
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
  if (updates.active !== undefined) updatePayload.active = updates.active
  if (updates.auto_pull_enabled !== undefined) {
    updatePayload.auto_pull_enabled = updates.auto_pull_enabled
  }
  if (updates.pull_interval_minutes !== undefined) {
    updatePayload.pull_interval_minutes = updates.pull_interval_minutes || null
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
