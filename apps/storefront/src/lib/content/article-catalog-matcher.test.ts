import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript runner requires the explicit extension.
import { matchArticleCatalog } from "./article-catalog-matcher.ts";
// @ts-expect-error Node's TypeScript runner requires the explicit extension.
import type { ArticleMatchInput, CatalogCandidate } from "./article-catalog-matcher.ts";

const article = (overrides: Partial<ArticleMatchInput> = {}): ArticleMatchInput => ({
  title: "Een mandje haken", domainId: "textiel", materialTitles: [], ...overrides,
});
const candidate = (overrides: Partial<CatalogCandidate> = {}): CatalogCandidate => ({
  targetType: "product", targetId: "p", title: "Haakgaren", domainIds: ["textiel"],
  productType: "supply", ...overrides,
});
const ids = (matches: ReturnType<typeof matchArticleCatalog>) =>
  matches.map(({ candidate: c }) => `${c.targetType}:${c.targetId}`);

// These tests intentionally import the public API directly: no fallback module or fake results.
test("domain alone and generic how-to/shop/beginner/material words never qualify", () => {
  assert.deepEqual(matchArticleCatalog(article({ title: "Hoe maak je iets voor beginners", excerpt: "Shop materialen en benodigdheden" }), [
    candidate({ title: "Materialen voor beginners", description: "Hoe maak je iets in onze shop" }),
    candidate({ targetType: "workshop", title: "Schilderen", productType: null }),
  ]), []);
});

test("folds accents and conservative Dutch crochet, knitting and material synonyms", () => {
  for (const [title, product] of [
    ["Macramé knopen", "MACRAME koord"], ["Haken", "Haaknaald"],
    ["Breien", "Brei wol"], ["Katoenen garens", "Cotton garen"], ["Wollen sjaal", "Wol"],
  ]) {
    assert.equal(matchArticleCatalog(article({ title }), [candidate({ title: product })]).length, 1);
  }
  assert.equal(matchArticleCatalog(article({ title: "Haken" }), [candidate({ title: "Schaakbord" })]).length, 0);
});

test("matches workshop and event topics from title/excerpt without requiring a domain", () => {
  const result = matchArticleCatalog(article({ title: "Creatief aan de slag", excerpt: "Leer een mandje haken", domainId: null }), [
    candidate({ targetType: "workshop", title: "Workshop haak", domainIds: [] }),
    candidate({ targetType: "event", title: "Haak festival", domainIds: [] }),
  ]);
  assert.equal(result.length, 2);
  assert.ok(result.every(m => m.proposedRelation === "related" && m.compatibility === "unknown"));
  assert.ok(result.every(m => m.evidence.some(e => e.includes("excerpt"))));
});

test("material lists and body material sections never supply workshop/event topic evidence", () => {
  assert.deepEqual(matchArticleCatalog(article({
    title: "Aquarel schilderen", materialTitles: ["Katoenen garen"],
    bodyMarkdown: "## Materialen\n- Haaknaald 6 mm\n- Breiwol\n## Stappen\nVolg de illustraties.",
  }), [
    candidate({ targetType: "workshop", title: "Haken met katoen" }),
    candidate({ targetType: "event", title: "Breien met wol" }),
  ]), []);
});

test("title/excerpt topics outrank body-only product topics", () => {
  const result = matchArticleCatalog(article({ title: "Mandje haken", bodyMarkdown: "Maak een borduurmotief." }), [
    candidate({ targetId: "body", title: "Borduurmotief", productType: "handmade" }),
    candidate({ targetId: "primary", title: "Gehaakt mandje", productType: "handmade" }),
  ]);
  assert.deepEqual(ids(result), ["product:primary", "product:body"]);
  assert.ok(result[0].score > result[1].score);
});

test("supply and destash can have textual recommendation compatibility from original material lines", () => {
  for (const productType of ["supply", "destash"]) {
    const [match] = matchArticleCatalog(article({ title: "Zomerproject", materialTitles: ["2 bollen 100% katoen garen (50 g)"] }), [
      candidate({ title: "Cotton garens 100%", productType }),
    ]);
    assert.equal(match.compatibility, "textual");
    assert.equal(match.proposedRelation, "related_product");
    assert.ok(match.evidence.some(e => e.includes("2 bollen 100% katoen garen (50 g)")));
    assert.ok(match.evidence.some(e => /aanbeveling/i.test(e)));
  }
});

test("extracts material requirements from Markdown sections, not arbitrary prose", () => {
  const [match] = matchArticleCatalog(article({ title: "Zomerproject", bodyMarkdown:
    "## Benodigdheden\n- 100% katoenen garen\n## Werkwijze\nKies een kleur." }), [candidate({ title: "100% cotton garen" })]);
  assert.equal(match.compatibility, "textual");
  assert.ok(match.evidence.some(e => e.includes("100% katoenen garen")));
  const [prose] = matchArticleCatalog(article({ title: "Zomerproject", bodyMarkdown: "Wij gebruiken katoenen garen." }), [candidate({ title: "Cotton garen" })]);
  assert.equal(prose.compatibility, "unknown");
});

test("handmade finished goods stay related with unknown compatibility", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["Katoenen garen"] }), [
    candidate({ title: "Gehaakt mandje van katoen", productType: "handmade" }),
  ]);
  assert.equal(match.proposedRelation, "related_product");
  assert.equal(match.compatibility, "unknown");
});

test("tickets, kits and event listings cannot gain material compatibility", () => {
  for (const productType of ["event_listing", "event_ticket", "workshop_ticket", "workshop_kit"]) {
    const [match] = matchArticleCatalog(article({ materialTitles: ["Katoenen garen"] }), [
      candidate({ title: "Mandje haken met katoen", productType }),
    ]);
    assert.equal(match.compatibility, "unknown");
    assert.deepEqual(matchArticleCatalog(article({ title: "Zomerproject", materialTitles: ["Katoenen garen"] }), [
      candidate({ title: "Katoenen garen", productType }),
    ]), []);
  }
});

test("unknown product kind or unknown material cannot imply compatibility", () => {
  for (const productType of [undefined, null, "unclassified"]) {
    const [match] = matchArticleCatalog(article({ materialTitles: ["Katoenen garen"] }), [
      candidate({ title: "Mandje haken met katoen", productType }),
    ]);
    assert.equal(match.compatibility, "unknown");
  }
  const [unknownMaterial] = matchArticleCatalog(article({ materialTitles: ["Garen"] }), [candidate({ title: "Garen om te haken" })]);
  assert.equal(unknownMaterial.compatibility, "unknown");
});

test("clearly conflicting yarn composition is rejected even with the same article topic", () => {
  assert.deepEqual(matchArticleCatalog(article({ materialTitles: ["100% katoenen garen"] }), [
    candidate({ title: "Wollen haakgaren", description: "100% wol voor mandjes haken" }),
    candidate({ targetId: "acryl", title: "Acryl garen om te haken", description: "100% acryl" }),
  ]), []);
});

test("explicit composition percentages must not silently accept an incompatible blend", () => {
  assert.deepEqual(matchArticleCatalog(article({ materialTitles: ["100% katoen garen"] }), [
    candidate({ title: "Haakgaren 50% katoen 50% acryl" }),
  ]), []);
  const [blend] = matchArticleCatalog(article({ materialTitles: ["50% katoen / 50% acryl garen"] }), [
    candidate({ title: "Haakgaren 50% cotton 50% acryl" }),
  ]);
  assert.equal(blend.compatibility, "textual");
});

test("exact explicit tool size qualifies but 6 mm versus 4 mm is rejected without topic fallback", () => {
  const result = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm"] }), [
    candidate({ targetId: "wrong", title: "Haaknaald 4 mm voor mandjes haken" }),
    candidate({ targetId: "right", title: "Haaknaald 6 mm" }),
  ]);
  assert.deepEqual(ids(result), ["product:right"]);
  assert.equal(result[0].compatibility, "textual");
  assert.ok(result[0].evidence.some(e => e.includes("Haaknaald 6 mm")));
});

test("decimal commas and dots preserve 6,5 mm requirements and reject near sizes", () => {
  const result = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6,5 mm"] }), [
    candidate({ targetId: "right", title: "Haaknaald 6.5 mm" }),
    candidate({ targetId: "wrong", title: "Haaknaald 6 mm" }),
  ]);
  assert.deepEqual(ids(result), ["product:right"]);
  assert.equal(result[0].compatibility, "textual");
  assert.ok(result[0].evidence.some(e => e.includes("Haaknaald 6,5 mm")));
});

test("unspecified tool size remains unknown, never textual compatibility", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm"] }), [candidate({ title: "Haaknaald" })]);
  assert.equal(match.compatibility, "unknown");
});

test("other requirements' millimetres do not contaminate a cotton yarn match", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm", "100% katoen garen", "Knoop 4 mm"] }), [
    candidate({ title: "100% cotton garen", description: "Voor naalden 4 mm" }),
  ]);
  assert.equal(match.compatibility, "textual");
  assert.ok(match.evidence.some(e => e.includes("100% katoen garen")));
  assert.ok(match.evidence.every(e => !e.includes("Haaknaald 6 mm") && !e.includes("Knoop 4 mm")));
});

test("mixed requirement lines bind each explicit mm size to its own tool", () => {
  const result = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm en breinaald 4 mm"] }), [
    candidate({ targetId: "right", title: "Haaknaald 6 mm" }),
    candidate({ targetId: "wrong", title: "Haaknaald 4 mm" }),
  ]);
  assert.deepEqual(ids(result), ["product:right"]);
});

test("an independent requirement can qualify without unrelated composition contradictions", () => {
  const result = matchArticleCatalog(article({ materialTitles: ["Katoenen garen", "Wollen vilt"] }), [
    candidate({ title: "Cotton garen" }),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].compatibility, "textual");
});

test("separate product/workshop/event budgets yield at most 3/2/1, not global saturation", () => {
  const candidates = [
    ...Array.from({ length: 8 }, (_, i) => candidate({ targetId: `p${i}`, title: "Mandje haken", description: "Haak mandje" })),
    ...Array.from({ length: 4 }, (_, i) => candidate({ targetType: "workshop", targetId: `w${i}`, title: "Haken" })),
    ...Array.from({ length: 3 }, (_, i) => candidate({ targetType: "event", targetId: `e${i}`, title: "Haken" })),
  ];
  const result = matchArticleCatalog(article(), candidates);
  assert.equal(result.length, 6);
  assert.equal(result.filter(m => m.candidate.targetType === "product").length, 3);
  assert.equal(result.filter(m => m.candidate.targetType === "workshop").length, 2);
  assert.equal(result.filter(m => m.candidate.targetType === "event").length, 1);
});

test("existing-key suppression precedes budgets and respects target type", () => {
  const candidates = ["a", "b", "c", "d"].map(targetId => candidate({ targetId, title: "Haken" }));
  candidates.push(candidate({ targetType: "workshop", targetId: "a", title: "Haken" }));
  const existing = new Set(["product:a"]);
  const result = matchArticleCatalog(article(), candidates, existing);
  assert.deepEqual(ids(result).filter(k => k.startsWith("product:")), ["product:b", "product:c", "product:d"]);
  assert.ok(ids(result).includes("workshop:a"));
  assert.deepEqual([...existing], ["product:a"]);
});

test("deduplicates keys with deterministic score/type/id ordering independent of input order", () => {
  const candidates = [
    candidate({ targetType: "workshop", targetId: "z", title: "Haken" }),
    candidate({ targetType: "event", targetId: "z", title: "Haken" }),
    candidate({ targetId: "b", title: "Haken" }),
    candidate({ targetId: "a", title: "Haken" }),
    candidate({ targetId: "a", title: "Onverwant" }),
  ];
  const forward = matchArticleCatalog(article(), candidates);
  assert.deepEqual(forward, matchArticleCatalog(article(), [...candidates].reverse()));
  assert.deepEqual(ids(forward), ["event:z", "product:a", "product:b", "workshop:z"]);
  assert.equal(new Set(ids(forward)).size, forward.length);
});

test("duplicate candidates select the strongest deterministic record even on equal-score ties", () => {
  const candidates = [
    candidate({ title: "Haken", description: "Z" }),
    candidate({ title: "Haken", description: "A" }),
    candidate({ title: "Mandje haken", description: "B" }),
  ];
  const result = matchArticleCatalog(article(), candidates);
  assert.equal(result.length, 1);
  assert.equal(result[0].candidate.title, "Mandje haken");
  assert.deepEqual(result, matchArticleCatalog(article(), [...candidates].reverse()));
  const tied = candidates.slice(0, 2);
  assert.deepEqual(matchArticleCatalog(article(), tied), matchArticleCatalog(article(), tied.reverse()));
  const sameContent = [
    candidate({ title: "Haken", description: null, domainIds: ["textiel", "extra"] }),
    candidate({ title: "Haken", description: undefined, domainIds: ["extra", "textiel"] }),
  ];
  assert.deepEqual(matchArticleCatalog(article(), sameContent), matchArticleCatalog(article(), [...sameContent].reverse()));
});

test("domain boosts an already meaningful match but never author/merchant identity", () => {
  const input = { ...article(), authorId: "same" };
  const candidates = [
    { ...candidate({ targetId: "different", title: "Haken", domainIds: [] }), merchantId: "same" },
    { ...candidate({ targetId: "domain", title: "Haken" }), merchantId: "other" },
    { ...candidate({ targetId: "identity-only", title: "Schilderij", domainIds: [] }), merchantId: "same" },
  ];
  const result = matchArticleCatalog(input, candidates);
  assert.deepEqual(ids(result), ["product:domain", "product:different"]);
  assert.ok(result[0].score > result[1].score);
  assert.ok(result.every(m => m.evidence.every(e => !/author|merchant|auteur|verkoper/.test(e))));
});

test("composition-only supplies cannot bypass contradictions and multi-tool sizes stay bound", () => {
  assert.deepEqual(matchArticleCatalog(article({ materialTitles: ["100% katoen garen"] }), [
    candidate({ title: "100% wol om te haken" }),
  ]), []);
  const [cotton] = matchArticleCatalog(article({ title: "Zomerproject", materialTitles: ["100% katoen garen"] }), [
    candidate({ title: "100% cotton" }),
  ]);
  assert.equal(cotton.compatibility, "textual");
  const result = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm / breinaald 4 mm"] }), [
    candidate({ targetId: "wrong", title: "Haaknaald 4 mm" }),
    candidate({ targetId: "right", title: "Haaknaald 6 mm / breinaald 4 mm" }),
  ]);
  assert.deepEqual(ids(result), ["product:right"]);
  assert.equal(result[0].compatibility, "textual");
});

test("is pure with deeply frozen inputs and returns finite deterministic evidence and scores", () => {
  const input = Object.freeze({ ...article({ excerpt: null, bodyMarkdown: null }), materialTitles: Object.freeze([]) });
  const c = Object.freeze({ ...candidate({ title: "Haken", description: null }), domainIds: Object.freeze(["textiel"]) });
  // Readonly freezes exercise runtime purity without changing the requested mutable-array API.
  const candidates = Object.freeze([c]);
  const result = matchArticleCatalog(input as unknown as ArticleMatchInput, candidates as unknown as CatalogCandidate[]);
  assert.equal(result.length, 1);
  assert.ok(Number.isFinite(result[0].score) && result[0].score > 0);
  assert.ok(result[0].evidence.length > 0);
  assert.deepEqual(result, matchArticleCatalog(input as unknown as ArticleMatchInput, candidates as unknown as CatalogCandidate[]));
  assert.deepEqual(matchArticleCatalog(article({ title: "", domainId: null }), []), []);
});

// Focused regressions from matcher-review.md; textual remains a pending recommendation.
test("cotton in an accessory cannot rescue explicitly woollen yarn", () => {
  assert.deepEqual(matchArticleCatalog(article({ materialTitles: ["Katoenen garen"] }), [
    candidate({ title: "Wollen haakgaren", description: "100% wol garen met een katoenen opbergtas" }),
  ]), []);
});

test("an independent woollen felt component cannot contradict cotton yarn", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["100% katoen garen"] }), [
    candidate({ title: "100% katoen haakgaren", description: "Met 100% wollen vilt" }),
  ]);
  assert.equal(match?.compatibility, "textual");
  assert.equal(match.proposedRelation, "related_product");
  assert.ok(match.evidence.some(e => e.includes("niet geverifieerd en geen vereist materiaal")));
});

test("accessory percentages cannot overwrite the actual yarn percentage", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["100% katoen garen"] }), [
    candidate({ title: "100% katoen haakgaren", description: "Met een tas van 50% katoen" }),
  ]);
  assert.equal(match?.compatibility, "textual");
});

test("a matching accessory percentage cannot rescue a contradictory yarn percentage", () => {
  assert.deepEqual(matchArticleCatalog(article({ materialTitles: ["100% katoen garen"] }), [
    candidate({ title: "50% katoen haakgaren", description: "Met een tas van 100% katoen" }),
  ]), []);
});

test("composition mentioned only for an accessory leaves yarn compatibility unknown", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["Katoenen garen"] }), [
    candidate({ title: "Haakgaren", description: "Met een katoenen opbergtas" }),
  ]);
  assert.equal(match?.compatibility, "unknown");
});

test("an ambiguous composition across multiple material kinds remains unknown", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["Katoenen garen"] }), [
    candidate({ title: "Haakgaren", description: "Katoenen garen met wollen vilt" }),
  ]);
  assert.equal(match?.compatibility, "textual");
  const [ambiguous] = matchArticleCatalog(article({ materialTitles: ["Katoenen garen"] }), [
    candidate({ title: "Haakgaren", description: "Katoen voor garen of vilt" }),
  ]);
  assert.equal(ambiguous?.compatibility, "unknown");
});

test("matching handle millimetres cannot rescue an explicitly wrong needle size", () => {
  assert.deepEqual(matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm"] }), [
    candidate({ title: "Haaknaald 4 mm met handvat 6 mm" }),
  ]), []);
});

test("handle-only millimetres never establish needle size compatibility", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm"] }), [
    candidate({ title: "Haaknaald met handvat 6 mm" }),
  ]);
  assert.equal(match?.compatibility, "unknown");
});

test("a separate explicit Naalddikte label binds to the single needle, not its handle", () => {
  for (const [required, label] of [["6", "6"], ["6,5", "6.5"]]) {
    const [match] = matchArticleCatalog(article({ materialTitles: [`Haaknaald ${required} mm`] }), [
      candidate({ title: "Haaknaald met handvat 10 mm", description: `Naalddikte: ${label} mm` }),
    ]);
    assert.equal(match?.compatibility, "textual");
  }
});

test("a contradictory separate Naalddikte label vetoes topic fallback", () => {
  assert.deepEqual(matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm"] }), [
    candidate({ title: "Haaknaald", description: "Naalddikte: 4 mm" }),
  ]), []);
});

test("an unbound Naalddikte label in a multi-tool listing remains unknown", () => {
  const [match] = matchArticleCatalog(article({ materialTitles: ["Haaknaald 6 mm"] }), [
    candidate({ title: "Haaknaald met handvat 10 mm en breinaald", description: "Naalddikte: 6 mm" }),
  ]);
  assert.equal(match?.compatibility, "unknown");
});

test("generic inspiration alone cannot qualify any target but concrete hobby topics still can", () => {
  for (const targetType of ["product", "workshop", "event"] as const) {
    assert.deepEqual(matchArticleCatalog(article({ title: "Inspiratie voor beginners" }), [
      candidate({ targetType, title: "Workshop inspiratie voor beginners" }),
    ]), []);
    assert.deepEqual(matchArticleCatalog(article({ title: "", excerpt: "Inspiratie", bodyMarkdown: "Inspiratie" }), [
      candidate({ targetType, title: "Inspiratie" }),
    ]), []);
    const [match] = matchArticleCatalog(article({ title: "Inspiratie voor haken" }), [
      candidate({ targetType, title: "Inspiratie voor haken" }),
    ]);
    assert.equal(match?.compatibility, "unknown");
    assert.equal(match.proposedRelation, targetType === "product" ? "related_product" : "related");
  }
});
