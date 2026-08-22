import "server-only";

import { createPlatformClient } from "@/lib/platform/client";
import type { WorkshopCategory } from "@/lib/platform/workshop-taxonomy";

export async function listWorkshopCategories(options?: {
  domainId?: string;
  activeOnly?: boolean;
}): Promise<WorkshopCategory[]> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("workshop_categories")
    .select("id, domain_id, slug, name, sort_order, is_active")
    .order("sort_order", { ascending: true });

  if (options?.domainId) {
    query = query.eq("domain_id", options.domainId);
  }
  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as WorkshopCategory[];
}

export async function getWorkshopCategoryById(
  id: string
): Promise<WorkshopCategory | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshop_categories")
    .select("id, domain_id, slug, name, sort_order, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as WorkshopCategory;
}
