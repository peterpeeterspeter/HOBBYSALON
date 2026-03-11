import { randomUUID } from 'node:crypto'

import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../shared/infra/http/utils'
import { importSellerProductsWorkflow } from '../../../../workflows/seller/workflows'

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
  const importJobId = randomUUID()

  const { result: products } = await importSellerProductsWorkflow.run({
    container: req.scope,
    input: {
      file_content: input.buffer.toString('utf-8'),
      seller_id: seller.id,
      submitter_id: req.auth_context.actor_id,
      import_job_id: importJobId,
    },
  })

  res.status(202).json({
    job: {
      id: importJobId,
      status: 'processing',
      total_count: products.length,
      processed_count: 0,
      accepted_count: 0,
      rejected_count: 0,
      pending_count: products.length,
    },
  })
}
