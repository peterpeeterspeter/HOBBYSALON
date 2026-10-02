import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework"

export const COMMERCE_PAYMENTS_PAUSED_MESSAGE =
  "Betalingen zijn tijdelijk uitgeschakeld. Probeer het later opnieuw."

/** Match the storefront flag, but enforce it independently on the backend. */
export function isCommercePaymentsEnabled(): boolean {
  const raw = process.env.COMMERCE_PAYMENTS_ENABLED?.trim().toLowerCase()
  return !raw || !["false", "0", "off", "no"].includes(raw)
}

/** Only attach to provider-session creation, never completion or aftercare. */
export function requireCommercePaymentsEnabled(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (!isCommercePaymentsEnabled()) {
    return res.status(503).json({ message: COMMERCE_PAYMENTS_PAUSED_MESSAGE })
  }
  return next()
}
