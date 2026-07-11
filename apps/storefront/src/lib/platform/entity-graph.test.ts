import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveEntityConnection } from "./entity-graph.ts";

test("resolves an outbound edge relative to the viewed entity", () => {
  const connection = resolveEntityConnection(
    {
      source_entity_type: "article",
      source_entity_id: "article-1",
      target_entity_type: "product",
      target_entity_id: "product-1",
      relation_type: "requires_material",
      weight: 4,
      sort_order: 2,
    },
    "article",
    "article-1"
  );

  assert.deepEqual(connection, {
    entityType: "product",
    entityId: "product-1",
    direction: "outbound",
    relationType: "requires_material",
    weight: 4,
    sortOrder: 2,
  });
});

test("resolves an inbound edge relative to the viewed entity", () => {
  const connection = resolveEntityConnection(
    {
      source_entity_type: "workshop",
      source_entity_id: "workshop-1",
      target_entity_type: "article",
      target_entity_id: "article-1",
      relation_type: "learn_with",
      weight: 3,
      sort_order: null,
    },
    "article",
    "article-1"
  );

  assert.deepEqual(connection, {
    entityType: "workshop",
    entityId: "workshop-1",
    direction: "inbound",
    relationType: "learn_with",
    weight: 3,
    sortOrder: null,
  });
});

test("rejects an edge unrelated to the viewed entity", () => {
  assert.equal(
    resolveEntityConnection(
      {
        source_entity_type: "workshop",
        source_entity_id: "workshop-1",
        target_entity_type: "product",
        target_entity_id: "product-1",
        relation_type: "requires_material",
        weight: 1,
        sort_order: null,
      },
      "article",
      "article-1"
    ),
    null
  );
});
