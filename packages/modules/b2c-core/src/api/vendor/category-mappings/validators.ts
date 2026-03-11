import { z } from 'zod'

import { createFindParams } from '@medusajs/medusa/api/utils/validators'

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

export type VendorGetCategoryMappingsParamsType = z.infer<
  typeof VendorGetCategoryMappingsParams
>
export const VendorGetCategoryMappingsParams = createFindParams({
  offset: 0,
  limit: 50,
}).extend({
  q: z.preprocess(toOptionalTrimmedString, z.string().optional()),
  source_category: z.preprocess(
    toOptionalTrimmedString,
    z.string().optional()
  ),
  domain_id: z.preprocess(toOptionalTrimmedString, z.string().optional()),
  active: toOptionalBoolean,
})

export type VendorCreateCategoryMappingType = z.infer<
  typeof VendorCreateCategoryMapping
>
export const VendorCreateCategoryMapping = z
  .object({
    source_category: z.preprocess(
      toOptionalTrimmedString,
      z.string().min(1, 'source_category is required')
    ),
    domain_id: z.preprocess(
      toOptionalTrimmedString,
      z.string().min(1, 'domain_id is required')
    ),
    confidence: z.number().min(0).max(1).optional(),
    active: z.boolean().optional().default(true),
  })
  .strict()

export type VendorUpdateCategoryMappingType = z.infer<
  typeof VendorUpdateCategoryMapping
>
export const VendorUpdateCategoryMapping = z
  .object({
    source_category: z.preprocess(toOptionalTrimmedString, z.string().min(1)).optional(),
    domain_id: z.preprocess(toOptionalTrimmedString, z.string().min(1)).optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  })
