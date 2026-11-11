/** All monetary values are EUR major units. Never accept client cart totals. */
export type ShippingPolicy = {
  seller_id: string;
  country_code: string;
  currency_code: string;
  free_shipping_threshold: unknown;
  shipping_option_ids: unknown;
};
export type ShippingItem = { total: unknown; seller_id: string };
export function parseThreshold(value: unknown): number | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error('Ongeldig bedrag');
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new Error('Gebruik een positief bedrag met maximaal twee decimalen');
  const amount = Number(text);
  if (
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(Math.round(amount * 100))
  )
    throw new Error('Ongeldig bedrag');
  return amount;
}
export function evaluateShippingPolicy(
  policy: ShippingPolicy,
  items: ShippingItem[],
  country: string,
  currency: string
) {
  const threshold =
    policy.free_shipping_threshold == null
      ? null
      : Number(policy.free_shipping_threshold);
  const rawTotal = items
    .filter((i) => i.seller_id === policy.seller_id)
    .reduce((sum, i) => {
      const amount = Number(i.total);
      if (!Number.isFinite(amount) || amount < 0)
        throw new Error('Ongeldig productbedrag');
      return sum + amount;
    }, 0);
  // Round the seller subtotal once; per-line rounding can falsely reach the threshold.
  const total = Math.round(rawTotal * 100);
  if (!Number.isSafeInteger(total)) throw new Error('Ongeldig productbedrag');
  const enabled =
    country === policy.country_code &&
    currency === 'eur' &&
    policy.currency_code === 'eur' &&
    threshold !== null &&
    Number.isFinite(threshold) &&
    threshold >= 0;
  const thresholdCents =
    threshold === null ? null : Math.round(threshold * 100);
  return {
    seller_id: policy.seller_id,
    country_code: policy.country_code,
    threshold_amount: threshold,
    subtotal: total / 100,
    qualified: enabled && total >= thresholdCents!,
    remaining_amount: enabled
      ? Math.max(0, thresholdCents! - total) / 100
      : null
  };
}
