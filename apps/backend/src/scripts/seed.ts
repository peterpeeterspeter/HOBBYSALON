import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

import {
  createAdminUser,
  createConfigurationRules,
  createDefaultCommissionLevel,
  createHobbysalonCommissionRules,
  createHobbysalonProducts,
  createInventoryItemStockLevels,
  createProductCategories,
  createProductCollections,
  createPublishableKey,
  createRegions,
  createSalesChannel,
  createSeller,
  createSellerProducts,
  createSellerShippingOption,
  createSellerStockLocation,
  createServiceZoneForFulfillmentSet,
  createStore,
  ensureHobbysalonProductTypes
} from './seed/seed-functions'

export default async function seedMarketplaceData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('=== Configurations ===')
  logger.info('Creating admin user...')
  await createAdminUser(container)
  logger.info('Creating default sales channel...')
  const salesChannel = await createSalesChannel(container)
  logger.info('Creating default regions...')
  const region = await createRegions(container)
  logger.info('Creating publishable api key...')
  const apiKey = await createPublishableKey(container, salesChannel.id)
  logger.info('Creating store data...')
  await createStore(container, salesChannel.id, region.id)
  logger.info('Creating configuration rules...')
  await createConfigurationRules(container)

  logger.info('=== Example data ===')
  logger.info('Creating product categories...')
  await createProductCategories(container)
  logger.info('Creating product collections...')
  await createProductCollections(container)
  logger.info('Ensuring Hobbysalon product types...')
  await ensureHobbysalonProductTypes(container)
  logger.info('Creating seller...')
  const seller = await createSeller(container)

  // Check if stock location already exists for this seller to avoid duplicates
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existingLocations } = await query.graph({
    entity: 'stock_location',
    fields: ['*', 'fulfillment_sets.*'],
    filters: {}
  })
  let stockLocation = existingLocations.find(
    (loc: { name: string }) => loc.name === `Stock Location for seller ${seller.id}`
  )

  let serviceZone: { id: string }
  if (!stockLocation) {
    logger.info('Creating seller stock location...')
    stockLocation = await createSellerStockLocation(container, seller.id, salesChannel.id)
    logger.info('Creating service zone...')
    serviceZone = await createServiceZoneForFulfillmentSet(
      container,
      seller.id,
      stockLocation.fulfillment_sets[0].id
    )
    logger.info('Creating seller shipping option...')
    await createSellerShippingOption(container, seller.id, seller.name, region.id, serviceZone.id)
  } else {
    logger.info('Seller stock location already exists...')
    const { Modules } = await import('@medusajs/framework/utils')
    const fulfillmentService = container.resolve(Modules.FULFILLMENT)
    const [zone] = await fulfillmentService.listServiceZones({
      fulfillment_set: { id: stockLocation.fulfillment_sets[0].id }
    })
    serviceZone = zone
    let hasShippingOption = false
    try {
      const sellerShippingOptionLink = (await import('@mercurjs/b2c-core/links/seller-shipping-option')).default as any
      const { data: sellerShippingOpts } = await query.graph({
        entity: sellerShippingOptionLink.entryPoint,
        fields: ['shipping_option_id'],
        filters: { seller_id: seller.id }
      })
      hasShippingOption = !!sellerShippingOpts?.length
    } catch {
      hasShippingOption = false
    }
    if (!hasShippingOption) {
      logger.info('Creating seller shipping option (was missing)...')
      await createSellerShippingOption(container, seller.id, seller.name, region.id, serviceZone.id)
    } else {
      logger.info('Seller already has shipping option, skipping...')
    }
  }

  logger.info('Creating seller products...')
  await createSellerProducts(container, seller.id, salesChannel.id)
  logger.info('Creating Hobbysalon products...')
  await createHobbysalonProducts(container, seller.id, salesChannel.id)
  logger.info('Creating inventory levels...')
  await createInventoryItemStockLevels(container, stockLocation.id)
  logger.info('Creating default commission...')
  await createDefaultCommissionLevel(container)
  logger.info('Creating Hobbysalon commission rules...')
  await createHobbysalonCommissionRules(container)

  logger.info('=== Finished ===')
  logger.info(`Publishable api key: ${apiKey.token}`)
  logger.info(`Admin panel access:`)
  logger.info(`email: admin@mercurjs.com`)
  logger.info(`pass: supersecret`)
  logger.info(`Vendor panel access:`)
  logger.info(`email: seller@mercurjs.com`)
  logger.info(`pass: secret`)
}
