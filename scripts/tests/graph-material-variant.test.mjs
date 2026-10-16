// Offline behavioral acceptance: actual SDK product methods, Medusa wrapper,
// product-page service, page -> buy card -> controls, real React hooks and SSR.
// Only external framework/platform/network/action boundaries use local fixtures.
// Run: HOBBYSALON_TEST_RUNTIME_PACKAGE=/path/to/storefront/package.json \
//   node --experimental-vm-modules --test --test-concurrency=1 scripts/tests/graph-material-variant.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(process.env.HOBBYSALON_TEST_RUNTIME_PACKAGE || new URL("../../apps/storefront/package.json", import.meta.url));
const ts = require("typescript");
const React = require("react");
const jsxRuntime = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");
const Medusa = require("@medusajs/js-sdk").default;
const root = new URL("../../apps/storefront/src/", import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const compiled = new Map();
const actual = {
  products: "lib/commerce/medusa/products.ts",
  page: "app/(public)/product/[slug]/page.tsx",
  "@/lib/services/product-page": "lib/services/product-page.ts",
  "@/components/product/ProductBuyCard": "components/product/ProductBuyCard.tsx",
  "@/components/product/ProductPurchaseControls": "components/product/ProductPurchaseControls.tsx",
  "@/components/cart/AddToCartButton": "components/cart/AddToCartButton.tsx",
  "@/components/domain/price-display": "components/domain/price-display.tsx",
  "@/lib/commerce/money": "lib/commerce/money.ts",
  "@/lib/commerce/variant-price": "lib/commerce/variant-price.ts",
  matcher: "lib/content/article-material-offers.ts",
  "@/lib/perf/with-timeout": "lib/perf/with-timeout.ts",
};

const first = { id: "variant_white", title: "White 100 g", calculated_price: { calculated_amount: 5.5, currency_code: "eur" }, options: [{ value: "White", option: { title: "Color" } }, { value: "100 g", option: { title: "Weight" } }] };
const second = { id: "variant_black", title: "Black 100 g", calculated_price: { calculated_amount: 7.49, currency_code: "eur" }, options: [{ value: "Black", option: { title: "Kleur" } }, { value: "100 g", option: { title: "Gewicht" } }] };
const commerceProduct = (variants = [first, second], extra = {}) => ({ id: "prod_yarn", title: "Garen", handle: "garen", variants: structuredClone(variants), ...extra });
const platformProduct = { id: "platform_yarn", slug: "garen", title: "Garen", product_type: "supply", is_active: true, status: "published", medusa_product_id: "prod_yarn", creator_id: null, domain_id: null, featured_image_url: null };

function compile(path) {
  if (!compiled.has(path)) {
    const result = ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
      fileName: path, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    assert.deepEqual(result.diagnostics ?? [], [], `${path}: syntax diagnostics`);
    compiled.set(path, result.outputText);
  }
  return compiled.get(path);
}

async function fixture({ products = [commerceProduct()], reject = () => false, product = platformProduct, changeSelectionTo } = {}) {
  const attempts = [], forbidden = [], reads = [], observed = { buy: [], controls: [], prices: [], cart: [], jsonLd: [] };
  const deny = name => (...args) => { forbidden.push({ name, args }); throw new Error(`Forbidden boundary: ${name}`); };
  const sdk = new Medusa({ baseUrl: "https://offline.invalid", publishableKey: "offline-fixture-not-a-secret" });
  // The real SDK's list/retrieve serialize into this client boundary. No HTTP,
  // writes, auth, env loading, or live product/DB access is possible here.
  sdk.client.fetch = async (path, options = {}) => {
    // SDK product methods omit method; its client defaults to GET.
    const attempt = { path, options: plain({ ...options, method: options.method ?? "GET" }) };
    attempts.push(attempt);
    if (attempt.options.method !== "GET" || !path.startsWith("/store/products")) return deny("SDK write/non-product request")(attempt);
    if (reject(attempt)) throw new Error("Local fixture request rejection");
    const fields = new Set((options.query?.fields ?? "").split(","));
    const projected = products.map(p => {
      const projectedProduct = structuredClone(p);
      for (const v of projectedProduct.variants ?? []) {
        if (!fields.has("*variants.options") && !fields.has("variants.options.value")) delete v.options;
        else if (!fields.has("*variants.options.option") && !fields.has("variants.options.option.title")) {
          for (const option of v.options ?? []) delete option.option;
        }
      }
      return projectedProduct;
    });
    if (path === "/store/products") {
      const ids = options.query?.id;
      return { products: projected.filter(p => (!ids || ids.includes(p.id)) && (!options.query?.handle || options.query.handle === p.handle)) };
    }
    return { product: projected.find(p => path === `/store/products/${p.id}`) ?? null };
  };
  const emptyQuery = name => async (...args) => { reads.push({ name, args }); return []; };
  const shell = ({ children }) => React.createElement("div", null, children);
  const ignore = () => null;
  const collaborators = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "./client": { sdk },
    "next/navigation": { notFound: () => { throw new Error("notFound"); }, useRouter: () => ({ refresh: deny("router.refresh"), push: deny("router.push") }) },
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "@/lib/platform/queries/products": { getProductBySlug: async slug => { reads.push({ name: "getProductBySlug", args: [slug] }); return product; }, listProductsByCreator: emptyQuery("creator products"), listProductsByDomain: emptyQuery("domain products"), listProductsByIds: emptyQuery("linked products") },
    "@/lib/platform/queries/creators": { getCreatorById: async () => null },
    "@/lib/platform/queries/workshops": { listWorkshopsByIds: emptyQuery("workshops") },
    "@/lib/platform/queries/product-usage": { listWorkshopIdsUsingProduct: emptyQuery("workshop usage"), listProjectIdsUsingProduct: emptyQuery("project usage"), listPublicProjectsByIds: emptyQuery("projects") },
    "@/lib/platform/queries/events": { listEventsByIds: emptyQuery("events") },
    "@/lib/platform/queries/articles": { listArticlesByIds: emptyQuery("articles") },
    "@/lib/platform/queries/entity-links": { getEntityConnections: emptyQuery("entity links") },
    "@/lib/platform/client": { createPlatformClient: () => ({ from: name => { assert.equal(name, "product_gallery_images"); reads.push({ name }); return { select: fields => { assert.equal(fields, "image_url"); return { eq: () => ({ order: async () => ({ data: [] }) }) }; } }; } }) },
    "@/lib/media/public-asset-url": { publicAssetUrl: value => value, publicAssetUrls: values => values },
    "@/lib/auth/session": { getAuthUser: async () => null },
    "@/lib/platform/queries/favorites": { isFavorite: deny("favorite read on anonymous render") },
    "@/lib/seo": { absoluteUrl: path => `https://offline.invalid${path}`, buildPageMetadata: value => value },
    "@/components/cards": Object.fromEntries(["CreatorCard", "WorkshopCard", "ArticleCard", "EventCard", "ProductCard", "ProjectCard"].map(name => [name, ignore])),
    "@/components/shared/EntityLinkBlock": { EntityLinkBlock: shell },
    "@/components/seo/JsonLd": { JsonLd: props => { observed.jsonLd.push(props.data); return null; } },
    "@/components/layout/page-layout": { PageLayout: shell },
    "@/components/ui/aspect-image": { AspectImage: ignore },
    "@/components/ui/card-shell": { CardShell: shell },
    "@/components/product/ProductInquiryForm": { ProductInquiryForm: ignore },
    "@/components/shared/FavoriteToggleButton": { FavoriteToggleButton: ignore },
    "lucide-react": { Truck: ignore, ShieldCheck: ignore, MessageCircle: ignore },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "@/app/actions/cart": { addToCartAction: deny("addToCartAction") },
    "@/lib/analytics/track": { trackEvent: deny("trackEvent") },
  };
  const context = vm.createContext({ URL, URLSearchParams, console, setTimeout, clearTimeout, process: { env: {} }, fetch: deny("VM fetch") });
  const modules = new Map();
  const watched = {
    "@/components/product/ProductBuyCard": ["ProductBuyCard", "buy"],
    "@/components/product/ProductPurchaseControls": ["ProductPurchaseControls", "controls"],
    "@/components/domain/price-display": ["PriceDisplay", "prices"],
    "@/components/cart/AddToCartButton": ["AddToCartButton", "cart"],
  };
  function synthetic(key, exports) {
    if (!modules.has(key)) modules.set(key, new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context, identifier: key }));
    return modules.get(key);
  }
  async function load(key) {
    if (modules.has(key)) return modules.get(key);
    const path = actual[key];
    assert.ok(path, `Unknown actual module: ${key}`);
    const module = new vm.SourceTextModule(compile(path), { context, identifier: path });
    modules.set(key, module);
    await module.link(async name => {
      if (name === "@/lib/commerce/medusa/products") return load("products");
      if (Object.hasOwn(watched, name)) {
        const realKey = `actual:${name}`;
        actual[realKey] = actual[name];
        const real = await load(realKey);
        const [exportName, bucket] = watched[name];
        // Observation wrapper delegates to real components; React owns all state.
        let changed = false;
        return synthetic(name, { [exportName]: props => {
          observed[bucket].push(props);
          if (bucket !== "controls" || changeSelectionTo === undefined) return React.createElement(real.namespace[exportName], props);
          // Local event harness: real React owns hook state and rerendering;
          // invoke the actual select's onChange once, without a browser/DOM shim.
          const tree = real.namespace[exportName](props);
          function change(node) {
            if (Array.isArray(node)) return node.forEach(change);
            if (!node || typeof node !== "object") return;
            if (node.type === "select" && !changed) {
              changed = true;
              node.props.onChange({ target: { value: changeSelectionTo } });
            }
            change(node.props?.children);
          }
          change(tree);
          return tree;
        } });
      }
      if (Object.hasOwn(actual, name)) return load(name);
      assert.ok(Object.hasOwn(collaborators, name), `Unexpected dependency: ${name}`);
      return synthetic(name, collaborators[name]);
    });
    return module;
  }
  const wrapper = await load("products");
  await wrapper.evaluate();
  async function evaluateGraph() {
    // Observed real modules are behind synthetic boundary exports, so they are
    // not ESM dependencies of those exports; evaluate their complete graph too.
    for (const module of modules.values()) if (module.status === "linked") await module.evaluate();
  }
  async function render(query, overrides = {}) {
    const page = await load("page");
    await page.evaluate();
    await evaluateGraph();
    const props = { params: Promise.resolve({ slug: product.slug }), ...overrides };
    if (query !== undefined) props.searchParams = Promise.resolve(query);
    const tree = await page.namespace.default(props);
    const html = renderToStaticMarkup(tree);
    assert.deepEqual(forbidden, [], "Render must not add to cart, navigate, track or attempt network/writes");
    return { html, observed, attempts };
  }
  return { api: wrapper.namespace, render, load: async key => { const module = await load(key); await evaluateGraph(); return module; }, observed, attempts, forbidden };
}

function assertSelected(result, variantId, title, cents) {
  const escaped = variantId.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  assert.ok(result.html.includes(`<option value="${escaped}" selected="">${title}</option>`), `Actual React <select> must select ${variantId}: ${result.html}`);
  assert.ok(result.html.includes(`Geselecteerd: ${title}`));
  assert.equal(result.observed.cart.at(-1)?.variantId, variantId, "Actual AddToCartButton receives exact rendered selection");
  if (cents === null) assert.equal(result.observed.prices.length, 0, "No stale other-variant price component");
  else assert.equal(result.observed.prices.at(-1)?.amount, cents);
}

// First watched RED: identity options must be requested AND survive real mapping.
test("actual Medusa wrapper hydrates option value plus original identity title on retrieve/list/handle", async () => {
  const f = await fixture();
  const retrieved = await f.api.getMedusaProduct("prod_yarn");
  assert.deepEqual(plain(retrieved.variants[1].options ?? null), second.options, "Identity options were not requested/preserved");
  const listed = await f.api.getMedusaProductsByIds(["prod_yarn", "prod_yarn", null]);
  assert.deepEqual(plain(listed.get("prod_yarn").variants[1].options), second.options);
  const handled = await f.api.getMedusaProductByHandle("garen");
  assert.deepEqual(plain(handled.variants[0].options), first.options);
  assert.equal(f.attempts.length, 3);
  for (const attempt of f.attempts) {
    const fields = attempt.options.query.fields.split(",");
    assert.ok(fields.includes("*variants.options"));
    assert.ok(fields.includes("variants.options.option.title") || fields.includes("*variants.options.option"));
    assert.equal(attempt.options.method, "GET");
  }
  assert.deepEqual(f.forbidden, []);
});

test("actual React page -> buy card -> controls selects URL's second variant, exact price and AddToCart id", async () => {
  const f = await fixture();
  const result = await f.render({ variant: second.id });
  assertSelected(result, second.id, second.title, 749);
  assert.equal(result.observed.buy[0].selectedVariantId, second.id);
  assert.equal(result.observed.controls[0].selectedVariantId, second.id);
  assert.equal(result.observed.jsonLd[0].offers.price, "7.49");
  assert.ok(result.html.includes("7,49"));
  assert.ok(!result.html.includes("5,50"));
});

test("legacy absent/empty/invalid/array/different-product queries preserve first variant and default price", async () => {
  for (const query of [undefined, {}, { variant: "" }, { variant: "does_not_exist" }, { variant: "variant_other_product" }, { variant: [second.id] }, { variant: [first.id, second.id] }, { variant: ` ${second.id}` }]) {
    const f = await fixture();
    const result = await f.render(query);
    assertSelected(result, first.id, first.title, 550);
    assert.equal(result.observed.buy[0].selectedVariantId ?? null, null, "Server must not claim a query selection without one exact scalar match");
    assert.equal(result.observed.controls[0].selectedVariantId ?? null, null);
    assert.equal(result.observed.jsonLd[0].offers.price, "5.50");
  }
});

test("encoded id reaches exact selection once decoded by URL parsing; no double decoding or query injection", async () => {
  const id = "variant:zwart &extra=x#/? café%2F";
  const selected = { ...second, id };
  const params = new URL(`https://offline.invalid/product/garen?variant=${encodeURIComponent(id)}`).searchParams;
  const f = await fixture({ products: [commerceProduct([first, selected])] });
  const result = await f.render({ variant: params.get("variant") });
  assertSelected(result, id, second.title, 749);
  assert.equal(result.observed.buy[0].selectedVariantId, id);
  const other = await fixture({ products: [commerceProduct([first, selected])] });
  assertSelected(await other.render({ variant: encodeURIComponent(id) }), first.id, first.title, 550);
});

test("exact first or second variant with zero price never falls back to another price (existing zero hiding retained)", async () => {
  for (const index of [0, 1]) {
    const variants = [structuredClone(first), structuredClone(second)];
    variants[index].calculated_price.calculated_amount = 0;
    const f = await fixture({ products: [commerceProduct(variants)] });
    const result = await f.render({ variant: variants[index].id });
    assertSelected(result, variants[index].id, variants[index].title, 0);
    assert.equal(result.observed.jsonLd[0].offers.price, "0.00");
    assert.ok(!result.html.includes("€"), "Unowned PriceDisplay's existing zero-price suppression is unchanged");
  }
});

test("exact unpriced/nonfinite variant never displays a different variant's fallback or JSON-LD offer", async () => {
  for (const index of [0, 1]) {
    for (const value of [undefined, NaN, Infinity]) {
      const variants = [structuredClone(first), structuredClone(second)];
      variants[index].calculated_price = value === undefined ? undefined : { calculated_amount: value, currency_code: "eur" };
      const f = await fixture({ products: [commerceProduct(variants)] });
      const result = await f.render({ variant: variants[index].id });
      assertSelected(result, variants[index].id, variants[index].title, null);
      assert.equal(result.observed.jsonLd[0].offers, undefined);
      assert.ok(!result.html.includes("€"));
    }
  }
});

test("legacy no-query/invalid-query unpriced first variant keeps its existing fallback-price behavior", async () => {
  const unpricedFirst = { ...first, calculated_price: undefined };
  for (const query of [undefined, { variant: "wrong" }, { variant: [first.id] }]) {
    const f = await fixture({ products: [commerceProduct([unpricedFirst, second])] });
    assertSelected(await f.render(query), first.id, first.title, 749);
  }
});

test("missing commerce or variants cannot claim requested selection, render select or expose AddToCart", async () => {
  for (const products of [[], [commerceProduct([])]]) {
    const f = await fixture({ products });
    const result = await f.render({ variant: second.id });
    assert.equal(result.observed.buy[0].selectedVariantId ?? null, null);
    assert.equal(result.observed.controls[0].selectedVariantId ?? null, null);
    assert.equal(result.observed.cart.length, 0);
    assert.equal(result.observed.prices.length, 0);
    assert.ok(!result.html.includes("Geselecteerd:"));
    assert.ok(result.html.includes("nog niet beschikbaar"));
  }
});

test("client controls defensively reject unmatched selectedVariantId and preserve standalone legacy defaults", async () => {
  for (const selectedVariantId of [undefined, "wrong", [second.id]]) {
    const f = await fixture();
    const module = await f.load("@/components/product/ProductPurchaseControls");
    await module.evaluate();
    const variants = [first, second].map(v => ({ id: v.id, title: v.title, calculated_amount: v.calculated_price.calculated_amount, currency_code: "eur" }));
    const html = renderToStaticMarkup(React.createElement(module.namespace.ProductPurchaseControls, { variants, selectedVariantId, fallbackPrice: { amount: 990, currency_code: "eur" } }));
    assertSelected({ html, observed: f.observed }, first.id, first.title, 550);
    assert.deepEqual(f.forbidden, []);
  }
});

test("wrapper retry and batch fallback keep hydrated options and read-only SDK attempts", async () => {
  const f = await fixture({ reject: a => a.path === "/store/products" || Boolean(a.options.query?.country_code) });
  const result = await f.api.getMedusaProductsByIds(["prod_yarn", "missing"]);
  assert.deepEqual(plain(result.get("prod_yarn").variants[1].options ?? null), second.options);
  assert.equal(result.get("missing"), null);
  assert.equal(f.attempts.length, 5);
  assert.ok(f.attempts.every(a => a.options.method === "GET"));
  assert.deepEqual(f.forbidden, []);
});

test("absent optional identity relations remain absent, never invented from metadata/description", async () => {
  const v = { ...second, options: [{ value: "Black", option: null }, { value: "100g" }], metadata: { color: "Black", weight: "100g" } };
  const f = await fixture({ products: [commerceProduct([v], { description: "Black 100g" })] });
  const result = await f.api.getMedusaProduct("prod_yarn");
  assert.deepEqual(plain(result.variants[0].options ?? null), [{ value: "Black", option: null }, { value: "100g" }]);
  assert.equal(result.variants[0].metadata, undefined);
  assert.equal(result.description, undefined);
  assert.deepEqual(f.forbidden, []);
});

test("empty product lookups perform no outbound SDK attempts", async () => {
  const f = await fixture();
  assert.equal(await f.api.getMedusaProduct(null), null);
  assert.equal(await f.api.getMedusaProductByHandle(null), null);
  assert.equal((await f.api.getMedusaProductsByIds([null, undefined, ""])).size, 0);
  assert.deepEqual(f.attempts, []);
  assert.deepEqual(f.forbidden, []);
});

test("a real variant from another Medusa product cannot select or price this product", async () => {
  const other = commerceProduct([{ ...second, id: "variant_other", calculated_price: { calculated_amount: 99, currency_code: "eur" } }], { id: "prod_other", handle: "ander" });
  const f = await fixture({ products: [commerceProduct(), other] });
  const result = await f.render({ variant: "variant_other" });
  assertSelected(result, first.id, first.title, 550);
  assert.equal(result.observed.buy[0].selectedVariantId ?? null, null);
  assert.ok(!result.html.includes("99,00"));
});

test("real buy-card element key resets controls on changed variant navigation, without default-id collision", async () => {
  const f = await fixture();
  const module = await f.load("@/components/product/ProductBuyCard");
  const controlsKey = selectedVariantId => {
    const tree = module.namespace.ProductBuyCard({ product: platformProduct, creator: null, price: null, variants: [], isFavorite: false, selectedVariantId });
    let found;
    function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      if (Object.hasOwn(node.props ?? {}, "fallbackPrice")) found = node;
      walk(node.props?.children);
    }
    walk(tree);
    assert.ok(found, "Actual BuyCard must contain purchase controls");
    return found.key;
  };
  assert.notEqual(controlsKey(undefined), controlsKey("default"));
  assert.notEqual(controlsKey(first.id), controlsKey(second.id));
  assert.deepEqual(f.forbidden, []);
});

// UI01-04: written before production fixes. The unchanged matcher and actual
// destination consume the same real SDK -> wrapper snapshot, entirely offline.
async function articleOffer(f, selected, sourceTitle = "Zwart garen 100g") {
  const hydrated = await f.api.getMedusaProductsByIds([platformProduct.medusa_product_id]);
  const matcher = await f.load("matcher");
  const rows = matcher.namespace.matchArticleMaterialOffers(
    [{ key: "original-source", title: sourceTitle }],
    [{ ...platformProduct, status: "active" }], hydrated,
  );
  assert.equal(rows[0].title, sourceTitle, "Original requirement stays unchanged");
  assert.equal(rows[0].offers.length, 1, "Unknown prices retain exact matching link");
  const offer = rows[0].offers[0];
  assert.equal(offer.variantId, selected.id);
  assert.equal(new URL(offer.href, "https://offline.invalid").searchParams.get("variant"), selected.id);
  return offer;
}

function assertOfferPrice(result, expected) {
  assert.deepEqual(plain(result.observed.buy.at(-1).price), expected, "Page passes matcher-normalized price to real BuyCard");
  assert.deepEqual(plain(result.observed.controls.at(-1).fallbackPrice), expected, "Real BuyCard preserves exact page price");
  const offer = result.observed.jsonLd.at(-1).offers;
  if (expected === null) {
    assert.equal(offer, undefined, "Unknown price must not publish an Offer");
    assert.ok(!result.html.includes("€"), "Unknown price cannot render fallback");
  } else {
    assert.equal(result.observed.prices.at(-1).currencyCode, "eur");
    assert.equal(offer.priceCurrency, "EUR");
    assert.equal(offer.price, (expected.amount / 100).toFixed(2));
  }
}

for (const [amount, currency, cents] of [[1.005, "eur", 101], [10.075, "eur", 1008], [7.49, "EUR", 749], [0, "eUr", 0], [1e-7, "eur", 0], [1e3, "eur", 100000]]) {
  test(`UI01 actual article -> SDK/service/page/controls/JSON-LD parity: ${amount} ${currency} -> ${cents}`, async () => {
    const selected = { ...second, calculated_price: { calculated_amount: amount, currency_code: currency } };
    const f = await fixture({ products: [commerceProduct([first, selected])] });
    const offer = await articleOffer(f, selected);
    assert.deepEqual(plain(offer.price), { amount: cents, currency_code: "eur" });
    const result = await f.render({ variant: new URL(offer.href, "https://offline.invalid").searchParams.get("variant") });
    assertSelected(result, selected.id, selected.title, cents);
    assertOfferPrice(result, plain(offer.price));
  });
}

const unavailablePrices = [
  ["missing calculated price", undefined],
  ["missing amount", { currency_code: "eur" }],
  ["null amount", { calculated_amount: null, currency_code: "eur" }],
  ["string amount", { calculated_amount: "7.49", currency_code: "eur" }],
  ["empty amount", { calculated_amount: "", currency_code: "eur" }],
  ["missing currency", { calculated_amount: 7.49 }],
  ["null currency", { calculated_amount: 7.49, currency_code: null }],
  ["empty currency", { calculated_amount: 7.49, currency_code: "" }],
  ["non-EUR currency", { calculated_amount: 7.49, currency_code: "usd" }],
  ["invalid currency", { calculated_amount: 7.49, currency_code: "invalid" }],
  ["non-string currency", { calculated_amount: 7.49, currency_code: 123 }],
  ["negative amount", { calculated_amount: -1, currency_code: "eur" }],
  ["negative subcent", { calculated_amount: -0.001, currency_code: "eur" }],
  ["NaN", { calculated_amount: NaN, currency_code: "eur" }],
  ["Infinity", { calculated_amount: Infinity, currency_code: "eur" }],
  ["negative Infinity", { calculated_amount: -Infinity, currency_code: "eur" }],
  ["unsafe cents", { calculated_amount: 90071992547409.92, currency_code: "eur" }],
  ["overflow", { calculated_amount: Number.MAX_VALUE, currency_code: "eur" }],
];
for (const [name, calculated_price] of unavailablePrices) {
  test(`UI02/UI03 actual unknown-price handoff rejects ${name} without fallback or invalid Offer`, async () => {
    for (const index of [0, 1]) {
      const variants = [structuredClone(first), structuredClone(second)];
      variants[index].calculated_price = calculated_price;
      const selected = variants[index];
      const f = await fixture({ products: [commerceProduct(variants)] });
      const offer = await articleOffer(f, selected, index === 0 ? "Wit garen 100g" : "Zwart garen 100g");
      assert.equal(offer.price, null);
      const result = await f.render({ variant: selected.id });
      assertSelected(result, selected.id, selected.title, null);
      assertOfferPrice(result, null);
    }
  });
}

test("UI02 service preserves raw provenance while legacy default currency/price fields stay unchanged", async () => {
  for (const [name, calculated_price] of [...unavailablePrices, ["half cent", { calculated_amount: 1.005, currency_code: "EUR" }]]) {
    const f = await fixture({ products: [commerceProduct([{ ...first, calculated_price }, second])] });
    const service = await f.load("@/lib/services/product-page");
    const data = await service.namespace.getProductPageData("garen");
    const v = data.variants[0];
    assert.deepEqual(plain(v.exact_price ?? null), plain(calculated_price ?? null), `${name}: provenance cannot invent EUR`);
    assert.ok(Object.is(v.calculated_amount, calculated_price?.calculated_amount), `${name}: legacy amount unchanged`);
    assert.equal(v.currency_code, calculated_price?.currency_code ?? "EUR", `${name}: legacy currency unchanged`);
    const legacy = calculated_price?.calculated_amount != null ? calculated_price : second.calculated_price;
    const legacyCents = Number.isNaN(Number(legacy.calculated_amount)) ? 0 : Math.round(Number(legacy.calculated_amount) * 100);
    assert.ok(Object.is(data.price.amount, legacyCents), `${name}: legacy rounding unchanged`);
    assert.equal(data.price.currency_code, legacy.currency_code ?? "EUR");
  }
});

test("UI04 scalar Offer URL round trips encoded variant/price; metadata/product identity stay canonical", async () => {
  for (const id of [second.id, "variant:zwart &extra=x#/? café%2F", "default"]) {
    const selected = { ...second, id, calculated_price: { calculated_amount: 10.075, currency_code: "eur" } };
    const products = [commerceProduct([first, selected])];
    const f = await fixture({ products });
    const article = await articleOffer(f, selected);
    const result = await f.render({ variant: new URL(article.href, "https://offline.invalid").searchParams.get("variant") });
    const offer = result.observed.jsonLd.at(-1).offers;
    assert.equal(offer.url, `https://offline.invalid/product/garen?variant=${encodeURIComponent(id)}`);
    const url = new URL(offer.url);
    assert.deepEqual([...url.searchParams], [["variant", id]]);
    assert.equal(url.hash, "");
    assert.equal(url.pathname, "/product/garen");
    const page = await f.load("page");
    const metadata = await page.namespace.generateMetadata({ params: Promise.resolve({ slug: "garen" }), searchParams: Promise.resolve({ variant: id }) });
    assert.equal(metadata.path, "/product/garen", "Canonical metadata excludes variant query");
    assert.equal(result.observed.buy.at(-1).product.slug, "garen");
    const fresh = await fixture({ products });
    const roundTrip = await fresh.render({ variant: url.searchParams.get("variant") });
    assertSelected(roundTrip, id, selected.title, 1008);
    assertOfferPrice(roundTrip, plain(article.price));
    assert.equal(roundTrip.observed.jsonLd.at(-1).offers.url, offer.url);
  }
});

for (const [name, calculated_price, cents] of [
  ["half cent", { calculated_amount: 1.005, currency_code: "EUR" }, 101],
  ["10.075", { calculated_amount: 10.075, currency_code: "eur" }, 1008],
  ["zero", { calculated_amount: 0, currency_code: "eur" }, 0],
  ...unavailablePrices.map(([name, price]) => [name, price, null]),
]) {
  test(`UI01-03 exact-link manual select onChange normalizes newly selected ${name} without fallback`, async () => {
    const changed = { ...first, calculated_price };
    const f = await fixture({ products: [commerceProduct([changed, second])], changeSelectionTo: first.id });
    const offer = await articleOffer(f, changed, "Wit garen 100g");
    const result = await f.render({ variant: second.id });
    assertSelected(result, changed.id, changed.title, cents);
    assert.equal(result.observed.controls.at(-1).selectedVariantId, second.id, "Exact-link mode persists after manual change");
    if (cents !== null) assert.equal(result.observed.prices.at(-1).currencyCode, offer.price.currency_code);
    assert.deepEqual(f.forbidden, []);
    // Server JSON-LD stays at initial URL selection: no additional UI workflow.
    assert.equal(result.observed.jsonLd.at(-1).offers.price, "7.49");
  });
}

test("non-exact legacy manual selection retains binary rounding and currency defaults", async () => {
  for (const calculated_price of [{ calculated_amount: 1.005, currency_code: "EUR" }, { calculated_amount: 7.49 }, { calculated_amount: 7.49, currency_code: "usd" }]) {
    const f = await fixture({ products: [commerceProduct([first, { ...second, calculated_price }])], changeSelectionTo: second.id });
    const result = await f.render();
    assertSelected(result, second.id, second.title, Math.round(calculated_price.calculated_amount * 100));
    assert.equal(result.observed.prices.at(-1).currencyCode, calculated_price.currency_code ?? "EUR");
    assert.equal(result.observed.jsonLd.at(-1).offers.url, "https://offline.invalid/product/garen");
    assert.equal(result.observed.jsonLd.at(-1).offers.price, "5.50");
  }
});

test("exact-EUR helper is browser-safe pure and rejects missing provenance", async () => {
  const module = new vm.SourceTextModule(compile(actual["@/lib/commerce/variant-price"]), { context: vm.createContext({}) });
  await module.link(name => { throw new Error(`Pure browser helper must not import ${name}`); });
  await module.evaluate();
  const normalize = module.namespace.exactEurVariantPrice;
  assert.equal(typeof normalize, "function");
  for (const [, price] of unavailablePrices) assert.equal(normalize(price), null);
  assert.equal(normalize(null), null);
  assert.deepEqual(plain(normalize({ calculated_amount: 1.005, currency_code: "EUR" })), { amount: 101, currency_code: "eur" });
  assert.deepEqual(plain(normalize({ calculated_amount: 10.075, currency_code: "eur" })), { amount: 1008, currency_code: "eur" });
});
