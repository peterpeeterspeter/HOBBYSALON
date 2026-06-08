import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

import {
  createPublishableKey,
  createRegions,
  createSalesChannel,
  createStore
} from './seed/seed-functions'

export default async function initializeStore({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const salesChannel = await createSalesChannel(container)
  const region = await createRegions(container)
  const publishableKey = await createPublishableKey(
    container,
    salesChannel.id
  )

  await createStore(container, salesChannel.id, region.id)

  logger.info('Production store initialized')
  logger.info(`Publishable API key: ${publishableKey.token}`)
}
