/**
 * Phase 5 step 3: backfill products.price_cents/currency_code on legacy
 * handmade/destash listings that still carry a medusa_product_id from
 * before the listing-first cutover (phase 1). New listings write
 * price_cents directly; these older rows never had it, so product-page.ts
 * falls back to Medusa's calculated_price for them - this script copies
 * that Medusa price into the platform column so the row no longer depends
 * on the Medusa lookup for display.
 *
 * Purely additive: only touches rows where price_cents is currently null.
 * Does NOT clear medusa_product_id - that is a separate, manual decision
 * per row once you've confirmed there are no open Medusa orders for it
 * (see docs/listing-first-integration-plan.md, phase 5). Cutting a
 * listing over while an order is in flight would break that order's
 * product reference, so this script deliberately never does it
 * automatically.
 *
 * Usage:
 *   MEDUSA_BACKEND_URL=https://api.hobbysalon.be \
 *   NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<pk> \
 *   NEXT_PUBLIC_SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx tsx scripts/backfill-handmade-price-cents.ts
 *
 * Add --dry-run to only print what would change.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const medusaUrl = (
  process.env.MEDUSA_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000"
).replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";
const countryCode = process.env.NEXT_PUBLIC_MEDUSA_COUNTRY_CODE ?? "be";
const dryRun = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

type MedusaVariantPrice = {
  calculated_price?: { calculated_amount: number; currency_code: string };
};
type MedusaProductResponse = {
  product?: { id: string; variants?: MedusaVariantPrice[] };
};

async function fetchMedusaPrice(
  medusaProductId: string
): Promise<{ amount: number; currencyCode: string } | null> {
  const url = `${medusaUrl}/store/products/${medusaProductId}?fields=id,*variants.calculated_price&country_code=${countryCode}`;
  const response = await fetch(url, {
    headers: { "x-publishable-api-key": publishableKey },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as MedusaProductResponse;
  const price = payload.product?.variants?.[0]?.calculated_price;
  if (!price) return null;

  return {
    amount: price.calculated_amount,
    currencyCode: (price.currency_code ?? "EUR").toUpperCase(),
  };
}

async function main() {
  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY - required to read Store API prices."
    );
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data: rows, error } = await supabase
    .from("products")
    .select("id, title, slug, medusa_product_id")
    .in("product_type", ["handmade", "destash"])
    .not("medusa_product_id", "is", null)
    .is("price_cents", null);

  if (error) throw error;
  if (!rows?.length) {
    console.warn("Nothing to backfill - no rows with price_cents null.");
    return;
  }

  console.warn(`Found ${rows.length} legacy row(s) missing price_cents.`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const price = await fetchMedusaPrice(row.medusa_product_id as string);
    if (!price) {
      console.warn(
        `SKIP  ${row.slug} (${row.medusa_product_id}) - no Medusa price found`
      );
      skipped += 1;
      continue;
    }

    console.warn(
      `${dryRun ? "WOULD SET" : "SET"} ${row.slug} -> price_cents=${
        price.amount
      } currency_code=${price.currencyCode}`
    );

    if (dryRun) continue;

    const { error: updateError } = await supabase
      .from("products")
      .update({ price_cents: price.amount, currency_code: price.currencyCode })
      .eq("id", row.id)
      .is("price_cents", null);

    if (updateError) {
      console.error(`FAILED to update ${row.slug}:`, updateError.message);
      skipped += 1;
      continue;
    }
    updated += 1;
  }

  console.warn(
    `Done. ${dryRun ? "would update" : "updated"}=${updated} skipped=${skipped}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
