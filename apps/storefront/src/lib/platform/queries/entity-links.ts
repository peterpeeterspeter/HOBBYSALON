import { createPlatformClient } from "../client";
import type { EntityLink, EntityType } from "@/types/platform";
import {
  isPublicGraphEdge,
  resolveEntityConnection,
  type GraphConnection,
} from "@/lib/platform/entity-graph";

export type EntityConnection = GraphConnection & {
  link: EntityLink;
};

function uniquePublicLinks(links: EntityLink[]): EntityLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (!isPublicGraphEdge(link) || seen.has(link.id)) return false;
    seen.add(link.id);
    return true;
  });
}

// Public outbound-only read: callers rely on the stored target and role.
export async function getRelatedEntities(
  sourceType: EntityType,
  sourceId: string,
  targetType?: EntityType,
  relationType?: string
): Promise<EntityLink[]> {
  try {
    const supabase = createPlatformClient();
    let q = supabase
      .from("entity_links")
      .select("*")
      .neq("relation_type", "suggested_auto")
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
    return uniquePublicLinks((data ?? []) as EntityLink[]);
  } catch {
    return [];
  }
}

// Public bidirectional read; direction is relative to the viewed entity.
export async function getEntityConnections(
  entityType: EntityType,
  entityId: string
): Promise<EntityConnection[]> {
  try {
    const supabase = createPlatformClient();
    const [outboundResult, inboundResult] = await Promise.all([
      supabase
        .from("entity_links")
        .select("*")
        .neq("relation_type", "suggested_auto")
        .eq("source_entity_type", entityType)
        .eq("source_entity_id", entityId),
      supabase
        .from("entity_links")
        .select("*")
        .neq("relation_type", "suggested_auto")
        .eq("target_entity_type", entityType)
        .eq("target_entity_id", entityId),
    ]);

    // A failed direction makes the combined graph incomplete/untrustworthy.
    if (outboundResult.error || inboundResult.error) return [];

    return uniquePublicLinks([
      ...(outboundResult.data ?? []),
      ...(inboundResult.data ?? []),
    ] as EntityLink[])
      .map((link) => {
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
  } catch {
    return [];
  }
}
