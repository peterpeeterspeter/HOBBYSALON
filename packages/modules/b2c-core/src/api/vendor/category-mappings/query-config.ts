export const vendorCategoryMappingsFields = [
  'id',
  'source_category',
  'source_category_normalized',
  'product_category_id',
  'confidence',
  'active',
  'created_at',
  'updated_at',
]

export const vendorCategoryMappingsQueryConfig = {
  list: {
    defaults: vendorCategoryMappingsFields,
    isList: true,
  },
  retrieve: {
    defaults: vendorCategoryMappingsFields,
    isList: false,
  },
}
