import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MedusaError } from '@medusajs/framework/utils'

import { fetchSellerByAuthActorId } from '../../../../../shared/infra/http/utils'
import {
  VendorImportDryRunMapping,
  type VendorImportDryRunMappingType,
  runVendorProductsImportDryRun,
} from './utils'

/**
 * @oas [post] /vendor/products/imports/dry-run
 * operationId: "VendorDryRunProductImport"
 * summary: "Dry Run Product CSV Import"
 * description: "Validates a product CSV import file and returns row-level validation errors without creating products."
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
 *             description: CSV file to validate.
 *           mapping:
 *             type: string
 *             description: JSON object mapping target fields to source CSV column names.
 *           delimiter:
 *             type: string
 *             description: Optional CSV delimiter (default autodetected comma behavior by parser options).
 *           currency_code:
 *             type: string
 *             description: Default currency code for mapped variant prices when not present in CSV.
 * responses:
 *   "200":
 *     description: OK
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
  const body = ((req as any).body || {}) as Record<string, unknown>

  if (!input) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No file was uploaded for dry-run import'
    )
  }

  await fetchSellerByAuthActorId(req.auth_context.actor_id, req.scope)

  let mapping: VendorImportDryRunMappingType | undefined
  if (body.mapping) {
    try {
      const rawMapping =
        typeof body.mapping === 'string'
          ? JSON.parse(body.mapping)
          : body.mapping
      mapping = VendorImportDryRunMapping.parse(rawMapping)
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid mapping payload: ${(error as Error).message}`
      )
    }
  }

  const dryRun = runVendorProductsImportDryRun({
    fileContent: input.buffer.toString('utf-8'),
    mapping,
    delimiter: typeof body.delimiter === 'string' ? body.delimiter : undefined,
    defaultCurrencyCode:
      typeof body.currency_code === 'string'
        ? body.currency_code
        : undefined,
  })

  res.json({ dry_run: dryRun })
}
