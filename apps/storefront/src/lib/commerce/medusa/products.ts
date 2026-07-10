import { withTimeout } from "@/lib/perf/with-timeout";
import { sdk } from "./client";

const MEDUSA_PRODUCT_TIMEOUT_MS = 8_000;
const MEDUSA_PRODUCT_FIELDS =
  "id,title,handle,*variants,*variants.calculated_price";
const MEDUSA_COUNTRY_CODE =
  process.env.NEXT_PUBLIC_MEDUSA_COUNTRY_CODE ?? "be";

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
  calculated_price?: {
    calculated_amount: number;
    currency_code: string;
  };
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
async function retrieveMedusaProduct(
  medusaProductId: string
): Promise<MedusaProductData> {
  try {
    const { product } = await withTimeout(
      sdk.store.product.retrieve(medusaProductId, {
        fields: MEDUSA_PRODUCT_FIELDS,
        country_code: MEDUSA_COUNTRY_CODE,
      }),
      MEDUSA_PRODUCT_TIMEOUT_MS
    );

    if (!product) return null;
    return toMedusaProductData(
      product as Parameters<typeof toMedusaProductData>[0]
    );
  } catch {
    try {
      const { product } = await withTimeout(
        sdk.store.product.retrieve(medusaProductId, {
          fields: MEDUSA_PRODUCT_FIELDS,
        }),
        MEDUSA_PRODUCT_TIMEOUT_MS
      );
      if (!product) return null;
      return toMedusaProductData(
        product as Parameters<typeof toMedusaProductData>[0]
      );
    } catch {
      return null;
    }
  }
}

export async function getMedusaProduct(
  medusaProductId: string | null
): Promise<MedusaProductData> {
  if (!medusaProductId) return null;
  return retrieveMedusaProduct(medusaProductId);
}

export async function getMedusaProductByHandle(
  handle: string | null
): Promise<MedusaProductData> {
  if (!handle) return null;

  try {
    const { products } = await sdk.store.product.list({
      handle,
      fields: "id,title,handle,*variants,*variants.calculated_price",
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

async function listMedusaProductsByIds(
  ids: string[]
): Promise<Map<string, MedusaProductData>> {
  const resultMap = new Map<string, MedusaProductData>();
  const chunkSize = 50;

  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize);

    try {
      const { products } = await withTimeout(
        sdk.store.product.list({
          id: chunk,
          fields: MEDUSA_PRODUCT_FIELDS,
          country_code: MEDUSA_COUNTRY_CODE,
          limit: chunk.length,
        }),
        MEDUSA_PRODUCT_TIMEOUT_MS
      );

      for (const product of products ?? []) {
        resultMap.set(
          product.id,
          toMedusaProductData(
            product as Parameters<typeof toMedusaProductData>[0]
          )
        );
      }
    } catch {
      // Fall back to per-product retrieval for this chunk.
    }

    const missingIds = chunk.filter((id) => !resultMap.has(id));
    if (missingIds.length === 0) {
      continue;
    }

    await Promise.all(
      missingIds.map(async (id) => {
        const product = await retrieveMedusaProduct(id);
        resultMap.set(id, product);
      })
    );
  }

  return resultMap;
}

export async function getMedusaProductsByIds(
  medusaProductIds: Array<string | null | undefined>
): Promise<Map<string, MedusaProductData>> {
  const ids = [
    ...new Set(medusaProductIds.filter((id): id is string => Boolean(id))),
  ];

  if (ids.length === 0) {
    return new Map<string, MedusaProductData>();
  }

  return listMedusaProductsByIds(ids);
}
