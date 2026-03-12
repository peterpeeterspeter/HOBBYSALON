import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import {
  VendorImportDryRunMapping,
  VendorImportDryRunMappingType,
  runVendorProductsImportDryRun,
} from '../../../../../../../vendor/products/imports/dry-run/utils'

type AdminImportDryRunBody = {
  csv_text?: string
  mapping?: VendorImportDryRunMappingType
  delimiter?: string
  currency_code?: string
}

/**
 * @oas [post] /admin/platform/materials/merchants/{id}/imports/dry-run
 * operationId: "AdminDryRunMerchantProductImport"
 * summary: "Dry Run Merchant Product Import"
 * description: "Validates merchant CSV import payload and returns row-level validation errors."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: MedusaRequest<AdminImportDryRunBody>,
  res: MedusaResponse
) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellerId = String(req.params.id || '')
  const body = (req.body || {}) as AdminImportDryRunBody

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

  let mapping: VendorImportDryRunMappingType | undefined
  if (body.mapping) {
    const parsed = VendorImportDryRunMapping.safeParse(body.mapping)
    if (!parsed.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      )
    }
    mapping = parsed.data
  }

  const mappingRows = (await knex('merchant_category_mapping')
    .select('source_category_normalized', 'product_category_id')
    .where('seller_id', sellerId)
    .where('active', true)
    .whereNull('deleted_at')) as Array<{
    source_category_normalized: string
    product_category_id: string
  }>

  const sourceCategoryDomainMap = Object.fromEntries(
    mappingRows.map((row) => [row.source_category_normalized, row.product_category_id])
  )

  const dryRun = runVendorProductsImportDryRun({
    fileContent: csvText,
    mapping,
    delimiter: typeof body.delimiter === 'string' ? body.delimiter : undefined,
    defaultCurrencyCode:
      typeof body.currency_code === 'string' ? body.currency_code : undefined,
    sourceCategoryDomainMap,
  })

  res.json({ dry_run: dryRun })
}
