/** Pending and dismissed rows stay in entity_links. Public pages must not treat them as connections. */
export const PENDING_SUGGESTION_RELATION = "suggested_auto";
export const DISMISSED_SUGGESTION_RELATION = "dismissed_suggestion";

const PRIVATE_RELATIONS = new Set([
  PENDING_SUGGESTION_RELATION,
  DISMISSED_SUGGESTION_RELATION,
]);

const PRODUCT_APPROVAL_RELATIONS = [
  "required_material",
  "required_tool",
  "optional_material",
  "related_product",
] as const;

export function isPublicGraphRelation(relationType: string): boolean {
  return !PRIVATE_RELATIONS.has(relationType);
}

/**
 * Confirmation chooses a meaning. A generic "related" approval becomes a
 * recommendation, never a material requirement.
 */
export function relationForApprovedSuggestion(
  targetType: string,
  submitted?: string | null
): string | null {
  const target = targetType.trim().toLowerCase();
  const value = submitted?.trim().toLowerCase() ?? "";
  const generic = value === "" || value === "related" || value === PENDING_SUGGESTION_RELATION;

  if (target === "product") {
    if ((PRODUCT_APPROVAL_RELATIONS as readonly string[]).includes(value)) return value;
    return generic ? "related_product" : null;
  }
  if (target === "workshop") {
    if (value === "related_workshop") return value;
    return generic ? "related_workshop" : null;
  }
  if (target === "event") {
    if (value === "related_event") return value;
    return generic ? "related_event" : null;
  }
  if (target === "article") {
    if (value === "next_step" || value === "related_article") return value;
    return generic ? "related_article" : null;
  }
  return null;
}

/** Older approved rows used `related`. Read them as recommendations, not requirements. */
export function publicRelationAlias(entityType: string, relationType: string): string {
  if (relationType !== "related") return relationType;
  if (entityType === "product") return "related_product";
  if (entityType === "workshop") return "related_workshop";
  if (entityType === "event") return "related_event";
  if (entityType === "article") return "related_article";
  return relationType;
}
