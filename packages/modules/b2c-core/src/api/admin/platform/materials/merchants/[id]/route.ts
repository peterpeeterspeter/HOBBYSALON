import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

type MerchantRow = {
  id: string
  name: string | null
  handle: string | null
  store_status: string | null
  seller_type: string | null
}

type IdLabelRow = {
  id: string
  source_category?: string | null
  product_category_id?: string | null
  name?: string | null
  provider?: string | null
  url?: string | null
  status?: string | null
  created_at?: string | Date | null
}

/**
 * @oas [get] /admin/platform/materials/merchants/{id}
 * operationId: "AdminGetMerchantMaterialsOverview"
 * summary: "Get Merchant Materials Overview"
 * description: "Returns detailed merchant readiness and latest records for mappings/imports/feeds/sync jobs."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellerId = String(req.params.id || '')

  const seller = (await knex('seller')
    .select('id', 'name', 'handle', 'store_status', 'seller_type')
    .where('id', sellerId)
    .whereNull('deleted_at')
    .first()) as MerchantRow | undefined

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Merchant seller ${sellerId} was not found`
    )
  }

  const [mappingRows, importRows, feedRows, syncRows, productRows] = await Promise.all([
    knex('merchant_category_mapping')
      .select('id', 'source_category', 'product_category_id', 'active', 'updated_at')
      .where('seller_id', sellerId)
      .whereNull('deleted_at')
      .orderBy('updated_at', 'desc')
      .limit(20),
    knex('product_import_job')
      .select('id', 'status', 'total_count', 'created_at')
      .where('seller_id', sellerId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(20),
    knex('merchant_feed_source')
      .select(
        'id',
        'name',
        'provider',
        'url',
        'method',
        'default_currency',
        'default_location_id',
        'headers',
        'mapping',
        'active',
        'auto_pull_enabled',
        'pull_interval_minutes',
        'updated_at'
      )
      .where('seller_id', sellerId)
      .whereNull('deleted_at')
      .orderBy('updated_at', 'desc')
      .limit(20),
    knex('product_sync_job')
      .select('id', 'status', 'total_count', 'accepted_count', 'rejected_count', 'created_at')
      .where('seller_id', sellerId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(20),
    knex('product as p')
      .distinct('p.id')
      .select('p.id', 'p.title', 'p.handle', 'p.status', 'p.updated_at')
      .innerJoin('seller_seller_product_product as sspp', function joinSellerProduct() {
        this.on('sspp.product_id', '=', 'p.id').onNull('sspp.deleted_at')
      })
      .where('sspp.seller_id', sellerId)
      .whereNull('p.deleted_at')
      .orderBy('p.updated_at', 'desc')
      .limit(20),
  ])

  const publishedProductCountRow = await knex('product as p')
    .countDistinct('p.id as count')
    .innerJoin('seller_seller_product_product as sspp', function joinSellerProduct() {
      this.on('sspp.product_id', '=', 'p.id').onNull('sspp.deleted_at')
    })
    .where('sspp.seller_id', sellerId)
    .whereNull('p.deleted_at')
    .where('p.status', 'published')
    .first()

  res.json({
    merchant: {
      seller_id: seller.id,
      seller_name: seller.name,
      seller_handle: seller.handle,
      store_status: seller.store_status,
      counts: {
        category_mappings: (mappingRows as IdLabelRow[]).filter((row: any) => row.active).length,
        import_jobs: importRows.length,
        feed_sources: (feedRows as any[]).filter((row) => row.active).length,
        sync_jobs: syncRows.length,
        published_products: Number.parseInt(
          String((publishedProductCountRow as any)?.count || 0),
          10
        ),
      },
      latest: {
        category_mappings: mappingRows,
        import_jobs: importRows,
        feed_sources: feedRows,
        sync_jobs: syncRows,
        products: productRows,
      },
    },
  })
}
