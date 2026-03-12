import { randomUUID } from 'node:crypto'

import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../shared/infra/http/utils'
import {
  VendorCreateFeedSourceType,
  VendorGetFeedSourcesParamsType,
} from './validators'
import { FeedSourceRow, serializeFeedSource } from './utils'

const assertMerchantSeller = async (
  actorId: string,
  scope: AuthenticatedMedusaRequest['scope']
) => {
  const seller = await fetchSellerByAuthActorId(actorId, scope, [
    'id',
    'seller_type',
  ])

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Feed sources are only available for merchant sellers'
    )
  }

  return seller
}

/**
 * @oas [get] /vendor/products/feed-sources
 * operationId: "VendorListFeedSources"
 * summary: "List Product Feed Sources"
 * description: "Retrieves product feed sources for the authenticated merchant."
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
  const seller = await assertMerchantSeller(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const validatedQuery = req.validatedQuery as VendorGetFeedSourcesParamsType

  const offset = Number(validatedQuery.offset) || 0
  const limit = Number(validatedQuery.limit) || 20

  let baseQuery = knex('merchant_feed_source')
    .where('seller_id', seller.id)
    .whereNull('deleted_at')

  if (validatedQuery.provider) {
    baseQuery = baseQuery.where('provider', validatedQuery.provider)
  }

  if (validatedQuery.active !== undefined) {
    baseQuery = baseQuery.where('active', validatedQuery.active)
  }

  if (validatedQuery.q) {
    const q = `%${validatedQuery.q}%`
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
 * @oas [post] /vendor/products/feed-sources
 * operationId: "VendorCreateFeedSource"
 * summary: "Create Product Feed Source"
 * description: "Creates a product feed source configuration for the authenticated merchant."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<VendorCreateFeedSourceType>,
  res: MedusaResponse
) => {
  const seller = await assertMerchantSeller(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const now = new Date()
  const id = `mfs_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const payload = req.validatedBody

  await knex('merchant_feed_source').insert({
    id,
    seller_id: seller.id,
    name: payload.name,
    provider: payload.provider,
    url: payload.url,
    method: payload.method,
    headers: knex.raw('?::jsonb', [JSON.stringify(payload.headers || {})]),
    mapping: knex.raw('?::jsonb', [JSON.stringify(payload.mapping || {})]),
    default_currency: payload.default_currency || null,
    default_location_id: payload.default_location_id || null,
    active: payload.active ?? true,
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
