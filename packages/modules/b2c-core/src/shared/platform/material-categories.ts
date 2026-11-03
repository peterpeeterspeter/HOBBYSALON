import { MedusaError } from "@medusajs/framework/utils";

import {
  SupabaseRestClient,
  createPlatformSupabaseClient,
  escapePostgrestValue,
} from "./supabase-rest-client";

/**
 * Material taxonomy for shop (supply) products. Lives in Supabase
 * product_categories with catalog = 'material': groups have parent_id null,
 * subcategories point to their group. domain_id is always null.
 */
export type MaterialCategory = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

const SELECT = "id,slug,name,parent_id,sort_order";

export async function listMaterialCategories(
  supabase: SupabaseRestClient
): Promise<MaterialCategory[]> {
  return supabase.get<MaterialCategory>("product_categories", {
    select: SELECT,
    catalog: "eq.material",
    order: "sort_order.asc,name.asc",
  });
}

/** Returns the category only when it exists and is a material category. */
export async function findMaterialCategory(
  supabase: SupabaseRestClient,
  id: string
): Promise<MaterialCategory | null> {
  if (!isUuid(id)) return null;
  const rows = await supabase.get<MaterialCategory>("product_categories", {
    select: SELECT,
    id: `eq.${escapePostgrestValue(id)}`,
    catalog: "eq.material",
    limit: "1",
  });
  return rows[0] ?? null;
}

/**
 * Category mappings and shop products may only target material categories.
 * Throws INVALID_DATA for a listing (per hobby) category or an unknown id.
 */
export async function assertMaterialCategoryId(
  id: string
): Promise<MaterialCategory> {
  const supabase = createPlatformSupabaseClient();
  if (!supabase) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Platform database is not configured"
    );
  }
  const category = await findMaterialCategory(supabase, id);
  if (!category) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Category ${id} is not a material category`
    );
  }
  return category;
}

/** Groups with their subcategories, sorted, for pickers. */
export function groupMaterialCategories(rows: MaterialCategory[]) {
  const bySort = (a: MaterialCategory, b: MaterialCategory) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name);
  return rows
    .filter((row) => !row.parent_id)
    .sort(bySort)
    .map((group) => ({
      ...group,
      children: rows.filter((row) => row.parent_id === group.id).sort(bySort),
    }));
}

type PriceRow = {
  amount?: number | string | null;
  currency_code?: string | null;
  price_list_id?: string | null;
  rules_count?: number | null;
};

/**
 * Lowest base price of a product in cents for one currency. Medusa stores
 * amounts in major units (12.5 = EUR 12,50). Price list and rule prices are
 * skipped. Returns null when the product has no price in that currency.
 */
export function lowestPriceCents(
  variants: Array<{ prices?: PriceRow[] | null }> | null | undefined,
  currencyCode = "eur"
): number | null {
  let lowest: number | null = null;
  for (const variant of variants ?? []) {
    for (const price of variant.prices ?? []) {
      if ((price.currency_code ?? "").toLowerCase() !== currencyCode) continue;
      if (price.price_list_id) continue;
      if (price.rules_count && price.rules_count > 0) continue;
      const amount = Number(price.amount);
      if (!Number.isFinite(amount) || amount < 0) continue;
      const cents = Math.round(amount * 100);
      if (lowest === null || cents < lowest) lowest = cents;
    }
  }
  return lowest;
}

/** Validates metadata.platform_category_id on a shop product write, if set. */
export async function assertMaterialCategoryInMetadata(
  metadata: Record<string, unknown> | null | undefined
): Promise<void> {
  const id = metadata?.platform_category_id;
  if (id === undefined || id === null || id === "") return;
  if (typeof id !== "string") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "platform_category_id must be a string"
    );
  }
  await assertMaterialCategoryId(id);
}
