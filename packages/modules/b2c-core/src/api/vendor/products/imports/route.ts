import { randomUUID } from 'node:crypto'

import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../shared/infra/http/utils'
import {
  PRODUCT_IMPORT_JOB_STARTED_EVENT,
  type ProductImportJobStatus,
} from './constants'
import { VendorGetProductImportJobsParamsType } from './validators'

type ProductImportJobListRow = {
  id: string
  status: ProductImportJobStatus
  file_name: string | null
  file_size: number | null
  total_count: number
  error_message: string | null
  created_at: Date | string
  updated_at: Date | string
}

/**
 * @oas [get] /vendor/products/imports
 * operationId: "VendorListProductImportJobs"
 * summary: "List Product Import Jobs"
 * description: "Retrieves product import jobs for the authenticated vendor."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const validatedQuery = req.validatedQuery as VendorGetProductImportJobsParamsType

  const offset = Number(validatedQuery.offset) || 0
  const limit = Number(validatedQuery.limit) || 20

  let baseQuery = knex('product_import_job')
    .where('seller_id', seller.id)
    .whereNull('deleted_at')

  if (validatedQuery.status) {
    baseQuery = baseQuery.where('status', validatedQuery.status)
  }

  const [{ count }] = await baseQuery
    .clone()
    .clearSelect()
    .clearOrder()
    .count('* as count')

  const jobs = (await baseQuery
    .clone()
    .select(
      'id',
      'status',
      'file_name',
      'file_size',
      'total_count',
      'error_message',
      'created_at',
      'updated_at'
    )
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(limit)) as ProductImportJobListRow[]

  res.json({
    jobs,
    count: Number.parseInt(String(count || 0), 10),
    offset,
    limit,
  })
}

/**
 * @oas [post] /vendor/products/imports
 * operationId: "VendorStartProductImport"
 * summary: "Start Product Import Job"
 * description: "Starts a CSV product import and returns a job identifier to track progress."
 * x-authenticated: true
 * requestBody:
 *   content:
 *     multipart/form-data:
 *       schema:
 *         type: object
 *         required:
 *           - file
 *         properties:
 *           file:
 *             type: string
 *             format: binary
 *             description: CSV file to import.
 * responses:
 *   "202":
 *     description: Accepted
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const input = (req as any).file

  if (!input) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No file was uploaded for importing'
    )
  }

  const seller = await fetchSellerByAuthActorId(
    req.auth_context.actor_id,
    req.scope
  )
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  const importJobId = randomUUID()
  const queuedStatus: ProductImportJobStatus = 'queued'
  const now = new Date()

  await knex('product_import_job').insert({
    id: importJobId,
    seller_id: seller.id,
    submitter_id: req.auth_context.actor_id,
    status: queuedStatus,
    file_name: input.originalname || null,
    file_size: Number.isFinite(input.size) ? input.size : null,
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
      file_content: input.buffer.toString('utf-8'),
      seller_id: seller.id,
      submitter_id: req.auth_context.actor_id,
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
