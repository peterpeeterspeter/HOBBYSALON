import { randomUUID } from 'node:crypto'

import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  toHandle,
} from '@medusajs/framework/utils'
import { createProductsWorkflow } from '@medusajs/medusa/core-flows'
import { z } from 'zod'

import { ensureSellerForCreatorRoutes } from '../../../../../../shared/platform/ensure-seller-for-creator-routes'
import { ensureSellerDefaultShippingProfile } from '../../../../../../shared/platform/ensure-seller-default-shipping-profile'

type ProductTypeRow = {
  id: string
}

const PRODUCT_CONDITION_VALUES = ['new', 'handmade', 'made_to_order', 'used'] as const

const CreateCreatorProductPayload = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().optional().nullable(),
  short_description: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  featured_image_url: z.string().trim().optional().nullable(),
  condition_type: z.enum(PRODUCT_CONDITION_VALUES).optional().nullable(),
  personalization_available: z.boolean().optional().default(false),
  estimated_dispatch_days: z.number().int().min(0).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  manage_inventory: z.boolean().optional().default(false),
  allow_backorder: z.boolean().optional().default(true),
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

const resolveDefaultSalesChannelId = async (
  scope: MedusaRequest['scope']
): Promise<string> => {
  const storeModule = scope.resolve(Modules.STORE)
  const [store] = await storeModule.listStores(
    {},
    { select: ['default_sales_channel_id'] }
  )

  if (store?.default_sales_channel_id) {
    return store.default_sales_channel_id
  }

  const salesChannelModule = scope.resolve(Modules.SALES_CHANNEL)
  const [defaultChannel] = await salesChannelModule.listSalesChannels(
    { name: 'Default Sales Channel' },
    { take: 1 }
  )

  if (defaultChannel?.id) {
    return defaultChannel.id
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    'Default sales channel is not configured.'
  )
}

const ensureCreatorSeller = ensureSellerForCreatorRoutes

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
  const salesChannelId = await resolveDefaultSalesChannelId(req.scope)
  const shippingProfileId = await ensureSellerDefaultShippingProfile(
    req.scope,
    sellerId
  )

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
  if (payload.condition_type !== undefined) {
    metadata.platform_condition_type = payload.condition_type
  }
  metadata.platform_personalization_available = !!payload.personalization_available
  if (payload.estimated_dispatch_days !== undefined) {
    metadata.platform_estimated_dispatch_days = payload.estimated_dispatch_days
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
          sales_channels: [{ id: salesChannelId }],
          ...(shippingProfileId
            ? { shipping_profile_id: shippingProfileId }
            : {}),
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
              allow_backorder: payload.allow_backorder,
              manage_inventory: payload.manage_inventory,
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
