import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import {
  FeedPullRunRow,
  serializeFeedPullRun,
} from '../../../../../../../../vendor/products/feed-sources/utils'

/**
 * @oas [get] /admin/platform/materials/merchants/{id}/feed-sources/{feed_id}/runs
 * operationId: "AdminListMerchantFeedSourceRuns"
 * summary: "List Merchant Feed Source Runs"
 * description: "Returns feed pull run history for a merchant feed source."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellerId = String(req.params.id || '')
  const feedId = String(req.params.feed_id || '')

  const seller = await knex('seller')
    .select('id', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()
  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Merchant ${sellerId} not found`)
  }

  const feedSource = await knex('merchant_feed_source')
    .select('id')
    .where('id', feedId)
    .where('seller_id', sellerId)
    .whereNull('deleted_at')
    .first()
  if (!feedSource) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Feed source ${feedId} not found`)
  }

  const offsetRaw = req.query?.offset
  const limitRaw = req.query?.limit
  const offset =
    typeof offsetRaw === 'string' ? Math.max(0, Number.parseInt(offsetRaw, 10) || 0) : 0
  const limitParsed = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 20
  const limit = Number.isFinite(limitParsed) ? Math.min(100, Math.max(1, limitParsed)) : 20
  const statusFilter = typeof req.query?.status === 'string' ? req.query.status.trim() : undefined

  let baseQuery = knex('merchant_feed_pull_run')
    .where('seller_id', sellerId)
    .where('feed_source_id', feedId)
    .whereNull('deleted_at')

  if (statusFilter) {
    baseQuery = baseQuery.where('status', statusFilter)
  }

  const [{ count }] = await baseQuery
    .clone()
    .clearSelect()
    .clearOrder()
    .count('* as count')

  const rows = (await baseQuery
    .clone()
    .select('*')
    .orderBy('started_at', 'desc')
    .offset(offset)
    .limit(limit)) as FeedPullRunRow[]

  res.json({
    runs: rows.map(serializeFeedPullRun),
    count: Number.parseInt(String(count || 0), 10),
    offset,
    limit,
  })
}
