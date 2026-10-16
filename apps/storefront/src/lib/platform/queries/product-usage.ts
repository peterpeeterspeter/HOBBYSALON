import { createPlatformClient } from "../client";
import type { Project } from "@/types/platform";

/** Read-only inverse discovery from existing, creator-authored usage tables.
 * These rows describe associations here, never cart or requiredness decisions.
 * Query failure must not remove independently approved graph recommendations.
 */
async function listUsageIds(
  table: "workshop_required_products" | "project_product_links",
  column: "workshop_id" | "project_id",
  productId: string
): Promise<string[]> {
  if (!productId) return [];
  try {
    const { data, error } = await createPlatformClient()
      .from(table)
      .select(column)
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order(column, { ascending: true });
    if (error || !data) return [];
    const rows = data as unknown as Array<Record<string, unknown>>;
    return [...new Set(rows.map((row) => row[column]).filter(
      (id): id is string => typeof id === "string" && id.length > 0
    ))];
  } catch {
    return [];
  }
}

export function listWorkshopIdsUsingProduct(productId: string): Promise<string[]> {
  return listUsageIds("workshop_required_products", "workshop_id", productId);
}

export function listProjectIdsUsingProduct(productId: string): Promise<string[]> {
  return listUsageIds("project_product_links", "project_id", productId);
}

/** Same public activity gate as getProjectBySlug, preserving editorial ID order. */
export async function listPublicProjectsByIds(ids: string[]): Promise<Project[]> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];
  try {
    const { data, error } = await createPlatformClient()
      .from("projects")
      .select("*")
      .in("id", uniqueIds)
      .eq("is_active", true);
    if (error || !data) return [];
    const byId = new Map((data as Project[]).map((project) => [project.id, project]));
    return uniqueIds.map((id) => byId.get(id)).filter(
      (project): project is Project => !!project
    );
  } catch {
    return [];
  }
}
