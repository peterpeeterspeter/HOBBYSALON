import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { normalizeArticleGraphRelations } from "./article-graph-relations.ts";

type Connection = Parameters<typeof normalizeArticleGraphRelations>[0][number];

function connection(
  entityType: string,
  entityId: string,
  relationType: string,
  sortOrder: number | null,
  weight: number | null,
  direction: "outbound" | "inbound" = "outbound"
): Connection {
  return { entityType, entityId, relationType, sortOrder, weight, direction };
}

test("normalizes only explicit outbound article product requirement relations in graph order", () => {
  const relations = normalizeArticleGraphRelations([
    connection("product", "paint", "required_material", 1, 2),
    connection("product", "brush", "required_tool", 2, 8),
    connection("product", "varnish", "optional_material", 3, 1),
    connection("product", "book", "related_product", 4, 5),
    connection("product", "ignored-inbound", "required_material", 0, 99, "inbound"),
    connection("product", "ignored-relation", "mentions", 0, 99),
  ]);

  assert.deepEqual(relations.requiredMaterials, [
    { id: "paint", sortOrder: 1, weight: 2 },
  ]);
  assert.deepEqual(relations.requiredTools, [
    { id: "brush", sortOrder: 2, weight: 8 },
  ]);
  assert.deepEqual(relations.optionalMaterials, [
    { id: "varnish", sortOrder: 3, weight: 1 },
  ]);
  assert.deepEqual(relations.relatedProducts, [
    { id: "book", sortOrder: 4, weight: 5 },
  ]);
});

test("orders and deduplicates relations with editorial sort order before weight", () => {
  const relations = normalizeArticleGraphRelations([
    connection("product", "later", "required_material", 3, 99),
    connection("product", "first", "required_material", 1, 1),
    connection("product", "weighted", "required_material", null, 8),
    connection("product", "weighted", "required_material", null, 1),
  ]);

  assert.deepEqual(relations.requiredMaterials, [
    { id: "first", sortOrder: 1, weight: 1 },
    { id: "later", sortOrder: 3, weight: 99 },
    { id: "weighted", sortOrder: null, weight: 8 },
  ]);
});

test("normalizes next and related articles only from their explicit outbound relation types", () => {
  const relations = normalizeArticleGraphRelations([
    connection("article", "continue-here", "next_step", 2, 4),
    connection("article", "read-also", "related_article", null, 9),
    connection("article", "wrong-type", "related_product", 1, 2),
    connection("workshop", "wrong-entity", "next_step", 1, 2),
  ]);

  assert.deepEqual(relations.nextSteps, [
    { id: "continue-here", sortOrder: 2, weight: 4 },
  ]);
  assert.deepEqual(relations.relatedArticles, [
    { id: "read-also", sortOrder: null, weight: 9 },
  ]);
});
