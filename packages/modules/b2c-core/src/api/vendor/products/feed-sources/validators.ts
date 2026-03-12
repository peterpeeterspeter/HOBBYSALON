import { z } from 'zod'

import { createFindParams } from '@medusajs/medusa/api/utils/validators'

const FeedProvider = z.enum([
  'custom_csv',
  'custom_json',
  'woocommerce',
  'shopify',
])

const FeedMethod = z.enum(['GET', 'POST'])

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const toOptionalBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }

  return value
}, z.boolean().optional())

const FeedFieldMapping = z
  .object({
    sku: z.string().min(1).optional(),
    price_amount: z.string().min(1).optional(),
    price_currency: z.string().min(1).optional(),
    stocked_quantity: z.string().min(1).optional(),
    incoming_quantity: z.string().min(1).optional(),
    location_id: z.string().min(1).optional(),
  })
  .strict()

export type VendorGetFeedSourcesParamsType = z.infer<
  typeof VendorGetFeedSourcesParams
>
export const VendorGetFeedSourcesParams = createFindParams({
  offset: 0,
  limit: 20,
}).extend({
  provider: FeedProvider.optional(),
  active: toOptionalBoolean,
  q: z.preprocess(toOptionalTrimmedString, z.string().optional()),
})

export type VendorCreateFeedSourceType = z.infer<typeof VendorCreateFeedSource>
export const VendorCreateFeedSource = z
  .object({
    name: z.preprocess(
      toOptionalTrimmedString,
      z.string().min(1, 'name is required')
    ),
    provider: FeedProvider.default('custom_csv'),
    url: z.preprocess(
      toOptionalTrimmedString,
      z.string().url('url must be a valid URL')
    ),
    method: FeedMethod.default('GET'),
    headers: z.record(z.string(), z.string()).optional(),
    mapping: FeedFieldMapping.optional(),
    default_currency: z
      .preprocess(
        (value) => {
          const parsed = toOptionalTrimmedString(value)
          if (typeof parsed === 'string') {
            return parsed.toLowerCase()
          }
          return parsed
        },
        z.string().regex(/^[a-z]{3}$/, 'default_currency must be a 3-letter code')
      )
      .optional(),
    default_location_id: z
      .preprocess(toOptionalTrimmedString, z.string().min(1))
      .optional(),
    active: z.boolean().optional().default(true),
  })
  .strict()

export type VendorUpdateFeedSourceType = z.infer<typeof VendorUpdateFeedSource>
export const VendorUpdateFeedSource = z
  .object({
    name: z.preprocess(toOptionalTrimmedString, z.string().min(1)).optional(),
    provider: FeedProvider.optional(),
    url: z.preprocess(toOptionalTrimmedString, z.string().url()).optional(),
    method: FeedMethod.optional(),
    headers: z.record(z.string(), z.string()).nullable().optional(),
    mapping: FeedFieldMapping.nullable().optional(),
    default_currency: z
      .preprocess(
        (value) => {
          const parsed = toOptionalTrimmedString(value)
          if (typeof parsed === 'string') {
            return parsed.toLowerCase()
          }
          return parsed
        },
        z.string().regex(/^[a-z]{3}$/)
      )
      .nullable()
      .optional(),
    default_location_id: z
      .preprocess(toOptionalTrimmedString, z.string().min(1))
      .nullable()
      .optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  })

export type VendorPullFeedSourceType = z.infer<typeof VendorPullFeedSource>
export const VendorPullFeedSource = z
  .object({
    limit: z.number().int().min(1).max(5000).optional(),
  })
  .strict()
