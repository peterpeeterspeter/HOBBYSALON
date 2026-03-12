import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

import { AlgoliaEvents } from '@mercurjs/framework'

type ProductChangedPayload = {
  ids: string[]
}

type ProductStatusRow = {
  id: string
  status: string
}

type SellerRow = {
  id: string
  name?: string | null
  handle?: string | null
  description?: string | null
  city?: string | null
  country_code?: string | null
  seller_type?: string | null
}

type ProductImageRow = {
  url?: string | null
}

type ProductRow = {
  id: string
  title?: string | null
  subtitle?: string | null
  description?: string | null
  handle?: string | null
  type?: { value?: string | null } | null
  metadata?: Record<string, unknown> | null
  seller?: SellerRow | null
  images?: ProductImageRow[] | null
  categories?: Array<{ handle?: string | null }> | null
}

type PlatformProductUpsertPayload = {
  medusa_product_id: string
  creator_id: string
  domain_id: string | null
  category_id: string | null
  slug: string
  title: string
  short_description: string | null
  description: string | null
  product_type: string
  condition_type: string | null
  personalization_available: boolean
  estimated_dispatch_days: number | null
  status: 'active'
  is_active: true
  featured_image_url: string | null
  seo_title: string | null
  seo_description: string | null
}

type PlatformCategoryMapping = {
  id: string
  domain_id: string | null
}

type ExistingCreatorRow = {
  id: string
}

type UserSellerLinkRow = {
  user_id: string
}

const SUPABASE_URL =
  process.env.PLATFORM_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY
const DEFAULT_DOMAIN_ID = process.env.PLATFORM_DEFAULT_DOMAIN_ID ?? null
const DEFAULT_CATEGORY_ID = process.env.PLATFORM_DEFAULT_CATEGORY_ID ?? null
const PRODUCT_TYPES = new Set([
  'supply',
  'handmade',
  'event_listing',
  'event_ticket',
  'workshop_ticket',
  'workshop_kit',
])
const CONDITION_TYPES = new Set(['new', 'handmade', 'made_to_order', 'used'])

const sanitizeSlug = (value: string, fallback: string) => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const escapePostgrestValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/\)/g, '\\)')

const toNullableInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }
  return null
}

const toShortDescription = (subtitle: string | null, description: string | null) => {
  if (subtitle) {
    return subtitle
  }

  if (!description) {
    return null
  }

  const normalized = description.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return null
  }

  return normalized.slice(0, 240)
}

const resolveProductType = (product: ProductRow) => {
  const metadataType = toNullableString(product.metadata?.platform_product_type)
  const typeValue = toNullableString(product.type?.value)

  const candidate = (metadataType || typeValue || '').toLowerCase()
  if (PRODUCT_TYPES.has(candidate)) {
    return candidate
  }

  if (product.seller?.seller_type === 'merchant') {
    return 'supply'
  }

  if (product.seller?.seller_type === 'creator') {
    return 'handmade'
  }

  return null
}

class SupabaseRestClient {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string
  ) {}

  private async request(
    method: 'GET' | 'POST' | 'PATCH',
    table: string,
    options?: {
      query?: Record<string, string>
      body?: unknown
      prefer?: string
    }
  ) {
    const endpoint = new URL(`/rest/v1/${table}`, this.url)

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        endpoint.searchParams.set(key, value)
      }
    }

    const response = await fetch(endpoint.toString(), {
      method,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(options?.prefer ? { Prefer: options.prefer } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    })

    const text = await response.text()
    if (!response.ok) {
      throw new Error(
        `Supabase ${method} ${table} failed (${response.status}): ${text || response.statusText}`
      )
    }

    if (!text) {
      return null
    }

    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  get(table: string, query: Record<string, string>) {
    return this.request('GET', table, { query })
  }

  post(
    table: string,
    body: unknown,
    query: Record<string, string>,
    prefer = 'resolution=merge-duplicates,return=representation'
  ) {
    return this.request('POST', table, {
      body,
      query,
      prefer,
    })
  }

  patch(table: string, body: unknown, query: Record<string, string>) {
    return this.request('PATCH', table, {
      body,
      query,
      prefer: 'return=representation',
    })
  }
}

const resolvePlatformCategoryByHandle = async (
  supabase: SupabaseRestClient,
  handle: string | null,
  cache: Map<string, PlatformCategoryMapping | null>
) => {
  if (!handle) {
    return null
  }

  if (cache.has(handle)) {
    return cache.get(handle) || null
  }

  const rows = (await supabase.get('product_categories', {
    select: 'id,domain_id,slug',
    slug: `eq.${escapePostgrestValue(handle)}`,
    limit: '1',
  })) as Array<{ id: string; domain_id: string | null }> | null

  const resolved = rows?.[0]
    ? {
        id: rows[0].id,
        domain_id: rows[0].domain_id ?? null,
      }
    : null

  cache.set(handle, resolved)
  return resolved
}

const resolveUniqueProductSlug = async (
  supabase: SupabaseRestClient,
  slug: string,
  medusaProductId: string,
  cache: Map<string, string>
) => {
  const cachedOwner = cache.get(slug)
  if (cachedOwner && cachedOwner === medusaProductId) {
    return slug
  }

  const rows = (await supabase.get('products', {
    select: 'medusa_product_id',
    slug: `eq.${escapePostgrestValue(slug)}`,
    limit: '1',
  })) as Array<{ medusa_product_id: string | null }> | null

  const existingOwner = rows?.[0]?.medusa_product_id || null
  if (!existingOwner || existingOwner === medusaProductId) {
    cache.set(slug, medusaProductId)
    return slug
  }

  const fallback = `${slug}-${medusaProductId.slice(-6).toLowerCase()}`
  cache.set(fallback, medusaProductId)
  return fallback
}

const ensurePlatformCreator = async (
  supabase: SupabaseRestClient,
  seller: SellerRow,
  product: ProductRow,
  sellerCache: Map<string, string>,
  creatorIdCache: Map<string, string | null>
) => {
  const cached = sellerCache.get(seller.id)
  if (cached) {
    return cached
  }

  const resolveExistingCreatorId = async (creatorId: string) => {
    if (creatorIdCache.has(creatorId)) {
      return creatorIdCache.get(creatorId)
    }

    const rows = (await supabase.get('creators', {
      select: 'id',
      id: `eq.${escapePostgrestValue(creatorId)}`,
      limit: '1',
    })) as ExistingCreatorRow[] | null
    const resolved = rows?.[0]?.id || null
    creatorIdCache.set(creatorId, resolved)
    return resolved
  }

  const ensureSyntheticCreator = async (
    slugPrefix: 'merchant' | 'creator',
    creatorTypes: string[]
  ) => {
    const creatorSlug = sanitizeSlug(
      `${slugPrefix}-${seller.id}`,
      `${slugPrefix}-${seller.id}`
    )

    const existing = (await supabase.get('creators', {
      select: 'id',
      slug: `eq.${creatorSlug}`,
      limit: '1',
    })) as ExistingCreatorRow[] | null

    if (existing?.[0]?.id) {
      return existing[0].id
    }

    const now = new Date().toISOString()
    const created = (await supabase.post(
      'creators',
      [
        {
          slug: creatorSlug,
          display_name:
            seller.name ||
            seller.handle ||
            `${slugPrefix === 'merchant' ? 'Merchant' : 'Creator'} ${seller.id}`,
          business_name: seller.name || null,
          bio: seller.description || null,
          city: seller.city || null,
          country_code: seller.country_code || 'BE',
          creator_types: creatorTypes,
          is_verified: false,
          is_featured: false,
          accepts_bookings: false,
          accepts_marketplace_orders: true,
          created_at: now,
          updated_at: now,
        },
      ],
      {},
      'return=representation'
    )) as Array<{ id: string }> | null

    const creatorId = created?.[0]?.id
    if (!creatorId) {
      throw new Error(`Unable to create platform creator for seller ${seller.id}`)
    }

    return creatorId
  }

  const metadataCreatorId = toNullableString(product.metadata?.platform_creator_id)
  if (metadataCreatorId) {
    const existingMetadataCreatorId = await resolveExistingCreatorId(metadataCreatorId)
    if (existingMetadataCreatorId) {
      sellerCache.set(seller.id, existingMetadataCreatorId)
      return existingMetadataCreatorId
    }
  }

  if (seller.seller_type === 'creator') {
    const links = (await supabase.get('user_seller_links', {
      select: 'user_id',
      seller_id: `eq.${escapePostgrestValue(seller.id)}`,
      seller_type: 'eq.creator',
      limit: '1',
    })) as UserSellerLinkRow[] | null

    const linkedUserId = links?.[0]?.user_id || null
    if (linkedUserId) {
      const linkedCreators = (await supabase.get('creators', {
        select: 'id',
        user_id: `eq.${escapePostgrestValue(linkedUserId)}`,
        limit: '1',
      })) as ExistingCreatorRow[] | null

      if (linkedCreators?.[0]?.id) {
        sellerCache.set(seller.id, linkedCreators[0].id)
        return linkedCreators[0].id
      }
    }

    const syntheticCreatorId = await ensureSyntheticCreator('creator', ['creator'])
    sellerCache.set(seller.id, syntheticCreatorId)
    return syntheticCreatorId
  }

  const creatorSlug = sanitizeSlug(`merchant-${seller.id}`, `merchant-${seller.id}`)
  const existing = (await supabase.get('creators', {
    select: 'id',
    slug: `eq.${creatorSlug}`,
    limit: '1',
  })) as ExistingCreatorRow[] | null

  if (existing?.[0]?.id) {
    sellerCache.set(seller.id, existing[0].id)
    return existing[0].id
  }

  const creatorId = await ensureSyntheticCreator('merchant', ['supplier'])
  sellerCache.set(seller.id, creatorId)
  return creatorId
}

const partitionProductIds = async (
  query: any,
  ids: string[]
) => {
  const { data } = await query.graph({
    entity: 'product',
    fields: ['id', 'status'],
    filters: {
      id: ids,
    },
  })

  const rows = (data || []) as ProductStatusRow[]
  const existingIds = new Set(rows.map((row) => row.id))
  const publishedIds = rows
    .filter((row) => row.status === 'published')
    .map((row) => row.id)
  const otherIds = [
    ...rows.filter((row) => row.status !== 'published').map((row) => row.id),
    ...ids.filter((id) => !existingIds.has(id)),
  ]

  return {
    publishedIds,
    otherIds,
  }
}

const buildUpsertRows = async (
  query: any,
  supabase: SupabaseRestClient,
  productIds: string[],
  creatorCache: Map<string, string>,
  creatorIdCache: Map<string, string | null>,
  categoryCache: Map<string, PlatformCategoryMapping | null>,
  slugCache: Map<string, string>
) => {
  if (!productIds.length) {
    return {
      payloads: [] as PlatformProductUpsertPayload[],
      includedIds: new Set<string>(),
    }
  }

  const { data } = await query.graph({
    entity: 'product',
    fields: [
      'id',
      'title',
      'subtitle',
      'description',
      'handle',
      'type.value',
      'metadata',
      'seller.id',
      'seller.name',
      'seller.handle',
      'seller.description',
      'seller.city',
      'seller.country_code',
      'seller.seller_type',
      'images.url',
      'categories.handle',
    ],
    filters: {
      id: productIds,
      status: 'published',
    },
  })

  const rows = (data || []) as ProductRow[]
  const payloads: PlatformProductUpsertPayload[] = []
  const includedIds = new Set<string>()

  for (const product of rows) {
    if (!product.id || !product.seller?.id) {
      continue
    }

    const sellerType = (product.seller.seller_type || '').toLowerCase()
    if (sellerType !== 'merchant' && sellerType !== 'creator') {
      continue
    }

    const productType = resolveProductType(product)
    const allowedForSeller =
      (sellerType === 'merchant' && productType === 'supply') ||
      (sellerType === 'creator' && productType === 'handmade')
    if (!allowedForSeller || !productType) {
      continue
    }

    const creatorId = await ensurePlatformCreator(
      supabase,
      product.seller,
      product,
      creatorCache,
      creatorIdCache
    )

    const title = toNullableString(product.title) || `Product ${product.id}`
    const description = toNullableString(product.description)
    const subtitle = toNullableString(product.subtitle)
    const handle = toNullableString(product.handle) || `product-${product.id}`
    const primaryCategoryHandle = toNullableString(product.categories?.[0]?.handle)
    const platformCategory = await resolvePlatformCategoryByHandle(
      supabase,
      primaryCategoryHandle,
      categoryCache
    )
    const baseSlug = sanitizeSlug(handle, `product-${product.id}`)
    const slug = await resolveUniqueProductSlug(
      supabase,
      baseSlug,
      product.id,
      slugCache
    )
    const featuredImage = toNullableString(product.images?.[0]?.url)
    const metadataDomainId = toNullableString(product.metadata?.platform_domain_id)
    const metadataCategoryId = toNullableString(
      product.metadata?.platform_category_id
    )
    const metadataConditionType = toNullableString(
      product.metadata?.platform_condition_type
    )
    const conditionType =
      metadataConditionType && CONDITION_TYPES.has(metadataConditionType)
        ? metadataConditionType
        : null
    const personalizationAvailable =
      typeof product.metadata?.platform_personalization_available === 'boolean'
        ? product.metadata.platform_personalization_available
        : false
    const estimatedDispatchDays = toNullableInteger(
      product.metadata?.platform_estimated_dispatch_days
    )

    payloads.push({
      medusa_product_id: product.id,
      creator_id: creatorId,
      domain_id:
        metadataDomainId || platformCategory?.domain_id || DEFAULT_DOMAIN_ID,
      category_id: metadataCategoryId || platformCategory?.id || DEFAULT_CATEGORY_ID,
      slug,
      title,
      short_description: toShortDescription(subtitle, description),
      description,
      product_type: productType,
      condition_type: conditionType,
      personalization_available: personalizationAvailable,
      estimated_dispatch_days: estimatedDispatchDays,
      status: 'active',
      is_active: true,
      featured_image_url: featuredImage,
      seo_title: title,
      seo_description: toShortDescription(subtitle, description),
    })
    includedIds.add(product.id)
  }

  return {
    payloads,
    includedIds,
  }
}

const archiveProducts = async (
  supabase: SupabaseRestClient,
  productIds: string[]
) => {
  for (const productId of productIds) {
    await supabase.patch(
      'products',
      {
        status: 'archived',
        is_active: false,
      },
      {
        medusa_product_id: `eq.${productId}`,
      }
    )
  }
}

export default async function platformProductsProjectionHandler({
  event,
  container,
}: SubscriberArgs<ProductChangedPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ids = [...new Set((event.data?.ids || []).filter(Boolean))]

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.debug(
      'Platform projection skipped: missing PLATFORM_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or PLATFORM_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY'
    )
    return
  }

  if (!ids.length) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const supabase = new SupabaseRestClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  )
  const creatorCache = new Map<string, string>()
  const creatorIdCache = new Map<string, string | null>()
  const categoryCache = new Map<string, PlatformCategoryMapping | null>()
  const slugCache = new Map<string, string>()

  const { publishedIds, otherIds } = await partitionProductIds(query, ids)
  const { payloads: upsertRows, includedIds } = await buildUpsertRows(
    query,
    supabase,
    publishedIds,
    creatorCache,
    creatorIdCache,
    categoryCache,
    slugCache
  )

  const excludedPublishedIds = publishedIds.filter((id) => !includedIds.has(id))
  const toArchiveIds = [...new Set([...otherIds, ...excludedPublishedIds])]

  if (upsertRows.length) {
    await supabase.post('products', upsertRows, {
      on_conflict: 'medusa_product_id',
    })
  }

  if (toArchiveIds.length) {
    await archiveProducts(supabase, toArchiveIds)
  }

  logger.info(
    `Platform projection synced ${upsertRows.length} products (merchant/supply + creator/handmade) and archived ${toArchiveIds.length} products`
  )
}

export const config: SubscriberConfig = {
  event: AlgoliaEvents.PRODUCTS_CHANGED,
  context: {
    subscriberId: 'platform-products-projection-handler',
  },
}
