// Run: node --experimental-vm-modules --test scripts/tests/graph-approval.test.mjs
// Executes the complete dashboard module and actual approval action. All external
// imports are local collaborators/tripwires; no app bootstrap, DB or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const dashboardPath = "apps/storefront/src/app/actions/dashboard.ts";
const relationPath = "apps/storefront/src/lib/content/article-suggestion-relation.ts";
const source = (path) => readFileSync(new URL(path, root), "utf8");
const LINK_ID = "abcdefab-cdef-4abc-8def-abcdefabcdef";
const ARTICLE_ID = "bcdefabc-defa-4bcd-8efa-bcdefabcdefa";
const CREATOR_ID = "33333333-3333-4333-8333-333333333333";
const PRODUCT_ROLES = ["required_material", "required_tool", "optional_material", "related_product"];
const tripwire = () => { throw Error("External/unexpected collaborator is forbidden"); };
const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_COLUMNS = { entity_links: ["id", "source_entity_id"], articles: ["id"] };

// Model PostgreSQL UUID equality only for known UUID columns. Other predicates
// retain strict matching; case-folding relation/target/ownership strings is unsafe.
function matchesColumn(table, column, stored, requested) {
  if (UUID_COLUMNS[table]?.includes(column) &&
      typeof stored === "string" && typeof requested === "string" &&
      UUID_TEXT.test(stored) && UUID_TEXT.test(requested)) {
    return stored.toLowerCase() === requested.toLowerCase();
  }
  return stored === requested;
}

async function fixture(options = {}) {
  const link = {
    id: LINK_ID, source_entity_type: "article", source_entity_id: ARTICLE_ID,
    target_entity_type: "product", relation_type: "suggested_auto", weight: 7,
    ...options.link,
  };
  const article = { id: ARTICLE_ID, author_creator_id: CREATOR_ID, ...options.article };
  const calls = { dbClients: 0, reads: [], rpcs: [], directMutations: [], revalidated: [], auth: 0 };
  let didRace = false;
  let articleReaders = 0;
  let releaseReaders;
  const readersReady = new Promise((resolve) => { releaseReaders = resolve; });

  function from(table) {
    assert.ok(["entity_links", "articles"].includes(table));
    const query = {
      filters: [], columns: null, result: null,
      select(columns) { this.columns = columns.split(",").map((column) => column.trim()); return this; },
      eq(column, value) { this.filters.push([column, value]); return this; },
      update() { calls.directMutations.push("update"); return tripwire(); },
      delete() { calls.directMutations.push("delete"); return tripwire(); },
      async execute(single) {
        if (this.result) return this.result;

        const row = table === "entity_links" ? link : article;
        const matches = !options.missingLink || table !== "entity_links";
        const matching = matches && this.filters.every(([column, value]) => matchesColumn(table, column, row[column], value));
        calls.reads.push({ table, filters: this.filters.slice(), columns: this.columns });
        const affected = matching;
        const projected = affected && this.columns
          ? Object.fromEntries(this.columns.map((column) => [column, row[column]])) : null;
        const error = options.readError && table === "entity_links"
          ? Error("offline read failed") : null;
        this.result = { data: error ? null : single ? projected : projected ? [projected] : null, error };
        // Both actual actions must read the pending link before either may call RPC.
        if (table === "articles" && options.twoApprovals) {
          articleReaders++;
          if (articleReaders === 2) releaseReaders();
          await readersReady;
        }
        return this.result;
      },
      maybeSingle() { return this.execute(true); },
      then(resolve, reject) { return this.execute(false).then(resolve, reject); },
    };
    return query;
  }

  // SDK contract model only: PostgreSQL acceptance tests enforce the real SQL CAS.
  async function rpc(name, args) {
    assert.equal(name, "graph_decide_article_suggestion");
    assert.deepEqual(Object.keys(args).sort(), ["p_article_id", "p_creator_id", "p_link_id", "p_relation"]);
    assert.equal(args.p_creator_id, CREATOR_ID);
    assert.equal(args.p_article_id, ARTICLE_ID);
    const reads = [calls.reads.find((read) => read.table === "entity_links"),
      calls.reads.find((read) => read.table === "articles")];
    assert.deepEqual(reads, [
      { table: "entity_links", columns: ["id", "source_entity_id", "relation_type", "target_entity_type"],
        filters: [["id", args.p_link_id], ["source_entity_type", "article"], ["relation_type", "suggested_auto"]] },
      { table: "articles", columns: ["id"], filters: [["id", ARTICLE_ID], ["author_creator_id", CREATOR_ID]] },
    ]);
    if (!didRace && (options.race || options.articleRace)) {
      didRace = true;
      Object.assign(link, options.race);
      Object.assign(article, options.articleRace);
    }
    const matching = matchesColumn("entity_links", "id", link.id, args.p_link_id) &&
      link.source_entity_type === "article" &&
      matchesColumn("entity_links", "source_entity_id", link.source_entity_id, args.p_article_id) &&
      link.relation_type === "suggested_auto" && article.author_creator_id === args.p_creator_id &&
      (link.target_entity_type === "product" ? PRODUCT_ROLES.includes(args.p_relation) :
        ["workshop", "event"].includes(link.target_entity_type) && args.p_relation === "related");
    calls.rpcs.push({ name, args: { ...args }, matching });
    if (options.rpcError) return { data: null, error: Error("offline RPC failed") };
    if (matching && !options.zeroAffected) link.relation_type = args.p_relation;
    return { data: options.responseData !== undefined ? options.responseData : matching && !options.zeroAffected, error: null };
  }

  const collaborators = {
    createPlatformClient() { calls.dbClients++; return { from, rpc }; },
    async getAuthUser() { calls.auth++; return options.unauthenticated ? null : { id: "offline-user" }; },
    async getCreatorByUserId(userId) {
      assert.equal(userId, "offline-user");
      return options.noCreator ? null : { id: CREATOR_ID };
    },
    creatorMakerProfileUrl: () => "/offline-maker",
    revalidatePath(path) { calls.revalidated.push(path); },
    redirect(location) {
      const error = Error("offline redirect");
      error.digest = "NEXT_REDIRECT;replace;";
      error.location = location;
      throw error;
    },
  };
  const context = vm.createContext({ FormData, Error, URL, fetch: tripwire });
  const text = stripTypeScriptTypes(source(dashboardPath));
  const dashboard = new vm.SourceTextModule(text, { context, identifier: dashboardPath });
  const importBindings = new Map([...text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
    .map((match) => [match[2], match[1].split(",").map((name) => name.trim()).filter(Boolean)]));
  await dashboard.link(async (specifier) => {
    if (specifier === "@/lib/dashboard/return-path") {
      const helper = new vm.SourceTextModule(stripTypeScriptTypes(source("apps/storefront/src/lib/dashboard/return-path.ts")), { context, identifier: specifier });
      await helper.link(tripwire);
      return helper;
    }
    if (specifier === "@/lib/content/article-suggestion-relation") {
      const helper = new vm.SourceTextModule(stripTypeScriptTypes(source(relationPath)), { context, identifier: relationPath });
      await helper.link(tripwire);
      return helper;
    }
    const names = importBindings.get(specifier);
    assert.ok(names, `Unsupported import: ${specifier}`);
    assert.ok(names.every((name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)), "Only simple named imports supported");
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, collaborators[name] ?? tripwire);
    }, { context, identifier: specifier });
  });
  await dashboard.evaluate();

  async function approve(fields = {}) {
    const form = new FormData();
    form.set("entity_link_id", LINK_ID);
    for (const [field, value] of Object.entries(fields)) {
      if (Array.isArray(value)) value.forEach((item) => form.append(field, item));
      else form.set(field, value);
    }
    try {
      await dashboard.namespace.approveArticleSuggestionAction(form);
      assert.fail("Approval must redirect");
    } catch (error) {
      assert.deepEqual(calls.directMutations, [], "No direct update/delete or fallback is permitted");
      assert.ok(error.digest?.startsWith("NEXT_REDIRECT"), error.stack);
      const location = new URL(error.location, "https://offline.invalid");
      return { path: location.pathname, error: location.searchParams.get("error"), success: location.searchParams.get("success") };
    }
  }
  return { approve, link, article, calls };
}

for (const [table, column] of [
  ["entity_links", "id"], ["entity_links", "source_entity_id"], ["articles", "id"],
]) {
  test(`offline PostgreSQL UUID matcher folds case only for ${table}.${column}`, () => {
    assert.equal(matchesColumn(table, column, LINK_ID, LINK_ID.toUpperCase()), true);
    assert.equal(matchesColumn(table, column, LINK_ID, ARTICLE_ID.toUpperCase()), false);
    assert.equal(matchesColumn(table, column, "not-a-uuid", "NOT-A-UUID"), false);
  });
}

test("offline UUID matching leaves non-UUID column predicates case-sensitive", () => {
  for (const [table, column, value] of [
    ["entity_links", "relation_type", "suggested_auto"],
    ["entity_links", "source_entity_type", "article"],
    ["entity_links", "target_entity_type", "product"],
    ["articles", "author_creator_id", LINK_ID],
  ]) {
    assert.equal(matchesColumn(table, column, value, value.toUpperCase()), false);
  }
});

for (const submittedId of [LINK_ID.toUpperCase(), LINK_ID.replace("abcdefab", "aBcDeFaB")]) {
  test(`approval accepts a case-variant UUID and reports the persisted success: ${submittedId}`, async (t) => {
    const f = await fixture();
    const result = await f.approve({ entity_link_id: submittedId });
    assert.equal(f.calls.rpcs.length, 1);
    assert.equal(f.calls.rpcs[0].matching, true, "RPC UUID argument matches the authorized row");
    assert.equal(f.link.id, LINK_ID, "Persisted UUID remains canonical lowercase");
    assert.equal(f.link.relation_type, "related_product", "Mutation persisted before checking the response");
    t.diagnostic(JSON.stringify({ rpcMatched: f.calls.rpcs[0].matching, persistedRole: f.link.relation_type, ...result, revalidated: f.calls.revalidated }));
    assert.equal(result.success, "Suggestie bevestigd.");
    assert.equal(result.error, null);
    assert.deepEqual(f.calls.revalidated, ["/profile", "/dashboard/pagina"]);
  });
}

for (const relation of [undefined, "", "  ", "related", ...PRODUCT_ROLES]) {
  test(`product approval persists canonical role for ${JSON.stringify(relation)}`, async () => {
    const f = await fixture();
    const result = await f.approve(relation === undefined ? {} : { relation_type: relation });
    assert.equal(result.success, "Suggestie bevestigd.");
    assert.equal(result.error, null);
    assert.equal(f.link.relation_type, PRODUCT_ROLES.includes(relation) ? relation : "related_product");
    assert.deepEqual(f.calls.rpcs[0].args, { p_link_id: LINK_ID, p_article_id: ARTICLE_ID, p_creator_id: CREATOR_ID, p_relation: f.link.relation_type });
    assert.deepEqual(f.calls.revalidated, ["/profile", "/dashboard/pagina"]);
    assert.equal(f.link.weight, 7, "Approval does not rescore the link");
  });
}

for (const target of ["workshop", "event"]) {
  for (const relation of [undefined, "related"]) {
    test(`${target} approval keeps related for ${JSON.stringify(relation)}`, async () => {
      const f = await fixture({ link: { target_entity_type: target } });
      assert.equal((await f.approve(relation === undefined ? {} : { relation_type: relation })).success, "Suggestie bevestigd.");
      assert.equal(f.link.relation_type, "related");
      assert.deepEqual(f.calls.rpcs[0].args, { p_link_id: LINK_ID, p_article_id: ARTICLE_ID, p_creator_id: CREATOR_ID, p_relation: "related" });
    });
  }
}

for (const [target, relations] of [
  ["product", ["suggested_auto", "mentions", "related_article", "next_step", "__proto__", "constructor", "RELATED_PRODUCT"]],
  ["workshop", PRODUCT_ROLES], ["event", PRODUCT_ROLES],
]) {
  for (const relation of relations) {
    test(`${target} rejects invalid or target-incompatible relation ${relation}`, async () => {
      const f = await fixture({ link: { target_entity_type: target } });
      const result = await f.approve({ relation_type: relation });
      assert.equal(result.success, null);
      assert.equal(result.error, "Ongeldig relatietype voor deze suggestie.");
      assert.equal(f.calls.rpcs.length, 0);
      assert.equal(f.link.relation_type, "suggested_auto");
      assert.deepEqual(f.calls.revalidated, []);
    });
  }
}

for (const target of ["article", "project", "creator", "unknown", "PRODUCT", null]) {
  test(`approval rejects unsupported persisted target ${JSON.stringify(target)}`, async () => {
    const f = await fixture({ link: { target_entity_type: target } });
    const result = await f.approve({ target_entity_type: "product" });
    assert.equal(result.success, null);
    assert.equal(result.error, "Ongeldig doeltype voor deze suggestie.");
    assert.equal(f.calls.rpcs.length, 0);
  });
}

test("approval ignores spoofed form target and uses persisted product", async () => {
  const f = await fixture();
  assert.equal((await f.approve({ target_entity_type: "workshop" })).success, "Suggestie bevestigd.");
  assert.equal(f.link.relation_type, "related_product");
});

test("spoofed product target cannot authorize a product role on a workshop", async () => {
  const f = await fixture({ link: { target_entity_type: "workshop" } });
  assert.equal((await f.approve({ target_entity_type: "product", relation_type: "required_tool" })).success, null);
  assert.equal(f.calls.rpcs.length, 0);
});

test("a file upload cannot supply a relation role", async () => {
  const f = await fixture();
  const result = await f.approve({ relation_type: new Blob(["related"]) });
  assert.equal(result.success, null);
  assert.equal(result.error, "Ongeldig relatietype voor deze suggestie.");
  assert.equal(f.calls.rpcs.length, 0);
});

test("duplicate relation fields cannot hide a tampered role", async () => {
  const f = await fixture();
  const result = await f.approve({ relation_type: ["related", "mentions"] });
  assert.equal(result.success, null);
  assert.equal(result.error, "Ongeldig relatietype voor deze suggestie.");
  assert.equal(f.calls.rpcs.length, 0);
});

for (const options of [
  { article: { author_creator_id: "other-creator" } },
  { link: { source_entity_type: "product" } },
  { link: { relation_type: "related_product" } },
  { missingLink: true }, { readError: true },
]) {
  test(`authorization/pending lookup rejects ${JSON.stringify(options)}`, async () => {
    const f = await fixture(options);
    const result = await f.approve();
    assert.equal(result.success, null);
    assert.ok(result.error);
    assert.equal(f.calls.rpcs.length, 0);
    assert.deepEqual(f.calls.revalidated, []);
  });
}

for (const options of [{ unauthenticated: true }, { noCreator: true }]) {
  test(`authentication rejects before any DB access ${JSON.stringify(options)}`, async () => {
    const f = await fixture(options);
    const result = await f.approve();
    assert.equal(result.success, null);
    if (options.unauthenticated) assert.equal(result.path, "/login");
    else assert.equal(result.error, "Maak eerst een creator-profiel aan.");
    assert.equal(f.calls.dbClients, 0);
  });
}

test("invalid suggestion id fails before any DB access", async () => {
  const f = await fixture();
  assert.equal((await f.approve({ entity_link_id: "tampered" })).success, null);
  assert.equal(f.calls.dbClients, 0);
});

for (const race of [
  { relation_type: "required_tool" },
  { source_entity_type: "product" },
  { source_entity_id: "other-article" },
  { target_entity_type: "workshop" },
]) {
  test(`conditional approval cannot overwrite changed pending/source ${JSON.stringify(race)}`, async () => {
    const f = await fixture({ race });
    const result = await f.approve();
    assert.equal(result.success, null);
    assert.ok(result.error);
    assert.equal(f.calls.rpcs.length, 1);
    assert.equal(f.calls.rpcs[0].matching, false);
    for (const [column, value] of Object.entries(race)) assert.equal(f.link[column], value);
    assert.deepEqual(f.calls.revalidated, []);
  });
}

for (const options of [{ zeroAffected: true }, { rpcError: true }]) {
  test(`approval does not report success without affected row ${JSON.stringify(options)}`, async () => {
    const f = await fixture(options);
    const result = await f.approve();
    assert.equal(result.success, null);
    assert.ok(result.error);
    assert.equal(f.link.relation_type, "suggested_auto");
    assert.deepEqual(f.calls.revalidated, []);
  });
}

test("approval rejects an affected-row object instead of the RPC boolean contract", async () => {
  const f = await fixture({ responseData: { id: ARTICLE_ID } });
  const result = await f.approve();
  assert.equal(f.calls.rpcs.length, 1);
  assert.equal(f.calls.rpcs[0].matching, true);
  assert.equal(f.link.relation_type, "related_product");
  assert.equal(result.success, null);
  assert.equal(result.error, "Bevestigen van suggestie mislukt.");
  assert.deepEqual(f.calls.revalidated, []);
});

test("approval sends the edge ID, not its source article ID, to the managed RPC", async () => {
  const f = await fixture();
  assert.equal((await f.approve()).success, "Suggestie bevestigd.");
  assert.equal(f.calls.rpcs[0].args.p_link_id, LINK_ID);
  assert.notEqual(f.calls.rpcs[0].args.p_link_id, f.calls.rpcs[0].args.p_article_id);
});

test("RPC owner recheck refuses a creator changed after the authorized pre-read", async () => {
  const f = await fixture({ articleRace: { author_creator_id: "other-creator" } });
  const result = await f.approve();
  assert.equal(result.success, null);
  assert.equal(f.calls.rpcs[0].matching, false);
  assert.equal(f.link.relation_type, "suggested_auto");
  assert.deepEqual(f.calls.revalidated, []);
});

test("two concurrent pending approvals allow exactly one winner without overwriting its role", async () => {
  const f = await fixture({ twoApprovals: true });
  const results = await Promise.all([
    f.approve({ relation_type: "required_material" }),
    f.approve({ relation_type: "required_tool" }),
  ]);
  const winner = results.findIndex((result) => result.success);
  assert.equal(results.filter((result) => result.success).length, 1);
  assert.equal(results.filter((result) => result.error).length, 1);
  assert.equal(f.link.relation_type, winner === 0 ? "required_material" : "required_tool");
  assert.equal(f.calls.rpcs.filter((update) => update.matching).length, 1);
  assert.deepEqual(f.calls.revalidated, ["/profile", "/dashboard/pagina"]);
});

test("confirmation form leaves relation default to the server", () => {
  const text = source("apps/storefront/src/components/dashboard/creator/CreatorArticlesTab.tsx");
  const form = text.match(/<form action=\{approveArticleSuggestionAction\}>([\s\S]*?)<\/form>/)?.[1];
  assert.ok(form, "Approval form exists");
  assert.match(form, /name="entity_link_id"/);
  assert.doesNotMatch(form, /name="relation_type"/);
});
