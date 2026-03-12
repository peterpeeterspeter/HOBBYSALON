import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * @oas [get] /admin/platform/materials/categories
 * operationId: "AdminListPlatformMaterialCategories"
 * summary: "List Material Categories"
 * description: "Returns product categories that can be used for merchant category mapping."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const rows = await knex('product_category')
    .select('id', 'name', 'handle')
    .whereNull('deleted_at')
    .orderBy('rank', 'asc')
    .orderBy('name', 'asc')

  res.json({
    categories: rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      handle: row.handle,
    })),
  })
}
