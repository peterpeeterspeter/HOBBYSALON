import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  LegacyPayoutGapError,
  parseLegacyPayoutGapFilters,
  readLegacyPayoutGapReport,
} from '../../../../../utils/legacy-payout-gap-report'

/**
 * GET /admin/platform/commerce-recovery/legacy-payouts
 * Read-only list of local payouts the new execution ledger does not cover.
 * Does not call Stripe and does not write a ledger row.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const auth = req.auth_context
  if (!auth || typeof auth.actor_id !== 'string' || !auth.actor_id.trim()) {
    return res.status(401).json({ code: 'unauthorized', message: 'Authentication required.' })
  }
  if (auth.actor_type !== 'user') {
    return res.status(403).json({ code: 'forbidden', message: 'Authenticated admin user required.' })
  }
  try {
    parseLegacyPayoutGapFilters(req.query)
    const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const report = await readLegacyPayoutGapReport(db, req.query)
    return res.status(200).json(report)
  } catch (error) {
    if (error instanceof LegacyPayoutGapError) {
      return res.status(400).json({ code: 'invalid_legacy_payout_filters', message: 'Invalid legacy payout inspection filters.' })
    }
    return res.status(503).json({ code: 'legacy_payout_inspection_unavailable', message: 'Legacy payout inspection unavailable.' })
  }
}
