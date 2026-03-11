import { createPlatformClient } from "../client";
import type { EntityLink } from "@/types/platform";
import type { EntityType } from "@/types/platform";

export async function getRelatedEntities(
  sourceType: EntityType,
  sourceId: string,
  targetType?: EntityType,
  relationType?: string
): Promise<EntityLink[]> {
  const supabase = createPlatformClient();
  let q = supabase
    .from("entity_links")
    .select("*")
    .eq("source_entity_type", sourceType)
    .eq("source_entity_id", sourceId);

  if (targetType) {
    q = q.eq("target_entity_type", targetType);
  }
  if (relationType) {
    q = q.eq("relation_type", relationType);
  }

  const { data, error } = await q.order("sort_order", {
    ascending: true,
    nullsFirst: false,
  });

  if (error) return [];
  return (data ?? []) as EntityLink[];
}
