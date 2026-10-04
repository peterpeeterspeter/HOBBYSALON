/** Raw variant price provenance, before any legacy currency defaults. */
export type ExactVariantPriceInput = {
  calculated_amount?: unknown;
  currency_code?: unknown;
};

/** Browser-safe exact-link EUR price; same decimal shift as material offers. */
export function exactEurVariantPrice(
  price?: ExactVariantPriceInput | null
): { amount: number; currency_code: "eur" } | null {
  if (
    !price ||
    typeof price.calculated_amount !== "number" ||
    !Number.isFinite(price.calculated_amount) ||
    price.calculated_amount < 0 ||
    typeof price.currency_code !== "string" ||
    price.currency_code.toLowerCase() !== "eur"
  ) return null;

  const [coefficient, exponent = "0"] = price.calculated_amount.toString().split("e");
  const amount = Math.round(Number(`${coefficient}e${Number(exponent) + 2}`));
  return Number.isSafeInteger(amount) && amount >= 0
    ? { amount, currency_code: "eur" }
    : null;
}
