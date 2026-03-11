import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'

import { getMerchantOnboardingStatus } from './utils'

/**
 * @oas [get] /vendor/sellers/me/onboarding/merchant
 * operationId: "VendorGetMerchantOnboardingStatus"
 * summary: "Get merchant onboarding status"
 * description: "Retrieves merchant-specific onboarding progress and checklist for the authenticated seller."
 * x-authenticated: true
 * responses:
 *   "200":
 *     description: OK
 * tags:
 *   - Vendor Onboarding
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const merchant_onboarding = await getMerchantOnboardingStatus(
    req.auth_context.actor_id,
    req.scope
  )

  res.json({ merchant_onboarding })
}

/**
 * @oas [post] /vendor/sellers/me/onboarding/merchant
 * operationId: "VendorRecalculateMerchantOnboardingStatus"
 * summary: "Recalculate merchant onboarding status"
 * description: "Recalculates base onboarding state and returns merchant-specific onboarding progress/checklist."
 * x-authenticated: true
 * responses:
 *   "200":
 *     description: OK
 * tags:
 *   - Vendor Onboarding
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const merchant_onboarding = await getMerchantOnboardingStatus(
    req.auth_context.actor_id,
    req.scope,
    { recalculate: true }
  )

  res.json({ merchant_onboarding })
}
