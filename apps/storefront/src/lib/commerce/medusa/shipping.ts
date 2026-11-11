import 'server-only';
import { sdk } from './client';
export type ShippingPolicyNotice = {
  seller_id: string;
  seller_name?: string;
  country_code: string;
  threshold_amount: number;
  remaining_amount?: number | null;
  qualified?: boolean;
  available?: boolean;
};
export async function productShippingPolicies(
  productId: string
): Promise<ShippingPolicyNotice[]> {
  try {
    return (
      await sdk.client.fetch<{ shipping_policies: ShippingPolicyNotice[] }>(
        `/store/products/${encodeURIComponent(productId)}/shipping-policy`,
        { cache: 'no-store' }
      )
    ).shipping_policies;
  } catch {
    return [];
  }
}
export async function cartShippingSummary(
  cartId: string
): Promise<{
  shipping_summary: ShippingPolicyNotice[];
  payment_frozen: boolean;
} | null> {
  try {
    return await sdk.client.fetch(
      `/store/carts/${encodeURIComponent(cartId)}/shipping-summary`,
      { cache: 'no-store' }
    );
  } catch {
    return null;
  }
}
export async function refreshShippingQuote(cartId: string): Promise<void> {
  await sdk.client.fetch(
    `/store/carts/${encodeURIComponent(cartId)}/shipping-summary/refresh`,
    { method: 'POST', cache: 'no-store' }
  );
}
