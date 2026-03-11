import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../shared/infra/http/utils'
import { ProductSyncJobStatus } from '../constants'

type ProductSyncJobRow = {
  id: string
  seller_id: string
  submitter_id: string
  status: ProductSyncJobStatus
  total_count: number
  processed_count: number
  accepted_count: number
  rejected_count: number
  error_message: string | null
  result_preview: unknown
  created_at: Date | string
  updated_at: Date | string
}

const parseResultPreview = (value: unknown) => {
  if (value === null || value === undefined) {
    return []
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return Array.isArray(value) ? value : []
}

/**
 * @oas [get] /vendor/products/sync/{job_id}
 * operationId: "VendorGetProductSyncJob"
 * summary: "Get Product Sync Job Status"
 * description: "Retrieves progress and summary errors for a previously started product sync job."
 * x-authenticated: true
 * parameters:
 *   - name: job_id
 *     in: path
 *     required: true
 *     schema:
 *       type: string
 *     description: The sync job identifier.
 * responses:
 *   "200":
 *     description: OK
 *   "404":
 *     description: Job not found
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
  const { job_id: jobId } = req.params
  if (!jobId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Missing job_id')
  }

  const seller = await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const job = (await knex('product_sync_job')
    .select(
      'id',
      'seller_id',
      'submitter_id',
      'status',
      'total_count',
      'processed_count',
      'accepted_count',
      'rejected_count',
      'error_message',
      'result_preview',
      'created_at',
      'updated_at'
    )
    .where('id', jobId)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()) as ProductSyncJobRow | undefined

  if (!job) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Sync job ${jobId} was not found`
    )
  }

  res.json({
    job: {
      id: job.id,
      status: job.status,
      total_count: job.total_count,
      processed_count: job.processed_count,
      accepted_count: job.accepted_count,
      rejected_count: job.rejected_count,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
    },
    errors: parseResultPreview(job.result_preview),
  })
}
