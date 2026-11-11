import { MedusaRequest, MedusaResponse } from '@medusajs/framework'

import {
  groupMaterialCategories,
  listMaterialCategories,
} from '../../../../../shared/platform/material-categories'
import { createPlatformSupabaseClient } from '../../../../../shared/platform/supabase-rest-client'

/**
 * @oas [get] /admin/platform/materials/categories
 * operationId: "AdminListPlatformMaterialCategories"
 * summary: "List Material Categories"
 * description: "Returns the platform material subcategories (catalog = 'material') that merchant category mappings target."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const supabase = createPlatformSupabaseClient()
  if (!supabase) {
    res.json({ categories: [] })
    return
  }

  const groups = groupMaterialCategories(await listMaterialCategories(supabase))
  res.json({
    categories: groups.flatMap((group) =>
      group.children.map((sub) => ({
        id: sub.id,
        name: `${group.name} › ${sub.name}`,
        handle: sub.slug,
      }))
    ),
  })
}
