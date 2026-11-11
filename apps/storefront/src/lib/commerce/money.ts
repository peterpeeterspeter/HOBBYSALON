/**
 * Medusa v2 amounts (calculated_amount, cart totals, variant prices) are in
 * major currency units (e.g. 9.99 EUR). Platform tables use minor units
 * (cents). Convert at the Medusa ↔ platform boundary so PriceDisplay stays cents.
 */
export function medusaAmountToCents(amount: number | null | undefined): number {
  if (amount == null || Number.isNaN(Number(amount))) return 0;
  return Math.round(Number(amount) * 100);
}

/** Platform cents → Medusa v2 major-unit amount (e.g. 2499 → 24.99). */
export function centsToMedusaAmount(cents: number | null | undefined): number {
  if (cents == null || Number.isNaN(Number(cents))) return 0;
  return Math.round(Number(cents)) / 100;
}
