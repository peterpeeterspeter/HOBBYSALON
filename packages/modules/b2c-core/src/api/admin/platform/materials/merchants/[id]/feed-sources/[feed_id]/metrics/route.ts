import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

const DEFAULT_WINDOW_DAYS = 14
const MIN_WINDOW_DAYS = 1
const MAX_WINDOW_DAYS = 90

const toWindowDays = (raw: unknown) => {
  if (typeof raw !== 'string') return DEFAULT_WINDOW_DAYS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_WINDOW_DAYS
  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, parsed))
}

/**
 * @oas [get] /admin/platform/materials/merchants/{id}/feed-sources/{feed_id}/metrics
 * operationId: "AdminGetMerchantFeedSourceMetrics"
 * summary: "Get Merchant Feed Source Metrics"
 * description: "Returns run metrics and trend data for a merchant feed source."
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
    .select('id', 'name')
    .where('id', feedId)
    .where('seller_id', sellerId)
    .whereNull('deleted_at')
    .first()
  if (!feedSource) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Feed source ${feedId} not found`)
  }

  const windowDays = toWindowDays(req.query?.window_days)
  const now = new Date()
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const baseQuery = knex('merchant_feed_pull_run')
    .where('seller_id', sellerId)
    .where('feed_source_id', feedId)
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
        knex.raw("sum(case when status = 'failed' then 1 else 0 end)::int as failed_runs"),
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
        knex.raw("sum(case when status = 'failed' then 1 else 0 end)::int as failed_runs")
      )
      .groupByRaw("date_trunc('day', started_at)::date")
      .orderBy('day', 'asc'),
    knex('merchant_feed_pull_run')
      .where('seller_id', sellerId)
      .where('feed_source_id', feedId)
      .where('status', 'processing')
      .whereNull('deleted_at')
      .count('* as count')
      .first(),
  ])

  const totalRuns = Number.parseInt(String(aggregateRow?.total_runs || 0), 10)
  const successfulRuns = Number.parseInt(String(aggregateRow?.successful_runs || 0), 10)
  const failedRuns = Number.parseInt(String(aggregateRow?.failed_runs || 0), 10)
  const processingRuns = Number.parseInt(String(processingRow?.count || 0), 10)
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
      day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
      total_runs: Number.parseInt(String(row.total_runs || 0), 10),
      successful_runs: Number.parseInt(String(row.successful_runs || 0), 10),
      failed_runs: Number.parseInt(String(row.failed_runs || 0), 10),
    })),
  })
}
