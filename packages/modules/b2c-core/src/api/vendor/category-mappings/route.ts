import { randomUUID } from 'node:crypto'

import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../shared/infra/http/utils'
import {
  VendorCreateCategoryMappingType,
  VendorGetCategoryMappingsParamsType,
} from './validators'
import {
  createMappingSelectQuery,
  normalizeSourceCategory,
  serializeCategoryMapping,
  type CategoryMappingRow,
} from './utils'

/**
 * @oas [get] /vendor/category-mappings
 * operationId: "VendorListCategoryMappings"
 * summary: "List Category Mappings"
 * description: "Retrieves category-to-domain mappings for the authenticated vendor."
 * x-authenticated: true
 * tags:
 *   - Vendor Category Mappings
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const validatedQuery = req.validatedQuery as VendorGetCategoryMappingsParamsType

  const offset = Number(validatedQuery.offset) || 0
  const limit = Number(validatedQuery.limit) || 50

  let baseQuery = createMappingSelectQuery(knex)
    .where('m.seller_id', seller.id)
    .whereNull('m.deleted_at')

  if (validatedQuery.active !== undefined) {
    baseQuery = baseQuery.where('m.active', validatedQuery.active)
  }

  if (validatedQuery.domain_id) {
    baseQuery = baseQuery.where('m.product_category_id', validatedQuery.domain_id)
  }

  if (validatedQuery.source_category) {
    baseQuery = baseQuery.whereILike(
      'm.source_category',
      `%${validatedQuery.source_category}%`
    )
  }

  if (validatedQuery.q) {
    const q = `%${validatedQuery.q}%`
    baseQuery = baseQuery.andWhere((queryBuilder) => {
      queryBuilder
        .whereILike('m.source_category', q)
        .orWhereILike('pc.name', q)
        .orWhereILike('pc.handle', q)
    })
  }

  const [{ count }] = await baseQuery
    .clone()
    .clearSelect()
    .clearOrder()
    .countDistinct('m.id as count')

  const rows = (await baseQuery
    .orderBy('m.updated_at', 'desc')
    .offset(offset)
    .limit(limit)) as CategoryMappingRow[]

  res.json({
    category_mappings: rows.map(serializeCategoryMapping),
    count: Number.parseInt(String(count || 0), 10),
    offset,
    limit,
  })
}

/**
 * @oas [post] /vendor/category-mappings
 * operationId: "VendorCreateCategoryMapping"
 * summary: "Create Category Mapping"
 * description: "Creates a mapping from a seller source category to a platform domain category."
 * x-authenticated: true
 * tags:
 *   - Vendor Category Mappings
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<VendorCreateCategoryMappingType>,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { source_category, domain_id, confidence, active } = req.validatedBody
  const sourceCategoryNormalized = normalizeSourceCategory(source_category)

  const domain = await knex('product_category')
    .select('id')
    .where('id', domain_id)
    .whereNull('deleted_at')
    .first()

  if (!domain) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Domain category ${domain_id} was not found`
    )
  }

  const id = `mcm_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const now = new Date()

  try {
    await knex('merchant_category_mapping').insert({
      id,
      seller_id: seller.id,
      source_category,
      source_category_normalized: sourceCategoryNormalized,
      product_category_id: domain_id,
      confidence: confidence ?? null,
      active: active ?? true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `A mapping for source category "${source_category}" already exists`
      )
    }
    throw error
  }

  const row = (await createMappingSelectQuery(knex)
    .where('m.id', id)
    .first()) as CategoryMappingRow | undefined

  if (!row) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'Failed to retrieve created category mapping'
    )
  }

  res.status(201).json({ category_mapping: serializeCategoryMapping(row) })
}
