import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../shared/infra/http/utils'

type RequestRow = {
  id: string
  status: 'draft' | 'pending' | 'accepted' | 'rejected'
  data: Record<string, unknown> | null
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

  await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const rows = (await knex('request as r')
    .select('r.id', 'r.status', 'r.data', 'r.created_at', 'r.updated_at')
    .where('r.type', 'product_import')
    .andWhere('r.submitter_id', req.auth_context.actor_id)
    .andWhereRaw("coalesce(r.data->>'import_job_id', '') = ?", [jobId])
    .orderBy('r.created_at', 'asc')) as RequestRow[]

  if (!rows.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Import job ${jobId} was not found`
    )
  }

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

  const totalCount = rows.length
  const processedCount = counts.accepted_count + counts.rejected_count
  const status =
    counts.pending_count > 0
      ? 'processing'
      : counts.rejected_count > 0
        ? counts.accepted_count > 0
          ? 'completed_with_errors'
          : 'failed'
        : 'completed'

  const createdAt = rows[0]?.created_at
  const updatedAt = rows[rows.length - 1]?.updated_at
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
      created_at: createdAt,
      updated_at: updatedAt,
    },
    items,
  })
}
