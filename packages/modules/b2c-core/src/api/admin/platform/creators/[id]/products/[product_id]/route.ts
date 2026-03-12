import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  toHandle,
} from '@medusajs/framework/utils'
import {
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from '@medusajs/medusa/core-flows'
import { z } from 'zod'

import { SellerType } from '@mercurjs/framework'

type SellerRow = {
  id: string
  seller_type: string | null
}

type ProductTypeRow = {
  id: string
}

const UpdateCreatorProductPayload = z.object({
  title: z.string().trim().min(1).optional(),
  slug: z.string().trim().optional().nullable(),
  short_description: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  featured_image_url: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional(),
  price_cents: z.number().int().min(0).optional(),
  currency_code: z.string().trim().optional(),
  platform_creator_id: z.string().uuid().optional(),
  platform_domain_id: z.string().uuid().optional().nullable(),
  platform_category_id: z.string().uuid().optional().nullable(),
})

const normalizeNullable = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const resolveHandmadeTypeId = async (
  knex: any
): Promise<string> => {
  const productType = (await knex('product_type')
    .select('id')
    .where('value', 'handmade')
    .whereNull('deleted_at')
    .first()) as ProductTypeRow | undefined

  if (!productType?.id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Product type "handmade" is not configured.'
    )
  }

  return productType.id
}

const ensureCreatorSeller = async (
  knex: any,
  sellerId: string
): Promise<void> => {
  const seller = (await knex('seller')
    .select('id', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()) as SellerRow | undefined

  if (!seller || seller.seller_type !== SellerType.CREATOR) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Creator seller ${sellerId} not found`
    )
  }
}

const ensureSellerOwnsProduct = async (
  knex: any,
  sellerId: string,
  productId: string
): Promise<void> => {
  const linked = await knex('seller_seller_product_product')
    .select('seller_id')
    .where('seller_id', sellerId)
    .where('product_id', productId)
    .whereNull('deleted_at')
    .first()

  if (!linked) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product ${productId} not found for creator seller ${sellerId}`
    )
  }
}

/**
 * @oas [post] /admin/platform/creators/{id}/products/{product_id}
 * operationId: "AdminUpdateCreatorProduct"
 * summary: "Update Creator Product"
 * description: "Updates a Medusa product owned by a creator seller and refreshes platform projection metadata."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = UpdateCreatorProductPayload.safeParse(req.body || {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    )
  }

  const payload = parsed.data
  const sellerId = req.params.id
  const productId = req.params.product_id

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  await ensureCreatorSeller(knex, sellerId)
  await ensureSellerOwnsProduct(knex, sellerId, productId)
  const handmadeTypeId = await resolveHandmadeTypeId(knex)

  const {
    data: [existingProduct],
  } = await query.graph({
    entity: 'product',
    fields: ['id', 'metadata', 'variants.id'],
    filters: { id: productId },
  })

  if (!existingProduct?.id) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product ${productId} not found`
    )
  }

  const existingMetadata =
    existingProduct.metadata &&
    typeof existingProduct.metadata === 'object' &&
    !Array.isArray(existingProduct.metadata)
      ? (existingProduct.metadata as Record<string, unknown>)
      : {}

  const metadata: Record<string, unknown> = {
    ...existingMetadata,
    platform_product_type: 'handmade',
  }

  if (payload.platform_creator_id) {
    metadata.platform_creator_id = payload.platform_creator_id
  }
  if (payload.platform_domain_id !== undefined) {
    metadata.platform_domain_id = payload.platform_domain_id
  }
  if (payload.platform_category_id !== undefined) {
    metadata.platform_category_id = payload.platform_category_id
  }

  const update: Record<string, unknown> = {
    type_id: handmadeTypeId,
    metadata,
  }

  if (payload.title) {
    update.title = payload.title.trim()
  }

  if (payload.short_description !== undefined) {
    update.subtitle = normalizeNullable(payload.short_description) ?? undefined
  }

  if (payload.description !== undefined) {
    update.description = normalizeNullable(payload.description) ?? undefined
  }

  if (payload.slug !== undefined) {
    const normalized = normalizeNullable(payload.slug)
    update.handle = normalized ? toHandle(normalized) : undefined
  }

  if (payload.featured_image_url !== undefined) {
    const featuredImageUrl = normalizeNullable(payload.featured_image_url)
    update.images = featuredImageUrl ? [{ url: featuredImageUrl }] : []
  }

  if (payload.is_active !== undefined) {
    update.status = payload.is_active ? 'published' : 'draft'
  }

  const { result } = await updateProductsWorkflow(req.scope).run({
    input: {
      update,
      selector: { id: productId },
    },
  })

  if (payload.price_cents !== undefined) {
    const firstVariantId = existingProduct.variants?.[0]?.id
    if (!firstVariantId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No variant found for product ${productId}`
      )
    }

    const currencyCode =
      normalizeNullable(payload.currency_code)?.toLowerCase() || 'eur'
    await updateProductVariantsWorkflow.run({
      container: req.scope,
      input: {
        selector: { id: firstVariantId, product_id: productId },
        update: {
          prices: [
            {
              currency_code: currencyCode,
              amount: payload.price_cents,
            },
          ],
        },
      },
    })
  }

  const updated = result?.[0]
  res.json({
    product: {
      id: updated?.id ?? productId,
      status: updated?.status ?? (payload.is_active ? 'published' : undefined),
      seller_id: sellerId,
    },
  })
}
