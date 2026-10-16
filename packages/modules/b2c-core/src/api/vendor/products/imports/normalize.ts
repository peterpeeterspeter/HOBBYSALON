import { parse as parseCsv } from 'csv-parse/sync'

import { normalizeSourceCategory } from '../../category-mappings/utils'

/**
 * Shared normalizer for "foreign" product lists (Shopify / WooCommerce exports,
 * Dutch Excel sheets, CRM dumps). Both the dry-run and the real import use it,
 * so a file that passes the dry-run imports the same way.
 */

export type CsvRecord = Record<string, string | null | undefined>

export type ImportMapping = Partial<Record<ImportField, string>>

export type ImportField =
  | 'title'
  | 'subtitle'
  | 'description'
  | 'thumbnail'
  | 'handle'
  | 'external_id'
  | 'type_id'
  | 'collection_id'
  | 'source_category'
  | 'category_id'
  | 'tag_ids'
  | 'sales_channel_ids'
  | 'status'
  | 'weight'
  | 'length'
  | 'height'
  | 'width'
  | 'material'
  | 'origin_country'
  | 'variant_title'
  | 'variant_sku'
  | 'variant_ean'
  | 'variant_upc'
  | 'variant_barcode'
  | 'variant_hs_code'
  | 'variant_mid_code'
  | 'variant_material'
  | 'variant_origin_country'
  | 'price_amount'
  | 'price_currency'
  | 'option_name'
  | 'option_value'
  | 'row_type'
  | 'parent_ref'

/**
 * Header aliases (lowercased) recognised without an explicit mapping.
 * Covers Medusa-style keys, Shopify and WooCommerce exports and common NL/EN names.
 */
export const HEADER_ALIASES: Record<ImportField, string[]> = {
  title: ['title', 'name', 'naam', 'productnaam', 'product naam', 'product name', 'artikel', 'artikelnaam', 'omschrijving kort', 'titel'],
  subtitle: ['subtitle', 'ondertitel'],
  description: ['description', 'body (html)', 'omschrijving', 'beschrijving', 'short description', 'korte beschrijving'],
  thumbnail: ['thumbnail', 'image src', 'images', 'image', 'afbeelding', 'foto', 'image url', 'afbeelding url'],
  handle: ['handle', 'slug', 'url key'],
  external_id: ['external_id', 'id', 'external id', 'artikelnummer extern'],
  type_id: ['type_id'],
  collection_id: ['collection_id'],
  source_category: ['source_category', 'category', 'categories', 'categorie', 'categorieën', 'product category', 'product type', 'groep', 'productgroep'],
  category_id: ['category_id'],
  tag_ids: ['tag_ids'],
  sales_channel_ids: ['sales_channel_ids'],
  status: ['status'],
  weight: ['weight', 'gewicht', 'weight (kg)', 'variant grams', 'gewicht (g)'],
  length: ['length', 'lengte', 'length (cm)'],
  height: ['height', 'hoogte', 'height (cm)'],
  width: ['width', 'breedte', 'width (cm)'],
  material: ['material', 'materiaal'],
  origin_country: ['origin_country', 'land van herkomst', 'country of origin'],
  variant_title: ['variant_title', 'variant', 'variant titel'],
  variant_sku: ['variant_sku', 'sku', 'variant sku', 'artikelnummer', 'artikelnr', 'art.nr', 'artnr', 'referentie', 'code'],
  variant_ean: ['variant_ean', 'ean', 'ean13', 'ean-code', 'gtin', 'variant barcode'],
  variant_upc: ['variant_upc', 'upc'],
  variant_barcode: ['variant_barcode', 'barcode', 'streepjescode'],
  variant_hs_code: ['variant_hs_code', 'hs code'],
  variant_mid_code: ['variant_mid_code'],
  variant_material: ['variant_material'],
  variant_origin_country: ['variant_origin_country'],
  price_amount: ['price_amount', 'price', 'prijs', 'variant price', 'regular price', 'verkoopprijs', 'prijs incl btw', 'prijs incl. btw', 'prijs (incl. btw)', 'adviesprijs'],
  price_currency: ['price_currency', 'currency', 'valuta', 'munt'],
  option_name: ['option_name', 'option1 name', 'attribute 1 name', 'optie', 'optienaam'],
  option_value: ['option_value', 'option1 value', 'attribute 1 value(s)', 'optiewaarde', 'kleur', 'maat', 'color', 'size'],
  row_type: ['type', 'row_type'],
  parent_ref: ['parent', 'parent_ref', 'parent sku'],
}

export type RowIssue = { row: number; field?: string; message: string }

export type NormalizedProduct = {
  rows: number[]
  source_category?: string
  resolved_category_id?: string
  product: Record<string, any>
}

export type NormalizeResult = {
  delimiter: string
  columns: string[]
  total_rows: number
  products: NormalizedProduct[]
  errors: RowIssue[]
  warnings: RowIssue[]
  error_rows: number
  unmapped_count: number
}

export type NormalizeOptions = {
  fileContent: string
  mapping?: ImportMapping
  delimiter?: string
  defaultCurrencyCode?: string
  sourceCategoryDomainMap?: Record<string, string>
}

const CANDIDATE_DELIMITERS = [';', ',', '\t', '|']

/** Picks the delimiter that splits the header line into the most columns. */
export const detectDelimiter = (content: string): string => {
  const firstLine = content.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  let best = ','
  let bestCount = 1
  for (const candidate of CANDIDATE_DELIMITERS) {
    // Ignore delimiters inside quoted headers.
    const stripped = firstLine.replace(/"[^"]*"/g, '')
    const count = stripped.split(candidate).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

export type PriceParse =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'negative' }

/**
 * Parses EU and US price notations: "6,95", "€ 6,95", "7,5 EUR", "1.234,50",
 * "1,234.50", "1234.5". Never silently mis-reads thousand separators.
 */
export const parsePrice = (raw: string | undefined | null): PriceParse => {
  if (raw === undefined || raw === null) {
    return { ok: false, reason: 'empty' }
  }
  let s = String(raw).trim()
  if (!s) {
    return { ok: false, reason: 'empty' }
  }
  s = s
    .replace(/€|eur(o)?|\s/gi, '')
    .replace(/^(\+)/, '')
  const negative = s.startsWith('-')
  if (negative) {
    s = s.slice(1)
  }
  if (!/^[0-9.,]+$/.test(s)) {
    return { ok: false, reason: 'invalid' }
  }

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized: string
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the right-most one is the decimal separator.
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    normalized = s.split(thousandSep).join('').replace(decimalSep, '.')
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.'
    const parts = s.split(sep)
    const tail = parts[parts.length - 1]
    if (parts.length > 2) {
      // "1.234.567" → thousands
      if (parts.slice(1).every((p) => p.length === 3)) {
        normalized = parts.join('')
      } else {
        return { ok: false, reason: 'invalid' }
      }
    } else if (tail.length === 3 && sep === '.' && parts[0] !== '0') {
      // "1.234" in an EU sheet is ambiguous; treat as thousands only for '.'
      normalized = parts.join('')
    } else {
      normalized = parts.join('.')
    }
  } else {
    normalized = s
  }

  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value)) {
    return { ok: false, reason: 'invalid' }
  }
  if (negative && value !== 0) {
    return { ok: false, reason: 'negative' }
  }
  return { ok: true, value: Math.round(value * 100) / 100 }
}

const toNumber = (value: string | undefined) => {
  const parsed = parsePrice(value)
  return parsed.ok ? parsed.value : undefined
}

const trimOrUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const parseIdList = (value: string | undefined) => {
  if (!value) {
    return undefined
  }
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((e) => (typeof e === 'string' ? e.trim() : '')).filter(Boolean)
      }
    } catch {
      return undefined
    }
  }
  return value.split(/[|,;]/g).map((e) => e.trim()).filter(Boolean)
}

const stripHtml = (value: string | undefined) =>
  value
    ? value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim() || undefined
    : undefined

const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/** Resolves which source column feeds each field: explicit mapping first, then aliases. */
export const resolveColumns = (
  columns: string[],
  mapping?: ImportMapping
): Partial<Record<ImportField, string>> => {
  const byLower = new Map(columns.map((c) => [c.trim().toLowerCase(), c]))
  const resolved: Partial<Record<ImportField, string>> = {}
  const used = new Set<string>()

  for (const [field, column] of Object.entries(mapping ?? {})) {
    if (!column) continue
    const actual = byLower.get(column.trim().toLowerCase())
    if (actual) {
      resolved[field as ImportField] = actual
      used.add(actual)
    }
  }
  for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
    if (resolved[field]) continue
    for (const alias of HEADER_ALIASES[field]) {
      const actual = byLower.get(alias)
      if (actual && !used.has(actual)) {
        resolved[field] = actual
        used.add(actual)
        break
      }
    }
  }
  return resolved
}

type ParsedRow = {
  rowNumber: number
  get: (field: ImportField) => string | undefined
}

/** True when the file is Medusa's own product-import template. */
export const isMedusaTemplateCsv = (content: string) => {
  const header = content.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  return /(^|[;,|\t]"?)Product Handle("?)([;,|\t]|$)/.test(header)
}

export const normalizeProductList = ({
  fileContent,
  mapping,
  delimiter,
  defaultCurrencyCode = 'eur',
  sourceCategoryDomainMap,
}: NormalizeOptions): NormalizeResult => {
  const effectiveDelimiter = delimiter || detectDelimiter(fileContent)
  const records = parseCsv(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    delimiter: effectiveDelimiter,
  }) as CsvRecord[]

  const columns = records.length ? Object.keys(records[0] ?? {}) : []
  const resolved = resolveColumns(columns, mapping)
  const errors: RowIssue[] = []
  const warnings: RowIssue[] = []
  const errorRowSet = new Set<number>()
  let unmappedCount = 0

  const addError = (row: number, field: string | undefined, message: string) => {
    errors.push({ row, field, message })
    errorRowSet.add(row)
  }

  if (records.length && !resolved.title) {
    addError(
      1,
      'title',
      `Geen kolom voor de producttitel gevonden. Gevonden kolommen: ${columns.join(', ')}. Koppel een kolom aan "title" (bv. Naam, Artikel, Title).`
    )
    return {
      delimiter: effectiveDelimiter,
      columns,
      total_rows: records.length,
      products: [],
      errors,
      warnings,
      error_rows: records.length,
      unmapped_count: 0,
    }
  }

  const rows: ParsedRow[] = records.map((record, index) => ({
    rowNumber: index + 2,
    get: (field) => {
      const column = resolved[field]
      return column ? trimOrUndefined(record[column] ?? undefined) : undefined
    },
  }))

  // Group rows into products: Shopify (same handle), WooCommerce (variation → parent), else one row = one product.
  type Group = { key: string; rows: ParsedRow[] }
  const groups: Group[] = []
  const groupByKey = new Map<string, Group>()
  const wooParentByRef = new Map<string, Group>()
  let lastWooParent: Group | undefined

  for (const row of rows) {
    const rowType = row.get('row_type')?.toLowerCase()
    const isWooVariation = rowType === 'variation'
    if (isWooVariation) {
      const parentRef = row.get('parent_ref')
      const parent = (parentRef && wooParentByRef.get(parentRef.replace(/^id:/i, ''))) || lastWooParent
      if (parent) {
        parent.rows.push(row)
        continue
      }
    }

    const handle = row.get('handle')
    if (handle && groupByKey.has(handle)) {
      groupByKey.get(handle)!.rows.push(row)
      continue
    }
    const group: Group = { key: handle || `row-${row.rowNumber}`, rows: [row] }
    groups.push(group)
    if (handle) groupByKey.set(handle, group)
    if (rowType === 'variable') {
      lastWooParent = group
      for (const ref of [row.get('external_id'), row.get('variant_sku')]) {
        if (ref) wooParentByRef.set(ref, group)
      }
    } else if (rowType && rowType !== 'variation') {
      lastWooParent = undefined
    }
  }

  const products: NormalizedProduct[] = []

  for (const group of groups) {
    const head = group.rows[0]
    const isWooVariable = head.get('row_type')?.toLowerCase() === 'variable'
    const variantRows = isWooVariable && group.rows.length > 1 ? group.rows.slice(1) : group.rows
    const title = head.get('title')
    const groupRowNumbers = group.rows.map((r) => r.rowNumber)

    if (!title) {
      addError(head.rowNumber, 'title', 'Titel ontbreekt')
      for (const r of group.rows) errorRowSet.add(r.rowNumber)
      continue
    }

    const sourceCategory = head.get('source_category')
    let resolvedCategoryId = head.get('category_id')
    if (!resolvedCategoryId && sourceCategory) {
      resolvedCategoryId = sourceCategoryDomainMap?.[normalizeSourceCategory(sourceCategory)]
      if (!resolvedCategoryId) {
        unmappedCount += 1
        warnings.push({
          row: head.rowNumber,
          field: 'category_id',
          message: `Categorie "${sourceCategory}" is nog niet gekoppeld; product wordt zonder categorie geïmporteerd`,
        })
      }
    }

    const statusRaw = head.get('status')?.toLowerCase()
    const product: Record<string, any> = {
      title,
      subtitle: head.get('subtitle'),
      description: stripHtml(head.get('description')),
      thumbnail: head.get('thumbnail')?.split(/[,|]/)[0]?.trim() || undefined,
      handle: head.get('handle') ? slugify(head.get('handle')!) : slugify(title) || undefined,
      external_id: head.get('external_id'),
      type_id: head.get('type_id'),
      collection_id: head.get('collection_id'),
      material: head.get('material'),
      origin_country: head.get('origin_country'),
      status: statusRaw === 'proposed' ? 'proposed' : 'draft',
    }
    for (const dim of ['weight', 'length', 'height', 'width'] as const) {
      const n = toNumber(head.get(dim))
      if (n !== undefined) product[dim] = n
    }
    if (resolvedCategoryId) product.categories = [{ id: resolvedCategoryId }]
    const tagIds = parseIdList(head.get('tag_ids'))
    if (tagIds?.length) product.tags = tagIds.map((id) => ({ id }))
    const salesChannelIds = parseIdList(head.get('sales_channel_ids'))
    if (salesChannelIds?.length) product.sales_channels = salesChannelIds.map((id) => ({ id }))
    for (const key of Object.keys(product)) {
      if (product[key] === undefined) delete product[key]
    }

    const optionColumn = resolved.option_value
    const optionColumnIsNamed =
      !!optionColumn && !/option|attribute|optie/i.test(optionColumn)
    const optionName =
      head.get('option_name') ||
      (optionColumnIsNamed ? optionColumn!.trim() : undefined) ||
      (variantRows.length > 1 ? 'Variant' : 'Standaard')
    const variants: Record<string, any>[] = []
    const seenOptionValues = new Set<string>()
    let groupHasError = false

    variantRows.forEach((row, index) => {
      const price = parsePrice(row.get('price_amount'))
      if (!price.ok) {
        groupHasError = true
        addError(
          row.rowNumber,
          'price_amount',
          price.reason === 'empty'
            ? 'Prijs ontbreekt'
            : price.reason === 'negative'
              ? `Negatieve prijs "${row.get('price_amount')}"`
              : `Ongeldige prijs "${row.get('price_amount')}"`
        )
        return
      }
      if (price.value === 0) {
        warnings.push({ row: row.rowNumber, field: 'price_amount', message: 'Prijs is 0 (gratis product)' })
      }

      const optionValue =
        row.get('option_value') ||
        row.get('variant_title') ||
        (variantRows.length > 1 ? row.get('variant_sku') || `Variant ${index + 1}` : 'Standaard')
      if (seenOptionValues.has(optionValue)) {
        groupHasError = true
        addError(row.rowNumber, 'option_value', `Dubbele variant "${optionValue}" voor "${title}"`)
        return
      }
      seenOptionValues.add(optionValue)

      const currency = (row.get('price_currency') || defaultCurrencyCode).toLowerCase()
      const variant: Record<string, any> = {
        title: variantRows.length > 1 ? optionValue : row.get('variant_title') || title,
        sku: row.get('variant_sku'),
        ean: row.get('variant_ean'),
        upc: row.get('variant_upc'),
        barcode: row.get('variant_barcode'),
        hs_code: row.get('variant_hs_code'),
        mid_code: row.get('variant_mid_code'),
        material: row.get('variant_material'),
        origin_country: row.get('variant_origin_country'),
        prices: [{ amount: price.value, currency_code: currency }],
        options: { [optionName]: optionValue },
      }
      for (const key of Object.keys(variant)) {
        if (variant[key] === undefined) delete variant[key]
      }
      variants.push(variant)
    })

    if (groupHasError || !variants.length) {
      for (const r of group.rows) errorRowSet.add(r.rowNumber)
      continue
    }

    product.options = [{ title: optionName, values: Array.from(seenOptionValues) }]
    product.variants = variants

    products.push({
      rows: groupRowNumbers,
      source_category: sourceCategory,
      resolved_category_id: resolvedCategoryId,
      product,
    })
  }

  return {
    delimiter: effectiveDelimiter,
    columns,
    total_rows: records.length,
    products,
    errors,
    warnings,
    error_rows: errorRowSet.size,
    unmapped_count: unmappedCount,
  }
}
