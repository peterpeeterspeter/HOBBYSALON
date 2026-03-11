import { sdk } from "./client";

export type MedusaProductPrice = {
  id: string;
  amount: number;
  currency_code: string;
  variant_id?: string;
};

export type MedusaProductVariant = {
  id: string;
  title: string;
  prices?: MedusaProductPrice[];
};

export type MedusaProductData = {
  id: string;
  title: string;
  handle: string;
  variants?: MedusaProductVariant[];
  // Price may be on first variant or computed
  calculated_price?: {
    calculated_amount: number;
    currency_code: string;
  };
} | null;

/**
 * Fetch Medusa product by ID for price, variants, inventory display.
 * Returns null if not found or if medusaProductId is empty.
 */
export async function getMedusaProduct(
  medusaProductId: string | null
): Promise<MedusaProductData> {
  if (!medusaProductId) return null;

  try {
    const { product } = await sdk.store.product.retrieve(medusaProductId, {
      fields: "*variants.calculated_price",
      country_code: "nl",
    });

    if (!product) return null;

    const data = product as {
      id: string;
      title: string;
      handle?: string;
      variants?: Array<{
        id: string;
        title: string;
        calculated_price?: {
          calculated_amount: number;
          currency_code: string;
        };
      }>;
    };

    const firstVariant = data.variants?.[0];
    const calculated_price = firstVariant?.calculated_price;

    return {
      id: data.id,
      title: data.title,
      handle: data.handle ?? "",
      variants: data.variants?.map((v) => ({
        id: v.id,
        title: v.title ?? "",
        calculated_price: v.calculated_price,
      })),
      calculated_price: calculated_price
        ? {
            calculated_amount: calculated_price.calculated_amount,
            currency_code: calculated_price.currency_code ?? "EUR",
          }
        : undefined,
    };
  } catch {
    return null;
  }
}
