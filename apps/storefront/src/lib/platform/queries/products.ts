import { createPlatformClient } from "../client";
import type { Product } from "@/types/platform";
import {
  MATERIALS_CATALOG_PRODUCT_TYPES,
  resolveMaterialsOffer,
  sanitizeAgendaSearchQuery,
  type MaterialsOffer,
} from "@/lib/materials/materials-catalog-helpers";

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Product;
}

export async function listProductsByDomain(
  domainId: string,
  productType?: "handmade" | "supply"
): Promise<Product[]> {
  const supabase = createPlatformClient();
  let q = supabase
    .from("products")
    .select("*")
    .eq("domain_id", domainId)
    .eq("is_active", true)
    .eq("status", "active");

  if (productType) {
    q = q.eq("product_type", productType);
  }

  const { data, error } = await q.order("is_featured", { ascending: false });

  if (error) return [];
  return (data ?? []) as Product[];
}

export async function listProductsByCreator(creatorId: string): Promise<Product[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("is_active", true)
    .eq("status", "active")
    .order("is_featured", { ascending: false });

  if (error) return [];
  return (data ?? []) as Product[];
}

export async function listFeaturedProducts(options?: {
  productType?: "handmade" | "supply";
  limit?: number;
}): Promise<Product[]> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 8);

  if (options?.productType) {
    query = query.eq("product_type", options.productType);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as Product[];
}

export async function listProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];

  const uniqueIds = [...new Set(ids)];
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("id", uniqueIds)
    .eq("is_active", true)
    .eq("status", "active");

  if (error || !data) return [];

  const byId = new Map((data as Product[]).map((product) => [product.id, product]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((product): product is Product => !!product);
}

type CreatorLocation = {
  id: string;
  display_name: string | null;
  slug: string | null;
  city: string | null;
  country_code: string | null;
  creator_types: string[] | null;
};

export type SupplyMarketplaceProduct = Product & {
  creator_display_name: string | null;
  creator_slug: string | null;
  creator_city: string | null;
  creator_country_code: string | null;
  creator_types: string[];
};

export type ProductCategoryOption = {
  id: string;
  name: string;
  slug: string;
  domain_id: string | null;
  parent_id?: string | null;
};

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function getSupplyLocalityScore(
  product: SupplyMarketplaceProduct,
  preferredCity: string | null,
  preferredCountryCode: string | null
): number {
  let score = 0;
  const creatorCity = normalizeLocationValue(product.creator_city);
  const creatorCountry = normalizeLocationValue(product.creator_country_code);

  if (preferredCity && creatorCity) {
    if (creatorCity === preferredCity) {
      score += 100;
    } else if (creatorCity.includes(preferredCity) || preferredCity.includes(creatorCity)) {
      score += 60;
    }
  }

  if (preferredCountryCode && creatorCountry === preferredCountryCode) {
    score += 25;
  }

  if (product.is_featured) {
    score += 5;
  }

  return score;
}

export async function listSupplyMarketplaceProducts(filters?: {
  q?: string;
  domain_id?: string;
  category_id?: string;
  category_name?: string;
  creator_type?: string;
  city?: string;
  country_code?: string;
  preferred_city?: string;
  preferred_country_code?: string;
  limit?: number;
  offset?: number;
}): Promise<SupplyMarketplaceProduct[]> {
  const supabase = createPlatformClient();
  let creatorIdsFilter: string[] | null = null;
  let categoryIdsFilter: string[] | null = null;
  const creatorQueryNeedsFilter = Boolean(
    filters?.city || filters?.country_code || filters?.creator_type
  );

  if (creatorQueryNeedsFilter) {
    let creatorQuery = supabase.from("creators").select("id");
    if (filters?.city) {
      creatorQuery = creatorQuery.ilike("city", `%${filters.city}%`);
    }
    if (filters?.country_code) {
      creatorQuery = creatorQuery.eq("country_code", filters.country_code.toUpperCase());
    }
    if (filters?.creator_type) {
      creatorQuery = creatorQuery.contains("creator_types", [filters.creator_type]);
    }

    const { data: creators, error: creatorError } = await creatorQuery.limit(3000);
    if (creatorError) return [];
    creatorIdsFilter = [...new Set((creators ?? []).map((row) => row.id))];
    if (creatorIdsFilter.length === 0) {
      return [];
    }
  }

  if (filters?.category_name && !filters?.category_id) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from("product_categories")
      .select("id")
      .ilike("name", filters.category_name)
      .limit(200);
    if (categoryError) return [];
    categoryIdsFilter = [...new Set((categoryRows ?? []).map((row) => row.id))];
    if (categoryIdsFilter.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("status", "active")
    .in("product_type", ["supply", "supplies"])
    .not("medusa_product_id", "is", null)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.domain_id) {
    query = query.eq("domain_id", filters.domain_id);
  }
  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id);
  }
  if (categoryIdsFilter) {
    query = query.in("category_id", categoryIdsFilter);
  }
  if (filters?.q) {
    query = query.or(
      `title.ilike.%${filters.q}%,short_description.ilike.%${filters.q}%,description.ilike.%${filters.q}%`
    );
  }
  if (creatorIdsFilter) {
    query = query.in("creator_id", creatorIdsFilter);
  }
  if (typeof filters?.offset === "number" && Number.isFinite(filters.offset)) {
    const safeOffset = Math.max(0, filters.offset);
    const safeLimit = Math.max(1, filters?.limit || 50);
    query = query.range(safeOffset, safeOffset + safeLimit - 1);
  } else if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) return [];

  const products = (data ?? []) as Product[];
  if (products.length === 0) return [];

  const creatorIds = [...new Set(products.map((product) => product.creator_id).filter(Boolean))];
  const { data: creatorRows } = await supabase
    .from("creators")
    .select("id, display_name, slug, city, country_code, creator_types")
    .in("id", creatorIds);

  const creatorMap = new Map(
    ((creatorRows ?? []) as CreatorLocation[]).map((creator) => [creator.id, creator])
  );

  const enriched = products.map((product) => {
    const creator = creatorMap.get(product.creator_id);
    return {
      ...product,
      creator_display_name: creator?.display_name ?? null,
      creator_slug: creator?.slug ?? null,
      creator_city: creator?.city ?? null,
      creator_country_code: creator?.country_code ?? null,
      creator_types: Array.isArray(creator?.creator_types)
        ? creator!.creator_types
        : [],
    } satisfies SupplyMarketplaceProduct;
  });

  const preferredCity = normalizeLocationValue(filters?.preferred_city);
  const preferredCountryCode = normalizeLocationValue(filters?.preferred_country_code);
  if (!preferredCity && !preferredCountryCode) {
    return enriched;
  }

  if (filters?.city || filters?.country_code) {
    return enriched;
  }

  return [...enriched].sort((a, b) => {
    const scoreDelta =
      getSupplyLocalityScore(b, preferredCity, preferredCountryCode) -
      getSupplyLocalityScore(a, preferredCity, preferredCountryCode);
    if (scoreDelta !== 0) return scoreDelta;
    return b.created_at.localeCompare(a.created_at);
  });
}

export type MaterialProductOption = {
  id: string;
  title: string;
  slug: string;
};

export async function listMaterialProductsForSelection(options?: {
  q?: string;
  limit?: number;
}): Promise<MaterialProductOption[]> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("products")
    .select("id, title, slug")
    .eq("is_active", true)
    .eq("status", "active")
    .in("product_type", ["supply", "workshop_kit", "supplies"])
    .order("title", { ascending: true })
    .limit(options?.limit ?? 100);

  if (options?.q && options.q.trim().length > 0) {
    query = query.or(
      `title.ilike.%${options.q.trim()}%,short_description.ilike.%${options.q.trim()}%,description.ilike.%${options.q.trim()}%`
    );
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
  }));
}

export async function listSupplyCategoryOptions(filters?: {
  domain_id?: string;
}): Promise<ProductCategoryOption[]> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("product_categories")
    .select("id, name, slug, domain_id, parent_id")
    .order("sort_order", { ascending: true })
    .limit(500);

  if (filters?.domain_id) {
    query = query.eq("domain_id", filters.domain_id);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as ProductCategoryOption[];
}

export type MaterialsCatalogItem = SupplyMarketplaceProduct & {
  offer: MaterialsOffer;
  displayPrice: { amount: number; currency_code: string } | null;
};

export type ListMaterialsCatalogFilters = {
  q?: string;
  category_id?: string;
  /** Parent category: include this id and children when parent_id matches. */
  category_parent_id?: string;
  offer?: "webshop" | "maker" | "destash" | "kit";
  condition?: string;
  sort?: "recommended" | "newest";
  limit?: number;
  offset?: number;
};

function offerToProductTypes(
  offer: ListMaterialsCatalogFilters["offer"]
): string[] | null {
  if (!offer) return null;
  if (offer === "webshop") return ["supply", "supplies"];
  if (offer === "maker") return ["handmade"];
  if (offer === "destash") return ["destash"];
  if (offer === "kit") return ["workshop_kit"];
  return null;
}

/**
 * Materials catalog: multi-offer platform listing with honest totalCount.
 * No price/stock filter or sort (Medusa enrich is display-only after pagination).
 */
export async function listMaterialsCatalog(
  filters?: ListMaterialsCatalogFilters
): Promise<{
  products: MaterialsCatalogItem[];
  totalCount: number;
  categoryIdsWithSupply: string[];
}> {
  const supabase = createPlatformClient();
  const searchTerm = sanitizeAgendaSearchQuery(filters?.q);
  const sort = filters?.sort === "newest" ? "newest" : "recommended";
  const typeFilter = offerToProductTypes(filters?.offer);

  let categoryIdsFilter: string[] | null = null;
  if (filters?.category_id) {
    categoryIdsFilter = [filters.category_id];
  } else if (filters?.category_parent_id) {
    const { data: children } = await supabase
      .from("product_categories")
      .select("id")
      .eq("parent_id", filters.category_parent_id)
      .limit(200);
    categoryIdsFilter = [
      filters.category_parent_id,
      ...((children ?? []).map((row) => row.id as string)),
    ];
  }

  // Category chip supply: distinct categories before category filter.
  let supplyCatQuery = supabase
    .from("products")
    .select("category_id")
    .eq("is_active", true)
    .eq("status", "active")
    .in("product_type", [...MATERIALS_CATALOG_PRODUCT_TYPES])
    .not("category_id", "is", null)
    .limit(2000);

  if (typeFilter) {
    supplyCatQuery = supplyCatQuery.in("product_type", typeFilter);
  }
  if (filters?.condition) {
    supplyCatQuery = supplyCatQuery.eq("condition_type", filters.condition);
  }
  if (searchTerm) {
    const like = `%${searchTerm}%`;
    supplyCatQuery = supplyCatQuery.or(
      `title.ilike.${like},short_description.ilike.${like}`
    );
  }

  const { data: supplyCatRows } = await supplyCatQuery;
  const categoryIdsWithSupply = [
    ...new Set(
      (supplyCatRows ?? [])
        .map((row) => row.category_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .eq("status", "active")
    .in(
      "product_type",
      typeFilter ?? [...MATERIALS_CATALOG_PRODUCT_TYPES]
    );

  if (categoryIdsFilter) {
    query = query.in("category_id", categoryIdsFilter);
  }
  if (filters?.condition) {
    query = query.eq("condition_type", filters.condition);
  }
  if (searchTerm) {
    const like = `%${searchTerm}%`;
    query = query.or(
      `title.ilike.${like},short_description.ilike.${like},description.ilike.${like}`
    );
  }

  if (sort === "newest") {
    query = query
      .order("created_at", { ascending: false })
      .order("is_featured", { ascending: false });
  } else {
    query = query
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });
  }

  const offset = Math.max(0, filters?.offset ?? 0);
  const limit = Math.max(1, filters?.limit ?? 24);
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    return { products: [], totalCount: 0, categoryIdsWithSupply };
  }

  const products = (data ?? []) as Product[];
  const totalCount = typeof count === "number" ? count : products.length;

  if (products.length === 0) {
    return { products: [], totalCount, categoryIdsWithSupply };
  }

  const creatorIds = [
    ...new Set(products.map((product) => product.creator_id).filter(Boolean)),
  ];
  const { data: creatorRows } = await supabase
    .from("creators")
    .select("id, display_name, slug, city, country_code, creator_types")
    .in("id", creatorIds);

  const creatorMap = new Map(
    ((creatorRows ?? []) as CreatorLocation[]).map((creator) => [
      creator.id,
      creator,
    ])
  );

  const items: MaterialsCatalogItem[] = products.map((product) => {
    const creator = creatorMap.get(product.creator_id);
    const base: SupplyMarketplaceProduct = {
      ...product,
      creator_display_name: creator?.display_name ?? null,
      creator_slug: creator?.slug ?? null,
      creator_city: creator?.city ?? null,
      creator_country_code: creator?.country_code ?? null,
      creator_types: Array.isArray(creator?.creator_types)
        ? creator!.creator_types
        : [],
    };
    const offer = resolveMaterialsOffer(product);
    const displayPrice =
      !product.medusa_product_id &&
      typeof product.price_cents === "number" &&
      product.price_cents > 0
        ? {
            amount: product.price_cents,
            currency_code: product.currency_code ?? "eur",
          }
        : null;
    return { ...base, offer, displayPrice };
  });

  return { products: items, totalCount, categoryIdsWithSupply };
}
