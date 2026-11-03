/**
 * Links platform products to Medusa by matching slug to handle, and copies
 * the lowest EUR price into products.price_cents for shop (supply) products,
 * so the /materials price filter and counts include them.
 * Run after both platform seed and Medusa seed:
 *   npx tsx scripts/link-medusa-products.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY),
 *           MEDUSA_BACKEND_URL, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import Medusa from "@medusajs/js-sdk";

function resolveEnv(name: string): string {
  const value = process.env[name]?.trim();
  return value ?? "";
}

const supabaseUrl = resolveEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey =
  resolveEnv("SUPABASE_SERVICE_ROLE_KEY") ||
  resolveEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const medusaUrl =
  resolveEnv("MEDUSA_BACKEND_URL") ||
  resolveEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL") ||
  "http://localhost:9000";
const publishableKey = resolveEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");

/** Medusa amounts are major units (12.5 = EUR 12,50). */
function lowestPriceCents(
  variants: Array<{ calculated_price?: { calculated_amount?: number | null } | null }> | null | undefined
): number | null {
  let lowest: number | null = null;
  for (const variant of variants ?? []) {
    const amount = Number(variant.calculated_price?.calculated_amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const cents = Math.round(amount * 100);
    if (lowest === null || cents < lowest) lowest = cents;
  }
  return lowest;
}

async function main() {
  if (!supabaseKey) {
    console.error(
      "Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
    process.exit(1);
  }
  if (!publishableKey) {
    console.error("Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const sdk = new Medusa({
    baseUrl: medusaUrl,
    publishableKey,
  });

  const { regions } = await sdk.store.region.list({ limit: 100 });
  const eurRegion = regions?.find((r) => r.currency_code?.toLowerCase() === "eur");
  if (!eurRegion) {
    console.warn("No EUR region found; prices are not synced.");
  }

  const { products } = await sdk.store.product.list({
    limit: 500,
    ...(eurRegion
      ? { region_id: eurRegion.id, fields: "*variants.calculated_price" }
      : {}),
  });
  if (!products?.length) {
    console.warn("No Medusa products found");
    return;
  }

  for (const product of products) {
    const handle = product.handle ?? "";
    if (!handle) continue;

    const { data, error } = await supabase
      .from("products")
      .update({ medusa_product_id: product.id })
      .eq("slug", handle)
      .select("id");

    if (error) {
      console.error(`Failed to link ${handle}:`, error.message);
    } else if (!data?.length) {
      console.warn(`No platform product found for handle ${handle}`);
    } else {
      console.warn(`Linked ${handle} -> ${product.id}`);
    }

    const priceCents = lowestPriceCents(product.variants);
    if (priceCents === null) continue;
    // Medusa owns the price of shop products; maker listings keep their own.
    const { error: priceError } = await supabase
      .from("products")
      .update({ price_cents: priceCents, currency_code: "EUR" })
      .eq("slug", handle)
      .in("product_type", ["supply", "supplies"]);
    if (priceError) {
      console.error(`Failed to sync price for ${handle}:`, priceError.message);
    }
  }
}

main().catch(console.error);
