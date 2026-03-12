import { randomUUID } from 'node:crypto'

import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import {
  VendorCreateFeedSource,
  VendorCreateFeedSourceType,
  VendorGetFeedSourcesParams,
  VendorGetFeedSourcesParamsType,
} from '../../../../../../vendor/products/feed-sources/validators'
import {
  FeedSourceRow,
  serializeFeedSource,
} from '../../../../../../vendor/products/feed-sources/utils'

const assertMerchant = async (knex: any, sellerId: string) => {
  const seller = await knex('seller')
    .select('id', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Merchant ${sellerId} not found`)
  }
}

/**
 * @oas [get] /admin/platform/materials/merchants/{id}/feed-sources
 * operationId: "AdminListMerchantFeedSources"
 * summary: "List Merchant Feed Sources"
 * description: "Returns feed sources for a merchant seller."
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
  await assertMerchant(knex, sellerId)

  const parsed = VendorGetFeedSourcesParams.safeParse(req.query || {})
  const query = (parsed.success
    ? parsed.data
    : { offset: 0, limit: 20 }) as VendorGetFeedSourcesParamsType

  const offset = Number(query.offset) || 0
  const limit = Number(query.limit) || 20

  let baseQuery = knex('merchant_feed_source')
    .where('seller_id', sellerId)
    .whereNull('deleted_at')

  if (query.provider) {
    baseQuery = baseQuery.where('provider', query.provider)
  }
  if (query.active !== undefined) {
    baseQuery = baseQuery.where('active', query.active)
  }
  if (query.q) {
    const q = `%${query.q}%`
    baseQuery = baseQuery.where((qb: any) => {
      qb.whereILike('name', q).orWhereILike('url', q)
    })
  }

  const [{ count }] = await baseQuery
    .clone()
    .clearSelect()
    .clearOrder()
    .count('* as count')

  const rows = (await baseQuery
    .clone()
    .select('*')
    .orderBy('updated_at', 'desc')
    .offset(offset)
    .limit(limit)) as FeedSourceRow[]

  res.json({
    feed_sources: rows.map(serializeFeedSource),
    count: Number.parseInt(String(count || 0), 10),
    offset,
    limit,
  })
}

/**
 * @oas [post] /admin/platform/materials/merchants/{id}/feed-sources
 * operationId: "AdminCreateMerchantFeedSource"
 * summary: "Create Merchant Feed Source"
 * description: "Creates a feed source for a merchant seller."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: MedusaRequest<VendorCreateFeedSourceType>,
  res: MedusaResponse
) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellerId = String(req.params.id || '')
  await assertMerchant(knex, sellerId)

  const parsed = VendorCreateFeedSource.safeParse(req.body || {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    )
  }

  const payload = parsed.data
  const now = new Date()
  const id = `mfs_${randomUUID().replace(/-/g, '').slice(0, 24)}`

  await knex('merchant_feed_source').insert({
    id,
    seller_id: sellerId,
    name: payload.name,
    provider: payload.provider,
    url: payload.url,
    method: payload.method,
    headers: knex.raw('?::jsonb', [JSON.stringify(payload.headers || {})]),
    mapping: knex.raw('?::jsonb', [JSON.stringify(payload.mapping || {})]),
    default_currency: payload.default_currency || null,
    default_location_id: payload.default_location_id || null,
    active: payload.active ?? true,
    auto_pull_enabled: payload.auto_pull_enabled ?? false,
    pull_interval_minutes: payload.pull_interval_minutes ?? 60,
    last_sync_job_id: null,
    last_pulled_at: null,
    last_pull_status: null,
    last_error: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  })

  const created = (await knex('merchant_feed_source')
    .select('*')
    .where('id', id)
    .whereNull('deleted_at')
    .first()) as FeedSourceRow | undefined

  if (!created) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'Failed to retrieve created feed source'
    )
  }

  res.status(201).json({ feed_source: serializeFeedSource(created) })
}
