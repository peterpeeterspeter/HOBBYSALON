import { Knex } from 'knex'

export type CategoryMappingRow = {
  id: string
  seller_id: string
  source_category: string
  source_category_normalized: string
  product_category_id: string
  confidence: number | null
  active: boolean
  created_at: Date | string
  updated_at: Date | string
  domain_name: string | null
  domain_handle: string | null
}

export const normalizeSourceCategory = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

export const createMappingSelectQuery = (knex: Knex) =>
  knex('merchant_category_mapping as m')
    .leftJoin('product_category as pc', 'm.product_category_id', 'pc.id')
    .select(
      'm.id',
      'm.seller_id',
      'm.source_category',
      'm.source_category_normalized',
      'm.product_category_id',
      'm.confidence',
      'm.active',
      'm.created_at',
      'm.updated_at',
      'pc.name as domain_name',
      'pc.handle as domain_handle'
    )

export const serializeCategoryMapping = (row: CategoryMappingRow) => ({
  id: row.id,
  seller_id: row.seller_id,
  source_category: row.source_category,
  source_category_normalized: row.source_category_normalized,
  domain_id: row.product_category_id,
  confidence: row.confidence,
  active: row.active,
  created_at: row.created_at,
  updated_at: row.updated_at,
  domain: {
    id: row.product_category_id,
    name: row.domain_name,
    handle: row.domain_handle,
  },
})
