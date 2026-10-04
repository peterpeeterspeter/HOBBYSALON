type ArticleSuggestionRelation =
  | "required_material"
  | "required_tool"
  | "optional_material"
  | "related_product"
  | "related";

const PRODUCT_RELATIONS = new Set<unknown>([
  "required_material",
  "required_tool",
  "optional_material",
  "related_product",
]);

/** Resolve approval roles using the persisted target, never a form target. */
export function resolveArticleSuggestionRelation(
  targetEntityType: unknown,
  requestedRelation?: unknown
): ArticleSuggestionRelation {
  if (
    targetEntityType !== "product" &&
    targetEntityType !== "workshop" &&
    targetEntityType !== "event"
  ) {
    throw new Error("Ongeldig doeltype voor deze suggestie.");
  }

  if (requestedRelation != null && typeof requestedRelation !== "string") {
    throw new Error("Ongeldig relatietype voor deze suggestie.");
  }

  const relation = typeof requestedRelation === "string" ? requestedRelation.trim() : "";
  if (!relation || relation === "related") {
    return targetEntityType === "product" ? "related_product" : "related";
  }
  if (targetEntityType === "product" && PRODUCT_RELATIONS.has(relation)) {
    return relation as ArticleSuggestionRelation;
  }

  throw new Error("Ongeldig relatietype voor deze suggestie.");
}
