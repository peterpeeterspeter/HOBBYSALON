import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import * as graph from "./entity-graph.ts";

const { resolveEntityConnection } = graph;

test("the central public predicate excludes only pending suggestions and preserves legacy relations", () => {
  assert.ok("isPublicGraphEdge" in graph && typeof graph.isPublicGraphEdge === "function");
  assert.equal(graph.isPublicGraphEdge({ relation_type: "suggested_auto" }), false);
  assert.equal(graph.isPublicGraphEdge({ relation_type: "related" }), true);
  assert.equal(graph.isPublicGraphEdge({ relation_type: "legacy_editorial_relation" }), true);
});

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

test("pending automatic suggestions do not resolve to public connections in either direction", () => {
  const edge = {
    source_entity_type: "article",
    source_entity_id: "article-1",
    target_entity_type: "product",
    target_entity_id: "product-1",
    relation_type: "suggested_auto",
    weight: 99,
    sort_order: 0,
  };
  assert.equal(resolveEntityConnection(edge, "article", "article-1"), null);
  assert.equal(resolveEntityConnection(edge, "product", "product-1"), null);
});

test("public resolution preserves an unregistered legacy relation", () => {
  const connection = resolveEntityConnection({
    source_entity_type: "event",
    source_entity_id: "event-1",
    target_entity_type: "creator",
    target_entity_id: "creator-1",
    relation_type: "legacy_editorial_role",
    weight: 1,
    sort_order: null,
  }, "event", "event-1");
  assert.equal(connection?.relationType, "legacy_editorial_role");
  assert.equal(connection?.direction, "outbound");
});

test("a self-link resolves deterministically as outbound", () => {
  const connection = resolveEntityConnection({
    source_entity_type: "article",
    source_entity_id: "article-1",
    target_entity_type: "article",
    target_entity_id: "article-1",
    relation_type: "related",
    weight: 1,
    sort_order: null,
  }, "article", "article-1");
  assert.equal(connection?.direction, "outbound");
  assert.equal(connection?.entityId, "article-1");
});
