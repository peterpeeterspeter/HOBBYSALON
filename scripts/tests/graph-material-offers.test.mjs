import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

// Native, offline behavioral tests: the actual pure TS module, no SDK/dependencies.
// An absent implementation remains a behavioral RED (rather than aborting discovery).
const sourceUrl = new URL("../../apps/storefront/src/lib/content/article-material-offers.ts", import.meta.url);
let api = {};
try {
  const module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(sourceUrl, "utf8")), {
    context: vm.createContext({}), identifier: sourceUrl.href,
  });
  await module.link(() => { throw new Error("Pure matcher must not import dependencies"); });
  await module.evaluate();
  api = module.namespace;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const plain = value => JSON.parse(JSON.stringify(value));
const materials = (...titles) => titles.map((title, index) => ({ key: `source:${index}:${title}`, title }));
const catalog = (id, title, extra = {}) => ({
  id, slug: id, title, product_type: "supply", is_active: true, status: "active", medusa_product_id: `medusa:${id}`, ...extra,
});
const variant = (id, title, extra = {}) => ({ id, title, calculated_price: { calculated_amount: 7.49, currency_code: "eur" }, ...extra });
const product = (candidate, variants, extra = {}) => ({ id: candidate.medusa_product_id, title: candidate.title, variants, ...extra });
const run = (titles, candidates, products) => plain(api.matchArticleMaterialOffers(materials(...titles), candidates, new Map(products.map(p => [p.id, p]))));
const offerIds = result => result.flatMap(row => row.offers.map(offer => offer.variantId));
const black = "Zwart accentgaren: één bol van 100 g, geraamd op € 6,95; de bron noemt circa 30 g gebruik.";
const hazelnut = "Hazelnootkleurig accentgaren: één bol van 100 g, geraamd op € 6,95; de bron noemt circa 45 g gebruik.";
const tools = "Haaknaald van 6 mm: geraamd op € 4,95; stopnaald: € 2,50; meetlint: € 2,50; schaar: € 5,95. Wie deze al heeft, hoeft ze niet opnieuw te kopen.";

test("public pure matcher contract exists", () => {
  for (const name of ["materialCatalogSearchTerms", "prefilterMaterialCatalog", "matchArticleMaterialOffers"]) assert.equal(typeof api[name], "function", name);
});

test("verbatim black/hazelnut source purchase 100g, not 30/45g use or source estimated price", () => {
  const c = catalog("yarn", "Accentgaren");
  const p = product(c, [variant("black100", "Black 100g"), variant("hazel100", "Hazelnut 100 g"), variant("black30", "Zwart 30g"), variant("hazel45", "Hazelnoot 45g"), variant("brown100", "Bruin 100g")]);
  const result = run([black, hazelnut], [c], [p]);
  assert.deepEqual(result.map(row => row.title), [black, hazelnut]);
  assert.deepEqual(result.map(row => row.offers.map(offer => offer.variantId)), [["black100"], ["hazel100"]]);
  assert.deepEqual(result[0].offers[0].price, { amount: 749, currency_code: "eur" });
  assert.equal(result[0].offers[0].productId, c.id);
  assert.equal(result[0].offers[0].href, "/product/yarn?variant=black100");
  assert.match(result[0].offers[0].requirementLabel, /100 g/);
});

test("semicolon combined source keeps one row and four separately labelled tools; wrong 5mm hook excluded", () => {
  const candidates = [catalog("hook6", "Haaknaald 6mm"), catalog("hook5", "Haaknaald 5mm"), catalog("needle", "Stopnaald"), catalog("tape", "Meetlint"), catalog("scissors", "Schaar")];
  const result = run([tools], candidates, candidates.map(c => product(c, [variant(c.id, "Default")] )));
  assert.equal(result.length, 1);
  assert.equal(result[0].title, tools);
  assert.deepEqual(offerIds(result), ["hook6", "needle", "tape", "scissors"]);
  assert.deepEqual(result[0].offers.map(o => o.requirementLabel), ["Haaknaald van 6 mm", "stopnaald", "meetlint", "schaar"]);
});

test("millimetres normalize case and decimal comma without confusing 6 with 6.5", () => {
  const c = catalog("hook", "Crochet hook");
  const p = product(c, [variant("six", "6 MM"), variant("sixhalf", "6.5 mm"), variant("five", "5mm")]);
  assert.deepEqual(offerIds(run(["Haaknaald 6,5 MM"], [c], [p])), ["sixhalf"]);
  assert.deepEqual(offerIds(run(["6 MM haaknaald"], [c], [p])), ["six"]);
});

test("colour and purchased weight must occur on the very same variant, never aggregated", () => {
  const c = catalog("yarn", "Garen");
  const p = product(c, [variant("wrongweight", "Black 50g"), variant("wrongcolour", "White 100g")]);
  assert.deepEqual(offerIds(run([black], [c], [p])), []);
});

test("identity options on same variant support explicit colour and weight; descriptions and metadata do not", () => {
  const c = catalog("yarn", "Garen", { description: "Black 100g" });
  const opts = [{ value: "Black", option: { title: "Color" } }, { value: "100 g", option: { title: "Weight" } }];
  const p = product(c, [variant("good", "Variant", { options: opts }), variant("metadata", "Default", { metadata: { color: "black", weight: "100g" } }), variant("untrusted", "Default", { options: [{ value: "Black 100g", option: { title: "Geschikt voor" } }] })], { description: "Black 100g" });
  assert.deepEqual(offerIds(run([black], [c], [p])), ["good"]);
});

test("hazelnut is a specific colour, not any brown; bilingual aliases work", () => {
  const candidates = [catalog("brown", "Garen bruin 100g"), catalog("hazel", "Yarn hazelnut 100g")];
  assert.deepEqual(offerIds(run([hazelnut], candidates, candidates.map(c => product(c, [variant(c.id, "Default")])))), ["hazel"]);
});

test("generic yarn and dimensionless hook have no identity proof", () => {
  const c = catalog("generic", "Garen");
  assert.deepEqual(offerIds(run([black, "Garen"], [c], [product(c, [variant("default", "Default")])])), []);
  const hook = catalog("hook", "Haaknaald");
  assert.deepEqual(offerIds(run(["Haaknaald"], [hook], [product(hook, [variant("6", "6 mm"), variant("5", "5 mm")])])), []);
});

test("active linked supply only; plural supplies, published, handmade, drafts, inactive or unlinked products rejected", () => {
  const cases = [
    ["ok", {}], ["plural", { product_type: "supplies" }], ["draft", { status: "draft" }],
    ["archived", { status: "archived" }], ["published", { status: "published" }], ["inactive", { is_active: false }], ["unlinked", { medusa_product_id: null }],
    ["blanklink", { medusa_product_id: " " }], ["handmade", { product_type: "handmade" }],
    ["digital", { product_type: "digital" }], ["ticket", { product_type: "workshop_ticket" }],
  ].map(([id, extra]) => catalog(id, "Garen zwart 100g", extra));
  assert.deepEqual(offerIds(run([black], cases, cases.map(c => product(c, [variant(c.id, "Default")])))), ["ok"]);
});

test("finished objects, digital patterns, kits, hardware homonyms and incidental suitable-for mentions excluded", () => {
  const badTitles = ["Zwarte trui van garen 100g", "Haakpatroon garen zwart 100g PDF", "Garen zwart 100g workshop", "Garen zwart 100g pakket", "Garen zwart 100g bundle", "Garen zwart 100g set", "Garen geschikt voor zwart 100g", "Haaknaaldhouder 6mm", "Haak 6mm", "Schaarlift", "Meetlint sticker", "Schaar krik", "Stopnaald boek", "Garen zwart 100g of wit"];
  for (const title of badTitles) {
    const c = catalog("bad", title);
    assert.deepEqual(offerIds(run([black, "Haaknaald 6mm", "Schaar", "Meetlint", "Stopnaald"], [c], [product(c, [variant("bad", "Default")])])), [], title);
  }
});

test("negative and alternative source constraints fail closed instead of matching a positive substring", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  for (const title of ["Garen niet zwart 100g", "Geen zwart garen 100g", "Garen zonder zwart 100g", "Garen zwart of wit 100g", "Garen zwart/wit 100g", "Garen zwart 100g; niet zwart", "Garen geschikt voor zwart 100g", "Garen zwart 100g tenzij wit", "Garen zwart 100g (geen katoen)"]) {
    assert.deepEqual(offerIds(run([title], [c], [product(c, [variant("black", "Default")])])), [], title);
  }
});

test("negation and alternatives in product or exact variant evidence also fail closed", () => {
  const c = catalog("yarn", "Garen");
  for (const title of ["Niet zwart 100g", "Black or white 100g", "Geen zwart 100g", "Black/white 100g", "Geschikt voor zwart 100g", "Black 100g set", "Black 100g (not cotton)"]) {
    assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", title)])])), [], title);
  }
});

test("unrecognized explicit material constraints are not silently dropped", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  for (const title of ["Fluorescerend zwart garen 100g", "Zwart velvet garen 100g", "Zwart garen 100g merk Onbekend", "Zwart garen 100g kleurcode 123", "Zwart garen 100g 170m", "Zwart garen 100g; waterafstotend"]) {
    assert.deepEqual(offerIds(run([title], [c], [product(c, [variant("black", "Default")])])), [], title);
  }
});

test("explicit yarn thickness needs explicit corresponding evidence, never a pattern compatibility claim", () => {
  const candidates = [catalog("generic", "Garen rood 454g"), catalog("medium", "Middelzwaar garen rood 454g"), catalog("thin", "Dun garen rood 454g")];
  const result = run(["Rood middelzwaar garen: één grote bol van 454 g, geraamd op € 16,95."], candidates, candidates.map(c => product(c, [variant(c.id, "Default")])));
  assert.deepEqual(offerIds(result), ["medium"]);
  assert.doesNotMatch(JSON.stringify(result), /compatibel|geschikt voor|pattern compatible/i);
});

test("explicit composition including percentages requires matching evidence, not just any yarn", () => {
  const candidates = [catalog("unknown", "Garen zwart 100g"), catalog("acrylic", "100% acryl garen zwart 100g"), catalog("cotton", "100% cotton yarn black 100g"), catalog("blend", "50% katoen 50% acryl garen zwart 100g")];
  const products = candidates.map(c => product(c, [variant(c.id, "Default")]));
  assert.deepEqual(offerIds(run(["100 % katoen garen zwart 100g"], candidates, products)), ["cotton"]);
  assert.deepEqual(offerIds(run(["50% katoen 50% acryl garen zwart 100g"], candidates, products)), ["blend"]);
});

test("conflicting catalog, commerce-title or variant attributes never override each other", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  for (const p of [product(c, [variant("v", "White")]), product(c, [variant("v", "50g")]), product(c, [variant("v", "Default")], { title: "Garen wit 100g" }), product(c, [variant("v", "Default")], { title: "Trui zwart 100g" })]) {
    assert.deepEqual(offerIds(run([black], [c], [p])), []);
  }
});

test("commerce id must equal linked Medusa id; null, missing commerce and variant id fail closed", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  assert.deepEqual(plain(api.matchArticleMaterialOffers(materials(black), [c], new Map([[c.medusa_product_id, { ...product(c, [variant("v", "Default")]), id: "wrong" }]])))[0].offers, []);
  for (const map of [new Map(), new Map([[c.medusa_product_id, null]]), new Map([[c.medusa_product_id, product(c, [])]]), new Map([[c.medusa_product_id, product(c, [variant("", "Default")])]])]) {
    assert.deepEqual(plain(api.matchArticleMaterialOffers(materials(black), [c], map))[0].offers, []);
  }
});

test("at most two deterministic products per requirement, one proven variant, deduplicated", () => {
  const candidates = ["z", "c", "a", "b"].map(id => catalog(id, "Garen zwart 100g"));
  const products = candidates.map(c => product(c, [variant(`v:${c.id}`, "Default")]));
  const result = run([black], [...candidates, candidates[2]], products);
  assert.deepEqual(offerIds(result), ["v:a", "v:b"]);
  assert.deepEqual(run([black], [...candidates].reverse(), products), result);
  const c = candidates[0];
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("one", "Default"), variant("two", "Default")])])), [], "Two equally suitable variants are ambiguous, not automatically all variants");
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("one", "Default"), variant("one", "Default")])])), ["one"]);
});

test("duplicate variant ids with conflicting evidence are rejected rather than order-dependent", () => {
  const c = catalog("yarn", "Garen");
  const p = product(c, [variant("duplicate", "Black 100g"), variant("duplicate", "White 100g")]);
  assert.deepEqual(offerIds(run([black], [c], [p])), []);
});

test("safe slug is encoded as one path segment; variant query value cannot inject parameters", () => {
  const c = catalog("safe", "Garen zwart 100g", { slug: "garen café" });
  const id = "v&other=evil#fragment/?";
  assert.equal(run([black], [c], [product(c, [variant(id, "Default")])])[0].offers[0].href, `/product/garen%20caf%C3%A9?variant=${encodeURIComponent(id)}`);
  for (const slug of ["", " ", "../x", ".", "..", "a/b", "a\\b", "a?x", "a#x", "https:evil", "//evil", "%2f", "%252f", "bad\u0000slug", "\ud800"]) {
    const bad = { ...c, slug };
    assert.deepEqual(offerIds(run([black], [bad], [product(bad, [variant("v", "Default")])])), [], JSON.stringify(slug));
  }
});

test("exact variant current EUR major units convert to integer cents, including zero and rounding", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  for (const [value, expected] of [[0, 0], [6.95, 695], [1.005, 101], [9.999, 1000]]) {
    const p = product(c, [variant("v", "Default", { calculated_price: { calculated_amount: value, currency_code: "EUR" } })]);
    assert.deepEqual(run([black], [c], [p])[0].offers[0].price, { amount: expected, currency_code: "eur" });
  }
});

test("invalid or unsupported price is null, never estimated source/platform/other variant fallback", () => {
  const c = catalog("yarn", "Garen", { price: 6.95 });
  for (const calculated_price of [undefined, null, { calculated_amount: -1, currency_code: "eur" }, { calculated_amount: NaN, currency_code: "eur" }, { calculated_amount: Infinity, currency_code: "eur" }, { calculated_amount: "6.95", currency_code: "eur" }, { calculated_amount: 6.95, currency_code: "" }, { calculated_amount: 6.95, currency_code: "eur?x" }, { calculated_amount: 6.95, currency_code: "usd" }, { calculated_amount: Number.MAX_VALUE, currency_code: "eur" }]) {
    const p = product(c, [variant("good", "Black 100g", { calculated_price }), variant("other", "White 100g")]);
    const result = run([black], [c], [p]);
    assert.deepEqual(offerIds(result), ["good"]);
    assert.equal(result[0].offers[0].price, null, JSON.stringify(calculated_price));
  }
});

test("search terms are bounded known family constants, never raw author input or SQL syntax", () => {
  const terms = plain(api.materialCatalogSearchTerms(materials(black, tools, "garen' OR 1=1 -- %,(evil)", "Mystery %_x")));
  assert.ok(terms.length > 0 && terms.length <= 16);
  assert.equal(new Set(terms).size, terms.length);
  for (const term of terms) assert.match(term, /^[a-z]+(?: [a-z]+)*$/);
  assert.ok(terms.includes("garen"));
  assert.ok(terms.includes("haaknaald"));
  assert.deepEqual(plain(api.materialCatalogSearchTerms(materials("Mystery %_x"))), []);
});

test("prefilter only relevant strong family titles, bounded 40, deterministic and no mutation", () => {
  const candidates = Array.from({ length: 60 }, (_, i) => catalog(`y${String(i).padStart(2, "0")}`, "Garen"));
  candidates.push(catalog("handmade", "Garen", { product_type: "handmade" }), catalog("inactive", "Garen", { is_active: false }), catalog("draft", "Garen", { status: "draft" }), catalog("kit", "Garen set"), catalog("bad", "Trui van garen"), catalog("tool", "Haaknaald 6mm"), catalog("homonym", "Garenhouder"));
  const before = plain(candidates);
  const result = plain(api.prefilterMaterialCatalog(materials(black), candidates));
  assert.equal(result.length, 40);
  assert.ok(result.every(c => /^y\d+$/.test(c.id)));
  assert.deepEqual(plain(api.prefilterMaterialCatalog(materials(black), [...candidates].reverse())), result);
  assert.deepEqual(candidates, before);
});

test("lossless source identity and immutable frozen inputs, including unavailable offers", () => {
  const source = materials("  Zwart accentgaren: één bol van 100 g  ", "Onbekend 🧶", black, black);
  const c = catalog("yarn", "Garen zwart 100g");
  const p = product(c, [variant("v", "Default")]);
  const before = plain({ source, c, p });
  function freeze(value) { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
  freeze(source); freeze(c); freeze(p);
  const result = plain(api.matchArticleMaterialOffers(source, Object.freeze([c]), new Map([[p.id, p]])));
  assert.deepEqual(result.map(({ key, title }) => ({ key, title })), source);
  assert.deepEqual(result[1].offers, []);
  assert.deepEqual({ source, c, p }, before);
  assert.deepEqual(Object.keys(result[0]).sort(), ["key", "offers", "title"]);
});

test("no automatic all-colour variant offers for an underspecified source", () => {
  const c = catalog("yarn", "100% cotton yarn 100g");
  const p = product(c, [variant("black", "Black"), variant("white", "White")]);
  assert.deepEqual(offerIds(run(["100% katoen garen 100g"], [c], [p])), []);
});

test("unlabelled multiple purchased weights or dimensions and compound families are ambiguous", () => {
  const candidates = [catalog("yarn", "Garen zwart 100g"), catalog("hook", "Haaknaald 6mm"), catalog("tools", "Haaknaald 6mm stopnaald")];
  const products = candidates.map(c => product(c, [variant(c.id, "Default")]));
  for (const title of ["Garen zwart 100g 30g", "Haaknaald 6mm 5mm", "Haaknaald 6mm en stopnaald", "Set haaknaald 6mm"]) assert.deepEqual(offerIds(run([title], candidates, products)), [], title);
});

// Adversarial review repros: catalog discovery is never missing commerce proof.
test("catalog attributes cannot supply missing commerce attributes for a single Default", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("default", "Default")], { title: "Garen" })])), []);
});

test("multi-variant commerce title cannot supply current Default identity", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("default", "Default"), variant("white", "White 50g")])])), []);
});

test("single commerce title proves invariant attributes, not the catalog", () => {
  const c = catalog("yarn", "Garen");
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("default", "Default")], { title: "Garen zwart 100g" })])), ["default"]);
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("default", "Default")], { title: "Garen" })])), []);
});

test("multi-variant identity needs all requested current dimensions, not title inheritance", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  for (const title of ["Black", "100g", "Default"]) {
    assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("partial", title), variant("white", "White 50g")])])), [], title);
  }
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("black", "Black 100g"), variant("white", "White 50g")])])), ["black"]);
});

test("unknown relevant Color options block catalog or title colour inheritance", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  for (const title of ["Garen", "Garen zwart 100g"]) {
    for (const color of ["Turquoise", "Off white", "Black metallic", "", "Default"]) {
      const options = [{ value: color, option: { title: "Color" } }, { value: "100g", option: { title: "Weight" } }];
      assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", "Default", { options })], { title })])), [], `${title}: ${color}`);
    }
  }
});

for (const option of [null, undefined, {}, { title: undefined }, { title: null }, { title: "" }, { title: "Unknown" }]) {
  test(`unknown option label/container cannot inherit black commerce title: ${JSON.stringify(option)}`, () => {
    const c = catalog("yarn", "Garen");
    assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", "Default", { options: [{ value: "White", option }] })], { title: "Garen zwart 100g" })])), []);
  });
}

test("unlabelled Default/Variant option fillers preserve single commerce title inheritance; Description stays irrelevant", () => {
  const c = catalog("yarn", "Garen");
  for (const option of [null, undefined, {}]) for (const value of ["Default", "Variant"]) {
    assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("good", "Default", { options: [{ value, option }] })], { title: "Garen zwart 100g" })])), ["good"]);
  }
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("good", "Default", { options: [{ value: "White", option: { title: "Description" } }] })], { title: "Garen zwart 100g" })])), ["good"]);
});

test("hook Size values require units and cannot inherit catalog six from unknown five", () => {
  const c = catalog("hook", "Haaknaald 6mm");
  const options = [{ value: "5", option: { title: "Size" } }];
  assert.deepEqual(offerIds(run(["Haaknaald 6mm"], [c], [product(c, [variant("wrong", "Default", { options }), variant("other", "7mm")], { title: "Haaknaald" })])), []);
  assert.deepEqual(offerIds(run(["Haaknaald 6mm"], [c], [product(c, [variant("wrong", "Default", { options })])])), []);
});

test("identity options are dimension-specific, not a shared evidence string", () => {
  const cases = [
    ["Haaknaald 6mm", "Haaknaald", "Color", "6mm"],
    [black, "Garen", "Composition", "Black 100g"],
    [black, "Garen", "Weight", "Black 100g"],
    [black, "Garen", "Color", "Black 100g"],
    [black, "Garen", "Size", "Black 100g"],
    [black, "Garen", "Thickness", "Black 100g"],
  ];
  for (const [source, title, label, value] of cases) {
    const c = catalog("candidate", title);
    assert.deepEqual(offerIds(run([source], [c], [product(c, [variant("bad", "Variant", { options: [{ value, option: { title: label } }] })])])), [], label);
  }
});

test("explicit units in Gewicht (g) and Maat(mm) labels prove numerical values", () => {
  const yarn = catalog("yarn", "Garen");
  const hook = catalog("hook", "Haaknaald");
  const yarnOptions = [{ value: "100", option: { title: "Gewicht (g)" } }, { value: "Black", option: { title: "Color" } }];
  const hookOptions = [{ value: "6", option: { title: "Maat(mm)" } }];
  assert.deepEqual(offerIds(run([black, "Haaknaald 6mm"], [yarn, hook], [product(yarn, [variant("y", "Variant", { options: yarnOptions })]), product(hook, [variant("h", "Default", { options: hookOptions })])])), ["y", "h"]);
  for (const label of ["Weight", "Gewicht"]) {
    assert.deepEqual(offerIds(run([black], [yarn], [product(yarn, [variant("bad", "Black", { options: [{ value: "100", option: { title: label } }] })])])), [], label);
  }
});

test("units-labelled options still reject signed, range, wrong unit and unknown modifiers", () => {
  const c = catalog("hook", "Haaknaald");
  for (const value of ["-6", ".6", ",6", "4-6", "6 g", "6 ergonomic"]) {
    assert.deepEqual(offerIds(run(["Haaknaald 6mm"], [c], [product(c, [variant("bad", "Default", { options: [{ value, option: { title: "Maat(mm)" } }] })])])), [], value);
  }
});

for (const [source, title] of [["Haaknaald 6mm", "Haaknaald 6mm sleutelhanger"], ["Schaar", "Schaar hoes"], ["Garen rood 100g", "Red Heart garen 100g"]]) {
  test(`unknown commerce/catalog modifier does not prove supply identity: ${title}`, () => {
    const c = catalog("candidate", title);
    assert.deepEqual(offerIds(run([source], [c], [product(c, [variant("bad", "Default")])])), []);
    const generic = catalog("generic", source.startsWith("Garen") ? "Garen" : source);
    assert.deepEqual(offerIds(run([source], [generic], [product(generic, [variant("bad", "Default")], { title })])), []);
  });
}

test("off-white and unknown variant modifiers cannot match a known colour substring", () => {
  const c = catalog("yarn", "Garen");
  for (const title of ["Off white 100g", "Cream white 100g", "Black metallic 100g", "Red Heart 100g", "Black 100g viscose", "Black 100g recycled cotton"]) {
    assert.deepEqual(offerIds(run(["Garen wit 100g", black, "Garen rood 100g"], [c], [product(c, [variant("bad", title)])])), [], title);
  }
});

test("Default/Variant fillers and explicit family attributes remain known positives", () => {
  const candidates = [catalog("y", "Garen"), catalog("h", "Haaknaald"), catalog("s", "Schaar")];
  const products = [product(candidates[0], [variant("y", "Variant Black 100g")]), product(candidates[1], [variant("h", "Default Haaknaald 6mm")]), product(candidates[2], [variant("s", "Variant Schaar")])];
  assert.deepEqual(offerIds(run([black, "Haaknaald 6mm", "Schaar"], candidates, products)), ["y", "h", "s"]);
});

for (const composition of ["60% cotton 40% viscose", "Cotton 50%, Viscose 50%", "60% cotton 40% recycled acrylic"]) {
  test(`unknown composition or modifier cannot match cotton-only: ${composition}`, () => {
    const c = catalog("yarn", "Garen");
    assert.deepEqual(offerIds(run(["Katoen garen zwart 100g"], [c], [product(c, [variant("bad", `Black 100g ${composition}`)])])), []);
  });
}

test("composition percentages above 100 reject source, title, variant, and merged options", () => {
  const c = catalog("yarn", "Garen");
  const invalid = "60% katoen 60% acryl garen zwart 100g";
  assert.deepEqual(plain(api.materialCatalogSearchTerms(materials(invalid))), []);
  assert.deepEqual(offerIds(run([invalid], [c], [product(c, [variant("bad", "Black 100g 60% cotton 60% acrylic")])])), []);
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", "Black 100g 60% cotton 60% acrylic")])])), []);
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", "Default")], { title: invalid })])), []);
  const options = [{ value: "60% acrylic", option: { title: "Composition" } }];
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", "Black 100g 60% cotton", { options })])])), []);
});

test("known composition percentages and composition options keep exact positives", () => {
  const c = catalog("yarn", "Garen");
  const source = "60% katoen 40% acryl garen zwart 100g";
  const options = [{ value: "60% cotton 40% acrylic", option: { title: "Composition" } }];
  assert.deepEqual(offerIds(run([source], [c], [product(c, [variant("blend", "Black 100g", { options })])])), ["blend"]);
  assert.deepEqual(offerIds(run(["100% katoen garen zwart 100g"], [c], [product(c, [variant("cotton", "100% Cotton Black 100g")])])), ["cotton"]);
});

for (const [malformed, exact] of [[".5mm", "5mm"], [",5mm", "5mm"], ["-6mm", "6mm"], ["4-6mm", "6mm"], ["+6mm", "6mm"], ["- 6mm", "6mm"], ["+ 6mm", "6mm"], ["−6mm", "6mm"], ["− 6mm", "6mm"], ["4 - 6mm", "6mm"]]) {
  test(`numeric suffix is never exact identity: ${malformed}`, () => {
    const c = catalog("hook", "Haaknaald");
    assert.deepEqual(offerIds(run([`Haaknaald ${malformed}`], [c], [product(c, [variant("exact", exact)])])), []);
    assert.deepEqual(offerIds(run([`Haaknaald ${exact}`], [c], [product(c, [variant("bad", malformed)])])), []);
    const badCatalog = catalog("bad", `Haaknaald ${malformed}`);
    assert.deepEqual(offerIds(run([`Haaknaald ${exact}`], [badCatalog], [product(badCatalog, [variant("bad", "Default")])])), []);
  });
}

test("signed and suffix purchased grams cannot identify a positive ball weight", () => {
  const c = catalog("yarn", "Garen");
  for (const weight of ["-100g", ".100g", ",100g", "50-100g", "+100g", "- 100g", "+ 100g", "−100g", "− 100g", "50 - 100g"]) {
    assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", `Black ${weight}`)])])), [], weight);
    assert.deepEqual(offerIds(run([`Garen zwart ${weight}`], [c], [product(c, [variant("exact", "Black 100g")])])), [], weight);
  }
});

test("exact historical red/white annotations preserve purchased 454g, never consumption 445/110g", () => {
  const red = "Rood middelzwaar garen: één grote bol van 454 g voor maat M, geraamd op € 16,95. Omdat 445 g dicht bij een volle bol ligt, kan een extra rode bol verstandig zijn als je een langere trui wilt; die reserve zit niet in het basistotaal.";
  const white = "Wit middelzwaar garen: één grote bol van 454 g, geraamd op € 16,95. Je koopt dus veel meer dan de opgegeven circa 110 g voor maat M; het overschot blijft voor een ander project.";
  const c = catalog("yarn", "Middelzwaar garen");
  const p = product(c, [variant("red454", "Medium Red 454g"), variant("white454", "Medium White 454g"), variant("red445", "Medium Red 445g"), variant("white110", "Medium White 110g")]);
  const result = run([red, white], [c], [p]);
  assert.deepEqual(result.map(row => row.title), [red, white]);
  assert.deepEqual(offerIds(result), ["red454", "white454"]);
  assert.ok(result.every(row => row.offers[0].requirementLabel.includes("454 g")));
  assert.deepEqual(plain(api.materialCatalogSearchTerms(materials(red, white))), ["garen", "yarn", "wol"]);
});

test("historical annotation recognition never truncates arbitrary new prose or changed constraints", () => {
  const c = catalog("yarn", "Middelzwaar garen rood 454g");
  for (const source of [
    "Rood middelzwaar garen: één grote bol van 454 g, geraamd op € 16,95. Alleen turquoise gebruiken.",
    "Rood middelzwaar garen: één grote bol van 454 g voor maat L, geraamd op € 16,95. Omdat 445 g dicht bij een volle bol ligt, kan een extra rode bol verstandig zijn als je een langere trui wilt; die reserve zit niet in het basistotaal.",
    "Wit middelzwaar garen: één grote bol van 454 g, geraamd op € 16,95. Je koopt dus veel meer dan de opgegeven circa 110 g voor maat M; het overschot blijft voor een ander project. Niet katoen.",
  ]) assert.deepEqual(offerIds(run([source], [c], [product(c, [variant("v", "Default")])])), [], source);
});

test("clear post-family quantity and a single trailing semicolon remain understood", () => {
  const yarn = catalog("yarn", "Garen");
  const hook = catalog("hook", "Haaknaald");
  for (const title of ["Garen zwart: 2 bollen 100g", "Garen zwart:2bollen100g"]) {
    assert.deepEqual(offerIds(run([title, "Haaknaald 6mm;"], [yarn, hook], [product(yarn, [variant("y", "Black 100g")]), product(hook, [variant("h", "6mm")])])), ["y", "h"]);
  }
  assert.deepEqual(offerIds(run(["Haaknaald 6mm;;", "Haaknaald 6mm; onbekend"], [hook], [product(hook, [variant("h", "6mm")])])), []);
});

test("contradictory candidates are discarded before the shared 40 hydration cap", () => {
  const wrong = Array.from({ length: 40 }, (_, i) => catalog(`a${String(i).padStart(2, "0")}`, "Garen wit 100g"));
  const good = [catalog("z-hook6", "Haaknaald 6mm"), catalog("z-yarnblack100", "Garen zwart 100g")];
  const candidates = [...wrong, ...good];
  assert.deepEqual(plain(api.prefilterMaterialCatalog(materials(black, "Haaknaald 6mm"), candidates)).map(c => c.id), good.map(c => c.id));
  assert.deepEqual(offerIds(run([black, "Haaknaald 6mm"], candidates, candidates.map(c => product(c, [variant(c.id, "Default")])))), ["z-yarnblack100", "z-hook6"]);
});

test("prefilter round-robins relevant families without starvation and remains deterministic bounded immutable", () => {
  const candidates = Array.from({ length: 50 }, (_, i) => catalog(`a${String(i).padStart(2, "0")}`, "Garen"));
  candidates.push(catalog("z-hook6", "Haaknaald 6mm"), catalog("z-needle", "Stopnaald"), catalog("z-tape", "Meetlint"), catalog("z-scissors", "Schaar"));
  const input = materials(black, tools);
  const before = plain(candidates);
  const selected = plain(api.prefilterMaterialCatalog(input, candidates));
  assert.equal(selected.length, 40);
  for (const id of ["z-hook6", "z-needle", "z-tape", "z-scissors"]) assert.ok(selected.some(c => c.id === id), id);
  assert.deepEqual(plain(api.prefilterMaterialCatalog([...input].reverse(), [...candidates].reverse())), selected);
  assert.deepEqual(candidates, before);
  const products = candidates.map(c => product(c, [variant(c.id, c.title === "Garen" ? "Black 100g" : "Default")]));
  assert.deepEqual(offerIds(run([black, tools], candidates, products)), ["a00", "a01", "z-hook6", "z-needle", "z-tape", "z-scissors"]);
});

test("candidate contradictions across size, thickness, composition and color are filtered but missing proof survives discovery", () => {
  const candidates = [catalog("generic", "Garen"), catalog("good", "60% katoen 40% acryl middelzwaar garen zwart 100g"), catalog("wrong-color", "Garen wit 100g"), catalog("wrong-weight", "Garen zwart 50g"), catalog("wrong-thickness", "Dun garen zwart 100g"), catalog("wrong-composition", "100% katoen garen zwart 100g"), catalog("wrong-size", "Haaknaald 5mm")];
  const selected = plain(api.prefilterMaterialCatalog(materials("60% katoen 40% acryl middelzwaar garen zwart 100g", "Haaknaald 6mm"), candidates));
  assert.deepEqual(selected.map(c => c.id), ["generic", "good"]);
});

test("EUR 10.075 rounds to 1008 cents using decimal half-up rather than binary underflow", () => {
  const c = catalog("yarn", "Garen zwart 100g");
  for (const [value, amount] of [[10.075, 1008], [1.005, 101], [1.255, 126], [10.074, 1007], [0, 0]]) {
    assert.deepEqual(run([black], [c], [product(c, [variant("v", "Default", { calculated_price: { calculated_amount: value, currency_code: "EUR" } })])])[0].offers[0].price, { amount, currency_code: "eur" });
  }
});

test("exactly 256 variants are supported; 257 fails closed without hidden default inheritance", () => {
  const c = catalog("yarn", "Garen");
  const variants = [variant("black", "Black 100g"), ...Array.from({ length: 255 }, (_, i) => variant(`wrong${i}`, "White 100g"))];
  assert.deepEqual(offerIds(run([black], [c], [product(c, variants)])), ["black"]);
  assert.deepEqual(offerIds(run([black], [c], [product(c, [...variants, variant("extra", "White 100g")])])), []);
});

test("multi-variant title composition conflicts cannot disappear when proof stays variant-local", () => {
  const c = catalog("yarn", "Garen");
  const p = product(c, [variant("cotton", "Black 100g Cotton"), variant("other", "White 100g")], { title: "60% cotton 40% acrylic garen" });
  assert.deepEqual(offerIds(run(["Katoen garen zwart 100g"], [c], [p])), []);
  // Generic source composition is unconstrained; known explicit blends remain
  // usable, while an explicit cotton-only requirement cannot ignore acrylic.
  assert.deepEqual(offerIds(run([black], [c], [p])), ["cotton"]);
});

test("signed and leading-fraction composition percentages are not positive suffix evidence", () => {
  const c = catalog("yarn", "Garen");
  const p = product(c, [variant("cotton", "Black 100g Cotton")]);
  for (const percent of ["-60%", ".60%", ",60%", "+60%", "40-60%", "0%"])
    assert.deepEqual(offerIds(run([`${percent} katoen garen zwart 100g`], [c], [p])), [], percent);
});

test("known postfix composition percentages remain exact and their total must not exceed 100", () => {
  const c = catalog("yarn", "Garen");
  assert.deepEqual(offerIds(run(["60% katoen 40% acryl garen zwart 100g"], [c], [product(c, [variant("blend", "Black 100g Cotton 60%, Acrylic 40%")])])), ["blend"]);
  assert.deepEqual(offerIds(run([black], [c], [product(c, [variant("bad", "Black 100g Cotton 60%, Acrylic 60%")])])), []);
});
