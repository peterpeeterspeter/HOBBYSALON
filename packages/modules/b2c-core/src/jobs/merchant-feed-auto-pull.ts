import { randomUUID } from 'node:crypto'

import { IEventBusModuleService, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

import { PRODUCT_SYNC_JOB_STARTED_EVENT } from '../api/vendor/products/sync/constants'
import { VendorStartProductSync } from '../api/vendor/products/sync/validators'
import {
  FeedSourceRow,
  buildSyncUpdatesFromFeed,
  parseFeedContent,
  serializeFeedSource,
} from '../api/vendor/products/feed-sources/utils'

const DEFAULT_PULL_INTERVAL_MINUTES = 60
const MAX_PREVIEW_ERRORS = 50

const isDue = (source: FeedSourceRow, now: Date) => {
  if (!source.active || !source.auto_pull_enabled) {
    return false
  }

  const intervalMinutes =
    source.pull_interval_minutes && source.pull_interval_minutes > 0
      ? source.pull_interval_minutes
      : DEFAULT_PULL_INTERVAL_MINUTES

  if (!source.last_pulled_at) {
    return true
  }

  const lastPulledAt = new Date(source.last_pulled_at)
  if (Number.isNaN(lastPulledAt.getTime())) {
    return true
  }

  return now.getTime() - lastPulledAt.getTime() >= intervalMinutes * 60 * 1000
}

const resolveSubmitterId = async (knex: any, sellerId: string) => {
  const member = await knex('member')
    .select('id')
    .where('seller_id', sellerId)
    .whereNull('deleted_at')
    .orderByRaw(
      `case when role = 'owner' then 0 when role = 'admin' then 1 else 2 end`
    )
    .first()

  return (member?.id as string | undefined) || sellerId
}

export default async function merchantFeedAutoPullJob(container: MedusaContainer) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const eventBus: IEventBusModuleService = container.resolve(Modules.EVENT_BUS)
  const now = new Date()

  const sources = (await knex('merchant_feed_source')
    .select('*')
    .where('active', true)
    .where('auto_pull_enabled', true)
    .whereNull('deleted_at')
    .orderBy('updated_at', 'asc')) as FeedSourceRow[]

  if (!sources.length) {
    return
  }

  for (const source of sources) {
    if (!isDue(source, now)) {
      continue
    }

    const serialized = serializeFeedSource(source)
    const headers = Object.fromEntries(
      Object.entries(serialized.headers || {}).map(([key, value]) => [
        key,
        String(value),
      ])
    )

    try {
      const response = await fetch(serialized.url, {
        method: serialized.method || 'GET',
        headers,
      })

      if (!response.ok) {
        throw new Error(`Feed request failed with status ${response.status}`)
      }

      const rawText = await response.text()
      const rows = parseFeedContent(
        rawText,
        source.provider,
        response.headers.get('content-type')
      )

      const buildResult = buildSyncUpdatesFromFeed(rows, {
        mapping: serialized.mapping,
        defaultCurrency: serialized.default_currency,
        defaultLocationId: serialized.default_location_id,
      })

      const validated = VendorStartProductSync.safeParse({
        updates: buildResult.updates,
      })

      if (!validated.success || !validated.data.updates.length) {
        const firstError = buildResult.errors[0]?.reason
        throw new Error(
          firstError || 'No valid sync updates could be created from feed'
        )
      }

      const submitterId = await resolveSubmitterId(knex, source.seller_id)
      const syncJobId = randomUUID()

      await knex('product_sync_job').insert({
        id: syncJobId,
        seller_id: source.seller_id,
        submitter_id: submitterId,
        status: 'queued',
        total_count: validated.data.updates.length,
        processed_count: 0,
        accepted_count: 0,
        rejected_count: 0,
        payload: knex.raw('?::jsonb', [JSON.stringify(validated.data.updates)]),
        error_message: null,
        result_preview: knex.raw('null'),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      })

      await eventBus.emit({
        name: PRODUCT_SYNC_JOB_STARTED_EVENT,
        data: {
          job_id: syncJobId,
        },
      })

      await knex('merchant_feed_source')
        .where('id', source.id)
        .whereNull('deleted_at')
        .update({
          last_pulled_at: new Date(),
          last_pull_status: 'success',
          last_error: null,
          last_sync_job_id: syncJobId,
          updated_at: new Date(),
        })
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 4000) : 'Unknown error'
      await knex('merchant_feed_source')
        .where('id', source.id)
        .whereNull('deleted_at')
        .update({
          last_pulled_at: new Date(),
          last_pull_status: 'failed',
          last_error: message,
          updated_at: new Date(),
        })

      logger.error(
        `Auto pull for merchant feed source ${source.id} failed: ${message}`
      )
    }
  }
}

export const config = {
  name: 'merchant-feed-auto-pull',
  schedule: '*/15 * * * *', // Every 15 minutes
}
