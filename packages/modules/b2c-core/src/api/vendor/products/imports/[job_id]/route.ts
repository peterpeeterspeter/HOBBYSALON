import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../shared/infra/http/utils'
import { ProductImportJobStatus } from '../constants'

type RequestRow = {
  id: string
  status: 'draft' | 'pending' | 'accepted' | 'rejected'
  data: Record<string, unknown> | null
  created_at: Date | string
  updated_at: Date | string
}

type ProductImportJobRow = {
  id: string
  seller_id: string
  submitter_id: string
  status: ProductImportJobStatus
  file_name: string | null
  file_size: number | null
  total_count: number
  error_message: string | null
  created_at: Date | string
  updated_at: Date | string
}

/**
 * @oas [get] /vendor/products/imports/{job_id}
 * operationId: "VendorGetProductImportJob"
 * summary: "Get Product Import Job Status"
 * description: "Retrieves progress for a previously started product import job."
 * x-authenticated: true
 * parameters:
 *   - name: job_id
 *     in: path
 *     required: true
 *     schema:
 *       type: string
 *     description: The import job identifier.
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
  const job = (await knex('product_import_job')
    .select(
      'id',
      'seller_id',
      'submitter_id',
      'status',
      'file_name',
      'file_size',
      'total_count',
      'error_message',
      'created_at',
      'updated_at'
    )
    .where('id', jobId)
    .where('seller_id', seller.id)
    .whereNull('deleted_at')
    .first()) as ProductImportJobRow | undefined

  if (!job) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Import job ${jobId} was not found`
    )
  }

  const rows = (await knex('request as r')
    .select('r.id', 'r.status', 'r.data', 'r.created_at', 'r.updated_at')
    .where('r.type', 'product_import')
    .andWhere('r.submitter_id', job.submitter_id)
    .andWhereRaw("coalesce(r.data->>'import_job_id', '') = ?", [jobId])
    .orderBy('r.created_at', 'asc')) as RequestRow[]

  const counts = rows.reduce(
    (acc, row) => {
      if (row.status === 'accepted') {
        acc.accepted_count += 1
      } else if (row.status === 'rejected') {
        acc.rejected_count += 1
      } else {
        acc.pending_count += 1
      }

      return acc
    },
    { accepted_count: 0, rejected_count: 0, pending_count: 0 }
  )

  const totalCount = Math.max(job.total_count || 0, rows.length)
  const processedCount = counts.accepted_count + counts.rejected_count
  let status:
    | ProductImportJobStatus
    | 'completed'
    | 'completed_with_errors'
    | 'processing'

  if (job.status === 'failed') {
    status = 'failed'
  } else if (!rows.length) {
    status = job.status
  } else if (counts.pending_count > 0) {
    status = 'processing'
  } else if (counts.rejected_count > 0) {
    status = counts.accepted_count > 0 ? 'completed_with_errors' : 'failed'
  } else {
    status = 'completed'
  }

  const createdAt = job.created_at
  const updatedAt = rows[rows.length - 1]?.updated_at || job.updated_at
  const items = rows.slice(0, 50).map((row) => ({
    request_id: row.id,
    status: row.status,
    product_id:
      row.data && typeof row.data.product_id === 'string'
        ? row.data.product_id
        : null,
    import_row_index:
      row.data && typeof row.data.import_row_index === 'number'
        ? row.data.import_row_index
        : null,
  }))

  res.json({
    job: {
      id: jobId,
      status,
      total_count: totalCount,
      processed_count: processedCount,
      ...counts,
      file_name: job.file_name,
      file_size: job.file_size,
      error_message: job.error_message,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    items,
  })
}
