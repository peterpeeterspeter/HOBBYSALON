import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../../shared/infra/http/utils'
import { VendorStartProductSync } from '../../../sync/validators'
import { VendorPreviewFeedSourceType } from '../../validators'
import {
  FeedSourceRow,
  buildSyncUpdatesFromFeed,
  parseFeedContent,
  serializeFeedSource,
} from '../../utils'

const MAX_PREVIEW_ITEMS = 100
const MAX_PREVIEW_ERRORS = 100

/**
 * @oas [post] /vendor/products/feed-sources/{id}/preview
 * operationId: "VendorPreviewFeedSource"
 * summary: "Preview Product Feed Source"
 * description: "Fetches and parses a feed source and returns mapping/validation preview without queuing a sync job."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<VendorPreviewFeedSourceType>,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope, [
    'id',
    'seller_type',
  ])

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Feed preview is only available for merchant sellers'
    )
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const source = (await knex('merchant_feed_source')
    .select('*')
    .where('id', req.params.id)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()) as FeedSourceRow | undefined

  if (!source) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Feed source not found')
  }

  const serialized = serializeFeedSource(source)
  const headers = Object.fromEntries(
    Object.entries(serialized.headers || {}).map(([key, value]) => [
      key,
      String(value),
    ])
  )

  const response = await fetch(serialized.url, {
    method: serialized.method || 'GET',
    headers,
  })

  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Feed request failed with status ${response.status}`
    )
  }

  const rawText = await response.text()
  const rows = parseFeedContent(
    rawText,
    source.provider,
    response.headers.get('content-type')
  )

  const parsedColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const effectiveMapping = req.validatedBody.mapping || serialized.mapping
  const effectiveCurrency =
    req.validatedBody.default_currency || serialized.default_currency
  const effectiveLocationId =
    req.validatedBody.default_location_id || serialized.default_location_id

  const buildResult = buildSyncUpdatesFromFeed(rows, {
    mapping: effectiveMapping,
    defaultCurrency: effectiveCurrency,
    defaultLocationId: effectiveLocationId,
    limit: req.validatedBody.limit,
  })

  const validation = VendorStartProductSync.safeParse({
    updates: buildResult.updates,
  })

  const validationErrors = validation.success
    ? []
    : validation.error.issues.map((issue) => ({
        row: 0,
        reason: issue.message,
      }))

  const acceptedCount = validation.success ? validation.data.updates.length : 0
  const rejectedCount =
    buildResult.rejected_count +
    (buildResult.accepted_count - acceptedCount) +
    validationErrors.length

  res.json({
    feed_source_id: source.id,
    summary: {
      total_count: buildResult.total_count,
      accepted_count: acceptedCount,
      rejected_count: rejectedCount,
      columns: parsedColumns,
    },
    preview: {
      updates: (validation.success ? validation.data.updates : []).slice(
        0,
        MAX_PREVIEW_ITEMS
      ),
      errors: [...buildResult.errors, ...validationErrors].slice(
        0,
        MAX_PREVIEW_ERRORS
      ),
    },
  })
}
