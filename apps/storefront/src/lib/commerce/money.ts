/**
 * Medusa Store API amounts (calculated_amount, cart totals, etc.) are in
 * major currency units (e.g. 9.99 EUR). Platform tables use minor units
 * (cents). Convert at the Medusa → UI boundary so PriceDisplay stays cents.
 */
export function medusaAmountToCents(amount: number | null | undefined): number {
  if (amount == null || Number.isNaN(Number(amount))) return 0;
  return Math.round(Number(amount) * 100);
}
