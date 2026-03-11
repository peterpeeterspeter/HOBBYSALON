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
