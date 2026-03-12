import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../../shared/infra/http/utils'
import { FeedPullRunRow, serializeFeedPullRun } from '../../utils'

/**
 * @oas [get] /vendor/products/feed-sources/{id}/runs
 * operationId: "VendorListFeedSourceRuns"
 * summary: "List Feed Source Pull Runs"
 * description: "Retrieves pull run history for a feed source belonging to the authenticated merchant."
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
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope, [
    'id',
    'seller_type',
  ])

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Feed source runs are only available for merchant sellers'
    )
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const feedSource = await knex('merchant_feed_source')
    .select('id')
    .where('id', req.params.id)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()

  if (!feedSource) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Feed source not found')
  }

  const offsetRaw = req.query?.offset
  const limitRaw = req.query?.limit
  const offset =
    typeof offsetRaw === 'string' ? Math.max(0, Number.parseInt(offsetRaw, 10) || 0) : 0
  const limitParsed =
    typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 20
  const limit = Number.isFinite(limitParsed)
    ? Math.min(100, Math.max(1, limitParsed))
    : 20

  const statusFilter =
    typeof req.query?.status === 'string' ? req.query.status.trim() : undefined

  let baseQuery = knex('merchant_feed_pull_run')
    .where('seller_id', seller.id)
    .where('feed_source_id', req.params.id)
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
