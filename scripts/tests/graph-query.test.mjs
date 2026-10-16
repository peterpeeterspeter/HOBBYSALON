import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

// Run with: node --experimental-vm-modules --test scripts/tests/graph-query.test.mjs
// Execute the actual query module and real graph helper, never the app client.
// Local Supabase stand-ins prove read behavior, not live DB/RLS integration.
const root = new URL("../../", import.meta.url);
const graphSource = stripTypeScriptTypes(readFileSync(new URL(
  "apps/storefront/src/lib/platform/entity-graph.ts", root
), "utf8"), { mode: "strip" });
const querySource = stripTypeScriptTypes(readFileSync(new URL(
  "apps/storefront/src/lib/platform/queries/entity-links.ts", root
), "utf8"), { mode: "strip" });

function edge(id, overrides = {}) {
  return {
    id,
    source_entity_type: "article",
    source_entity_id: "article-1",
    target_entity_type: "product",
    target_entity_id: id,
    relation_type: "related",
    weight: 1,
    sort_order: null,
    ...overrides,
  };
}
const incoming = (id, overrides = {}) => edge(id, {
  source_entity_type: "workshop", source_entity_id: id,
  target_entity_type: "article", target_entity_id: "article-1",
  ...overrides,
});
const ids = (rows) => Array.from(rows, (row) => row.id ?? row.link.id);
// VM objects have a separate realm; compare detached data, not prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value));

async function loadQueries(rows, options = {}) {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, "entity_links");
      const call = { filters: [], orders: [] };
      calls.push(call);
      const builder = {
        select(columns) { assert.equal(columns, "*"); return this; },
        eq(column, value) { call.filters.push(["eq", column, value]); return this; },
        neq(column, value) { call.filters.push(["neq", column, value]); return this; },
        order(column, settings) { call.orders.push([column, settings]); return this; },
        then(resolve, reject) {
          const direction = call.filters.some(([, column]) => column === "source_entity_id")
            ? "outbound" : "inbound";
          if (options.reject === direction) {
            return Promise.reject(new Error("synthetic transport failure")).then(resolve, reject);
          }
          let data = rows.filter((row) => call.filters.every(([operator, column, value]) => {
            if (operator === "neq" && options.ignoreNeq) return true;
            return operator === "eq" ? row[column] === value : row[column] !== value;
          }));
          data = [...data].sort((a, b) => {
            for (const [column, settings] of call.orders) {
              const av = a[column];
              const bv = b[column];
              if (av == null && bv == null) continue;
              if (av == null) return settings.nullsFirst ? -1 : 1;
              if (bv == null) return settings.nullsFirst ? 1 : -1;
              if (av !== bv) return settings.ascending ? av - bv : bv - av;
            }
            return 0;
          });
          // Keep data even on error to test that it cannot be published.
          return Promise.resolve({ data, error: options.error === direction
            ? { message: "synthetic query failure" } : null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const sideEffects = [];
  const forbidden = (kind) => {
    sideEffects.push(kind);
    throw new Error("unexpected network or logging side effect");
  };
  const context = vm.createContext({
    fetch: () => forbidden("network"),
    console: {
      log: () => forbidden("logging"),
      warn: () => forbidden("logging"),
      error: () => forbidden("logging"),
    },
  });
  const clientModule = new vm.SyntheticModule(["createPlatformClient"], function () {
    this.setExport("createPlatformClient", () => client);
  }, { context, identifier: "offline-platform-client" });
  const graphModule = new vm.SourceTextModule(graphSource, { context, identifier: "real-entity-graph" });
  const queryModule = new vm.SourceTextModule(querySource, { context, identifier: "real-entity-links" });
  await queryModule.link((specifier) => {
    if (specifier === "../client") return clientModule;
    if (specifier === "@/lib/platform/entity-graph") return graphModule;
    throw new Error(`Unexpected runtime import: ${specifier}`);
  });
  await queryModule.evaluate();
  const queries = Object.fromEntries(Object.entries(queryModule.namespace)
    .map(([name, implementation]) => [name, async (...args) => {
      try {
        return await implementation(...args);
      } finally {
        // Assert outside the query's fail-safe catch so swallowed logs/network
        // attempts cannot falsely pass an empty-result error test.
        assert.deepEqual(sideEffects, []);
      }
    }]));
  return { queries, calls };
}

for (const ignoreNeq of [false, true]) {
  const boundary = ignoreNeq ? "defense-in-depth" : "database predicate";
  test(`getRelatedEntities excludes pending suggested_auto via ${boundary}`, async () => {
    const { queries } = await loadQueries([
      edge("pending", { relation_type: "suggested_auto", sort_order: 0, weight: 99 }),
      edge("accepted", { relation_type: "related" }),
    ], { ignoreNeq });
    assert.deepEqual(ids(await queries.getRelatedEntities("article", "article-1")), ["accepted"]);
  });
  test(`getEntityConnections excludes pending edges in both directions via ${boundary}`, async () => {
    const { queries } = await loadQueries([
      edge("pending-out", { relation_type: "suggested_auto" }),
      incoming("pending-in", { relation_type: "suggested_auto" }),
      edge("accepted-out", { relation_type: "requires_material" }),
      incoming("accepted-in", { relation_type: "learn_with" }),
    ], { ignoreNeq });
    assert.deepEqual(ids(await queries.getEntityConnections("article", "article-1")),
      ["accepted-out", "accepted-in"]);
  });
}

test("all public queries request SQL-level pending exclusion", async () => {
  const { queries, calls } = await loadQueries([]);
  await queries.getRelatedEntities("article", "article-1");
  await queries.getEntityConnections("article", "article-1");
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.ok(call.filters.some(([op, column, value]) =>
      op === "neq" && column === "relation_type" && value === "suggested_auto"));
  }
});

test("getRelatedEntities stays outbound-only and preserves raw accepted legacy relations", async () => {
  const accepted = edge("accepted", { relation_type: "legacy_editorial_relation" });
  const { queries, calls } = await loadQueries([accepted, incoming("incoming")]);
  assert.deepEqual(plain(await queries.getRelatedEntities("article", "article-1")), [accepted]);
  assert.equal(calls.length, 1);
});

test("getRelatedEntities preserves optional target and relation filters", async () => {
  const { queries } = await loadQueries([
    edge("related-product"),
    edge("material-product", { relation_type: "requires_material" }),
    edge("related-workshop", { target_entity_type: "workshop" }),
    incoming("incoming-product", { source_entity_type: "product" }),
  ]);
  assert.deepEqual(ids(await queries.getRelatedEntities("article", "article-1", "product", "related")),
    ["related-product"]);
  assert.deepEqual(ids(await queries.getRelatedEntities("article", "article-1", undefined, "requires_material")),
    ["material-product"]);
});

test("requesting suggested_auto explicitly cannot expose pending related links", async () => {
  const { queries } = await loadQueries([edge("pending", { relation_type: "suggested_auto" })], { ignoreNeq: true });
  assert.deepEqual(ids(await queries.getRelatedEntities("article", "article-1", "product", "suggested_auto")), []);
});

test("getEntityConnections resolves accepted directed edges without rewriting their stored direction", async () => {
  const outbound = edge("out", { relation_type: "requires_material", weight: 4, sort_order: 1 });
  const inbound = incoming("in", { relation_type: "legacy_editorial_relation", weight: 3, sort_order: 2 });
  const { queries } = await loadQueries([outbound, inbound, edge("unrelated", { source_entity_id: "elsewhere" })]);
  assert.deepEqual(plain(await queries.getEntityConnections("article", "article-1")), [
    { entityType: "product", entityId: "out", direction: "outbound",
      relationType: "requires_material", weight: 4, sortOrder: 1, link: outbound },
    { entityType: "workshop", entityId: "in", direction: "inbound",
      relationType: "legacy_editorial_relation", weight: 3, sortOrder: 2, link: inbound },
  ]);
});

test("getEntityConnections exposes the reverse perspective of one stored directed edge", async () => {
  const link = edge("product-1", { relation_type: "requires_material" });
  const { queries } = await loadQueries([link]);
  const [connection] = await queries.getEntityConnections("product", "product-1");
  assert.equal(connection.entityType, "article");
  assert.equal(connection.entityId, "article-1");
  assert.equal(connection.direction, "inbound");
  assert.equal(connection.relationType, "requires_material");
  assert.deepEqual(plain(connection.link), link);
  assert.deepEqual(ids(await queries.getRelatedEntities("product", "product-1")), []);
});

test("getEntityConnections sorts editorial order before weight across both directions", async () => {
  const { queries } = await loadQueries([
    edge("unsorted-heavy", { weight: 100 }),
    edge("later-heavy", { sort_order: 2, weight: 90 }),
    edge("first-light", { sort_order: 0, weight: 1 }),
    incoming("first-heavy", { sort_order: 0, weight: 5 }),
    incoming("unsorted-light", { weight: 2 }),
  ]);
  assert.deepEqual(ids(await queries.getEntityConnections("article", "article-1")),
    ["first-heavy", "first-light", "later-heavy", "unsorted-heavy", "unsorted-light"]);
});

test("getRelatedEntities preserves editorial order before heavier unordered links", async () => {
  const { queries } = await loadQueries([
    edge("unsorted-heavy", { weight: 100 }),
    edge("later-heavy", { sort_order: 2, weight: 90 }),
    edge("first-light", { sort_order: 0, weight: 1 }),
  ]);
  assert.deepEqual(ids(await queries.getRelatedEntities("article", "article-1")),
    ["first-light", "later-heavy", "unsorted-heavy"]);
});

test("getEntityConnections returns a self-link only once with outbound direction", async () => {
  const link = edge("self", { target_entity_type: "article", target_entity_id: "article-1" });
  const { queries } = await loadQueries([link]);
  const result = await queries.getEntityConnections("article", "article-1");
  assert.deepEqual(ids(result), ["self"]);
  assert.equal(result[0].direction, "outbound");
});

for (const reader of ["getRelatedEntities", "getEntityConnections"]) {
  test(`${reader} deduplicates the same stored edge, not distinct relations to the same neighbor`, async () => {
    const link = edge("one");
    const distinct = edge("two", { target_entity_id: link.target_entity_id, relation_type: "requires_material" });
    const { queries } = await loadQueries([link, { ...link }, distinct]);
    assert.deepEqual(ids(await queries[reader]("article", "article-1")), ["one", "two"]);
  });
  test(`${reader} returns an empty list for no matching links`, async () => {
    const { queries } = await loadQueries([edge("unrelated", { source_entity_id: "elsewhere" })]);
    assert.deepEqual(ids(await queries[reader]("article", "article-1")), []);
  });
  test(`${reader} fails safe on a rejected query without logging`, async () => {
    const { queries } = await loadQueries([edge("out"), incoming("in")], { reject: "outbound" });
    assert.deepEqual(ids(await queries[reader]("article", "article-1")), []);
  });
}

test("getRelatedEntities never publishes data accompanying a query error", async () => {
  const { queries } = await loadQueries([edge("out")], { error: "outbound" });
  assert.deepEqual(ids(await queries.getRelatedEntities("article", "article-1")), []);
});

for (const direction of ["outbound", "inbound"]) {
  test(`getEntityConnections fails safe when only the ${direction} query fails`, async () => {
    const { queries } = await loadQueries([edge("out"), incoming("in")], { error: direction });
    assert.deepEqual(ids(await queries.getEntityConnections("article", "article-1")), []);
  });
}
