import { randomUUID } from 'node:crypto'

import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'

import { PRODUCT_SYNC_JOB_STARTED_EVENT } from '../../../../../../../../vendor/products/sync/constants'
import { VendorStartProductSync } from '../../../../../../../../vendor/products/sync/validators'
import { VendorPullFeedSource } from '../../../../../../../../vendor/products/feed-sources/validators'
import {
  FeedSourceRow,
  buildSyncUpdatesFromFeed,
  fetchFeedWithRetry,
  parseFeedContent,
  serializeFeedSource,
} from '../../../../../../../../vendor/products/feed-sources/utils'

const MAX_PREVIEW_ERRORS = 50
const RUN_STALE_AFTER_MS = 2 * 60 * 60 * 1000

const getActiveProcessingRun = async (knex: any, feedSourceId: string) =>
  knex('merchant_feed_pull_run')
    .select('id', 'started_at')
    .where('feed_source_id', feedSourceId)
    .where('status', 'processing')
    .whereNull('deleted_at')
    .orderBy('started_at', 'desc')
    .first()

/**
 * @oas [post] /admin/platform/materials/merchants/{id}/feed-sources/{feed_id}/pull
 * operationId: "AdminPullMerchantFeedSource"
 * summary: "Pull Merchant Feed Source"
 * description: "Fetches a feed source and queues a sync job for a merchant seller."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  const sellerId = String(req.params.id || '')
  const feedId = String(req.params.feed_id || '')
  const parsed = VendorPullFeedSource.safeParse(req.body || {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    )
  }

  const seller = await knex('seller')
    .select('id', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Merchant ${sellerId} not found`)
  }

  const source = (await knex('merchant_feed_source')
    .select('*')
    .where('id', feedId)
    .where('seller_id', sellerId)
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
    Object.entries(serialized.headers || {}).map(([key, value]) => [key, String(value)])
  )
  const now = new Date()
  const currentProcessingRun = await getActiveProcessingRun(knex, source.id)
  if (currentProcessingRun) {
    const startedAt = new Date(currentProcessingRun.started_at)
    const isStale =
      Number.isNaN(startedAt.getTime()) ||
      now.getTime() - startedAt.getTime() > RUN_STALE_AFTER_MS

    if (isStale) {
      await knex('merchant_feed_pull_run')
        .where('id', currentProcessingRun.id)
        .whereNull('deleted_at')
        .update({
          status: 'failed',
          error_message: 'Run marked as stale before starting a new manual pull',
          finished_at: new Date(),
          updated_at: new Date(),
        })
    } else {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Feed source already has a processing run (${currentProcessingRun.id})`
      )
    }
  }

  const runId = `mfr_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  await knex('merchant_feed_pull_run').insert({
    id: runId,
    seller_id: sellerId,
    feed_source_id: source.id,
    trigger_type: 'manual',
    status: 'processing',
    total_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    sync_job_id: null,
    error_preview: knex.raw('?::jsonb', [JSON.stringify([])]),
    error_message: null,
    started_at: now,
    finished_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  })

  try {
    const response = await fetchFeedWithRetry({
      url: serialized.url,
      method: serialized.method || 'GET',
      headers,
      retries: parsed.data.retries,
      timeoutMs: parsed.data.timeout_ms,
    })

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
      limit: parsed.data.limit,
    })

    const validated = VendorStartProductSync.safeParse({ updates: buildResult.updates })
    if (!validated.success || !validated.data.updates.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        buildResult.errors[0]?.reason || 'No valid sync updates could be created from feed'
      )
    }

    const syncJobId = randomUUID()
    await knex('product_sync_job').insert({
      id: syncJobId,
      seller_id: sellerId,
      submitter_id: `admin:${sellerId}`,
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
      data: { job_id: syncJobId },
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

    await knex('merchant_feed_pull_run')
      .where('id', runId)
      .whereNull('deleted_at')
      .update({
        status: buildResult.rejected_count > 0 ? 'partial' : 'success',
        total_count: buildResult.total_count,
        accepted_count: buildResult.accepted_count,
        rejected_count: buildResult.rejected_count,
        sync_job_id: syncJobId,
        error_preview: knex.raw('?::jsonb', [
          JSON.stringify(buildResult.errors.slice(0, MAX_PREVIEW_ERRORS)),
        ]),
        error_message: null,
        finished_at: new Date(),
        updated_at: new Date(),
      })

    res.status(202).json({
      feed_source_id: source.id,
      sync_job: { id: syncJobId, status: 'queued' },
      summary: {
        total_count: buildResult.total_count,
        accepted_count: buildResult.accepted_count,
        rejected_count: buildResult.rejected_count,
      },
      preview_errors: buildResult.errors.slice(0, MAX_PREVIEW_ERRORS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : 'Unknown error'

    await knex('merchant_feed_source')
      .where('id', source.id)
      .whereNull('deleted_at')
      .update({
        last_pulled_at: new Date(),
        last_pull_status: 'failed',
        last_error: message,
        updated_at: new Date(),
      })

    await knex('merchant_feed_pull_run')
      .where('id', runId)
      .whereNull('deleted_at')
      .update({
        status: 'failed',
        error_message: message,
        finished_at: new Date(),
        updated_at: new Date(),
      })

    throw error
  }
}
