export type CheckoutStep = "address" | "shipping" | "payment";

export function getCheckoutStep({
  hasAddress,
  hasShipping,
}: {
  hasAddress: boolean;
  hasShipping: boolean;
}): CheckoutStep {
  if (!hasAddress) return "address";
  return hasShipping ? "payment" : "shipping";
}
