import { z } from 'zod'

const detailsSchema = z
  .object({
    icon: z.string().nullable().optional(),
    banner: z.string().nullable().optional(),
    thumbnail: z.string().nullable().optional(),
    rank: z.number().nullable().optional()
  })
  .partial()

const productSchema = z.object({
  product_id: z.string()
})

const productCategorySchema = z.object({
  name: z.string(),
  handle: z.string(),
  description: z.string().optional(),
  parent_category_id: z.string().nullable().optional(),
  details: detailsSchema.optional()
})

const productCollectionSchema = z.object({
  title: z.string(),
  handle: z.string(),
  details: detailsSchema.optional()
})

const productCollectionUpdateSchema = z.object({
  collection_id: z.string(),
  title: z.string().optional(),
  handle: z.string().optional()
})

const reviewRemoveSchema = z.object({
  review_id: z.string(),
  reason: z.string().optional()
})

const productTypeSchema = z.object({
  value: z.string(),
  metadata: z.record(z.unknown()).nullish()
})

const productTagSchema = z.object({
  value: z.string(),
  metadata: z.record(z.unknown()).nullish()
})

const productUpdateSchema = z
  .object({
    product_id: z.string()
  })
  .passthrough()

const sellerCreationSchema = z.object({
  member: z.record(z.unknown()),
  seller: z.record(z.unknown()),
  auth_identity_id: z.string()
})

const schemaByType = {
  product: productSchema,
  product_category: productCategorySchema,
  product_collection: productCollectionSchema,
  product_collection_update: productCollectionUpdateSchema,
  review_remove: reviewRemoveSchema,
  product_type: productTypeSchema,
  product_tag: productTagSchema,
  product_update: productUpdateSchema,
  seller: sellerCreationSchema
} as const

export type KnownRequestType = keyof typeof schemaByType

const unknownPayloadSchema = z.record(z.unknown())

export const parseRequestDataForType = (
  type: string,
  data: unknown
): Record<string, unknown> => {
  const schema = (schemaByType as Record<string, z.ZodType<unknown>>)[type]
  const parsedData = schema ? schema.parse(data) : unknownPayloadSchema.parse(data)

  return unknownPayloadSchema.parse(parsedData)
}

export const parseProductRequestData = (data: unknown) =>
  productSchema.parse(data)

export const parseProductCategoryRequestData = (data: unknown) =>
  productCategorySchema.parse(data)

export const parseProductCollectionRequestData = (data: unknown) =>
  productCollectionSchema.parse(data)

export const parseProductCollectionUpdateRequestData = (data: unknown) =>
  productCollectionUpdateSchema.parse(data)

export const parseReviewRemoveRequestData = (data: unknown) =>
  reviewRemoveSchema.parse(data)

export const parseProductTypeRequestData = (data: unknown) =>
  productTypeSchema.parse(data)

export const parseProductTagRequestData = (data: unknown) =>
  productTagSchema.parse(data)

export const parseProductUpdateRequestData = (data: unknown) =>
  productUpdateSchema.parse(data)

export const parseSellerCreationRequestData = (data: unknown) =>
  sellerCreationSchema.parse(data)
