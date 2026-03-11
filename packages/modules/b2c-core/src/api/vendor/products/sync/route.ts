import { randomUUID } from 'node:crypto'

import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../shared/infra/http/utils'
import {
  PRODUCT_SYNC_JOB_STARTED_EVENT,
  ProductSyncJobStatus,
} from './constants'
import {
  VendorGetProductSyncJobsParamsType,
  VendorStartProductSyncType,
} from './validators'

type ProductSyncJobListRow = {
  id: string
  status: ProductSyncJobStatus
  total_count: number
  processed_count: number
  accepted_count: number
  rejected_count: number
  error_message: string | null
  created_at: Date | string
  updated_at: Date | string
}

/**
 * @oas [get] /vendor/products/sync
 * operationId: "VendorListProductSyncJobs"
 * summary: "List Product Sync Jobs"
 * description: "Retrieves stock and price sync jobs for the authenticated merchant."
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
  const validatedQuery = req.validatedQuery as VendorGetProductSyncJobsParamsType

  const offset = Number(validatedQuery.offset) || 0
  const limit = Number(validatedQuery.limit) || 20

  let baseQuery = knex('product_sync_job')
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
      'total_count',
      'processed_count',
      'accepted_count',
      'rejected_count',
      'error_message',
      'created_at',
      'updated_at'
    )
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(limit)) as ProductSyncJobListRow[]

  res.json({
    jobs,
    count: Number.parseInt(String(count || 0), 10),
    offset,
    limit,
  })
}

/**
 * @oas [post] /vendor/products/sync
 * operationId: "VendorStartProductSync"
 * summary: "Start Product Price/Stock Sync Job"
 * description: "Queues a bulk sync job to update variant prices and inventory by SKU for the authenticated merchant."
 * x-authenticated: true
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         required:
 *           - updates
 *         properties:
 *           updates:
 *             type: array
 *             description: List of SKU-based updates.
 *             items:
 *               type: object
 *               required:
 *                 - sku
 *               properties:
 *                 sku:
 *                   type: string
 *                 price_amount:
 *                   type: number
 *                 price_currency:
 *                   type: string
 *                 stocked_quantity:
 *                   type: number
 *                 incoming_quantity:
 *                   type: number
 *                 location_id:
 *                   type: string
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
  req: AuthenticatedMedusaRequest<VendorStartProductSyncType>,
  res: MedusaResponse
) => {
  const seller = await fetchSellerByAuthActorId(
    req.auth_context.actor_id,
    req.scope,
    ['id', 'seller_type']
  )

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Product sync is only available for merchant sellers'
    )
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  const jobId = randomUUID()
  const now = new Date()
  const updates = req.validatedBody.updates
  const queuedStatus: ProductSyncJobStatus = 'queued'

  await knex('product_sync_job').insert({
    id: jobId,
    seller_id: seller.id,
    submitter_id: req.auth_context.actor_id,
    status: queuedStatus,
    total_count: updates.length,
    processed_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    payload: knex.raw('?::jsonb', [JSON.stringify(updates)]),
    error_message: null,
    result_preview: knex.raw('null'),
    created_at: now,
    updated_at: now,
    deleted_at: null,
  })

  await eventBus.emit({
    name: PRODUCT_SYNC_JOB_STARTED_EVENT,
    data: {
      job_id: jobId,
    },
  })

  res.status(202).json({
    job: {
      id: jobId,
      status: queuedStatus,
      total_count: updates.length,
      processed_count: 0,
      accepted_count: 0,
      rejected_count: 0,
    },
  })
}
