import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'

import {
  groupMaterialCategories,
  listMaterialCategories,
} from '../../../../shared/platform/material-categories'
import { createPlatformSupabaseClient } from '../../../../shared/platform/supabase-rest-client'

/**
 * @oas [get] /vendor/platform/material-categories
 * operationId: "VendorListMaterialCategories"
 * summary: "List Material Categories"
 * description: "Returns the platform material taxonomy (groups with subcategories) that shop products use on /materials."
 * x-authenticated: true
 * tags:
 *   - Vendor Products
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const supabase = createPlatformSupabaseClient()
  if (!supabase) {
    res.json({ groups: [] })
    return
  }

  const rows = await listMaterialCategories(supabase)
  res.json({ groups: groupMaterialCategories(rows) })
}
