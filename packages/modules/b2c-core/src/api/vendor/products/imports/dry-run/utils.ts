import { z } from 'zod'

import { CreateProduct } from '../../validators'
import {
  ImportMapping,
  isMedusaTemplateCsv,
  normalizeProductList,
} from '../normalize'

export const VendorImportDryRunMapping = z
  .object({
    title: z.string().min(1).optional(),
    subtitle: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    thumbnail: z.string().min(1).optional(),
    handle: z.string().min(1).optional(),
    external_id: z.string().min(1).optional(),
    type_id: z.string().min(1).optional(),
    collection_id: z.string().min(1).optional(),
    source_category: z.string().min(1).optional(),
    category_id: z.string().min(1).optional(),
    tag_ids: z.string().min(1).optional(),
    sales_channel_ids: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    weight: z.string().min(1).optional(),
    length: z.string().min(1).optional(),
    height: z.string().min(1).optional(),
    width: z.string().min(1).optional(),
    material: z.string().min(1).optional(),
    origin_country: z.string().min(1).optional(),
    variant_title: z.string().min(1).optional(),
    variant_sku: z.string().min(1).optional(),
    variant_ean: z.string().min(1).optional(),
    variant_upc: z.string().min(1).optional(),
    variant_barcode: z.string().min(1).optional(),
    variant_hs_code: z.string().min(1).optional(),
    variant_mid_code: z.string().min(1).optional(),
    variant_material: z.string().min(1).optional(),
    variant_origin_country: z.string().min(1).optional(),
    price_amount: z.string().min(1).optional(),
    price_currency: z.string().min(1).optional(),
    option_name: z.string().min(1).optional(),
    option_value: z.string().min(1).optional(),
    row_type: z.string().min(1).optional(),
    parent_ref: z.string().min(1).optional(),
  })
  .strict()

export type VendorImportDryRunMappingType = z.infer<
  typeof VendorImportDryRunMapping
>

export type VendorImportDryRunError = {
  row: number
  field?: string
  message: string
}

export type VendorImportDryRunPreviewItem = {
  row: number
  title: string
  status: 'draft' | 'proposed'
  source_category?: string
  domain_id?: string
  sku?: string
  price_amount?: number
  price_currency?: string
  variant_count?: number
}

export type VendorImportDryRunResult = {
  total_count: number
  valid_count: number
  error_count: number
  error_issue_count: number
  unmapped_count: number
  product_count: number
  delimiter: string
  columns: string[]
  errors: VendorImportDryRunError[]
  warnings: VendorImportDryRunError[]
  preview: VendorImportDryRunPreviewItem[]
}

type DryRunOptions = {
  fileContent: string
  mapping?: VendorImportDryRunMappingType
  delimiter?: string
  defaultCurrencyCode?: string
  sourceCategoryDomainMap?: Record<string, string>
}

const formatZodErrors = (
  rowNumber: number,
  issues: z.ZodIssue[]
): VendorImportDryRunError[] =>
  issues.map((issue) => ({
    row: rowNumber,
    field: issue.path.map(String).join('.') || undefined,
    message: issue.message,
  }))

/**
 * Validates a product list exactly as the real import will process it
 * (same normalizer), and reports row-level errors and warnings.
 */
export const runVendorProductsImportDryRun = ({
  fileContent,
  mapping,
  delimiter,
  defaultCurrencyCode = 'eur',
  sourceCategoryDomainMap,
}: DryRunOptions): VendorImportDryRunResult => {
  if (isMedusaTemplateCsv(fileContent)) {
    return {
      total_count: 0,
      valid_count: 0,
      error_count: 0,
      error_issue_count: 0,
      unmapped_count: 0,
      product_count: 0,
      delimiter: delimiter || ',',
      columns: [],
      errors: [],
      warnings: [
        {
          row: 1,
          message:
            'Medusa-importsjabloon herkend; dit formaat wordt rechtstreeks door Medusa gevalideerd tijdens de import.',
        },
      ],
      preview: [],
    }
  }

  const normalized = normalizeProductList({
    fileContent,
    mapping: mapping as ImportMapping | undefined,
    delimiter,
    defaultCurrencyCode,
    sourceCategoryDomainMap,
  })

  const errors: VendorImportDryRunError[] = [...normalized.errors]
  const extraErrorRows = new Set<number>()
  const preview: VendorImportDryRunPreviewItem[] = []
  let validRows = 0
  let productCount = 0

  for (const item of normalized.products) {
    const parsed = CreateProduct.safeParse(item.product)
    if (!parsed.success) {
      errors.push(...formatZodErrors(item.rows[0], parsed.error.issues))
      item.rows.forEach((r) => extraErrorRows.add(r))
      continue
    }
    productCount += 1
    validRows += item.rows.length
    if (preview.length < 20) {
      const variant = parsed.data.variants?.[0]
      preview.push({
        row: item.rows[0],
        title: parsed.data.title,
        status: parsed.data.status,
        source_category: item.source_category,
        domain_id: item.resolved_category_id,
        sku: variant?.sku,
        price_amount: variant?.prices?.[0]?.amount,
        price_currency: variant?.prices?.[0]?.currency_code,
        variant_count: parsed.data.variants?.length ?? 0,
      })
    }
  }

  return {
    total_count: normalized.total_rows,
    valid_count: validRows,
    error_count: normalized.error_rows + extraErrorRows.size,
    error_issue_count: errors.length,
    unmapped_count: normalized.unmapped_count,
    product_count: productCount,
    delimiter: normalized.delimiter,
    columns: normalized.columns,
    errors,
    warnings: normalized.warnings,
    preview,
  }
}
