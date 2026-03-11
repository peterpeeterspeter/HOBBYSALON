/**
 * Links platform products to Medusa by matching slug to handle.
 * Run after both platform seed and Medusa seed:
 *   npx tsx scripts/link-medusa-products.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY),
 *           MEDUSA_BACKEND_URL, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import Medusa from "@medusajs/js-sdk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const medusaUrl =
  process.env.MEDUSA_BACKEND_URL ?? process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

const HANDLE_TO_SLUG: Record<string, string> = {
  "handmade-crochet-scarf": "handmade-crochet-scarf",
  "supply-yarn-bundle": "supply-yarn-bundle",
  "handmade-knitted-hat": "handmade-knitted-hat",
  "supply-pattern-pdf": "supply-pattern-pdf",
  "handmade-pottery-mug": "handmade-pottery-mug",
  "supply-bead-kit": "supply-bead-kit",
};

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
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

  const { products } = await sdk.store.product.list({ limit: 500 });
  if (!products?.length) {
    console.log("No Medusa products found");
    return;
  }

  for (const product of products) {
    const handle = product.handle ?? "";
    if (!HANDLE_TO_SLUG[handle]) continue;

    const { error } = await supabase
      .from("products")
      .update({ medusa_product_id: product.id })
      .eq("slug", handle);

    if (error) {
      console.error(`Failed to link ${handle}:`, error.message);
    } else {
      console.log(`Linked ${handle} -> ${product.id}`);
    }
  }
}

main().catch(console.error);
