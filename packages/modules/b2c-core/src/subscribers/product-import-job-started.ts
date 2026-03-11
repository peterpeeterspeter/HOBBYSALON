import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

import { importSellerProductsWorkflow } from '../workflows/seller/workflows'
import { PRODUCT_IMPORT_JOB_STARTED_EVENT } from '../api/vendor/products/imports/constants'

type ProductImportJobStartedPayload = {
  job_id: string
  file_content: string
  seller_id: string
  submitter_id: string
}

export default async function productImportJobStartedHandler({
  event,
  container,
}: SubscriberArgs<ProductImportJobStartedPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const input = event.data
  const now = new Date()

  const transitionedRows = await knex('product_import_job')
    .where('id', input.job_id)
    .whereNull('deleted_at')
    .where('status', 'queued')
    .update({
      status: 'processing',
      updated_at: now,
      error_message: null,
    })

  if (!transitionedRows) {
    logger.info(
      `Skipping product import job ${input.job_id}: already processing or finalized`
    )
    return
  }

  try {
    const { result: products } = await importSellerProductsWorkflow.run({
      container,
      input: {
        file_content: input.file_content,
        seller_id: input.seller_id,
        submitter_id: input.submitter_id,
        import_job_id: input.job_id,
      },
    })

    await knex('product_import_job')
      .where('id', input.job_id)
      .whereNull('deleted_at')
      .update({
        status: 'submitted',
        total_count: products.length,
        updated_at: new Date(),
      })
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 4000) : 'Unknown error'

    await knex('product_import_job')
      .where('id', input.job_id)
      .whereNull('deleted_at')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date(),
      })

    logger.error(`Product import job ${input.job_id} failed: ${message}`)
  }
}

export const config: SubscriberConfig = {
  event: PRODUCT_IMPORT_JOB_STARTED_EVENT,
  context: {
    subscriberId: 'product-import-job-started-handler',
  },
}
