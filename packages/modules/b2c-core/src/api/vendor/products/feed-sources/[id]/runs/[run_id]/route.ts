import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../../../shared/infra/http/utils'
import { FeedPullRunRow, serializeFeedPullRun } from '../../../utils'

/**
 * @oas [get] /vendor/products/feed-sources/{id}/runs/{run_id}
 * operationId: "VendorGetFeedSourceRun"
 * summary: "Get Feed Source Pull Run"
 * description: "Retrieves a single feed pull run for a feed source belonging to the authenticated merchant."
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
  const row = (await knex('merchant_feed_pull_run')
    .select('*')
    .where('id', req.params.run_id)
    .where('feed_source_id', req.params.id)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()) as FeedPullRunRow | undefined

  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Feed source run not found')
  }

  res.json({ run: serializeFeedPullRun(row) })
}
