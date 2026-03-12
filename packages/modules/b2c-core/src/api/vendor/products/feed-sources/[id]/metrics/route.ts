import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../../shared/infra/http/utils'

const DEFAULT_WINDOW_DAYS = 14
const MIN_WINDOW_DAYS = 1
const MAX_WINDOW_DAYS = 90

const toWindowDays = (raw: unknown) => {
  if (typeof raw !== 'string') {
    return DEFAULT_WINDOW_DAYS
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_WINDOW_DAYS
  }

  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, parsed))
}

/**
 * @oas [get] /vendor/products/feed-sources/{id}/metrics
 * operationId: "VendorGetFeedSourceMetrics"
 * summary: "Get Feed Source Metrics"
 * description: "Retrieves run metrics and trend data for a feed source belonging to the authenticated merchant."
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
      'Feed source metrics are only available for merchant sellers'
    )
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const feedSource = await knex('merchant_feed_source')
    .select('id', 'name')
    .where('id', req.params.id)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()

  if (!feedSource) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Feed source not found')
  }

  const windowDays = toWindowDays(req.query?.window_days)
  const now = new Date()
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const baseQuery = knex('merchant_feed_pull_run')
    .where('seller_id', seller.id)
    .where('feed_source_id', req.params.id)
    .whereNull('deleted_at')
    .andWhere('started_at', '>=', since)

  const [aggregateRow, latestRun, trendRows, processingRow] = await Promise.all([
    baseQuery
      .clone()
      .clearSelect()
      .select(
        knex.raw('count(*)::int as total_runs'),
        knex.raw(
          "sum(case when status in ('success', 'partial') then 1 else 0 end)::int as successful_runs"
        ),
        knex.raw(
          "sum(case when status = 'failed' then 1 else 0 end)::int as failed_runs"
        ),
        knex.raw(
          "avg(case when finished_at is not null then extract(epoch from (finished_at - started_at)) * 1000 else null end)::float as avg_duration_ms"
        )
      )
      .first(),
    baseQuery
      .clone()
      .select(
        'id',
        'trigger_type',
        'status',
        'total_count',
        'accepted_count',
        'rejected_count',
        'sync_job_id',
        'started_at',
        'finished_at'
      )
      .orderBy('started_at', 'desc')
      .first(),
    baseQuery
      .clone()
      .clearSelect()
      .select(
        knex.raw("date_trunc('day', started_at)::date as day"),
        knex.raw('count(*)::int as total_runs'),
        knex.raw(
          "sum(case when status in ('success', 'partial') then 1 else 0 end)::int as successful_runs"
        ),
        knex.raw(
          "sum(case when status = 'failed' then 1 else 0 end)::int as failed_runs"
        )
      )
      .groupByRaw("date_trunc('day', started_at)::date")
      .orderBy('day', 'asc'),
    knex('merchant_feed_pull_run')
      .where('seller_id', seller.id)
      .where('feed_source_id', req.params.id)
      .where('status', 'processing')
      .whereNull('deleted_at')
      .count('* as count')
      .first(),
  ])

  const totalRuns = Number.parseInt(String(aggregateRow?.total_runs || 0), 10)
  const successfulRuns = Number.parseInt(
    String(aggregateRow?.successful_runs || 0),
    10
  )
  const failedRuns = Number.parseInt(String(aggregateRow?.failed_runs || 0), 10)
  const processingRuns = Number.parseInt(
    String(processingRow?.count || 0),
    10
  )
  const avgDurationMs = Number(
    Number.isFinite(Number(aggregateRow?.avg_duration_ms))
      ? Number(aggregateRow?.avg_duration_ms)
      : 0
  )

  res.json({
    feed_source: {
      id: feedSource.id,
      name: feedSource.name,
    },
    window_days: windowDays,
    metrics: {
      total_runs: totalRuns,
      successful_runs: successfulRuns,
      failed_runs: failedRuns,
      processing_runs: processingRuns,
      success_rate: totalRuns ? Number((successfulRuns / totalRuns).toFixed(4)) : 0,
      avg_duration_ms: Math.round(avgDurationMs),
    },
    latest_run: latestRun || null,
    trend: (trendRows || []).map((row: any) => ({
      day:
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day),
      total_runs: Number.parseInt(String(row.total_runs || 0), 10),
      successful_runs: Number.parseInt(String(row.successful_runs || 0), 10),
      failed_runs: Number.parseInt(String(row.failed_runs || 0), 10),
    })),
  })
}
