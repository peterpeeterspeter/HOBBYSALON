import { z } from 'zod'

import { createFindParams } from '@medusajs/medusa/api/utils/validators'

import { PRODUCT_SYNC_JOB_STATUSES } from './constants'

const toTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) {
      return undefined
    }
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : value
  }

  return value
}

const toOptionalInteger = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : value
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) {
      return undefined
    }
    const parsed = Number.parseInt(normalized, 10)
    return Number.isInteger(parsed) ? parsed : value
  }

  return value
}

const ProductSyncUpdate = z
  .object({
    sku: z.preprocess(
      toTrimmedString,
      z.string().min(1, 'sku is required')
    ),
    price_amount: z
      .preprocess(toOptionalNumber, z.number().min(0))
      .optional(),
    price_currency: z
      .preprocess(
        (value) => {
          const parsed = toTrimmedString(value)
          if (typeof parsed === 'string') {
            return parsed.toLowerCase()
          }
          return parsed
        },
        z.string().regex(/^[a-z]{3}$/, 'price_currency must be a 3-letter code')
      )
      .optional(),
    stocked_quantity: z
      .preprocess(toOptionalInteger, z.number().int().min(0))
      .optional(),
    incoming_quantity: z
      .preprocess(toOptionalInteger, z.number().int().min(0))
      .optional(),
    location_id: z.preprocess(toTrimmedString, z.string().min(1)).optional(),
    external_reference: z
      .preprocess(toTrimmedString, z.string().min(1))
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasPrice = value.price_amount !== undefined
    const hasInventory =
      value.stocked_quantity !== undefined ||
      value.incoming_quantity !== undefined

    if (!hasPrice && !hasInventory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Each update must include at least one change: price_amount, stocked_quantity, or incoming_quantity',
      })
    }

    if (hasPrice && !value.price_currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price_currency'],
        message: 'price_currency is required when price_amount is provided',
      })
    }

    if (hasInventory && !value.location_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['location_id'],
        message:
          'location_id is required when stocked_quantity or incoming_quantity is provided',
      })
    }
  })

export type VendorProductSyncUpdateType = z.infer<typeof ProductSyncUpdate>

export type VendorStartProductSyncType = z.infer<typeof VendorStartProductSync>
export const VendorStartProductSync = z
  .object({
    updates: z.array(ProductSyncUpdate).min(1).max(5000),
  })
  .strict()

export type VendorGetProductSyncJobsParamsType = z.infer<
  typeof VendorGetProductSyncJobsParams
>
export const VendorGetProductSyncJobsParams = createFindParams({
  offset: 0,
  limit: 20,
}).extend({
  status: z.enum(PRODUCT_SYNC_JOB_STATUSES).optional(),
})
