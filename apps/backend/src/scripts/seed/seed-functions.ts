import { MedusaContainer } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductTypesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  updateStoresWorkflow,
  updateTaxRegionsWorkflow,
  createUserAccountWorkflow
} from '@medusajs/medusa/core-flows'

import { SELLER_MODULE } from '@mercurjs/b2c-core/modules/seller'
import {
  createConfigurationRuleWorkflow,
  createLocationFulfillmentSetAndAssociateWithSellerWorkflow,
  createSellerWorkflow
} from '@mercurjs/b2c-core/workflows'
import { createCommissionRuleWorkflow } from '@mercurjs/commission/workflows'
import {
  ConfigurationRuleDefaults,
  SELLER_SHIPPING_PROFILE_LINK
} from '@mercurjs/framework'

import { productsToInsert } from './seed-products'
import { hobbysalonProductsToInsert } from './seed-hobbysalon-products'

const countries = ['be', 'de', 'dk', 'se', 'fr', 'es', 'it', 'pl', 'cz', 'nl']

export async function createAdminUser(container: MedusaContainer) {
  const authService = container.resolve(Modules.AUTH)
  const userService = container.resolve(Modules.USER)
  
  // Check if admin user already exists
  const [existingUser] = await userService.listUsers({
    email: 'admin@mercurjs.com'
  })
  
  if (existingUser) {
    return existingUser
  }
  
  // Create auth identity with password
  const { authIdentity } = await authService.register('emailpass', {
    body: {
      email: 'admin@mercurjs.com',
      password: 'supersecret'
    }
  })
  
  if (!authIdentity?.id) {
    throw new Error('Failed to create admin auth identity')
  }
  
  // Create admin user account
  const { result: user } = await createUserAccountWorkflow(container).run({
    input: {
      userData: {
        email: 'admin@mercurjs.com',
        first_name: 'Admin',
        last_name: 'User'
      },
      authIdentityId: authIdentity.id
    }
  })
  
  return user
}

export async function createSalesChannel(container: MedusaContainer) {
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  let [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels(
    {
      name: 'Default Sales Channel'
    }
  )

  if (!defaultSalesChannel) {
    const {
      result: [salesChannelResult]
    } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: 'Default Sales Channel'
          }
        ]
      }
    })
    defaultSalesChannel = salesChannelResult
  }

  return defaultSalesChannel
}

export async function createStore(
  container: MedusaContainer,
  salesChannelId: string,
  regionId: string
) {
  const storeModuleService = container.resolve(Modules.STORE)
  const [store] = await storeModuleService.listStores()

  if (!store) {
    return
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: salesChannelId,
        default_region_id: regionId
      }
    }
  })
}
export async function createRegions(container: MedusaContainer) {
  const regionService = container.resolve(Modules.REGION)

  // Return existing region if already seeded
  const [existingRegion] = await regionService.listRegions({ name: 'Europe' })
  if (existingRegion) {
    return existingRegion
  }

  const {
    result: [region]
  } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: 'Europe',
          currency_code: 'eur',
          countries,
          payment_providers: ['pp_card_stripe-connect']
        }
      ]
    }
  })

  // Only create tax regions that don't exist yet
  const taxService = container.resolve(Modules.TAX)
  const existingTaxRegions = await taxService.listTaxRegions({})
  const existingCodes = new Set(existingTaxRegions.map((t: { country_code: string }) => t.country_code))
  const missingCountries = countries.filter((c) => !existingCodes.has(c))

  if (missingCountries.length > 0) {
    const { result: taxRegions } = await createTaxRegionsWorkflow(container).run({
      input: missingCountries.map((country_code) => ({
        country_code
      }))
    })

    await updateTaxRegionsWorkflow(container).run({
      input: taxRegions.map((taxRegion) => ({
        id: taxRegion.id,
        provider_id: 'tp_system'
      }))
    })
  }

  return region
}

export async function createPublishableKey(
  container: MedusaContainer,
  salesChannelId: string
) {
  const apiKeyService = container.resolve(Modules.API_KEY)

  let [key] = await apiKeyService.listApiKeys({ type: 'publishable' })

  if (!key) {
    const {
      result: [publishableApiKeyResult]
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: 'Default publishable key',
            type: 'publishable',
            created_by: ''
          }
        ]
      }
    })
    key = publishableApiKeyResult
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: key.id,
      add: [salesChannelId]
    }
  })

  return key
}

export async function createProductCategories(container: MedusaContainer) {
  const productService = container.resolve(Modules.PRODUCT)
  const allCategories = [
    { name: 'Sneakers', is_active: true },
    { name: 'Sandals', is_active: true },
    { name: 'Boots', is_active: true },
    { name: 'Sport', is_active: true },
    { name: 'Accessories', is_active: true },
    { name: 'Tops', is_active: true }
  ]

  const results: any[] = []
  for (const cat of allCategories) {
    try {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: { product_categories: [cat] }
      })
      results.push(...result)
    } catch (e: unknown) {
      const raw = e as { message?: string }
      const msg = (raw?.message ?? String(e)).toLowerCase()
      if (!msg.includes('already') && !msg.includes('duplicate') && !msg.includes('unique') && !msg.includes('exists')) {
        throw e
      }
    }
  }

  return results.length ? results : productService.listProductCategories({})
}

export async function createProductCollections(container: MedusaContainer) {
  const productService = container.resolve(Modules.PRODUCT)
  const allCollections = [
    { title: 'Luxury' },
    { title: 'Vintage' },
    { title: 'Casual' },
    { title: 'Soho' },
    { title: 'Streetwear' },
    { title: 'Y2K' }
  ]

  const results: any[] = []
  for (const col of allCollections) {
    try {
      const { result } = await createCollectionsWorkflow(container).run({
        input: { collections: [col] }
      })
      results.push(...result)
    } catch (e: unknown) {
      const raw = e as { message?: string }
      const msg = (raw?.message ?? String(e)).toLowerCase()
      if (!msg.includes('already') && !msg.includes('duplicate') && !msg.includes('unique') && !msg.includes('exists')) {
        throw e
      }
    }
  }

  return results.length ? results : productService.listProductCollections({})
}

export async function createSeller(container: MedusaContainer) {
  const authService = container.resolve(Modules.AUTH)

  // Return existing seller if already seeded
  try {
    const [existing] = await authService.listAuthIdentities({
      provider_identities: { entity_id: 'seller@mercurjs.com', provider: 'emailpass' }
    })
    if (existing) {
      const sellerModule = container.resolve(SELLER_MODULE) as {
        listSellers: (input: Record<string, unknown>) => Promise<any[]>
      }
      const [existingSeller] = await sellerModule.listSellers({})
      if (existingSeller) return existingSeller
    }
  } catch {
    // fall through to create
  }

  const { authIdentity } = await authService.register('emailpass', {
    body: {
      email: 'seller@mercurjs.com',
      password: 'secret'
    }
  })

  const { result: seller } = await createSellerWorkflow.run({
    container,
    input: {
      auth_identity_id: authIdentity?.id,
      member: {
        name: 'John Doe',
        email: 'seller@mercurjs.com'
      },
      seller: {
        name: 'MercurJS Store'
      }
    }
  })

  return seller
}

export async function createSellerStockLocation(
  container: MedusaContainer,
  sellerId: string,
  salesChannelId: string
) {
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const {
    result: [stock]
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: `Stock Location for seller ${sellerId}`,
          address: {
            address_1: 'Random Strasse',
            city: 'Berlin',
            country_code: 'de'
          }
        }
      ]
    }
  })

  await link.create([
    {
      [SELLER_MODULE]: {
        seller_id: sellerId
      },
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stock.id
      }
    },
    {
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stock.id
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: 'manual_manual'
      }
    },
    {
      [Modules.SALES_CHANNEL]: {
        sales_channel_id: salesChannelId
      },
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stock.id
      }
    }
  ])

  await createLocationFulfillmentSetAndAssociateWithSellerWorkflow.run({
    container,
    input: {
      fulfillment_set_data: {
        name: `${sellerId} fulfillment set`,
        type: 'shipping'
      },
      location_id: stock.id,
      seller_id: sellerId
    }
  })

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [stockLocation]
  } = await query.graph({
    entity: 'stock_location',
    fields: ['*', 'fulfillment_sets.*'],
    filters: {
      id: stock.id
    }
  })

  return stockLocation
}

export async function createServiceZoneForFulfillmentSet(
  container: MedusaContainer,
  sellerId: string,
  fulfillmentSetId: string
) {
  await createServiceZonesWorkflow.run({
    container,
    input: {
      data: [
        {
          fulfillment_set_id: fulfillmentSetId,
          name: `Europe`,
          geo_zones: countries.map((c) => ({
            type: 'country',
            country_code: c
          }))
        }
      ]
    }
  })

  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  const [zone] = await fulfillmentService.listServiceZones({
    fulfillment_set: {
      id: fulfillmentSetId
    }
  })

  const link = container.resolve(ContainerRegistrationKeys.LINK)
  await link.create({
    [SELLER_MODULE]: {
      seller_id: sellerId
    },
    [Modules.FULFILLMENT]: {
      service_zone_id: zone.id
    }
  })

  return zone
}

export async function createSellerShippingOption(
  container: MedusaContainer,
  sellerId: string,
  sellerName: string,
  regionId: string,
  serviceZoneId: string
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [shippingProfile]
  } = await query.graph({
    entity: SELLER_SHIPPING_PROFILE_LINK,
    fields: ['shipping_profile_id'],
    filters: {
      seller_id: sellerId
    }
  })

  const {
    result: [shippingOption]
  } = await createShippingOptionsWorkflow.run({
    container,
    input: [
      {
        name: `${sellerName} shipping`,
        shipping_profile_id: shippingProfile.shipping_profile_id,
        service_zone_id: serviceZoneId,
        provider_id: 'manual_manual',
        type: {
          label: `${sellerName} shipping`,
          code: sellerName,
          description: 'Europe shipping'
        },
        rules: [
          { value: 'true', attribute: 'enabled_in_store', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' }
        ],
        prices: [
          { currency_code: 'eur', amount: 10 },
          { amount: 10, region_id: regionId }
        ],
        price_type: 'flat',
        data: { id: 'manual-fulfillment' }
      }
    ]
  })

  const link = container.resolve(ContainerRegistrationKeys.LINK)
  await link.create({
    [SELLER_MODULE]: {
      seller_id: sellerId
    },
    [Modules.FULFILLMENT]: {
      shipping_option_id: shippingOption.id
    }
  })

  return shippingOption
}

export async function createSellerProducts(
  container: MedusaContainer,
  sellerId: string,
  salesChannelId: string
) {
  const productService = container.resolve(Modules.PRODUCT)
  const existing = await productService.listProducts({}, { select: ['handle'] })
  const existingHandles = new Set(existing.map((p: { handle: string }) => p.handle))

  const collections = await productService.listProductCollections({}, { select: ['id', 'title'] })
  const categories = await productService.listProductCategories({}, { select: ['id', 'name'] })
  const randomCategory = () => categories[Math.floor(Math.random() * categories.length)]
  const randomCollection = () => collections[Math.floor(Math.random() * collections.length)]

  const newProducts = productsToInsert.filter((p) => !existingHandles.has(p.handle))
  if (!newProducts.length) return existing

  const toInsert = newProducts.map((p) => ({
    ...p,
    categories: [{ id: randomCategory().id }],
    collection_id: randomCollection().id,
    sales_channels: [{ id: salesChannelId }]
  }))

  const { result } = await createProductsWorkflow.run({
    container,
    input: { products: toInsert, additional_data: { seller_id: sellerId } }
  })

  return result
}

export async function createHobbysalonProducts(
  container: MedusaContainer,
  sellerId: string,
  salesChannelId: string
) {
  const productService = container.resolve(Modules.PRODUCT)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const existing = await productService.listProducts({}, { select: ['handle'] })
  const existingHandles = new Set(existing.map((p: { handle: string }) => p.handle))

  const { data: productTypes } = await query.graph({
    entity: 'product_type',
    fields: ['id', 'value'],
    filters: {}
  })
  const typeIdByValue = new Map(productTypes.map((t: { id: string; value: string }) => [t.value, t.id]))

  const collections = await productService.listProductCollections({}, { select: ['id', 'title'] })
  const categories = await productService.listProductCategories({}, { select: ['id', 'name'] })
  const randomCategory = () => categories[Math.floor(Math.random() * categories.length)]
  const randomCollection = () => collections[Math.floor(Math.random() * collections.length)]

  const newProducts = hobbysalonProductsToInsert.filter((p) => !existingHandles.has(p.handle))
  if (!newProducts.length) return existing

  const toInsert = newProducts.map((p) => {
    const { product_type, ...rest } = p as { product_type?: string; [k: string]: unknown }
    const type_id = product_type ? typeIdByValue.get(product_type) : undefined
    return {
      ...rest,
      ...(type_id && { type_id }),
      categories: [{ id: randomCategory().id }],
      collection_id: randomCollection().id,
      sales_channels: [{ id: salesChannelId }]
    }
  })

  const { result } = await createProductsWorkflow.run({
    container,
    input: { products: toInsert, additional_data: { seller_id: sellerId } }
  })

  return result
}

export async function createInventoryItemStockLevels(
  container: MedusaContainer,
  stockLocationId: string
) {
  const inventoryService = container.resolve(Modules.INVENTORY)
  const items = await inventoryService.listInventoryItems({}, { select: ['id'] })

  const existingLevels = await inventoryService.listInventoryLevels(
    { location_id: stockLocationId },
    { select: ['inventory_item_id'] }
  )
  const existingItemIds = new Set(existingLevels.map((l: { inventory_item_id: string }) => l.inventory_item_id))

  const toCreate = items
    .filter((i: { id: string }) => !existingItemIds.has(i.id))
    .map((i: { id: string }) => ({
      inventory_item_id: i.id,
      location_id: stockLocationId,
      stocked_quantity: Math.floor(Math.random() * 50) + 1
    }))

  if (!toCreate.length) return []

  const { result } = await createInventoryLevelsWorkflow.run({
    container,
    input: { inventory_levels: toCreate }
  })
  return result
}

/**
 * Hobbysalon commission matrix (see docs/billing-commission-matrix.md):
 * - supply: 10%, handmade: 6%
 * - event_listing, event_ticket, workshop_ticket: flat (TBD amount, placeholder 100 = 1 EUR)
 * - workshop_kit: no rule (commerce only)
 */
const HOBBYSALON_PRODUCT_TYPES = [
  'supply',
  'handmade',
  'event_listing',
  'event_ticket',
  'workshop_ticket',
  'workshop_kit'
] as const

const COMMISSION_CONFIG: Record<
  string,
  { type: 'percentage' | 'flat'; percentage_rate?: number; price_set?: { amount: number; currency_code: string }[] }
> = {
  supply: { type: 'percentage', percentage_rate: 10 },
  handmade: { type: 'percentage', percentage_rate: 6 },
  event_listing: { type: 'flat', price_set: [{ amount: 100, currency_code: 'eur' }] },
  event_ticket: { type: 'flat', price_set: [{ amount: 100, currency_code: 'eur' }] },
  workshop_ticket: { type: 'flat', price_set: [{ amount: 100, currency_code: 'eur' }] },
  workshop_kit: { type: 'percentage', percentage_rate: 0 } // No platform fee; explicit 0% overrides site default
}

function tryCommissionRule(container: MedusaContainer, fn: () => Promise<unknown>) {
  return fn().catch((e: unknown) => {
    const raw = e as { message?: string }
    const msg = (raw?.message ?? String(e)).toLowerCase()
    if (!msg.includes('already') && !msg.includes('duplicate') && !msg.includes('unique') && !msg.includes('exists')) {
      throw e
    }
  })
}

export async function ensureHobbysalonProductTypes(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existing } = await query.graph({
    entity: 'product_type',
    fields: ['id', 'value'],
    filters: {}
  })
  const existingValues = new Set(existing.map((t: { value: string }) => t.value))
  const toCreate = HOBBYSALON_PRODUCT_TYPES.filter((v) => !existingValues.has(v))
  if (toCreate.length === 0) return existing

  try {
    const { result } = await createProductTypesWorkflow.run({
      container,
      input: { product_types: toCreate.map((value) => ({ value })) }
    })
    return [...existing, ...(result ?? [])]
  } catch (e: unknown) {
    const raw = e as { message?: string }
    const msg = (raw?.message ?? String(e)).toLowerCase()
    if (msg.includes('already') || msg.includes('duplicate') || msg.includes('unique') || msg.includes('exists')) {
      return existing
    }
    throw e
  }
}

export async function createHobbysalonCommissionRules(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: productTypes } = await query.graph({
    entity: 'product_type',
    fields: ['id', 'value'],
    filters: {}
  })
  const byValue = new Map(productTypes.map((t: { id: string; value: string }) => [t.value, t.id]))

  for (const value of HOBBYSALON_PRODUCT_TYPES) {
    const config = COMMISSION_CONFIG[value]
    if (!config) continue
    const refId = byValue.get(value)
    if (!refId) continue

    await tryCommissionRule(container, () =>
      createCommissionRuleWorkflow.run({
        container,
        input: {
          name: `hobbysalon-${value}`,
          is_active: true,
          reference: 'product_type',
          reference_id: refId,
          rate: {
            include_tax: true,
            type: config.type,
            ...(config.percentage_rate != null && { percentage_rate: config.percentage_rate }),
            ...(config.price_set && { price_set: config.price_set })
          }
        }
      })
    )
  }
}

export async function createDefaultCommissionLevel(container: MedusaContainer) {
  await tryCommissionRule(container, () =>
    createCommissionRuleWorkflow.run({
      container,
      input: {
        name: 'default',
        is_active: true,
        reference: 'site',
        reference_id: '',
        rate: {
          include_tax: true,
          type: 'percentage',
          percentage_rate: 2
        }
      }
    })
  )
}

export async function createConfigurationRules(container: MedusaContainer) {
  for (const [ruleType, isEnabled] of ConfigurationRuleDefaults) {
    try {
      await createConfigurationRuleWorkflow.run({
        container,
        input: {
          rule_type: ruleType,
          is_enabled: isEnabled
        }
      })
    } catch (e: unknown) {
      const raw = e as { message?: string }
      const msg = (raw?.message ?? String(e)).toLowerCase()
      if (!msg.includes('already') && !msg.includes('duplicate') && !msg.includes('unique') && !msg.includes('exists')) {
        throw e
      }
    }
  }
}
