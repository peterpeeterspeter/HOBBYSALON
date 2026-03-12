import { parse as parseCsv } from 'csv-parse/sync'

import { MedusaError } from '@medusajs/framework/utils'

export type FeedSourceRow = {
  id: string
  seller_id: string
  name: string
  provider: 'custom_csv' | 'custom_json' | 'woocommerce' | 'shopify'
  url: string
  method: 'GET' | 'POST'
  headers: unknown
  mapping: unknown
  default_currency: string | null
  default_location_id: string | null
  active: boolean
  auto_pull_enabled: boolean
  pull_interval_minutes: number | null
  last_sync_job_id: string | null
  last_pulled_at: Date | string | null
  last_pull_status: 'success' | 'failed' | null
  last_error: string | null
  created_at: Date | string
  updated_at: Date | string
}

export type FeedFieldMappingType = {
  sku?: string
  price_amount?: string
  price_currency?: string
  stocked_quantity?: string
  incoming_quantity?: string
  location_id?: string
}

export type FeedSyncCandidate = {
  sku: string
  price_amount?: number
  price_currency?: string
  stocked_quantity?: number
  incoming_quantity?: number
  location_id?: string
}

export type FeedParseError = {
  row: number
  sku?: string
  reason: string
}

export type FeedPullRunRow = {
  id: string
  seller_id: string
  feed_source_id: string
  trigger_type: 'manual' | 'scheduled'
  status: 'processing' | 'success' | 'partial' | 'failed'
  total_count: number
  accepted_count: number
  rejected_count: number
  sync_job_id: string | null
  error_preview: unknown
  error_message: string | null
  started_at: Date | string
  finished_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

type BuildSyncUpdatesOptions = {
  mapping?: FeedFieldMappingType
  defaultCurrency?: string | null
  defaultLocationId?: string | null
  limit?: number
}

const toJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    try {
      const parsed = JSON.parse(trimmed)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }

  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

const toJsonArray = (value: unknown): unknown[] => {
  if (value === null || value === undefined) {
    return []
  }

  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return []
    }

    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const toNumber = (value: unknown) => {
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
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

const toInteger = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) {
      return undefined
    }

    const parsed = Number.parseInt(normalized, 10)
    return Number.isInteger(parsed) ? parsed : undefined
  }

  return undefined
}

const parseHeaders = (value: unknown) => {
  const parsed = toJsonObject(value)
  if (!parsed) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(parsed)
      .map(([key, raw]) => [key.trim(), normalizeString(raw)])
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
  )
}

const parseMapping = (value: unknown): FeedFieldMappingType | undefined => {
  const parsed = toJsonObject(value)
  if (!parsed) {
    return undefined
  }

  const mapping: FeedFieldMappingType = {}
  const keys: (keyof FeedFieldMappingType)[] = [
    'sku',
    'price_amount',
    'price_currency',
    'stocked_quantity',
    'incoming_quantity',
    'location_id',
  ]

  for (const key of keys) {
    const mappedColumn = normalizeString(parsed[key])
    if (mappedColumn) {
      mapping[key] = mappedColumn
    }
  }

  return Object.keys(mapping).length ? mapping : undefined
}

const getRowValueFactory = (
  row: Record<string, unknown>,
  mapping?: FeedFieldMappingType
) => {
  const normalized = new Map<string, unknown>()
  for (const [key, value] of Object.entries(row)) {
    normalized.set(key.trim().toLowerCase(), value)
  }

  return (targetField: keyof FeedFieldMappingType) => {
    const sourceField = mapping?.[targetField] || targetField
    return normalized.get(sourceField.trim().toLowerCase())
  }
}

const getArrayFromObject = (payload: Record<string, unknown>) => {
  const candidates = ['items', 'products', 'data', 'results']
  for (const key of candidates) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return null
}

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )
}

const flattenShopifyRows = (rows: Record<string, unknown>[]) => {
  const flattened: Record<string, unknown>[] = []

  for (const row of rows) {
    const variants = toRecordArray(row.variants)

    if (variants.length) {
      for (const variant of variants) {
        const sku = normalizeString(variant.sku) || normalizeString(row.sku)
        const priceAmount =
          variant.price ??
          variant.compare_at_price ??
          row.price ??
          row.compare_at_price
        const stockedQuantity =
          variant.inventory_quantity ?? row.inventory_quantity
        const incomingQuantity =
          variant.incoming_quantity ?? row.incoming_quantity
        const priceCurrency =
          normalizeString(variant.currency) ||
          normalizeString(row.currency) ||
          normalizeString(row.currency_code)

        flattened.push({
          ...row,
          ...variant,
          sku,
          price_amount: priceAmount,
          price_currency: priceCurrency,
          stocked_quantity: stockedQuantity,
          incoming_quantity: incomingQuantity,
          location_id:
            normalizeString(variant.location_id) ||
            normalizeString(row.location_id),
          source_product_id:
            normalizeString(row.id) ||
            normalizeString(row.product_id) ||
            null,
          source_variant_id:
            normalizeString(variant.id) ||
            normalizeString(variant.variant_id) ||
            null,
        })
      }
      continue
    }

    flattened.push({
      ...row,
      sku: normalizeString(row.sku),
      price_amount: row.price ?? row.compare_at_price,
      price_currency:
        normalizeString(row.currency) || normalizeString(row.currency_code),
      stocked_quantity: row.inventory_quantity,
      incoming_quantity: row.incoming_quantity,
      location_id: normalizeString(row.location_id),
      source_product_id:
        normalizeString(row.id) || normalizeString(row.product_id) || null,
      source_variant_id:
        normalizeString(row.id) || normalizeString(row.variant_id) || null,
    })
  }

  return flattened
}

const flattenWoocommerceRows = (rows: Record<string, unknown>[]) => {
  const flattened: Record<string, unknown>[] = []

  for (const row of rows) {
    const variations = toRecordArray(row.variations)

    if (variations.length) {
      for (const variation of variations) {
        const sku = normalizeString(variation.sku) || normalizeString(row.sku)
        const priceAmount =
          variation.price ??
          variation.regular_price ??
          variation.sale_price ??
          row.price ??
          row.regular_price ??
          row.sale_price
        const stockedQuantity =
          variation.stock_quantity ??
          variation.inventory_quantity ??
          row.stock_quantity ??
          row.inventory_quantity
        const incomingQuantity =
          variation.incoming_quantity ?? row.incoming_quantity

        flattened.push({
          ...row,
          ...variation,
          sku,
          price_amount: priceAmount,
          price_currency:
            normalizeString(variation.currency) ||
            normalizeString(variation.currency_code) ||
            normalizeString(row.currency) ||
            normalizeString(row.currency_code),
          stocked_quantity: stockedQuantity,
          incoming_quantity: incomingQuantity,
          location_id:
            normalizeString(variation.location_id) ||
            normalizeString(row.location_id),
          source_product_id:
            normalizeString(row.id) ||
            normalizeString(row.product_id) ||
            null,
          source_variant_id:
            normalizeString(variation.id) ||
            normalizeString(variation.variant_id) ||
            null,
        })
      }
      continue
    }

    flattened.push({
      ...row,
      sku: normalizeString(row.sku),
      price_amount: row.price ?? row.regular_price ?? row.sale_price,
      price_currency:
        normalizeString(row.currency) || normalizeString(row.currency_code),
      stocked_quantity: row.stock_quantity ?? row.inventory_quantity,
      incoming_quantity: row.incoming_quantity,
      location_id: normalizeString(row.location_id),
      source_product_id:
        normalizeString(row.id) || normalizeString(row.product_id) || null,
      source_variant_id:
        normalizeString(row.id) || normalizeString(row.variant_id) || null,
    })
  }

  return flattened
}

const applyProviderNormalization = (
  rows: Record<string, unknown>[],
  provider: FeedSourceRow['provider']
) => {
  if (provider === 'shopify') {
    return flattenShopifyRows(rows)
  }

  if (provider === 'woocommerce') {
    return flattenWoocommerceRows(rows)
  }

  return rows
}

export const parseFeedContent = (
  rawText: string,
  provider: FeedSourceRow['provider'],
  contentTypeHeader?: string | null
): Record<string, unknown>[] => {
  const contentType = (contentTypeHeader || '').toLowerCase()
  const shouldParseAsJson =
    provider === 'custom_json' ||
    provider === 'woocommerce' ||
    provider === 'shopify' ||
    contentType.includes('application/json')

  if (shouldParseAsJson) {
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(rawText)
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Feed response is not valid JSON'
      )
    }

    if (Array.isArray(parsedJson)) {
      const rows = parsedJson.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
      )
      return applyProviderNormalization(rows, provider)
    }

    if (parsedJson && typeof parsedJson === 'object') {
      const rows = getArrayFromObject(parsedJson as Record<string, unknown>)
      if (rows) {
        const normalized = rows.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
        )
        return applyProviderNormalization(normalized, provider)
      }
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'JSON feed must be an array or contain one of: items/products/data/results'
    )
  }

  const parsedCsv = parseCsv(rawText, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  })

  if (!Array.isArray(parsedCsv)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'CSV feed could not be parsed'
    )
  }

  return applyProviderNormalization(parsedCsv as Record<string, unknown>[], provider)
}

export const buildSyncUpdatesFromFeed = (
  rows: Record<string, unknown>[],
  options?: BuildSyncUpdatesOptions
) => {
  const selectedRows =
    typeof options?.limit === 'number' && options.limit > 0
      ? rows.slice(0, options.limit)
      : rows

  const updates: FeedSyncCandidate[] = []
  const errors: FeedParseError[] = []

  for (const [index, row] of selectedRows.entries()) {
    const rowNumber = index + 1
    const getValue = getRowValueFactory(row, options?.mapping)

    const sku = normalizeString(getValue('sku'))
    if (!sku) {
      errors.push({ row: rowNumber, reason: 'Missing SKU' })
      continue
    }

    const priceAmount = toNumber(getValue('price_amount'))
    const priceCurrency = normalizeString(getValue('price_currency'))
      ?.toLowerCase()
      .slice(0, 3)
    const stockedQuantity = toInteger(getValue('stocked_quantity'))
    const incomingQuantity = toInteger(getValue('incoming_quantity'))
    const locationId =
      normalizeString(getValue('location_id')) ||
      normalizeString(options?.defaultLocationId)
    const defaultCurrency = normalizeString(options?.defaultCurrency)
      ?.toLowerCase()
      .slice(0, 3)
    const resolvedCurrency = priceCurrency || defaultCurrency

    const hasPriceUpdate = priceAmount !== undefined
    const hasInventoryUpdate =
      stockedQuantity !== undefined || incomingQuantity !== undefined

    if (!hasPriceUpdate && !hasInventoryUpdate) {
      errors.push({
        row: rowNumber,
        sku,
        reason: 'No supported changes detected (price/inventory)',
      })
      continue
    }

    if (hasPriceUpdate && !resolvedCurrency) {
      errors.push({
        row: rowNumber,
        sku,
        reason: 'Missing currency for price update',
      })
      continue
    }

    if (hasInventoryUpdate && !locationId) {
      errors.push({
        row: rowNumber,
        sku,
        reason: 'Missing location_id for inventory update',
      })
      continue
    }

    updates.push({
      sku,
      price_amount: priceAmount,
      price_currency: resolvedCurrency,
      stocked_quantity: stockedQuantity,
      incoming_quantity: incomingQuantity,
      location_id: locationId,
    })
  }

  return {
    updates,
    errors,
    total_count: selectedRows.length,
    accepted_count: updates.length,
    rejected_count: errors.length,
  }
}

export const serializeFeedSource = (row: FeedSourceRow) => ({
  id: row.id,
  seller_id: row.seller_id,
  name: row.name,
  provider: row.provider,
  url: row.url,
  method: row.method,
  headers: parseHeaders(row.headers) || {},
  mapping: parseMapping(row.mapping) || {},
  default_currency: row.default_currency,
  default_location_id: row.default_location_id,
  active: row.active,
  auto_pull_enabled: row.auto_pull_enabled,
  pull_interval_minutes: row.pull_interval_minutes,
  last_sync_job_id: row.last_sync_job_id,
  last_pulled_at: row.last_pulled_at,
  last_pull_status: row.last_pull_status,
  last_error: row.last_error,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

export const serializeFeedPullRun = (row: FeedPullRunRow) => ({
  id: row.id,
  seller_id: row.seller_id,
  feed_source_id: row.feed_source_id,
  trigger_type: row.trigger_type,
  status: row.status,
  total_count: row.total_count,
  accepted_count: row.accepted_count,
  rejected_count: row.rejected_count,
  sync_job_id: row.sync_job_id,
  error_preview: toJsonArray(row.error_preview),
  error_message: row.error_message,
  started_at: row.started_at,
  finished_at: row.finished_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
})
