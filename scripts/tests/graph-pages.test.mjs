import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

// Offline source-bound integration: real page services, graph queries and graph
// normalizers. SDK/framework/commerce collaborators are local, not live DB/RLS.
const root = new URL("../../apps/storefront/src/", import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const ids = rows => Array.from(rows, row => row.id);
const product = { id: "p", slug: "p", product_type: "handmade", price_cents: 1250, is_active: true, status: "active" };
const workshop = { id: "w", slug: "w", creator_id: "c", is_active: true, listing_fee_status: "launch_free" };
const article = { id: "a", slug: "a", author_creator_id: null, is_published: true };
const edge = (id, sourceType, sourceId, targetType, targetId, relation = "related", sort = null) => ({
  id, source_entity_type: sourceType, source_entity_id: sourceId,
  target_entity_type: targetType, target_entity_id: targetId,
  relation_type: relation, sort_order: sort, weight: 1,
});

async function loadPage(kind, edges, options = {}) {
  const products = options.products ?? [product];
  const articles = options.articles ?? [article];
  const workshops = options.workshops ?? [workshop];
  const rows = {
    entity_links: edges, products,
    workshop_required_products: options.requiredRows ?? [],
    project_product_links: options.projectRows ?? [],
    projects: options.projects ?? [],
    workshop_sessions: [], workshop_gallery_images: [], product_gallery_images: [],
  };
  const calls = [];
  const attempts = [];
  const forbidden = name => { attempts.push(name); throw new Error(`Forbidden side effect: ${name}`); };
  const client = { from(table) {
    if (!Object.hasOwn(rows, table)) return forbidden(`table:${table}`);
    const filters = [];
    const orders = [];
    const call = { table, filters };
    calls.push(call);
    return {
      select() { return this; },
      single() { return this; },
      eq(key, value) { filters.push(row => row[key] === value); return this; },
      neq(key, value) { filters.push(row => row[key] !== value); return this; },
      in(key, values) { filters.push(row => values.includes(row[key])); return this; },
      gte(key, value) { filters.push(row => row[key] >= value); return this; },
      order(key, settings) { orders.push([key, settings]); return this; },
      then(resolve, reject) {
        const data = rows[table].filter(row => filters.every(filter => filter(row))).sort((a, b) => {
          for (const [key] of orders) {
            const av = a[key] ?? Number.MAX_SAFE_INTEGER;
            const bv = b[key] ?? Number.MAX_SAFE_INTEGER;
            if (av !== bv) return typeof av === "string" && typeof bv === "string"
              ? av.localeCompare(bv)
              : av - bv;
          }
          return 0;
        });
        if (options.swallowedEffectTable === table) {
          try { forbidden("simulated swallowed effect"); } catch { /* emulate production catch */ }
        }
        if (options.rejectTable === table) return Promise.reject(new Error("local read rejection")).then(resolve, reject);
        return Promise.resolve({ data, error: options.errorTable === table ? { message: "local read error" } : null }).then(resolve, reject);
      },
    };
  } };
  const context = vm.createContext({
    fetch: () => forbidden("network"),
    console: Object.fromEntries(["log", "warn", "error"].map(key => [key, () => forbidden("log")])),
  });
  const visibilityModule = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL("lib/pricing/workshop-launch-offer.ts", root), "utf8")), { context });
  await visibilityModule.link(specifier => { throw new Error(`Unexpected visibility import: ${specifier}`); });
  await visibilityModule.evaluate();
  const visibleWorkshop = row => visibilityModule.namespace.isWorkshopListingPubliclyVisible(row);
  const events = options.events ?? [];
  // Mirror saved-query hydration order and visibility at this local boundary;
  // the actual SDK queries still require separate integration acceptance.
  const byIds = collection => async wanted => [...new Set(wanted)]
    .map(id => collection.find(row => row.id === id)).filter(Boolean);
  const collaborators = {
    "@/lib/platform/client": { createPlatformClient: () => client },
    "@/lib/platform/queries/products": {
      getProductBySlug: async slug => products.find(row => row.slug === slug) ?? null,
      listProductsByIds: byIds(products.filter(row => row.is_active && row.status === "active")),
      listProductsByCreator: async () => [], listProductsByDomain: async () => [],
    },
    "@/lib/platform/queries/articles": {
      getArticleBySlug: async slug => articles.find(row => row.slug === slug) ?? null,
      listArticlesByIds: byIds(articles.filter(row => row.is_published)),
      listArticlesBySlugs: async wanted => [...new Set(wanted)]
        .map(slug => articles.find(row => row.slug === slug && row.is_published)).filter(Boolean),
    },
    "@/lib/platform/queries/workshops": {
      getWorkshopBySlug: async slug => workshops.find(row => row.slug === slug) ?? null,
      listWorkshopsByIds: byIds(workshops.filter(visibleWorkshop)),
      getWorkshopById: async id => workshops.find(row => row.id === id && visibleWorkshop(row)) ?? null,
    },
    "@/lib/platform/queries/events": { listEventsByIds: byIds(events.filter(row => row.is_active)) },
    "@/lib/platform/queries/creators": { getCreatorById: async () => null },
    "@/lib/platform/queries/projects": { listApprovedCommunityGalleryForArticle: async () => [] },
    "@/lib/platform/queries/learning-paths": { listNextLearningPathArticleIds: async () => [] },
    "@/lib/platform/queries/workshop-categories": { getWorkshopCategoryById: async () => null },
    "@/lib/platform/commercial-entitlements": { getCreatorCommercialEntitlements: () => forbidden("entitlements") },
    "@/lib/commerce/medusa/products": {
      getMedusaProduct: async id => id == null ? null : forbidden("medusa"),
      getMedusaProductByHandle: () => forbidden("medusa"),
    },
    "@/lib/commerce/money": { medusaAmountToCents: () => forbidden("commerce amount") },
    "@/lib/media/public-asset-url": { publicAssetUrl: value => value ?? null, publicAssetUrls: values => values },
  };
  const realPaths = {
    "@/lib/platform/queries/entity-links": "lib/platform/queries/entity-links.ts",
    "@/lib/platform/queries/product-usage": "lib/platform/queries/product-usage.ts",
    "@/lib/platform/entity-graph": "lib/platform/entity-graph.ts",
    "@/lib/content/article-graph-relations": "lib/content/article-graph-relations.ts",
    "@/lib/content/article-editorial-links": "lib/content/article-editorial-links.ts",
    "@/lib/content/parse-article-materials": "lib/content/parse-article-materials.ts",
    "./article-section-headings": "lib/content/article-section-headings.ts",
  };
  const modules = new Map();
  function moduleFor(name) {
    if (name === "../client") name = "@/lib/platform/client";
    if (modules.has(name)) return modules.get(name);
    let module;
    if (Object.hasOwn(realPaths, name)) {
      module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL(realPaths[name], root), "utf8")), { context, identifier: name });
    } else {
      const exports = collaborators[name];
      assert.ok(exports, `Unexpected import: ${name}`);
      module = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context, identifier: name });
    }
    modules.set(name, module);
    return module;
  }
  const page = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL(`lib/services/${kind}-page.ts`, root), "utf8")), { context, identifier: `${kind}-page` });
  await page.link(moduleFor);
  await page.evaluate();
  return { async run(slug = kind === "product" ? "p" : kind === "workshop" ? "w" : "a") {
    try { return plain(await page.namespace[`get${kind[0].toUpperCase() + kind.slice(1)}PageData`](slug)); }
    finally { assert.deepEqual(attempts, [], "No network/commerce side effects permitted"); }
  }, calls };
}

test("product discovers incoming article/workshop edges and deduplicates neighbors", async () => {
  const page = await loadPage("product", [
    edge("pa", "product", "p", "article", "a", "related"),
    edge("ap", "article", "a", "product", "p", "related_product"),
    edge("wp", "workshop", "w", "product", "p", "requires_material"),
    edge("wp2", "workshop", "w", "product", "p", "related"),
  ]);
  const data = await page.run();
  assert.deepEqual(ids(data.relatedArticles), ["a"]);
  assert.deepEqual(ids(data.relatedWorkshops), ["w"]);
  assert.deepEqual(data.price, { amount: 1250, currency_code: "EUR" });
  assert.deepEqual(data.variants, []);
});

test("product includes an exclusively incoming approved article", async () => {
  const page = await loadPage("product", [edge("ap", "article", "a", "product", "p", "related_product")]);
  assert.deepEqual(ids((await page.run()).relatedArticles), ["a"]);
});

test("workshop discovers incoming article without promoting incoming products to material requirements", async () => {
  const required = { ...product, id: "required" };
  const optional = { ...product, id: "optional" };
  const incomingProduct = { ...product, id: "incoming" };
  const page = await loadPage("workshop", [
    edge("aw", "article", "a", "workshop", "w"),
    edge("wa", "workshop", "w", "article", "a"),
    edge("ow", "product", "incoming", "workshop", "w", "required_material"),
    edge("wo", "workshop", "w", "product", "optional", "related"),
  ], { products: [required, optional, incomingProduct], requiredRows: [
    { workshop_id: "w", product_id: "required", is_required: true, sort_order: 0 },
  ] });
  const data = await page.run();
  assert.deepEqual(ids(data.relatedArticles), ["a"]);
  assert.deepEqual(ids(data.requiredProducts), ["required"]);
  assert.deepEqual(ids(data.optionalProducts), ["optional"]);
});

test("workshop includes an exclusively incoming approved article", async () => {
  const page = await loadPage("workshop", [edge("aw", "article", "a", "workshop", "w")]);
  assert.deepEqual(ids((await page.run()).relatedArticles), ["a"]);
});

test("legacy approved related product is visible on article without becoming required", async () => {
  const page = await loadPage("article", [edge("ap", "article", "a", "product", "p", "related")]);
  const data = await page.run();
  assert.deepEqual(ids(data.relatedProducts), ["p"]);
  assert.deepEqual(data.requiredMaterials, []);
  assert.deepEqual(data.requiredTools, []);
});

test("reciprocal product discovery respects hydration visibility and editorial article order", async () => {
  const page = await loadPage("product", [
    edge("a1p", "article", "first", "product", "p", "related", 0),
    edge("a2p", "article", "second", "product", "p", "related", 1),
    edge("adp", "article", "draft", "product", "p", "related", 2),
    edge("wp", "workshop", "w", "product", "p"),
    edge("wup", "workshop", "unpaid", "product", "p"),
    edge("wep", "workshop", "expired", "product", "p"),
    edge("ep", "event", "live-event", "product", "p"),
    edge("eip", "event", "inactive-event", "product", "p"),
  ], {
    articles: [{ ...article, id: "second" }, { ...article, id: "first" }, { ...article, id: "draft", is_published: false }],
    workshops: [workshop, { ...workshop, id: "unpaid", listing_fee_status: "unpaid" }, { ...workshop, id: "expired", listing_fee_status: "paid", listing_expires_at: "2000-01-01T00:00:00Z" }],
    events: [{ id: "live-event", is_active: true }, { id: "inactive-event", is_active: false }],
  });
  const data = await page.run();
  assert.deepEqual(ids(data.relatedArticles), ["first", "second"]);
  assert.deepEqual(ids(data.relatedWorkshops), ["w"]);
  assert.deepEqual(ids(data.relatedEvents), ["live-event"]);
});

test("reciprocal workshop events are deduplicated and active-only", async () => {
  const page = await loadPage("workshop", [
    edge("ew", "event", "live", "workshop", "w"),
    edge("we", "workshop", "w", "event", "live"),
    edge("iw", "event", "inactive", "workshop", "w"),
  ], { events: [{ id: "live", is_active: true }, { id: "inactive", is_active: false }] });
  assert.deepEqual(ids((await page.run()).relatedEvents), ["live"]);
});

test("phase2: product discovers dedicated required and optional workshop rows without graph edges", async () => {
  const saved = [
    { workshop_id: "required", product_id: "p", is_required: true, is_bundle_default: true, sort_order: 2 },
    { workshop_id: "optional", product_id: "p", is_required: false, is_bundle_default: false, sort_order: 1 },
    { workshop_id: "other", product_id: "other-product", is_required: true, sort_order: 0 },
  ];
  const snapshot = plain(saved);
  const page = await loadPage("product", [], { requiredRows: saved, workshops: [
    { ...workshop, id: "required" }, { ...workshop, id: "optional" }, { ...workshop, id: "other" },
  ] });
  const result = await page.run();
  assert.deepEqual(ids(result.relatedWorkshops), ["optional", "required"]);
  assert.deepEqual(saved, snapshot);
  assert.deepEqual(result.price, { amount: 1250, currency_code: "EUR" });
  assert.deepEqual(result.variants, []);
});

test("phase2: explicit usage precedes graph recommendations and deduplicates workshops", async () => {
  const page = await loadPage("product", [
    edge("wp", "workshop", "w", "product", "p", "related", 0),
    edge("gp", "workshop", "graph", "product", "p", "related", 1),
  ], { requiredRows: [{ workshop_id: "w", product_id: "p", sort_order: 3 }], workshops: [workshop, { ...workshop, id: "graph" }] });
  assert.deepEqual(ids((await page.run()).relatedWorkshops), ["w", "graph"]);
});

test("phase2: product discovers active projects from authoritative table and approved reciprocal graph", async () => {
  const page = await loadPage("product", [
    edge("rp", "project", "graph", "product", "p", "related"),
    edge("pr", "product", "p", "project", "explicit", "related"),
    edge("pending", "project", "pending", "product", "p", "suggested_auto"),
  ], { projectRows: [
    { project_id: "inactive", product_id: "p", link_type: "material", sort_order: 0 },
    { project_id: "explicit", product_id: "p", link_type: "tool", sort_order: 1 },
    { project_id: "other", product_id: "different", link_type: "material", sort_order: 0 },
  ], projects: [
    { id: "explicit", slug: "explicit", is_active: true },
    { id: "graph", slug: "graph", is_active: true },
    { id: "inactive", slug: "inactive", is_active: false },
    { id: "pending", slug: "pending", is_active: true },
    { id: "other", slug: "other", is_active: true },
  ] });
  assert.deepEqual(ids((await page.run()).relatedProjects), ["explicit", "graph"]);
});

test("phase2: dedicated workshop inverse reads respect public fee and activity filters", async () => {
  const page = await loadPage("product", [], { requiredRows: ["expired", "unpaid", "inactive", "w"].map((id, index) => ({
    workshop_id: id, product_id: "p", sort_order: index, is_required: true,
  })), workshops: [
    { ...workshop, id: "expired", listing_fee_status: "paid", listing_expires_at: "2000-01-01T00:00:00Z" },
    { ...workshop, id: "unpaid", listing_fee_status: "unpaid" },
    { ...workshop, id: "inactive", is_active: false }, workshop,
  ] });
  assert.deepEqual(ids((await page.run()).relatedWorkshops), ["w"]);
});

for (const failTable of ["workshop_required_products", "project_product_links", "projects"]) {
  for (const failure of ["errorTable", "rejectTable"]) {
    test(`phase2: failed ${failTable} ${failure} does not erase valid graph neighbors`, async () => {
      const page = await loadPage("product", [
        edge("wp", "workshop", "w", "product", "p"),
        edge("rp", "project", "graph-project", "product", "p"),
      ], {
        [failure]: failTable, projectRows: [{ project_id: "project", product_id: "p", sort_order: 0 }],
        projects: [
          { id: "project", slug: "project", is_active: true },
          { id: "graph-project", slug: "graph-project", is_active: true },
        ],
      });
      const result = await page.run();
      assert.deepEqual(ids(result.relatedWorkshops), ["w"]);
      assert.deepEqual(ids(result.relatedProjects), failTable === "projects" ? []
        : failTable === "project_product_links" ? ["graph-project"] : ["project", "graph-project"]);
    });
  }
}

test("phase2: equal usage sort order breaks UUID ties consistently and deduplicates saved rows", async () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const page = await loadPage("product", [], { requiredRows: [
    { workshop_id: second, product_id: "p", sort_order: 0 },
    { workshop_id: first, product_id: "p", sort_order: 0 },
    { workshop_id: first, product_id: "p", sort_order: 0 },
  ], workshops: [{ ...workshop, id: second }, { ...workshop, id: first }] });
  assert.deepEqual(ids((await page.run()).relatedWorkshops), [first, second]);
});

test("phase2: swallowed forbidden effect fails the outside guard", async () => {
  const page = await loadPage("product", [], { swallowedEffectTable: "project_product_links" });
  await assert.rejects(page.run(), /No network\/commerce side effects permitted/);
});

for (const kind of ["product", "article", "workshop"]) {
  test(`${kind} public page excludes pending edges in both directions`, async () => {
    const page = await loadPage(kind, [
      edge("ap", "article", "a", "product", "p", "suggested_auto"),
      edge("pa", "product", "p", "article", "a", "suggested_auto"),
      edge("aw", "article", "a", "workshop", "w", "suggested_auto"),
      edge("wa", "workshop", "w", "article", "a", "suggested_auto"),
    ]);
    const data = await page.run();
    for (const key of ["relatedProducts", "relatedArticles", "relatedWorkshops", "requiredMaterials", "optionalProducts"]) {
      if (Object.hasOwn(data, key)) assert.deepEqual(data[key], []);
    }
  });
  test(`${kind} missing entity preserves empty page contract`, async () => {
    const page = await loadPage(kind, []);
    const data = await page.run("missing");
    assert.equal(data[kind], null);
    assert.equal(page.calls.length, 0);
  });
}
