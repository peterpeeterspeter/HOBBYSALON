import { randomUUID } from 'node:crypto'

import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { normalizeSourceCategory } from '../../../../../../vendor/category-mappings/utils'

type CreateMappingBody = {
  source_category?: string
  domain_id?: string
  confidence?: number
  active?: boolean
}

/**
 * @oas [post] /admin/platform/materials/merchants/{id}/category-mappings
 * operationId: "AdminCreateMerchantCategoryMapping"
 * summary: "Create Merchant Category Mapping"
 * description: "Creates a category mapping for a merchant seller."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: MedusaRequest<CreateMappingBody>,
  res: MedusaResponse
) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellerId = String(req.params.id || '')
  const body = (req.body || {}) as CreateMappingBody

  const sourceCategory = String(body.source_category || '').trim()
  const domainId = String(body.domain_id || '').trim()
  const confidence =
    body.confidence === undefined || body.confidence === null
      ? null
      : Number(body.confidence)
  const active = body.active ?? true

  if (!sourceCategory) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'source_category is required')
  }

  if (!domainId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'domain_id is required')
  }

  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'confidence must be between 0 and 1'
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

  const category = await knex('product_category')
    .select('id')
    .where('id', domainId)
    .whereNull('deleted_at')
    .first()

  if (!category) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `domain_id ${domainId} not found`)
  }

  const id = `mcm_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const now = new Date()

  try {
    await knex('merchant_category_mapping').insert({
      id,
      seller_id: sellerId,
      source_category: sourceCategory,
      source_category_normalized: normalizeSourceCategory(sourceCategory),
      product_category_id: domainId,
      confidence,
      active,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `A mapping for source category "${sourceCategory}" already exists`
      )
    }
    throw error
  }

  const created = await knex('merchant_category_mapping')
    .select('*')
    .where('id', id)
    .first()

  res.status(201).json({
    category_mapping: created,
  })
}
