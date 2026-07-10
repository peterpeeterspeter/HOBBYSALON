export type GraphEdge = {
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  relation_type: string;
  weight: number | null;
  sort_order: number | null;
};

export type GraphConnection = {
  entityType: string;
  entityId: string;
  direction: "outbound" | "inbound";
  relationType: string;
  weight: number | null;
  sortOrder: number | null;
};

export function resolveEntityConnection(
  edge: GraphEdge,
  entityType: string,
  entityId: string
): GraphConnection | null {
  if (
    edge.source_entity_type === entityType &&
    edge.source_entity_id === entityId
  ) {
    return {
      entityType: edge.target_entity_type,
      entityId: edge.target_entity_id,
      direction: "outbound",
      relationType: edge.relation_type,
      weight: edge.weight,
      sortOrder: edge.sort_order,
    };
  }

  if (
    edge.target_entity_type === entityType &&
    edge.target_entity_id === entityId
  ) {
    return {
      entityType: edge.source_entity_type,
      entityId: edge.source_entity_id,
      direction: "inbound",
      relationType: edge.relation_type,
      weight: edge.weight,
      sortOrder: edge.sort_order,
    };
  }

  return null;
}
