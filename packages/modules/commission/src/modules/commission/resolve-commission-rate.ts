/**
 * Hobbysalon commission rate resolver.
 * Commission base is line item subtotal (item.total), excluding shipping lines.
 * Payment/checkout fees are tracked separately from commission (see payout step).
 */
export const HOBBYSALON_COMMISSION_RATES = {
  handmade: 0.06,
  supply: 0.1,
  workshop_kit_creator: 0.06,
  workshop_kit_merchant: 0.1,
} as const;

export type HobbysalonSellerType = "creator" | "merchant";

export function resolveHobbysalonCommissionPercentage(input: {
  productTypeValue: string | null | undefined;
  sellerType?: HobbysalonSellerType | null;
}): number | null {
  const productType = input.productTypeValue ?? "";

  if (productType === "handmade") {
    return HOBBYSALON_COMMISSION_RATES.handmade;
  }

  if (productType === "supply") {
    return HOBBYSALON_COMMISSION_RATES.supply;
  }

  if (productType === "workshop_kit") {
    return input.sellerType === "creator"
      ? HOBBYSALON_COMMISSION_RATES.workshop_kit_creator
      : HOBBYSALON_COMMISSION_RATES.workshop_kit_merchant;
  }

  return null;
}

export function getCommissionCalculationBase(input: {
  itemTotal: number;
  itemTaxTotal: number;
  includeTax: boolean;
}): number {
  return input.includeTax
    ? input.itemTotal
    : Math.max(0, input.itemTotal - input.itemTaxTotal);
}

export function calculatePercentageCommissionAmount(input: {
  base: number;
  percentageRate: number;
}): number {
  return input.base * (input.percentageRate / 100);
}
