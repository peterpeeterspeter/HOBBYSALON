import { batchInventoryItemLevelsWorkflow } from '@medusajs/core-flows'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { updateProductVariantsWorkflow } from '@medusajs/medusa/core-flows'

import { IntermediateEvents } from '@mercurjs/framework'

import sellerStockLocation from '../links/seller-stock-location'
import { PRODUCT_SYNC_JOB_STARTED_EVENT } from '../api/vendor/products/sync/constants'
import {
  VendorProductSyncUpdateType,
  VendorStartProductSync,
} from '../api/vendor/products/sync/validators'

type ProductSyncJobStartedPayload = {
  job_id: string
}

type ProductSyncJobRow = {
  id: string
  seller_id: string
  payload: unknown
}

type SellerVariantRow = {
  variant_id: string
  sku: string | null
  inventory_item_id: string | null
}

type ProductSyncErrorPreviewItem = {
  row: number
  sku: string
  reason: string
}

const chunk = <T>(items: T[], size: number): T[][] => {
  if (!items.length) {
    return []
  }

  const output: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size))
  }

  return output
}

const getMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error'

const parsePayload = (value: unknown): VendorProductSyncUpdateType[] => {
  const source =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value)
          } catch {
            return []
          }
        })()
      : value

  const parsed = VendorStartProductSync.safeParse({ updates: source })
  if (!parsed.success) {
    throw new Error('Invalid sync job payload')
  }

  return parsed.data.updates
}

const getVariantLookupBySku = async (
  knex: any,
  sellerId: string,
  skus: string[]
) => {
  const uniqueSkus = [...new Set(skus)].filter(Boolean)
  const lookup = new Map<
    string,
    { variantIds: Set<string>; inventoryItemIds: Set<string> }
  >()

  for (const skuChunk of chunk(uniqueSkus, 1000)) {
    const rows = (await knex('product_variant as pv')
      .select(
        'pv.id as variant_id',
        'pv.sku as sku',
        'pvii.inventory_item_id as inventory_item_id'
      )
      .innerJoin('seller_seller_product_product as sspp', function joinSeller() {
        this.on('sspp.product_id', '=', 'pv.product_id')
          .on('sspp.seller_id', '=', knex.raw('?', [sellerId]))
          .onNull('sspp.deleted_at')
      })
      .leftJoin('product_variant_inventory_item as pvii', function joinInventory() {
        this.on('pvii.variant_id', '=', 'pv.id').onNull('pvii.deleted_at')
      })
      .whereNull('pv.deleted_at')
      .whereIn('pv.sku', skuChunk)
      .whereNotNull('pv.sku')) as SellerVariantRow[]

    for (const row of rows) {
      if (!row.sku || !row.variant_id) {
        continue
      }

      const entry = lookup.get(row.sku) ?? {
        variantIds: new Set<string>(),
        inventoryItemIds: new Set<string>(),
      }

      entry.variantIds.add(row.variant_id)
      if (row.inventory_item_id) {
        entry.inventoryItemIds.add(row.inventory_item_id)
      }

      lookup.set(row.sku, entry)
    }
  }

  return lookup
}

export default async function productSyncJobStartedHandler({
  event,
  container,
}: SubscriberArgs<ProductSyncJobStartedPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const eventBus = container.resolve(Modules.EVENT_BUS)
  const { job_id: jobId } = event.data

  const transitionedRows = await knex('product_sync_job')
    .where('id', jobId)
    .whereNull('deleted_at')
    .where('status', 'queued')
    .update({
      status: 'processing',
      error_message: null,
      updated_at: new Date(),
    })

  if (!transitionedRows) {
    logger.info(
      `Skipping product sync job ${jobId}: already processing or finalized`
    )
    return
  }

  const job = (await knex('product_sync_job')
    .select('id', 'seller_id', 'payload')
    .where('id', jobId)
    .whereNull('deleted_at')
    .first()) as ProductSyncJobRow | undefined

  if (!job) {
    logger.error(`Product sync job ${jobId} not found after transitioning`)
    return
  }

  try {
    const updates = parsePayload(job.payload)
    const skuLookup = await getVariantLookupBySku(
      knex,
      job.seller_id,
      updates.map((update) => update.sku)
    )

    const { data: sellerLocationLinks } = await query.graph({
      entity: sellerStockLocation.entryPoint,
      fields: ['stock_location_id'],
      filters: {
        seller_id: job.seller_id,
      },
    })

    const sellerLocationIdSet = new Set(
      (sellerLocationLinks ?? [])
        .map((link: any) => link?.stock_location_id)
        .filter((locationId: unknown): locationId is string =>
          typeof locationId === 'string'
        )
    )

    const inventoryPairs = updates
      .map((update) => {
        const skuEntry = skuLookup.get(update.sku)
        if (
          !skuEntry ||
          skuEntry.variantIds.size !== 1 ||
          skuEntry.inventoryItemIds.size !== 1 ||
          !update.location_id
        ) {
          return null
        }

        const [inventoryItemId] = [...skuEntry.inventoryItemIds]
        return {
          inventoryItemId,
          locationId: update.location_id,
        }
      })
      .filter(
        (
          value
        ): value is { inventoryItemId: string; locationId: string } =>
          value !== null
      )

    const existingInventoryLevelRows = inventoryPairs.length
      ? await knex('inventory_level')
          .select('inventory_item_id', 'location_id')
          .whereIn(
            'inventory_item_id',
            [...new Set(inventoryPairs.map((pair) => pair.inventoryItemId))]
          )
          .whereIn('location_id', [
            ...new Set(inventoryPairs.map((pair) => pair.locationId)),
          ])
          .whereNull('deleted_at')
      : []

    const existingInventoryKeys = new Set(
      existingInventoryLevelRows.map(
        (row: { inventory_item_id: string; location_id: string }) =>
          `${row.inventory_item_id}::${row.location_id}`
      )
    )

    let processedCount = 0
    let acceptedCount = 0
    let rejectedCount = 0
    const errorPreview: ProductSyncErrorPreviewItem[] = []
    const changedInventoryItemIds = new Set<string>()

    for (const [index, update] of updates.entries()) {
      const rowNumber = index + 1
      const skuEntry = skuLookup.get(update.sku)
      const hasInventorySignal =
        update.stocked_quantity !== undefined ||
        update.incoming_quantity !== undefined

      let variantId: string | null = null
      let inventoryItemId: string | null = null
      const rowErrors: string[] = []

      if (!skuEntry) {
        rowErrors.push(`SKU "${update.sku}" was not found for this seller`)
      } else if (skuEntry.variantIds.size !== 1) {
        rowErrors.push(
          `SKU "${update.sku}" is ambiguous for this seller (${skuEntry.variantIds.size} variants)`
        )
      } else {
        ;[variantId] = [...skuEntry.variantIds]
      }

      if (hasInventorySignal) {
        if (!update.location_id) {
          rowErrors.push('location_id is required for inventory updates')
        } else if (!sellerLocationIdSet.has(update.location_id)) {
          rowErrors.push(
            `location_id "${update.location_id}" does not belong to this seller`
          )
        }

        if (!skuEntry || skuEntry.inventoryItemIds.size === 0) {
          rowErrors.push(`SKU "${update.sku}" has no linked inventory item`)
        } else if (skuEntry.inventoryItemIds.size > 1) {
          rowErrors.push(
            `SKU "${update.sku}" has multiple inventory items and cannot be synced automatically`
          )
        } else {
          ;[inventoryItemId] = [...skuEntry.inventoryItemIds]
        }
      }

      if (rowErrors.length) {
        rejectedCount += 1
        processedCount += 1
        if (errorPreview.length < 50) {
          errorPreview.push({
            row: rowNumber,
            sku: update.sku,
            reason: rowErrors.join('; '),
          })
        }
        continue
      }

      try {
        if (variantId && update.price_amount !== undefined) {
          await updateProductVariantsWorkflow.run({
            container,
            input: {
              selector: { id: variantId },
              update: {
                prices: [
                  {
                    currency_code: update.price_currency,
                    amount: update.price_amount,
                  },
                ],
              },
            },
          })
        }

        if (hasInventorySignal && inventoryItemId && update.location_id) {
          const inventoryKey = `${inventoryItemId}::${update.location_id}`
          const payload = {
            inventory_item_id: inventoryItemId,
            location_id: update.location_id,
            stocked_quantity: update.stocked_quantity,
            incoming_quantity: update.incoming_quantity,
          }

          await batchInventoryItemLevelsWorkflow.run({
            container,
            input: existingInventoryKeys.has(inventoryKey)
              ? {
                  update: [payload],
                }
              : {
                  create: [payload],
                },
          })

          existingInventoryKeys.add(inventoryKey)
          changedInventoryItemIds.add(inventoryItemId)
        }

        acceptedCount += 1
      } catch (error) {
        rejectedCount += 1
        if (errorPreview.length < 50) {
          errorPreview.push({
            row: rowNumber,
            sku: update.sku,
            reason: getMessage(error),
          })
        }
      } finally {
        processedCount += 1
      }

      if (processedCount % 100 === 0 || processedCount === updates.length) {
        await knex('product_sync_job')
          .where('id', jobId)
          .whereNull('deleted_at')
          .update({
            processed_count: processedCount,
            accepted_count: acceptedCount,
            rejected_count: rejectedCount,
            updated_at: new Date(),
          })
      }
    }

    if (changedInventoryItemIds.size) {
      await eventBus.emit({
        name: IntermediateEvents.INVENTORY_ITEM_CHANGED,
        data: { id: [...changedInventoryItemIds] },
      })
    }

    await knex('product_sync_job')
      .where('id', jobId)
      .whereNull('deleted_at')
      .update({
        status: rejectedCount ? 'completed_with_errors' : 'completed',
        processed_count: processedCount,
        accepted_count: acceptedCount,
        rejected_count: rejectedCount,
        error_message: null,
        result_preview: knex.raw('?::jsonb', [JSON.stringify(errorPreview)]),
        updated_at: new Date(),
      })
  } catch (error) {
    const message = getMessage(error).slice(0, 4000)

    await knex('product_sync_job')
      .where('id', jobId)
      .whereNull('deleted_at')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date(),
      })

    logger.error(`Product sync job ${jobId} failed: ${message}`)
  }
}

export const config: SubscriberConfig = {
  event: PRODUCT_SYNC_JOB_STARTED_EVENT,
  context: {
    subscriberId: 'product-sync-job-started-handler',
  },
}
