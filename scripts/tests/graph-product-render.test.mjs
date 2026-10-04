// Offline execution of actual TSX page with local JSX tree runtime.
// Not React/Next/browser or live database acceptance.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require(process.env.HOBBYSALON_TEST_TYPESCRIPT_PATH || "typescript");
const source = readFileSync(new URL("../../apps/storefront/src/app/(public)/product/[slug]/page.tsx", import.meta.url), "utf8");

async function render(projects) {
  const calls = [], forbidden = [];
  const product = { id: "product", slug: "product", title: "Product", product_type: "handmade", is_active: true, price_cents: null };
  const data = { product, creator: null, domain: null, price: null, variants: [], galleryImages: [], relatedSupplies: [], relatedArticles: [], relatedEvents: [], relatedWorkshops: [], relatedProjects: projects };
  const jsx = (type, props, key) => ({ type, props, key });
  const components = ["CreatorCard", "WorkshopCard", "ArticleCard", "EventCard", "ProductCard", "ProjectCard"];
  const collaborators = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "next/navigation": { notFound: () => { throw new Error("notFound"); } },
    "next/link": { default: "Link" },
    "@/lib/services/product-page": { getProductPageData: async slug => { calls.push(["page", slug]); return data; } },
    "@/components/cards": Object.fromEntries(components.map(name => [name, name])),
    "@/components/shared/EntityLinkBlock": { EntityLinkBlock: "EntityLinkBlock" },
    "@/components/product/ProductBuyCard": { ProductBuyCard: "ProductBuyCard" },
    "@/components/seo/JsonLd": { JsonLd: "JsonLd" },
    "@/components/layout/page-layout": { PageLayout: "PageLayout" },
    "@/components/ui/aspect-image": { AspectImage: "AspectImage" },
    "@/lib/auth/session": { getAuthUser: async () => null },
    "@/lib/platform/queries/favorites": { isFavorite: () => { forbidden.push("favorites"); throw new Error("forbidden"); } },
    "@/lib/seo": { absoluteUrl: path => `https://offline.invalid${path}`, buildPageMetadata: () => { forbidden.push("metadata"); throw new Error("forbidden"); } },
  };
  const context = vm.createContext({ fetch: () => { forbidden.push("network"); throw new Error("forbidden"); } });
  const transformed = ts.transpileModule(source, { fileName: "page.tsx", compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
  assert.deepEqual(transformed.diagnostics ?? [], [], "Actual page transpiles without syntax diagnostics");
  const module = new vm.SourceTextModule(transformed.outputText, { context });
  await module.link(name => {
    assert.ok(Object.hasOwn(collaborators, name), `Unexpected import: ${name}`);
    const exports = collaborators[name];
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  let tree;
  try { tree = await module.namespace.default({ params: Promise.resolve({ slug: "product" }) }); }
  finally { assert.deepEqual(forbidden, [], "No side effects permitted outside swallowed catches"); }
  assert.deepEqual(calls, [["page", "product"]]);
  const all = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    all.push(node); walk(node.props?.children);
  }
  walk(tree);
  return { all, data };
}

test("actual product TSX emits ordered ProjectCards in neutral discovery block and leaves buy-card payload unchanged", async () => {
  const projects = [{ id: "a", slug: "a" }, { id: "b", slug: "b" }];
  const snapshot = JSON.stringify(projects);
  const { all, data } = await render(projects);
  const blocks = all.filter(node => node.type === "EntityLinkBlock");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].props.title, "Ontdek projecten bij dit product");
  const cards = all.filter(node => node.type === "ProjectCard");
  assert.deepEqual(cards.map(node => node.key), ["a", "b"]);
  assert.equal(cards[0].props.project, projects[0]);
  assert.equal(cards[1].props.project, projects[1]);
  const buy = all.find(node => node.type === "ProductBuyCard");
  assert.equal(buy.props.product, data.product);
  assert.equal(buy.props.price, null);
  assert.equal(buy.props.variants, data.variants);
  assert.equal(Object.hasOwn(buy.props, "relatedProjects"), false);
  assert.equal(JSON.stringify(projects), snapshot);
});

test("actual product TSX omits discovery block when no eligible project survives", async () => {
  const { all } = await render([]);
  assert.deepEqual(all.filter(node => node.type === "ProjectCard" || node.type === "EntityLinkBlock"), []);
  assert.equal(all.filter(node => node.type === "ProductBuyCard").length, 1);
});
