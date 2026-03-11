import { createPlatformClient } from "../client";
import type { Product } from "@/types/platform";

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
