import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

// Actual homepage + public target queries + pure visibility helpers; no SDK,
// framework, commerce, network, or live database imports are evaluated.
const root = new URL("../../apps/storefront/src/", import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const product = (id, extra = {}) => ({ id, title: `Materiaal ${id}`, slug: id, is_active: true, status: "active", ...extra });
const workshop = (id, extra = {}) => ({ id, title: `Workshop ${id}`, slug: id, city: null, is_active: true, listing_fee_status: "launch_free", listing_expires_at: null, ...extra });
// Intentionally no is_active: the local Creator type/DDL has no such field.
const creator = (id, extra = {}) => ({ id, display_name: `Maker ${id}`, business_name: null, slug: id, ...extra });
const candidate = (id, extra = {}) => ({ id, title: `Creatief ${id}`, slug: id, featured_image_url: `/${id}.jpg`, difficulty_level: "beginner", ...extra });
const connections = (products = [], workshops = [], creators = []) => [
  ...products.map(entityId => ({ entityType: "product", entityId, relationType: "related_product", direction: "outbound" })),
  ...workshops.map(entityId => ({ entityType: "workshop", entityId, relationType: "related_workshop", direction: "outbound" })),
  ...creators.map(entityId => ({ entityType: "creator", entityId, relationType: "made_by", direction: "outbound" })),
];
const labels = links => links.map(link => link.label);

async function loadHome(options = {}) {
  const rows = {
    products: options.products ?? [product("p")],
    workshops: options.workshops ?? [workshop("w")],
    creators: options.creators ?? [creator("c")],
  };
  const calls = [];
  const candidateCalls = [];
  const attempts = [];
  const forbidden = name => { attempts.push(name); throw new Error(`Forbidden side effect: ${name}`); };
  const client = { from(table) {
    if (!Object.hasOwn(rows, table)) return forbidden(`table:${table}`);
    const filters = [];
    const call = { table, filters: [], projection: null };
    calls.push(call);
    let single = false;
    const query = {
      select(projection) { call.projection = projection; return this; },
      eq(key, value) {
        if (table === "creators" && key === "is_active") return forbidden("invented creator activity gate");
        call.filters.push(["eq", key, value]);
        filters.push(row => row[key] === value);
        return this;
      },
      in(key, values) {
        call.filters.push(["in", key, Array.from(values)]);
        filters.push(row => values.includes(row[key]));
        return this;
      },
      single() { single = true; return this; },
      maybeSingle() { single = true; return this; },
      then(resolve, reject) {
        if (!call.filters.some(([, key]) => key === "id")) return forbidden(`unbounded catalog:${table}`);
        if (options.swallowedEffect === table) {
          try { forbidden("network fixture tripwire"); } catch { /* emulate a broad swallowed catch */ }
          return Promise.resolve({ data: null, error: { message: "fixture failure" } }).then(resolve, reject);
        }
        if (options.throwTable === table) return Promise.reject(new Error("fixture hydration rejection")).then(resolve, reject);
        if (options.failTables?.includes(table)) return Promise.resolve({ data: null, error: { message: "fixture failure" } }).then(resolve, reject);
        const selected = rows[table].filter(row => filters.every(filter => filter(row))).map(row => {
          if (call.projection === "*") return { ...row };
          return Object.fromEntries(call.projection.split(",").map(key => [key.trim(), row[key.trim()]]));
        });
        return Promise.resolve({ data: single ? selected[0] ?? null : selected, error: null }).then(resolve, reject);
      },
    };
    return new Proxy(query, { get(target, key) {
      if (key in target) return target[key];
      return () => forbidden(`client method:${String(key)}`);
    } });
  } };
  const context = vm.createContext({
    fetch: () => forbidden("network"),
    WebSocket: function () { forbidden("network websocket"); },
    console: Object.fromEntries(["log", "info", "warn", "error"].map(key => [key, () => forbidden(`console:${key}`)])),
  }, { codeGeneration: { strings: false, wasm: false } });
  const tripwire = name => () => forbidden(name);
  const collaborators = {
    "@/lib/platform/client": { createPlatformClient: () => client },
    "@/lib/platform/queries/entity-links": { getEntityConnections: async (kind, id) => {
      candidateCalls.push(["connections", kind, id]);
      if (options.failGraphIds?.includes(id)) throw new Error("fixture graph rejection");
      return options.graphById?.[id] ?? options.graph ?? connections(["p"], ["w"], ["c"]);
    } },
    "@/lib/platform/queries/articles": { listLatestArticles: async limit => {
      candidateCalls.push(["articles", limit]); return options.articles ?? [candidate("a")];
    } },
    "@/lib/platform/queries/projects": {
      listFeaturedProjects: async limit => { candidateCalls.push(["projects", limit]); return options.projects ?? []; },
      listProjectProductLinks: async id => { candidateCalls.push(["project-products", id]); if(options.failProjectIds?.includes(id))throw new Error("fixture project rejection"); return options.projectLinks?.[id] ?? []; },
    },
    "@/lib/platform/ranking": {
      computeRankingScore: tripwire("ranking"), getActiveBoostScoresForEntities: tripwire("ranking query"),
    },
  };
  const realPaths = {
    "@/lib/services/home-journey": "lib/services/home-journey.ts",
    "@/lib/platform/queries/products": "lib/platform/queries/products.ts",
    "@/lib/platform/queries/workshops": "lib/platform/queries/workshops.ts",
    "@/lib/platform/queries/creators": "lib/platform/queries/creators.ts",
    "@/lib/pricing/workshop-launch-offer": "lib/pricing/workshop-launch-offer.ts",
    "@/lib/platform/workshop-taxonomy": "lib/platform/workshop-taxonomy.ts",
    "@/lib/workshops/workshop-discovery-helpers": "lib/workshops/workshop-discovery-helpers.ts",
    "@/lib/materials/materials-catalog-helpers": "lib/materials/materials-catalog-helpers.ts",
    "@/lib/creators/creators-directory-helpers": "lib/creators/creators-directory-helpers.ts",
    "@/lib/agenda/agenda-helpers": "lib/agenda/agenda-helpers.ts",
    "@/lib/services/home-router-helpers": "lib/services/home-router-helpers.ts",
  };
  const aliases = {
    "../client": "@/lib/platform/client",
    "../ranking": "@/lib/platform/ranking",
    "../workshop-taxonomy": "@/lib/platform/workshop-taxonomy",
  };
  const modules = new Map();
  function moduleFor(specifier) {
    const name = aliases[specifier] ?? specifier;
    if (modules.has(name)) return modules.get(name);
    let module;
    if (Object.hasOwn(realPaths, name)) {
      module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL(realPaths[name], root), "utf8")), {
        context, identifier: name,
        importModuleDynamically: imported => forbidden(`dynamic import:${imported}`),
      });
    } else {
      const exports = collaborators[name];
      if (!exports) return forbidden(`import:${name}`);
      module = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context, identifier: name });
    }
    modules.set(name, module);
    return module;
  }
  const home = moduleFor("@/lib/services/home-journey");
  await home.link(moduleFor);
  await home.evaluate();
  assert.deepEqual(attempts, [], "Imports must not initialize application clients or commerce");
  return { calls, candidateCalls, rows, async run() {
    try { return plain(await home.namespace.resolveHomeJourney()); }
    finally { assert.deepEqual(attempts, [], "No forbidden client/network/commerce attempts, including swallowed failures"); }
  } };
}

function assertBatched(home, table, wanted) {
  const calls = home.calls.filter(call => call.table === table);
  assert.equal(calls.length, 1, `${table}: one batch, not per-item catalog queries`);
  assert.deepEqual(calls[0].filters.find(([op, key]) => op === "in" && key === "id")?.[2], wanted);
}

test("archived and inactive products are excluded while the active fallback remains", async () => {
  const home = await loadHome({ graph: connections(["archived", "inactive", "valid"], [], ["c"]), products: [product("archived", { status: "archived" }), product("inactive", { is_active: false }), product("valid")] });
  assert.deepEqual((await home.run()).materials, [{ label: "Materiaal valid", href: "/product/valid" }]);
  assertBatched(home, "products", ["archived", "inactive", "valid"]);
});

for (const [name, extra] of [
  ["expired", { listing_fee_status: "paid", listing_expires_at: "2000-01-01T00:00:00Z" }],
  ["unpaid", { listing_fee_status: "unpaid" }],
  ["inactive", { is_active: false }],
]) {
  test(`${name} first workshop is excluded and the next eligible workshop is used`, async () => {
    const home = await loadHome({ graph: connections(["p"], [name, "missing", "valid"]), workshops: [workshop(name, extra), workshop("valid", { city: " Gent " })] });
    const journey = await home.run();
    assert.ok(journey, "Eligible fallback must produce a journey");
    assert.deepEqual(journey.workshop, { label: "Workshop valid in Gent", href: "/workshop/valid" });
    assertBatched(home, "workshops", [name, "missing", "valid"]);
  });
}

test("materials are hydrated for eligibility before the old six-row and four-link caps", async () => {
  const hidden = Array.from({ length: 6 }, (_, i) => `hidden-${i}`);
  const valid = ["v4", "v2", "v5", "v1", "v3"];
  const home = await loadHome({ graph: connections([...hidden, ...valid], [], ["c"]), products: [...valid].reverse().map(id => product(id)) });
  const journey = await home.run();
  assert.ok(journey, "Eligible materials beyond the old hydration cap must be found");
  assert.deepEqual(labels(journey.materials), valid.slice(0, 4).map(id => `Materiaal ${id}`));
  assertBatched(home, "products", [...hidden, ...valid]);
});

test("missing creators are filtered before the three-maker cap without invented activity gating", async () => {
  const valid = ["c4", "c2", "c1", "c3"];
  const home = await loadHome({ graph: connections(["p"], [], ["gone1", "gone2", "gone3", ...valid]), creators: valid.map(id => creator(id)) });
  const journey = await home.run();
  assert.ok(journey, "Eligible creators beyond missing IDs must be found");
  assert.deepEqual(labels(journey.makers), ["Maker c4", "Maker c2", "Maker c1"]);
  assert.equal(home.calls.filter(call => call.table === "creators").length, 7);
});

test("graph order wins over reversed and repeated hydration rows for all target types", async () => {
  const home = await loadHome({ graph: connections(["p2", "p1"], ["w2", "w1"], ["c2", "c1"]),
    products: [product("p1"), product("p2"), product("p2")],
    workshops: [workshop("w1"), workshop("w2")], creators: [creator("c1"), creator("c2")],
  });
  const journey = await home.run();
  assert.deepEqual(labels(journey.materials), ["Materiaal p2", "Materiaal p1"]);
  assert.deepEqual(journey.workshop, { label: "Workshop w2", href: "/workshop/w2" });
  assert.deepEqual(labels(journey.makers), ["Maker c2", "Maker c1"]);
});

test("creator graph order is preserved independently of database row order", async () => {
  const home = await loadHome({ graph: connections(["p"], [], ["c2", "c1"]), creators: [creator("c1"), creator("c2")] });
  assert.deepEqual(labels((await home.run()).makers), ["Maker c2", "Maker c1"]);
});

test("eligible paid workshop fallback remains visible without booking or stock fields", async () => {
  const home = await loadHome({ graph: connections(["p"], ["missing", "paid", "free"]),
    workshops: [workshop("free"), workshop("paid", { listing_fee_status: "paid", listing_expires_at: "9999-12-31T00:00:00Z", city: " " })],
  });
  const journey = await home.run();
  assert.ok(journey, "The public paid-listing policy must permit an eligible fallback");
  assert.deepEqual(journey.workshop, { label: "Workshop paid", href: "/workshop/paid" });
});

test("repeated graph/project IDs dedupe and use one product/workshop batch", async () => {
  const graph = connections(["p", "p"], ["w", "w"], ["c", "c"]);
  const home = await loadHome({ articles: [], projects: [candidate("project")], graph,
    projectLinks: { project: [{ product_id: "p" }, { product_id: "p2" }, { product_id: "p2" }] }, products: [product("p2"), product("p")],
  });
  const journey = await home.run();
  assert.deepEqual(labels(journey.materials), ["Materiaal p", "Materiaal p2"]);
  assert.equal(journey.href, "/project/project");
  assertBatched(home, "products", ["p", "p2"]);
  assertBatched(home, "workshops", ["w"]);
  assert.equal(home.calls.filter(call => call.table === "creators").length, 1);
  assert.deepEqual(graph, connections(["p", "p"], ["w", "w"], ["c", "c"]));
});

test("repeat resolution is stable, detached and rechecks changed eligibility", async () => {
  const graph = connections(["p"], ["w"], ["c"]);
  const home = await loadHome({ graph });
  const first = await home.run();
  assert.deepEqual(await home.run(), first);
  first.materials[0].label = "changed by caller";
  assert.equal((await home.run()).materials[0].label, "Materiaal p");
  home.rows.products[0].status = "archived";
  assert.deepEqual((await home.run()).materials, []);
  assert.deepEqual(graph, connections(["p"], ["w"], ["c"]));
});

test("compatibility: empty candidates return null without target hydration", async () => {
  const home = await loadHome({ articles: [], projects: [] });
  assert.equal(await home.run(), null);
  assert.deepEqual(home.calls, []);
});

test("compatibility: fewer than two raw legs never hydrates targets", async () => {
  const home = await loadHome({ graph: connections(["p"]) });
  assert.equal(await home.run(), null);
  assert.deepEqual(home.calls, []);
});

test("empty target IDs do not trigger unused product/workshop catalog queries", async () => {
  const home = await loadHome({ graph: connections([], ["w"], ["c"]) });
  assert.deepEqual((await home.run()).materials, []);
  assert.equal(home.calls.filter(call => call.table === "products").length, 0);
  const other = await loadHome({ graph: connections(["p"], [], ["c"]) });
  assert.equal((await other.run()).workshop, null);
  assert.equal(other.calls.filter(call => call.table === "workshops").length, 0);
});

test("deleted or ineligible targets cannot count as two resolved legs", async () => {
  const home = await loadHome({ products: [product("p", { status: "archived" })], workshops: [workshop("w", { listing_fee_status: "unpaid" })] });
  assert.equal(await home.run(), null);
});

for (const table of ["products", "workshops", "creators"]) {
  test(`${table} failed hydration empties only that leg and preserves the other two`, async () => {
    const home = await loadHome({ failTables: [table] });
    const journey = await home.run();
    assert.ok(journey);
    assert.deepEqual(journey[table === "products" ? "materials" : table === "workshops" ? "workshop" : "makers"], table === "workshops" ? null : []);
  });
}

test("compatibility: all hydration errors fail closed to null", async () => {
  const home = await loadHome({ failTables: ["products", "workshops", "creators"] });
  assert.equal(await home.run(), null);
});

test("compatibility: unexpected hydration rejection is propagated, not concealed", async () => {
  const home = await loadHome({ throwTable: "products" });
  await assert.rejects(home.run(), /fixture hydration rejection/);
});

test("the no-network guard catches attempted effects even when a query swallows them", async () => {
  const home = await loadHome({ swallowedEffect: "products" });
  await assert.rejects(home.run(), /No forbidden client\/network\/commerce attempts/);
});

test("fallback advances to the next candidate when eligible hydration leaves one leg", async () => {
  const home = await loadHome({ articles: [candidate("first"), candidate("second")],
    graphById: { first: connections(["archived"], [], ["c"]), second: connections(["p"], ["w"]) },
    products: [product("archived", { status: "archived" }), product("p")],
  });
  assert.equal((await home.run()).href, "/artikel/second");
});

test("quality filtering and interleave stay intact while stronger hydrated journey wins", async () => {
  const home = await loadHome({ articles: [candidate("bad", { title: "Test content" }), candidate("no-image", { featured_image_url: " " }), candidate("article")], projects: [candidate("project")],
    graphById: { project: connections(["p"], [], ["c"]), article: connections(["p"], ["w"], ["c"]) },
    creators: [creator("c", { business_name: " Atelier ", display_name: "Display" })],
  });
  assert.deepEqual(await home.run(), { kind: "article", title: "Creatief article", href: "/artikel/article", imageUrl: "/article.jpg", difficultyLevel: "beginner",
    materials: [{ label: "Materiaal p", href: "/product/p" }], workshop: {label:"Workshop w",href:"/workshop/w"}, makers: [{ label: "Atelier", href: "/creator/c" }],
  });
  assert.deepEqual(home.candidateCalls, [["articles", 8], ["projects", 8], ["connections", "project", "project"], ["project-products", "project"], ["connections", "article", "article"]]);
});

test("rank uses eligible resolved legs rather than raw target counts or stale strong links",async()=>{
 const home=await loadHome({articles:[candidate("raw"),candidate("complete")],graphById:{raw:connections(["hidden"],["w"],["c"]),complete:connections(["p"],["w"],["c"])},products:[product("hidden",{status:"archived"}),product("p")]});
 assert.equal((await home.run()).href,"/artikel/complete");
});
test("eligible explicit material wins equal completeness, general topic edges never become requirements",async()=>{
 const home=await loadHome({articles:[candidate("generic"),candidate("explicit")],graphById:{generic:connections(["p"],[],["c"]),explicit:[{entityType:"product",entityId:"p",relationType:"required_tool",direction:"outbound"},...connections([],[],["c"])]}});
 assert.equal((await home.run()).href,"/artikel/explicit");
});
test("missing explicit material cannot boost an otherwise equal journey",async()=>{
 const home=await loadHome({articles:[candidate("first"),candidate("later")],graphById:{first:connections(["p"],[],["c"]),later:[{entityType:"product",entityId:"gone",relationType:"required_material",direction:"outbound"},...connections(["p"],[],["c"])]}});
 assert.equal((await home.run()).href,"/artikel/first");
});
for(const direction of ["inbound",undefined])test(`required role with ${direction??"missing"} direction is context not outbound evidence`,async()=>{
 const home=await loadHome({articles:[candidate("first"),candidate("later")],graphById:{first:connections(["p"],[],["c"]),later:[{entityType:"product",entityId:"p",relationType:"required_material",...(direction?{direction}:{})},...connections([],[],["c"])]}});
 assert.equal((await home.run()).href,"/artikel/first");
});

test("project associations rank ahead of generic graph materials, dedupe without mutating inputs",async()=>{
 const links=[{product_id:"p2"},{product_id:"p2"}];
 const home=await loadHome({articles:[],projects:[candidate("project")],projectLinks:{project:links},graph:connections(["p"],[],["c"]),products:[product("p"),product("p2")]});
 assert.deepEqual(labels((await home.run()).materials),["Materiaal p2","Materiaal p"]);assert.deepEqual(links,[{product_id:"p2"},{product_id:"p2"}]);
});
test("equal quality preserves editorial interleave and caps candidate scans at eight",async()=>{
 const home=await loadHome({articles:Array.from({length:8},(_,i)=>candidate(`a${i}`)),projects:Array.from({length:8},(_,i)=>candidate(`j${i}`))});
 const first=await home.run();assert.equal(first.href,"/project/j0");
 assert.equal(home.candidateCalls.filter(c=>c[0]==="connections").length,8);
 assert.deepEqual(await home.run(),first);
});
test("pending edges cannot create a leg or steal ranking from approved content",async()=>{
 const home=await loadHome({articles:[candidate("pending"),candidate("accepted")],graphById:{pending:[{entityType:"product",entityId:"p",relationType:"suggested_auto"},...connections([],[],["c"])],accepted:connections(["p"],["w"])}});
 assert.equal((await home.run()).href,"/artikel/accepted");
});
test("one failed graph or explicit-project read does not erase other eligible candidates",async()=>{
 for(const opts of [{articles:[candidate("bad"),candidate("good")],failGraphIds:["bad"]},{articles:[candidate("good")],projects:[candidate("bad")],failProjectIds:["bad"]}]){
  const home=await loadHome(opts);assert.equal((await home.run()).href,"/artikel/good");
 }
});
