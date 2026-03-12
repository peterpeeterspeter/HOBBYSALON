import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

type MerchantOverviewRow = {
  seller_id: string
  seller_name: string | null
  seller_handle: string | null
  store_status: string | null
  category_mapping_count: string | number
  import_job_count: string | number
  feed_source_count: string | number
  sync_job_count: string | number
  published_product_count: string | number
}

/**
 * @oas [get] /admin/platform/materials/merchants
 * operationId: "AdminListMerchantMaterialsOverview"
 * summary: "List Merchant Materials Overview"
 * description: "Returns merchant readiness metrics for materials marketplace onboarding."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const limitRaw = Number.parseInt(String(req.query.limit || '25'), 10)
  const offsetRaw = Number.parseInt(String(req.query.offset || '0'), 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0
  const q = String(req.query.q || '').trim()

  let baseQuery = knex('seller as s')
    .leftJoin('merchant_category_mapping as mcm', function joinMappings() {
      this.on('mcm.seller_id', '=', 's.id').onNull('mcm.deleted_at')
    })
    .leftJoin('product_import_job as pij', function joinImports() {
      this.on('pij.seller_id', '=', 's.id').onNull('pij.deleted_at')
    })
    .leftJoin('merchant_feed_source as mfs', function joinFeeds() {
      this.on('mfs.seller_id', '=', 's.id').onNull('mfs.deleted_at')
    })
    .leftJoin('product_sync_job as psj', function joinSyncs() {
      this.on('psj.seller_id', '=', 's.id').onNull('psj.deleted_at')
    })
    .leftJoin('seller_seller_product_product as sspp', function joinSellerProducts() {
      this.on('sspp.seller_id', '=', 's.id').onNull('sspp.deleted_at')
    })
    .leftJoin('product as p', function joinProducts() {
      this.on('p.id', '=', 'sspp.product_id').onNull('p.deleted_at')
    })
    .whereNull('s.deleted_at')
    .where('s.seller_type', 'merchant')

  if (q) {
    const query = `%${q}%`
    baseQuery = baseQuery.andWhere((builder: any) => {
      builder.whereILike('s.name', query).orWhereILike('s.handle', query)
    })
  }

  const countRow = await knex('seller as s')
    .count('* as count')
    .whereNull('s.deleted_at')
    .where('s.seller_type', 'merchant')
    .modify((builder: any) => {
      if (!q) {
        return
      }
      const query = `%${q}%`
      builder.andWhere((inner: any) => {
        inner.whereILike('s.name', query).orWhereILike('s.handle', query)
      })
    })
    .first()

  const rows = (await baseQuery
    .groupBy('s.id', 's.name', 's.handle', 's.store_status')
    .select(
      's.id as seller_id',
      's.name as seller_name',
      's.handle as seller_handle',
      's.store_status',
      knex.raw(
        "count(distinct case when mcm.active = true then mcm.id else null end) as category_mapping_count"
      ),
      knex.raw('count(distinct pij.id) as import_job_count'),
      knex.raw(
        "count(distinct case when mfs.active = true then mfs.id else null end) as feed_source_count"
      ),
      knex.raw(
        "count(distinct case when psj.status in ('completed', 'completed_with_errors') then psj.id else null end) as sync_job_count"
      ),
      knex.raw(
        "count(distinct case when p.status = 'published' then p.id else null end) as published_product_count"
      )
    )
    .orderBy('s.name', 'asc')
    .offset(offset)
    .limit(limit)) as MerchantOverviewRow[]

  const merchants = rows.map((row) => ({
    seller_id: row.seller_id,
    seller_name: row.seller_name,
    seller_handle: row.seller_handle,
    store_status: row.store_status,
    category_mapping_count: Number.parseInt(String(row.category_mapping_count || 0), 10),
    import_job_count: Number.parseInt(String(row.import_job_count || 0), 10),
    feed_source_count: Number.parseInt(String(row.feed_source_count || 0), 10),
    sync_job_count: Number.parseInt(String(row.sync_job_count || 0), 10),
    published_product_count: Number.parseInt(String(row.published_product_count || 0), 10),
  }))

  res.json({
    merchants,
    count: Number.parseInt(String(countRow?.count || 0), 10),
    offset,
    limit,
  })
}
