import { randomUUID } from 'node:crypto'

import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'

import {
  PRODUCT_IMPORT_JOB_STARTED_EVENT,
  ProductImportJobStatus,
} from '../../../../../../vendor/products/imports/constants'

type AdminStartImportBody = {
  csv_text?: string
  file_name?: string
}

/**
 * @oas [post] /admin/platform/materials/merchants/{id}/imports
 * operationId: "AdminStartMerchantProductImport"
 * summary: "Start Merchant Product Import"
 * description: "Starts a merchant CSV product import job."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: MedusaRequest<AdminStartImportBody>,
  res: MedusaResponse
) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  const sellerId = String(req.params.id || '')
  const body = (req.body || {}) as AdminStartImportBody

  const seller = await knex('seller')
    .select('id', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Merchant ${sellerId} not found`)
  }

  const csvText = typeof body.csv_text === 'string' ? body.csv_text : ''
  if (!csvText.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'csv_text is required')
  }

  const importJobId = randomUUID()
  const queuedStatus: ProductImportJobStatus = 'queued'
  const now = new Date()
  const actorId = `admin:${sellerId}`

  await knex('product_import_job').insert({
    id: importJobId,
    seller_id: sellerId,
    submitter_id: actorId,
    status: queuedStatus,
    file_name: body.file_name || 'admin-materials-import.csv',
    file_size: Buffer.byteLength(csvText, 'utf-8'),
    total_count: 0,
    error_message: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  })

  await eventBus.emit({
    name: PRODUCT_IMPORT_JOB_STARTED_EVENT,
    data: {
      job_id: importJobId,
      file_content: csvText,
      seller_id: sellerId,
      submitter_id: actorId,
    },
  })

  res.status(202).json({
    job: {
      id: importJobId,
      status: queuedStatus,
      total_count: 0,
      processed_count: 0,
      accepted_count: 0,
      rejected_count: 0,
      pending_count: 0,
    },
  })
}
