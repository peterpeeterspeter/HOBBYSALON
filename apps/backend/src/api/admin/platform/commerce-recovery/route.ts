import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { parseRecoveryFilters, readCommerceRecoveryReport, RecoveryFilterError } from '../../../../utils/commerce-recovery-report'

/**
 * GET /admin/platform/commerce-recovery — read-only operator inspection.
 * Preserve native /admin authentication. Medusa 2.11.3 ADMIN_ACTOR_TYPE is "user";
 * API keys authenticate as "api-key" and are deliberately insufficient here.
 * This endpoint cannot authorize refunds, retries, reconciliation writes or completion.
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
    // Validate before resolving privileged DB services; helper independently validates too.
    parseRecoveryFilters(req.query)
    const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const report = await readCommerceRecoveryReport(db, req.query)
    return res.status(200).json(report)
  } catch (error) {
    if (error instanceof RecoveryFilterError) {
      return res.status(400).json({ code: 'invalid_recovery_filters', message: 'Invalid recovery inspection filters.' })
    }
    // No original message, SQL, bindings, provider payload or error cause is exposed/logged.
    return res.status(503).json({ code: 'recovery_inspection_unavailable', message: 'Recovery inspection unavailable.' })
  }
}
