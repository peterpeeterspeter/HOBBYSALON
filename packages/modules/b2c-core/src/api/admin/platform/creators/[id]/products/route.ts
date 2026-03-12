import { randomUUID } from 'node:crypto'

import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  toHandle,
} from '@medusajs/framework/utils'
import { createProductsWorkflow } from '@medusajs/medusa/core-flows'
import { z } from 'zod'

import { SellerType } from '@mercurjs/framework'

type SellerRow = {
  id: string
  seller_type: string | null
}

type ProductTypeRow = {
  id: string
}

const CreateCreatorProductPayload = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().optional().nullable(),
  short_description: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  featured_image_url: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional().default(true),
  price_cents: z.number().int().min(0).optional().default(0),
  currency_code: z.string().trim().optional().default('EUR'),
  platform_creator_id: z.string().uuid(),
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
): Promise<SellerRow> => {
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

  return seller
}

/**
 * @oas [post] /admin/platform/creators/{id}/products
 * operationId: "AdminCreateCreatorProduct"
 * summary: "Create Creator Product"
 * description: "Creates a Medusa product for a creator seller and tags it for platform projection."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = CreateCreatorProductPayload.safeParse(req.body || {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    )
  }

  const sellerId = req.params.id
  const payload = parsed.data
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  await ensureCreatorSeller(knex, sellerId)
  const handmadeTypeId = await resolveHandmadeTypeId(knex)

  const normalizedTitle = payload.title.trim()
  const normalizedSlug = normalizeNullable(payload.slug)
  const handleBase = normalizedSlug || normalizedTitle || `handmade-${randomUUID().slice(0, 8)}`
  const handle =
    toHandle(handleBase) ||
    `handmade-${randomUUID().slice(0, 8)}`
  const shortDescription = normalizeNullable(payload.short_description)
  const description = normalizeNullable(payload.description)
  const featuredImageUrl = normalizeNullable(payload.featured_image_url)
  const currencyCode = (payload.currency_code || 'EUR').trim().toLowerCase()

  const metadata: Record<string, unknown> = {
    platform_product_type: 'handmade',
    platform_creator_id: payload.platform_creator_id,
  }

  if (payload.platform_domain_id) {
    metadata.platform_domain_id = payload.platform_domain_id
  }
  if (payload.platform_category_id) {
    metadata.platform_category_id = payload.platform_category_id
  }

  const { result } = await createProductsWorkflow.run({
    container: req.scope,
    input: {
      products: [
        {
          title: normalizedTitle,
          subtitle: shortDescription ?? undefined,
          description: description ?? undefined,
          handle,
          status: payload.is_active ? 'published' : 'draft',
          type_id: handmadeTypeId,
          metadata,
          images: featuredImageUrl ? [{ url: featuredImageUrl }] : undefined,
          options: [
            {
              title: 'Variant',
              values: ['Default'],
            },
          ],
          variants: [
            {
              title: 'Default',
              sku: handle,
              allow_backorder: true,
              manage_inventory: false,
              options: {
                Variant: 'Default',
              },
              prices: [
                {
                  currency_code: currencyCode,
                  amount: payload.price_cents,
                },
              ],
            },
          ],
        },
      ],
      additional_data: {
        seller_id: sellerId,
      },
    },
  })

  const created = result?.[0]
  if (!created?.id) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'Creator product was not created.'
    )
  }

  res.status(201).json({
    product: {
      id: created.id,
      handle: created.handle,
      status: created.status,
      seller_id: sellerId,
    },
  })
}
