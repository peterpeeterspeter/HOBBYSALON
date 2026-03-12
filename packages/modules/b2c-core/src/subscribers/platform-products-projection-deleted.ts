import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

import { AlgoliaEvents } from '@mercurjs/framework'

type ProductDeletedPayload = {
  ids: string[]
}

const SUPABASE_URL =
  process.env.PLATFORM_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

const archiveProducts = async (ids: string[]) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return
  }

  for (const id of ids) {
    const endpoint = new URL('/rest/v1/products', SUPABASE_URL)
    endpoint.searchParams.set('medusa_product_id', `eq.${id}`)

    const response = await fetch(endpoint.toString(), {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status: 'archived',
        is_active: false,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `Failed to archive platform product ${id} (${response.status}): ${body || response.statusText}`
      )
    }
  }
}

export default async function platformProductsProjectionDeletedHandler({
  event,
  container,
}: SubscriberArgs<ProductDeletedPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ids = [...new Set((event.data?.ids || []).filter(Boolean))]

  if (!ids.length) {
    return
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.debug(
      'Platform delete projection skipped: missing PLATFORM_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or PLATFORM_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY'
    )
    return
  }

  await archiveProducts(ids)
  logger.info(`Platform projection archived ${ids.length} deleted products`)
}

export const config: SubscriberConfig = {
  event: AlgoliaEvents.PRODUCTS_DELETED,
  context: {
    subscriberId: 'platform-products-projection-deleted-handler',
  },
}
