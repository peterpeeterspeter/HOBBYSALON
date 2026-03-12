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

function toMedusaProductData(product: {
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
}): MedusaProductData {
  const firstVariant = product.variants?.[0];
  const calculatedPrice = firstVariant?.calculated_price;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle ?? "",
    variants: product.variants?.map((v) => ({
      id: v.id,
      title: v.title ?? "",
      calculated_price: v.calculated_price,
    })),
    calculated_price: calculatedPrice
      ? {
          calculated_amount: calculatedPrice.calculated_amount,
          currency_code: calculatedPrice.currency_code ?? "EUR",
        }
      : undefined,
  };
}

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
      country_code: process.env.NEXT_PUBLIC_MEDUSA_COUNTRY_CODE ?? "be",
    });

    if (!product) return null;
    return toMedusaProductData(product as Parameters<typeof toMedusaProductData>[0]);
  } catch {
    try {
      const { product } = await sdk.store.product.retrieve(medusaProductId, {
        fields: "*variants.calculated_price",
      });
      if (!product) return null;
      return toMedusaProductData(product as Parameters<typeof toMedusaProductData>[0]);
    } catch {
      return null;
    }
  }
}

export async function getMedusaProductByHandle(
  handle: string | null
): Promise<MedusaProductData> {
  if (!handle) return null;

  try {
    const { products } = await sdk.store.product.list({
      handle,
      fields: "*variants.calculated_price",
      country_code: process.env.NEXT_PUBLIC_MEDUSA_COUNTRY_CODE ?? "be",
      limit: 1,
    });
    const product = products?.[0];
    if (!product) return null;
    return toMedusaProductData(product as Parameters<typeof toMedusaProductData>[0]);
  } catch {
    return null;
  }
}

export async function getMedusaProductsByIds(
  medusaProductIds: Array<string | null | undefined>,
  concurrency = 6
): Promise<Map<string, MedusaProductData>> {
  const ids = [...new Set(medusaProductIds.filter((id): id is string => Boolean(id)))];
  const resultMap = new Map<string, MedusaProductData>();

  if (ids.length === 0) {
    return resultMap;
  }

  const workerCount = Math.max(1, Math.min(concurrency, ids.length));
  let cursor = 0;

  const worker = async () => {
    while (cursor < ids.length) {
      const currentIndex = cursor;
      cursor += 1;
      const id = ids[currentIndex];
      const product = await getMedusaProduct(id);
      resultMap.set(id, product);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return resultMap;
}
