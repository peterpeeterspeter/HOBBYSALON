import { createPlatformClient } from "../client";
import type { EntityLink, EntityType } from "@/types/platform";
import {
  resolveEntityConnection,
  type GraphConnection,
} from "@/lib/platform/entity-graph";

export type EntityConnection = GraphConnection & {
  link: EntityLink;
};

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

export async function getEntityConnections(
  entityType: EntityType,
  entityId: string
): Promise<EntityConnection[]> {
  const supabase = createPlatformClient();
  const [outboundResult, inboundResult] = await Promise.all([
    supabase
      .from("entity_links")
      .select("*")
      .eq("source_entity_type", entityType)
      .eq("source_entity_id", entityId),
    supabase
      .from("entity_links")
      .select("*")
      .eq("target_entity_type", entityType)
      .eq("target_entity_id", entityId),
  ]);

  if (outboundResult.error && inboundResult.error) return [];

  return [...(outboundResult.data ?? []), ...(inboundResult.data ?? [])]
    .map((row) => {
      const link = row as EntityLink;
      const connection = resolveEntityConnection(link, entityType, entityId);
      return connection ? { ...connection, link } : null;
    })
    .filter((connection): connection is EntityConnection => connection !== null)
    .sort((a, b) => {
      const aSortOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bSortOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder;
      return (b.weight ?? 0) - (a.weight ?? 0);
    });
}
