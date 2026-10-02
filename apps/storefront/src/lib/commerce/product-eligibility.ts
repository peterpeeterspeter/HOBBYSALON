/**
 * Purchasable vs inquiry vs unavailable for storefront product detail.
 */

export type ProductEligibility =
  | "purchasable"
  | "inquiry_only"
  | "unavailable";

const MAKER_LISTING_TYPES = new Set(["handmade", "destash"]);

export function resolveProductEligibility(input: {
  product_type: string;
  medusa_product_id?: string | null;
  has_priced_variant?: boolean;
}): ProductEligibility {
  const isMaker = MAKER_LISTING_TYPES.has(input.product_type);
  const hasMedusa = Boolean(input.medusa_product_id);

  if (input.product_type === "supply" || (isMaker && hasMedusa)) {
    return input.has_priced_variant === false ? "unavailable" : "purchasable";
  }

  if (isMaker) {
    return "inquiry_only";
  }

  return hasMedusa ? "purchasable" : "unavailable";
}

export function pickSelectedVariantPrice(input: {
  variants: Array<{
    id: string;
    calculated_price?: { calculated_amount: number; currency_code: string };
  }>;
  selectedVariantId: string | null;
}): { amount: number; currency_code: string } | null {
  if (!input.selectedVariantId || input.variants.length === 0) return null;
  const selected = input.variants.find((v) => v.id === input.selectedVariantId);
  const price = selected?.calculated_price;
  if (!price || price.calculated_amount == null) return null;
  return {
    amount: price.calculated_amount,
    currency_code: price.currency_code ?? "EUR",
  };
}
