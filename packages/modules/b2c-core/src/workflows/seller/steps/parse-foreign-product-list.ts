import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { normalizeProductList } from '../../../api/vendor/products/imports/normalize'

/**
 * Converts a foreign product list (Shopify/WooCommerce/Excel/CRM export) into
 * product DTOs with the same normalizer the dry-run uses. Rejects the whole
 * file when any row has an error, so imports never silently drop rows.
 */
export const parseForeignProductListStep = createStep(
  'parse-foreign-product-list',
  async (
    input: { file_content: string; seller_id: string; default_currency_code?: string },
    { container }
  ) => {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const mappingRows = (await knex('merchant_category_mapping')
      .select('source_category_normalized', 'product_category_id')
      .where('seller_id', input.seller_id)
      .where('active', true)
      .whereNull('deleted_at')) as Array<{
      source_category_normalized: string
      product_category_id: string
    }>

    const result = normalizeProductList({
      fileContent: input.file_content,
      defaultCurrencyCode: input.default_currency_code || 'eur',
      sourceCategoryDomainMap: Object.fromEntries(
        mappingRows.map((r) => [r.source_category_normalized, r.product_category_id])
      ),
    })

    if (result.errors.length) {
      const summary = result.errors
        .slice(0, 10)
        .map((e) => `rij ${e.row}${e.field ? ` (${e.field})` : ''}: ${e.message}`)
        .join('; ')
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Import geweigerd: ${result.errors.length} fout(en). ${summary}`
      )
    }

    if (!result.products.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Geen producten gevonden in bestand')
    }

    return new StepResponse(result.products.map((p) => p.product))
  }
)
