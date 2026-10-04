import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

// Offline behavioral integration: actual service, article queries, graph reads,
// materials parser and page TSX. Only SDK/framework/client UI boundaries are local.
// No env/secrets loaded. Optional existing audit fixtures enable the full real body.
const root = new URL("../../apps/storefront/src/", import.meta.url);
const require = createRequire(new URL("../../apps/storefront/package.json", import.meta.url));
function dependency(name) {
  if (process.env.HOBBYSALON_TEST_RUNTIME_DIR) {
    return createRequire(resolve(process.env.HOBBYSALON_TEST_RUNTIME_DIR, "package.json"))(name);
  }
  return require(name);
}
const React = dependency("react");
const { renderToStaticMarkup } = dependency("react-dom/server");
const ts = dependency("typescript");
const plain = value => JSON.parse(JSON.stringify(value));
const ids = rows => Array.from(rows, row => row.id);

// Published snapshot excerpts, verbatim materials and explicit companion links.
const snapshotBody = `🛒 MATERIALENLIJST

Wilmade vermeldt voor de oorspronkelijke uitvoering Lion Brand Pound of Love in rood en wit: één bol bevat 454 g en ongeveer 932 m. Voor maat M noteert haar materiaallijst ongeveer 445 g rood en 110 g wit als hoeveelheden bij vergelijkbaar garen. De accenten vragen volgens diezelfde lijst circa 30 g zwart en 45 g hazelnoot; het genoemde accentgaren bevat 100 g en ongeveer 170 m per bol. Dit zijn brongegevens, geen door ons nagewogen verbruiken.

- Rood middelzwaar garen: één grote bol van 454 g voor maat M, geraamd op € 16,95. Omdat 445 g dicht bij een volle bol ligt, kan een extra rode bol verstandig zijn als je een langere trui wilt; die reserve zit niet in het basistotaal.
- Wit middelzwaar garen: één grote bol van 454 g, geraamd op € 16,95. Je koopt dus veel meer dan de opgegeven circa 110 g voor maat M; het overschot blijft voor een ander project.
- Zwart accentgaren: één bol van 100 g, geraamd op € 6,95; de bron noemt circa 30 g gebruik.
- Hazelnootkleurig accentgaren: één bol van 100 g, geraamd op € 6,95; de bron noemt circa 45 g gebruik.
- Haaknaald van 6 mm: geraamd op € 4,95; stopnaald: € 2,50; meetlint: € 2,50; schaar: € 5,95. Wie deze al heeft, hoeft ze niet opnieuw te kopen.

📋 STAP VOOR STAP

🎯 AFSLUITING

Begin met een proeflap en een eerlijke maatvergelijking, leg daarna pas de vier kleuren klaar. Houd het originele schema open zodra het rendier verschijnt en gebruik deze gids als controlelijst voor spanning, garenvoorraad en afwerking. Voor verwante techniek kun je [een wandhanger in tapisseriesteek](https://www.hobbysalon.be/artikel/lama-wandhanger-haken-gratis-tapestry-patroon) bekijken; voor een kleiner winterproject is er [een muts met kleurwerk](https://www.hobbysalon.be/artikel/hartjesmuts-haken-voorbereiding-kleurwerk-patroontips). Beide artikelen zijn aanvullingen, geen vervanging voor de trui-instructies.`;
let mainArticle = {
  id: "e8dbb280-d283-4f33-bd47-d9580e1815a6",
  slug: "rendierkersttrui-haken-voorbereiding-kleurwerk-wilmade",
  title: "Rendierkersttrui haken: voorbereiding, kleurwerk en pasvorm",
  is_published: true, article_type: "guide", author_creator_id: null,
  created_at: "2026-09-28T21:04:03.632499+00:00", updated_at: "2026-09-28T21:04:03.632499+00:00",
  body_markdown: snapshotBody,
};
let companions = [
  { id: "cbd66f2c-8295-48b3-885a-158f475d0a39", slug: "hartjesmuts-haken-voorbereiding-kleurwerk-patroontips", title: "Hartjesmuts haken: voorbereiding, kleurwerk en patroontips", is_published: true },
  { id: "e8dff775-939b-4e03-ade1-4e53d41a5c81", slug: "lama-wandhanger-haken-gratis-tapestry-patroon", title: "Lama wandhanger haken: gratis patroon in tapestry-steek", is_published: true },
];
if (process.env.HOBBYSALON_ARTICLE_EVIDENCE_DIR) {
  const dir = process.env.HOBBYSALON_ARTICLE_EVIDENCE_DIR;
  mainArticle = { ...mainArticle, ...JSON.parse(readFileSync(resolve(dir, "evidence.json"), "utf8")).data[0].evidence.article };
  companions = JSON.parse(readFileSync(resolve(dir, "catalog-snapshot.json"), "utf8")).data[0].snapshot.companions;
}
const article = (id, extra = {}) => ({ ...mainArticle, id, slug: id, title: `Artikel ${id}`, body_markdown: "", ...extra });
const edge = (targetId, relation = "related_article", order = 0, extra = {}) => ({
  id: `${targetId}-${relation}-${order}`, source_entity_type: "article", source_entity_id: mainArticle.id,
  target_entity_type: "article", target_entity_id: targetId, relation_type: relation,
  sort_order: order, weight: 1, ...extra,
});

async function load(options = {}) {
  const current = { ...mainArticle, ...options.current };
  const rows = { articles: [current, ...(options.targets ?? companions)], entity_links: options.edges ?? [], products: options.products ?? [] };
  const before = plain(rows);
  const attempts = [];
  const calls = [];
  const bodies = [];
  const forbid = name => { attempts.push(name); throw new Error(`Forbidden side effect: ${name}`); };
  const client = { from(table) {
    if (!Object.hasOwn(rows, table)) return forbid(`table:${table}`);
    const filters = [];
    const call = { table, filters, select: null };
    calls.push(call);
    let single = false;
    const query = {
      select(value) { call.select = value; return this; },
      eq(key, value) { filters.push(["eq", key, value]); return this; },
      neq(key, value) { filters.push(["neq", key, value]); return this; },
      in(key, value) { filters.push(["in", key, Array.from(value)]); return this; },
      limit() { return this; },
      maybeSingle() { single = true; return this; },
      then(resolve, reject) {
        const isSlugBatch = table === "articles" && filters.some(([op, key]) => op === "in" && key === "slug");
        if (isSlugBatch && options.rejectEditorial) return Promise.reject(new Error("local read rejection")).then(resolve, reject);
        const data = rows[table].filter(row => filters.every(([op, key, value]) => op === "eq" ? row[key] === value : op === "neq" ? row[key] !== value : value.includes(row[key])));
        return Promise.resolve({ data: single ? data[0] ?? null : data, error: isSlugBatch && options.errorEditorial ? { message: "local read error" } : null }).then(resolve, reject);
      },
    };
    return new Proxy(query, { get(target, key) { if (key in target) return target[key]; return () => forbid(`query:${String(key)}`); } });
  } };
  const inert = () => null;
  const boundary = {
    "@/lib/platform/client": { createPlatformClient: () => client },
    "@/lib/platform/queries/creators": { getCreatorById: async () => options.author ?? null },
    "@/lib/platform/queries/workshops": { getWorkshopById: async () => null },
    "@/lib/platform/queries/events": { listEventsByIds: async () => [] },
    "@/lib/platform/queries/projects": { listApprovedCommunityGalleryForArticle: async () => [] },
    "@/lib/platform/queries/learning-paths": { listNextLearningPathArticleIds: async () => options.learningPath ?? [] },
    "@/lib/commerce/medusa/products": { getMedusaProduct: async id => id == null ? null : forbid("medusa") },
    "react/jsx-runtime": dependency("react/jsx-runtime"),
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "lucide-react": { Clock: inert, Calendar: inert },
    "@/components/cards": { ProductCard: ({ product }) => React.createElement("a", { href: `/product/${product.slug}`, "data-product": product.id }, product.title) },
    "@/components/shared/FavoriteToggleButton": { FavoriteToggleButton: inert },
    "@/components/profile/StartSavedProjectButton": { StartSavedProjectButton: inert },
    "@/components/seo/JsonLd": { JsonLd: inert },
    "@/components/content/markdown-content": { MarkdownContent: ({ markdown }) => { bodies.push(markdown); return React.createElement("div", { "data-body": true }); } },
    "@/components/content/DifficultyBadge": { DifficultyBadge: inert },
    "@/components/content/PrintArticleButton": { PrintArticleButton: inert },
    "@/components/content/CommunityGallery": { CommunityGallery: inert },
    "@/components/layout/grid-layout": { GridLayout: ({ children }) => React.createElement("div", {}, children) },
    "@/lib/auth/session": { getAuthUser: async () => null },
    "@/lib/content/printable-article": { isPrintableArticleType: () => false },
    "@/lib/platform/queries/favorites": { isFavorite: () => forbid("favorite write/read") },
    "@/lib/seo": { absoluteUrl: value => `https://www.hobbysalon.be${value}`, buildPageMetadata: value => value },
    "@/lib/schema": { buildBreadcrumbSchema: () => ({}), buildFaqSchema: () => null, buildHowToSchema: () => null },
  };
  const context = vm.createContext({ URL, console: { log: () => forbid("log"), warn: () => forbid("log"), error: () => forbid("log") }, fetch: () => forbid("network") });
  const modules = new Map();
  function moduleFor(specifier, importer) {
    if (specifier === "../client") specifier = "@/lib/platform/client";
    if (specifier.startsWith(".")) specifier = `${dirname(importer.identifier)}/${specifier}.ts`;
    if (modules.has(specifier)) return modules.get(specifier);
    let module;
    if (boundary[specifier]) {
      const exports = boundary[specifier];
      module = new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context, identifier: specifier });
    } else {
      const path = specifier.startsWith("@/") ? `${specifier.slice(2)}.ts` : specifier;
      const source = readFileSync(new URL(path, root), "utf8");
      const code = path.endsWith(".tsx") ? ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: path }).outputText : stripTypeScriptTypes(source);
      module = new vm.SourceTextModule(code, { context, identifier: path });
    }
    modules.set(specifier, module);
    return module;
  }
  const service = moduleFor("@/lib/services/article-page");
  await service.link(moduleFor);
  await service.evaluate();
  async function run(slug = current.slug) {
    try { return plain(await service.namespace.getArticlePageData(slug)); }
    finally { assert.deepEqual(attempts, [], "No writes/network/review bypass even if swallowed"); assert.deepEqual(rows, before, "Source rows remain unchanged"); }
  }
  return { current, calls, run, async render() {
    const page = moduleFor("app/(public)/artikel/[slug]/page.tsx");
    await page.link(moduleFor);
    await page.evaluate();
    const html = renderToStaticMarkup(await page.namespace.default({ params: Promise.resolve({ slug: current.slug }) }));
    assert.deepEqual(bodies, [current.body_markdown], "Original markdown passed through unchanged");
    assert.deepEqual(attempts, []);
    assert.deepEqual(rows, before);
    return html;
  } };
}
const slugBatches = calls => calls.filter(call => call.table === "articles" && call.filters.some(([op, key]) => op === "in" && key === "slug"));

test("no edges: actual published companion links yield two cards in body order and five separate source materials", async () => {
  const page = await load();
  const data = await page.run();
  assert.deepEqual(ids(data.relatedArticles), [companions[1].id, companions[0].id]);
  assert.equal(data.sourceMaterials.length, 5);
  assert.deepEqual(data.sourceMaterials.map(row => Object.keys(row).sort()), Array(5).fill(["key", "title"]));
  assert.match(data.sourceMaterials[0].title, /^Rood middelzwaar garen:/);
  assert.deepEqual(data.nextSteps, [], "Editorial related reading is never guessed next_step");
  for (const key of ["requiredMaterials", "requiredTools", "optionalMaterials", "relatedProducts"]) assert.deepEqual(data[key], []);
  assert.equal(slugBatches(page.calls).length, 1, "One SELECT batch, no per-link hydration");
  assert.ok(slugBatches(page.calls)[0].filters.some(([op, key, value]) => op === "eq" && key === "is_published" && value === true));
});

test("actual TSX with native React renders two real reading cards and a five-line non-commerce source list", async () => {
  const page = await load();
  const html = await page.render();
  for (const row of companions) {
    assert.equal(html.split(`href="/artikel/${row.slug}"`).length - 1, 1);
    assert.ok(html.includes(row.title));
  }
  assert.ok(html.includes("Meer over dit onderwerp"));
  assert.ok(html.includes("Materialen uit dit artikel"));
  assert.ok(html.includes("geen gekoppelde winkelproducten"));
  const section = html.match(/<section[^>]*aria-labelledby="source-materials-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, "A genuine page section, not merely service data");
  assert.equal((section.match(/<li\b/g) ?? []).length, 5);
  assert.doesNotMatch(section, /href=|data-product|SKU|op voorraad|compatibel/i);
  assert.doesNotMatch(html, /Ga verder met deze stap|Dit heb je nodig|Benodigd gereedschap/);
  if (process.env.HOBBYSALON_ARTICLE_RENDER_PATH) writeFileSync(process.env.HOBBYSALON_ARTICLE_RENDER_PATH, html);
});

test("strict allowlist: excludes external, protocol confusion, images, escaped links, self, duplicates and all code forms", async () => {
  const links = [
    "[a](/artikel/a)", "[dup](https://hobbysalon.be/artikel/a#tip)", "[b](https://www.hobbysalon.be/artikel/b?ref=bron)",
    "[angle](<https://hobbysalon.be/artikel/c> \"lees\")", "[encoded](/artikel/caf%C3%A9)",
    `[self](/artikel/${mainArticle.slug})`, "[draft](/artikel/draft)", "[missing](/artikel/missing)",
    "[x](https://evil.example/artikel/external)", "[x](https://hobbysalon.be.evil.example/artikel/suffix)",
    "[x](https://evil.example@hobbysalon.be/artikel/credentials)", "[x](//hobbysalon.be/artikel/protocol-relative)",
    "[x](http://hobbysalon.be/artikel/insecure)", "[x](javascript:/artikel/script)",
    "[x](https:\\hobbysalon.be/artikel/backslash)", "[x](/artikel/%2Fslash)", "[x](/artikel/%252Fdouble-encoded)",
    "[x](/artikel/../traversal)", "[x](/artikel/%2e%2e)", "[x](/artikel/a/child)",
    "[x](https://hobbysalon.be:444/artikel/port)", "![image](/artikel/image)",
    "[![nested image](/artikel/nested-image)](https://evil.example)", "![alt [brackets](/artikel/image-brackets)](https://evil.example/photo.jpg)", "\\[escaped](/artikel/escaped)",
    "`[inline](/artikel/inline)`", "``[inline multi](/artikel/inline-multi)``", "    [indented](/artikel/indented)",
    "```markdown\n[fenced](/artikel/fenced)\n```", "~~~md\n[tilde](/artikel/tilde)\n~~~",
    "<!-- [comment](/artikel/comment) -->", "[reference][ref]\n[ref]: /artikel/reference",
  ].join("\n\n");
  const targets = ["a", "b", "c", "café", "external", "suffix", "credentials", "protocol-relative", "insecure", "script", "backslash", "traversal", "port", "image", "nested-image", "escaped", "inline", "inline-multi", "indented", "fenced", "tilde", "comment", "reference"].map(id => article(id));
  const page = await load({ current: { body_markdown: links }, targets: [...targets, article("draft", { is_published: false })] });
  const data = await page.run();
  assert.deepEqual(ids(data.relatedArticles), ["a", "b", "c", "café"]);
  assert.deepEqual(data.nextSteps, []);
  assert.deepEqual(slugBatches(page.calls)[0].filters.find(([op]) => op === "in")[2], ["a", "b", "c", "café", "draft", "missing"]);
});

test("fenced examples in blockquotes/lists and unclosed fences never become editorial cards", async () => {
  const page = await load({ current: { body_markdown: [
    "> ```md", "> [quoted](/artikel/quoted)", "> ```", "",
    "- ~~~~md", "  [listed](/artikel/listed)", "  ~~~", "  [still code](/artikel/still-code)", "  ~~~~", "",
    "[real](/artikel/real)", "", "```md", "[unclosed](/artikel/unclosed)",
  ].join("\n") }, targets: ["quoted", "listed", "still-code", "real", "unclosed"].map(id => article(id)) });
  assert.deepEqual(ids((await page.run()).relatedArticles), ["real"]);
});

test("mixed list and blockquote fences exclude examples without swallowing later prose", async () => {
  for (const prefix of ['- > ', '> - > ']) {
    const page = await load({ current: { body_markdown: `${prefix}\`\`\`md\n  > [voorbeeld](/artikel/voorbeeld)\n  > \`\`\`\n\n[lees](/artikel/lees)` }, targets: ['voorbeeld', 'lees'].map(id => article(id)) });
    assert.deepEqual(ids((await page.run()).relatedArticles), ['lees']);
  }
});

test("unmatched prose bracket cannot hide later links but nested image labels remain excluded", async () => {
  const page = await load({ current: { body_markdown: 'Gebruik [haaknotatie.\n\n[Lees verder](/artikel/vervolg)\n\n![alt [nested](/artikel/nested)](https://example.invalid/image)' }, targets: ['vervolg', 'nested'].map(id => article(id)) });
  assert.deepEqual(ids((await page.run()).relatedArticles), ['vervolg']);
});

const exactSourceBody = [
  '```md', '## Materialen', '- Fake heading material', '```', '',
  '## Benodigdheden', '- **2 bollen** [wol](https://example.invalid/wol)', '- 3 bollen wol',
  '- 100 % katoen garen', '- 6 MM haaknaald',
  '- > ```md', '  > - Fake fenced bullet', '  > ## Tips', '  > ```',
  '```md', '## Tips', '- Another fake bullet', '```',
  '## Stappen', '- Geen materiaal',
  '## Gereedschap en materialen', '- `1x stopnaald`', '## Tips', 'Tekst',
].join('\n');
const exactSourceTitles = ['2 bollen wol', '3 bollen wol', '100 % katoen garen', '6 MM haaknaald', '1x stopnaald'];

test("actual service preserves source quantities across all materials sections and ignores fenced headings/bullets", async () => {
  const page = await load({ current: { body_markdown: exactSourceBody }, targets: [] });
  const data = await page.run();
  assert.deepEqual(data.sourceMaterials.map(item => item.title), exactSourceTitles);
  assert.equal(new Set(data.sourceMaterials.map(item => item.key)).size, exactSourceTitles.length);
  const reordered = await load({ current: { body_markdown: exactSourceBody.replace('- 3 bollen wol', '- 4 bollen wol\n- 3 bollen wol') }, targets: [] });
  const other = (await reordered.run()).sourceMaterials;
  for (const item of data.sourceMaterials) assert.equal(other.find(row => row.title === item.title)?.key, item.key);
});

test("actual TSX renders exact non-commerce source quantities and second section without fenced examples", async () => {
  const page = await load({ current: { body_markdown: exactSourceBody }, targets: [] });
  const html = await page.render();
  const section = html.match(/<section[^>]*aria-labelledby="source-materials-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  for (const title of exactSourceTitles) assert.ok(section.includes(title), title);
  assert.equal((section.match(/<li\b/g) ?? []).length, exactSourceTitles.length);
  assert.doesNotMatch(section, /Fake|fake|Geen materiaal|href=|data-product/);
});

test("approved graph has explicit priority/order; next_step overlap deduplicates reading and pending/incoming do not invent next steps", async () => {
  const page = await load({ current: { body_markdown: "[body](/artikel/body) [second](/artikel/second) [next](/artikel/next)" },
    targets: ["body", "second", "next", "first", "pending", "incoming", "draft"].map(id => article(id, { is_published: id !== "draft" })),
    edges: [edge("second", "related_article", 3), edge("first", "related_article", 1), edge("next", "related_article", 0), edge("next", "next_step", 2), edge("draft", "related_article", -1), edge(mainArticle.id), edge("pending", "suggested_auto", -2), edge("incoming", "next_step", 0, { source_entity_id: "incoming", target_entity_id: mainArticle.id })],
  });
  const data = await page.run();
  assert.deepEqual(ids(data.nextSteps), ["next"]);
  assert.deepEqual(ids(data.relatedArticles), ["first", "second", "body"]);
});

test("learning path remains authoritative next steps and overlap is removed from graph/editorial reading", async () => {
  const page = await load({ current: { body_markdown: "[path](/artikel/path) [body](/artikel/body)" }, targets: ["body", "path", "graph-next", "graph-related"].map(id => article(id)), learningPath: ["path"], edges: [edge("graph-next", "next_step"), edge("path"), edge("graph-related", "related_article", 1)] });
  const data = await page.run();
  assert.deepEqual(ids(data.nextSteps), ["path"]);
  assert.deepEqual(ids(data.relatedArticles), ["graph-related", "body"]);
});

test("bounded related rail fills six slots only after filtering drafts/self/overlap; graph precedes body order", async () => {
  const page = await load({ current: { body_markdown: `[draft](/artikel/draft) [self](/artikel/${mainArticle.slug}) ` + Array.from({ length: 9 }, (_, index) => `[body](/artikel/b${index})`).join(" ") }, targets: [article("draft", { is_published: false }), article("next"), article("graph"), ...Array.from({ length: 9 }, (_, index) => article(`b${index}`))], edges: [edge("next", "next_step"), edge("draft", "related_article", -1), edge("graph"), edge("next", "related_article", 1)] });
  const data = await page.run();
  assert.deepEqual(ids(data.relatedArticles), ["graph", "b0", "b1", "b2", "b3", "b4"]);
  assert.deepEqual(ids(data.nextSteps), ["next"]);
  assert.equal(slugBatches(page.calls).length, 1);
});

for (const failure of ["errorEditorial", "rejectEditorial"]) {
  test(`${failure}: failed editorial batch cannot erase approved graph or source materials`, async () => {
    const page = await load({ [failure]: true, edges: [edge("approved")], targets: [...companions, article("approved")] });
    const data = await page.run();
    assert.deepEqual(ids(data.relatedArticles), ["approved"]);
    assert.equal(data.sourceMaterials.length, 5);
    assert.deepEqual(data.nextSteps, []);
  });
}

test("missing/draft source has empty page data, no graph/body target reads", async () => {
  for (const current of [{}, { is_published: false }]) {
    const page = await load({ current });
    const data = await page.run(current.is_published === false ? page.current.slug : "absent");
    assert.equal(data.article, null);
    assert.deepEqual(data.sourceMaterials, []);
    assert.deepEqual(data.relatedArticles, []);
    assert.equal(page.calls.filter(call => call.table !== "articles").length, 0);
    assert.equal(slugBatches(page.calls).length, 0);
  }
});

test("source list is hidden when explicit required material/tool cards exist; graph product/creator semantics survive", async () => {
  for (const role of ["required_material", "required_tool"]) {
    const author = { id: "maker", slug: "maker", display_name: "Maker", avatar_url: null };
    const page = await load({ current: { author_creator_id: author.id }, author, edges: [edge("supply", role, 0, { target_entity_type: "product" })], products: [{ id: "supply", slug: "supply", title: "Expliciet gekoppeld materiaal", is_active: true, status: "active", medusa_product_id: null }] });
    const data = await page.run();
    assert.equal(data.sourceMaterials.length, 5);
    assert.deepEqual(ids(data[role === "required_material" ? "requiredMaterials" : "requiredTools"]), ["supply"]);
    assert.deepEqual(ids(data.relatedCreators), ["maker"]);
    const html = await page.render();
    assert.ok(html.includes('data-product="supply"'));
    assert.ok(html.includes('href="/creator/maker"'));
    assert.ok(!html.includes('id="source-materials-heading"'));
  }
});

test("source-only page renders materials even without reading/graph cards; no empty material section", async () => {
  const page = await load({ current: { body_markdown: "## Benodigdheden\n- Stopnaald\n- Meetlint\n\n## Stappen\nTekst" }, targets: [] });
  const html = await page.render();
  assert.ok(html.includes('id="source-materials-heading"'));
  const section = html.match(/<section[^>]*aria-labelledby="source-materials-heading"[\s\S]*?<\/section>/)?.[0];
  assert.equal((section?.match(/<li\b/g) ?? []).length, 2);
  const empty = await load({ current: { body_markdown: "Zonder materialenlijst." }, targets: [] });
  assert.ok(!(await empty.render()).includes('id="source-materials-heading"'));
});
