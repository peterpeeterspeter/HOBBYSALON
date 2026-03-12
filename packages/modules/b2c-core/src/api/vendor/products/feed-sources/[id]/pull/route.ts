import { randomUUID } from 'node:crypto'

import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../../shared/infra/http/utils'
import { PRODUCT_SYNC_JOB_STARTED_EVENT } from '../../../sync/constants'
import { VendorStartProductSync } from '../../../sync/validators'
import { VendorPullFeedSourceType } from '../../validators'
import {
  FeedSourceRow,
  buildSyncUpdatesFromFeed,
  parseFeedContent,
  serializeFeedSource,
} from '../../utils'

const MAX_PREVIEW_ERRORS = 50

/**
 * @oas [post] /vendor/products/feed-sources/{id}/pull
 * operationId: "VendorPullFeedSource"
 * summary: "Pull Product Feed Source"
 * description: "Fetches a configured feed source, maps records to SKU stock/price updates, and queues a product sync job."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<VendorPullFeedSourceType>,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope, [
    'id',
    'seller_type',
  ])

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Feed pull is only available for merchant sellers'
    )
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  const source = (await knex('merchant_feed_source')
    .select('*')
    .where('id', req.params.id)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()) as FeedSourceRow | undefined

  if (!source) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Feed source not found')
  }

  if (!source.active) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Feed source is inactive and cannot be pulled'
    )
  }

  const serialized = serializeFeedSource(source)
  const headers = Object.fromEntries(
    Object.entries(serialized.headers || {}).map(([key, value]) => [
      key,
      String(value),
    ])
  )
  const now = new Date()

  try {
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

    const buildResult = buildSyncUpdatesFromFeed(rows, {
      mapping: serialized.mapping,
      defaultCurrency: serialized.default_currency,
      defaultLocationId: serialized.default_location_id,
      limit: req.validatedBody.limit,
    })

    const validated = VendorStartProductSync.safeParse({
      updates: buildResult.updates,
    })
    if (!validated.success || !validated.data.updates.length) {
      const firstError = buildResult.errors[0]?.reason
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        firstError || 'No valid sync updates could be created from feed'
      )
    }

    const syncJobId = randomUUID()
    await knex('product_sync_job').insert({
      id: syncJobId,
      seller_id: seller.id,
      submitter_id: req.auth_context.actor_id,
      status: 'queued',
      total_count: validated.data.updates.length,
      processed_count: 0,
      accepted_count: 0,
      rejected_count: 0,
      payload: knex.raw('?::jsonb', [JSON.stringify(validated.data.updates)]),
      error_message: null,
      result_preview: knex.raw('null'),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })

    await eventBus.emit({
      name: PRODUCT_SYNC_JOB_STARTED_EVENT,
      data: {
        job_id: syncJobId,
      },
    })

    await knex('merchant_feed_source')
      .where('id', source.id)
      .whereNull('deleted_at')
      .update({
        last_pulled_at: new Date(),
        last_pull_status: 'success',
        last_error: null,
        last_sync_job_id: syncJobId,
        updated_at: new Date(),
      })

    res.status(202).json({
      feed_source_id: source.id,
      sync_job: {
        id: syncJobId,
        status: 'queued',
      },
      summary: {
        total_count: buildResult.total_count,
        accepted_count: buildResult.accepted_count,
        rejected_count: buildResult.rejected_count,
      },
      preview_errors: buildResult.errors.slice(0, MAX_PREVIEW_ERRORS),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 4000) : 'Unknown error'

    await knex('merchant_feed_source')
      .where('id', source.id)
      .whereNull('deleted_at')
      .update({
        last_pulled_at: new Date(),
        last_pull_status: 'failed',
        last_error: message,
        updated_at: new Date(),
      })

    throw error
  }
}
