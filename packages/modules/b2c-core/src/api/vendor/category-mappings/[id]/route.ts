import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils'
import { Knex } from 'knex'

import { fetchSellerByAuthActorId } from '../../../../shared/infra/http/utils'
import { VendorUpdateCategoryMappingType } from '../validators'
import {
  createMappingSelectQuery,
  normalizeSourceCategory,
  serializeCategoryMapping,
  type CategoryMappingRow,
} from '../utils'

const getOwnedMapping = async (
  knex: Knex,
  id: string,
  sellerId: string
): Promise<CategoryMappingRow | undefined> => {
  return (await createMappingSelectQuery(knex)
    .where('m.id', id)
    .where('m.seller_id', sellerId)
    .whereNull('m.deleted_at')
    .first()) as CategoryMappingRow | undefined
}

/**
 * @oas [get] /vendor/category-mappings/{id}
 * operationId: "VendorGetCategoryMapping"
 * summary: "Get Category Mapping"
 * description: "Retrieves a category-to-domain mapping by ID for the authenticated vendor."
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

  const row = await getOwnedMapping(knex, req.params.id, seller.id)
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Category mapping not found')
  }

  res.json({ category_mapping: serializeCategoryMapping(row) })
}

/**
 * @oas [put] /vendor/category-mappings/{id}
 * operationId: "VendorUpdateCategoryMapping"
 * summary: "Update Category Mapping"
 * description: "Updates a category-to-domain mapping for the authenticated vendor."
 * x-authenticated: true
 * tags:
 *   - Vendor Category Mappings
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const PUT = async (
  req: AuthenticatedMedusaRequest<VendorUpdateCategoryMappingType>,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { id } = req.params

  const existing = await getOwnedMapping(knex, id, seller.id)
  if (!existing) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Category mapping not found')
  }

  const updates = req.validatedBody
  if (updates.domain_id) {
    const domain = await knex('product_category')
      .select('id')
      .where('id', updates.domain_id)
      .whereNull('deleted_at')
      .first()

    if (!domain) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Domain category ${updates.domain_id} was not found`
      )
    }
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date(),
  }

  if (updates.source_category !== undefined) {
    updatePayload.source_category = updates.source_category
    updatePayload.source_category_normalized = normalizeSourceCategory(
      updates.source_category
    )
  }
  if (updates.domain_id !== undefined) {
    updatePayload.product_category_id = updates.domain_id
  }
  if (updates.confidence !== undefined) {
    updatePayload.confidence = updates.confidence
  }
  if (updates.active !== undefined) {
    updatePayload.active = updates.active
  }

  try {
    await knex('merchant_category_mapping')
      .where('id', id)
      .where('seller_id', seller.id)
      .whereNull('deleted_at')
      .update(updatePayload)
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `A mapping for source category "${updates.source_category}" already exists`
      )
    }
    throw error
  }

  const updated = await getOwnedMapping(knex, id, seller.id)
  if (!updated) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'Failed to retrieve updated category mapping'
    )
  }

  res.json({ category_mapping: serializeCategoryMapping(updated) })
}

/**
 * @oas [delete] /vendor/category-mappings/{id}
 * operationId: "VendorDeleteCategoryMapping"
 * summary: "Delete Category Mapping"
 * description: "Soft deletes a category-to-domain mapping for the authenticated vendor."
 * x-authenticated: true
 * tags:
 *   - Vendor Category Mappings
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { id } = req.params

  const row = await getOwnedMapping(knex, id, seller.id)
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Category mapping not found')
  }

  await knex('merchant_category_mapping')
    .where('id', id)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    })

  res.status(200).json({
    id,
    object: 'category_mapping',
    deleted: true,
  })
}
