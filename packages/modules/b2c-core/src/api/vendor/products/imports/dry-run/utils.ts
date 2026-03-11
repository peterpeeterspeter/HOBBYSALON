import { parse as parseCsv } from 'csv-parse/sync'
import { z } from 'zod'

import { normalizeSourceCategory } from '../../../category-mappings/utils'
import { CreateProduct } from '../../validators'

type CsvRecord = Record<string, string | null | undefined>

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
}

export type VendorImportDryRunResult = {
  total_count: number
  valid_count: number
  error_count: number
  error_issue_count: number
  unmapped_count: number
  columns: string[]
  errors: VendorImportDryRunError[]
  preview: VendorImportDryRunPreviewItem[]
}

type DryRunOptions = {
  fileContent: string
  mapping?: VendorImportDryRunMappingType
  delimiter?: string
  defaultCurrencyCode?: string
  sourceCategoryDomainMap?: Record<string, string>
}

const normalizeKey = (value: string) => value.trim().toLowerCase()

const toTrimmedString = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const toNumber = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.replace(/\s+/g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseIdList = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean)
      }
    } catch {
      return undefined
    }
  }

  return trimmed
    .split(/[|,;]/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const getRowValueFactory = (
  row: CsvRecord,
  mapping?: VendorImportDryRunMappingType
) => {
  const normalizedRow = new Map<string, string>()
  for (const [key, rawValue] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key)
    const value = toTrimmedString(rawValue)
    if (value) {
      normalizedRow.set(normalizedKey, value)
    }
  }

  return (targetField: keyof VendorImportDryRunMappingType | string) => {
    const mappedColumn = mapping?.[targetField as keyof VendorImportDryRunMappingType]
    const sourceColumn = mappedColumn || targetField
    return normalizedRow.get(normalizeKey(sourceColumn))
  }
}

const createDraftProductFromRow = (
  row: CsvRecord,
  mapping: VendorImportDryRunMappingType | undefined,
  defaultCurrencyCode: string,
  sourceCategoryDomainMap?: Record<string, string>
) => {
  const getValue = getRowValueFactory(row, mapping)

  const title = getValue('title')
  const sourceCategory = getValue('source_category')
  const mappedDomainId = sourceCategory
    ? sourceCategoryDomainMap?.[normalizeSourceCategory(sourceCategory)]
    : undefined
  const resolvedCategoryId = getValue('category_id') || mappedDomainId
  const statusRaw = getValue('status')?.toLowerCase()
  const status = statusRaw === 'proposed' ? 'proposed' : 'draft'

  const product: Record<string, unknown> = {
    title,
    subtitle: getValue('subtitle'),
    description: getValue('description'),
    thumbnail: getValue('thumbnail'),
    handle: getValue('handle'),
    external_id: getValue('external_id'),
    type_id: getValue('type_id'),
    collection_id: getValue('collection_id'),
    material: getValue('material'),
    origin_country: getValue('origin_country'),
    status,
  }

  const weight = toNumber(getValue('weight'))
  const length = toNumber(getValue('length'))
  const height = toNumber(getValue('height'))
  const width = toNumber(getValue('width'))

  if (weight !== undefined) {
    product.weight = weight
  }
  if (length !== undefined) {
    product.length = length
  }
  if (height !== undefined) {
    product.height = height
  }
  if (width !== undefined) {
    product.width = width
  }

  if (resolvedCategoryId) {
    product.categories = [{ id: resolvedCategoryId }]
  }

  const tagIds = parseIdList(getValue('tag_ids'))
  if (tagIds?.length) {
    product.tags = tagIds.map((id) => ({ id }))
  }

  const salesChannelIds = parseIdList(getValue('sales_channel_ids'))
  if (salesChannelIds?.length) {
    product.sales_channels = salesChannelIds.map((id) => ({ id }))
  }

  const variantTitle = getValue('variant_title')
  const variantSku = getValue('variant_sku')
  const variantEan = getValue('variant_ean')
  const variantUpc = getValue('variant_upc')
  const variantBarcode = getValue('variant_barcode')
  const variantHsCode = getValue('variant_hs_code')
  const variantMidCode = getValue('variant_mid_code')
  const variantMaterial = getValue('variant_material')
  const variantOriginCountry = getValue('variant_origin_country')
  const priceAmount = toNumber(getValue('price_amount'))
  const priceCurrency =
    (getValue('price_currency') || defaultCurrencyCode).toLowerCase()

  const hasVariantSignal =
    Boolean(variantTitle) ||
    Boolean(variantSku) ||
    Boolean(variantEan) ||
    Boolean(variantUpc) ||
    Boolean(variantBarcode) ||
    Boolean(variantHsCode) ||
    Boolean(variantMidCode) ||
    Boolean(variantMaterial) ||
    Boolean(variantOriginCountry) ||
    priceAmount !== undefined

  if (hasVariantSignal) {
    product.variants = [
      {
        title: variantTitle || title,
        sku: variantSku,
        ean: variantEan,
        upc: variantUpc,
        barcode: variantBarcode,
        hs_code: variantHsCode,
        mid_code: variantMidCode,
        material: variantMaterial,
        origin_country: variantOriginCountry,
        prices:
          priceAmount !== undefined
            ? [
                {
                  amount: priceAmount,
                  currency_code: priceCurrency,
                },
              ]
            : undefined,
      },
    ]
  }

  return {
    product,
    source_category: sourceCategory,
    resolved_domain_id: resolvedCategoryId,
  }
}

const formatZodErrors = (
  rowNumber: number,
  issues: z.ZodIssue[]
): VendorImportDryRunError[] => {
  return issues.map((issue) => {
    const path = issue.path.map(String).join('.')
    return {
      row: rowNumber,
      field: path || undefined,
      message: issue.message,
    }
  })
}

export const runVendorProductsImportDryRun = ({
  fileContent,
  mapping,
  delimiter,
  defaultCurrencyCode = 'eur',
  sourceCategoryDomainMap,
}: DryRunOptions): VendorImportDryRunResult => {
  const records = parseCsv(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    delimiter: delimiter || undefined,
  }) as CsvRecord[]

  if (!records.length) {
    return {
      total_count: 0,
      valid_count: 0,
      error_count: 0,
      error_issue_count: 0,
      unmapped_count: 0,
      columns: [],
      errors: [],
      preview: [],
    }
  }

  const columns = Object.keys(records[0] ?? {})
  const errors: VendorImportDryRunError[] = []
  const preview: VendorImportDryRunPreviewItem[] = []
  let validCount = 0
  let errorRows = 0
  let unmappedCount = 0

  records.forEach((row, index) => {
    const rowNumber = index + 2
    const draftProduct = createDraftProductFromRow(
      row,
      mapping,
      defaultCurrencyCode,
      sourceCategoryDomainMap
    )
    if (draftProduct.source_category && !draftProduct.resolved_domain_id) {
      unmappedCount += 1
      errorRows += 1
      errors.push({
        row: rowNumber,
        field: 'category_id',
        message: `No domain mapping found for source category "${draftProduct.source_category}"`,
      })
      return
    }

    const parsed = CreateProduct.safeParse(draftProduct.product)

    if (!parsed.success) {
      errorRows += 1
      errors.push(...formatZodErrors(rowNumber, parsed.error.issues))
      return
    }

    validCount += 1

    if (preview.length < 20) {
      const variant = parsed.data.variants?.[0]
      preview.push({
        row: rowNumber,
        title: parsed.data.title,
        status: parsed.data.status,
        source_category: draftProduct.source_category,
        domain_id: draftProduct.resolved_domain_id,
        sku: variant?.sku,
        price_amount: variant?.prices?.[0]?.amount,
        price_currency: variant?.prices?.[0]?.currency_code,
      })
    }
  })

  return {
    total_count: records.length,
    valid_count: validCount,
    error_count: errorRows,
    error_issue_count: errors.length,
    unmapped_count: unmappedCount,
    columns,
    errors,
    preview,
  }
}
