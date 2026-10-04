/**
 * Read-only, deliberately conservative runtime offers. This is not a graph link,
 * purchase-quantity calculation, or a claim of compatibility with the pattern.
 * Only a small understood source grammar is supported: unknown constraints do
 * not become optional, and evidence is never pooled across commerce variants.
 */
export type MaterialCatalogCandidate = {
  id: string;
  slug: string;
  title: string;
  product_type: string;
  is_active: boolean;
  status: string;
  medusa_product_id: string | null;
};

export type MaterialCommerceProduct = {
  id: string;
  title: string;
  variants?: Array<{
    id: string;
    title: string;
    options?: Array<{ value: string; option?: { title: string } }>;
    calculated_price?: { calculated_amount: number; currency_code: string };
    metadata?: Record<string, unknown>;
  }>;
};

export type ArticleMaterialOffer = {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  requirementLabel: string;
  href: string;
  price: { amount: number; currency_code: string } | null;
};

export type SourceMaterialWithOffers = {
  key: string;
  title: string;
  offers: ArticleMaterialOffer[];
};

type SourceMaterial = { key: string; title: string };
type Family = "yarn" | "hook" | "needle" | "tape" | "scissors";
type Variant = NonNullable<MaterialCommerceProduct["variants"]>[number];
type Attributes = {
  colors: Set<string>;
  grams: Set<number>;
  mm: Set<number>;
  thickness: Set<string>;
  composition: Map<string, number | null>;
  invalid: boolean;
};
type Requirement = { family: Family; label: string; attributes: Attributes };

// These literals alone may enter a database OR/ILIKE filter. Never return source
// strings (including otherwise harmless author punctuation) as search terms.
const FAMILIES: Array<{ family: Family; words: string[]; terms: string[] }> = [
  { family: "yarn", words: ["accentgaren", "garen", "yarn", "wol", "wool"], terms: ["garen", "yarn", "wol"] },
  { family: "hook", words: ["haaknaald", "crochet hook"], terms: ["haaknaald", "crochet hook"] },
  { family: "needle", words: ["stopnaald", "darning needle", "tapestry needle"], terms: ["stopnaald", "darning needle", "tapestry needle"] },
  { family: "tape", words: ["meetlint", "measuring tape", "tape measure"], terms: ["meetlint", "measuring tape", "tape measure"] },
  { family: "scissors", words: ["schaar", "scissors"], terms: ["schaar", "scissors"] },
];
const COLORS: Array<[string, string[]]> = [
  ["black", ["zwart", "zwarte", "black"]],
  ["white", ["wit", "witte", "white"]],
  ["red", ["rood", "rode", "red"]],
  ["hazelnut", ["hazelnootkleurig", "hazelnootkleurige", "hazelnoot", "hazelnut"]],
  ["brown", ["bruin", "bruine", "brown"]],
  ["blue", ["blauw", "blauwe", "blue"]],
  ["green", ["groen", "groene", "green"]],
  ["yellow", ["geel", "gele", "yellow"]],
  ["pink", ["roze", "pink"]],
  ["purple", ["paars", "paarse", "purple"]],
  ["orange", ["oranje", "orange"]],
  ["grey", ["grijs", "grijze", "grey", "gray"]],
  ["beige", ["beige"]],
];
// Translations only, not inferred gauge/category equivalences (e.g. DK ≠ aran).
const THICKNESS: Array<[string, string[]]> = [
  ["medium", ["middelzwaar", "middelzware", "medium"]],
  ["thin", ["dun", "dunne", "thin"]],
  ["thick", ["dik", "dikke", "thick"]],
  ["dk", ["dk"]], ["worsted", ["worsted"]], ["aran", ["aran"]],
  ["bulky", ["bulky"]], ["chunky", ["chunky"]],
];
const COMPOSITION: Array<[string, string[]]> = [
  ["cotton", ["katoen", "cotton"]], ["acrylic", ["acryl", "acrylic"]],
  ["wool", ["wol", "wool"]], ["polyester", ["polyester"]],
  ["alpaca", ["alpaca"]], ["merino", ["merino"]], ["mohair", ["mohair"]],
  ["silk", ["zijde", "silk"]], ["bamboo", ["bamboe", "bamboo"]],
  ["linen", ["linnen", "linen"]],
];
const NEGATIVE_OR_AMBIGUOUS = /\b(?:geen|niet|zonder|not|no|without|non|behalve|unless|tenzij|of|or|either|alternatief|alternatieve|alternative|alternatives|set|sets|bundle|bundel|kit|pakket|assortiment|multicolor|multicolour|veelkleurig|geschikt|suitable|compatible|compatibel|vervanging|replacement)\b|[\/\\]|\b(?:voor|for)\b/;
const NOT_A_SUPPLY = /\b(?:patroon|patronen|pattern|patterns|haakpatroon|breipatroon|pdf|digitaal|digital|download|boek|book|workshop|cursus|course|trui|sweater|vest|cardigan|muts|hat|sjaal|scarf|knuffel|amigurumi|afgewerkt|finished|houder|holder|haaknaaldhouder|garenhouder|schaarlift|krik|jack|lift|sticker|print|hardware)\b/;
// A number must begin here, not at the suffix of a sign, decimal or range.
const GRAMS = /(?<![\w.,+\-])(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram|grams)\b/g;
const MILLIMETRES = /(?<![\w.,+\-])(\d+(?:[.,]\d+)?)\s*(?:mm|millimeter|millimetre|millimeters|millimetres)\b/g;

function normalized(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function wordPattern(word: string): RegExp {
  // All dictionary words are internal lowercase letters/spaces, not user regex.
  return new RegExp(`\\b${word}\\b`, "g");
}
function hasWord(text: string, word: string): boolean {
  return wordPattern(word).test(text);
}
function families(text: string): Family[] {
  return FAMILIES.filter(entry => entry.words.some(word => hasWord(text, word))).map(entry => entry.family);
}
function safeEvidence(text: string): boolean {
  return !NEGATIVE_OR_AMBIGUOUS.test(text) && !NOT_A_SUPPLY.test(text);
}
function attributes(text: string): Attributes {
  const result: Attributes = { colors: new Set(), grams: new Set(), mm: new Set(), thickness: new Set(), composition: new Map(), invalid: false };
  for (const [canonical, words] of COLORS) if (words.some(word => hasWord(text, word))) result.colors.add(canonical);
  for (const [canonical, words] of THICKNESS) if (words.some(word => hasWord(text, word))) result.thickness.add(canonical);
  for (const [regex, values] of [[GRAMS, result.grams], [MILLIMETRES, result.mm]] as const) {
    for (const match of text.matchAll(regex)) {
      const value = Number(match[1].replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) result.invalid = true;
      values.add(value);
    }
  }
  for (const [canonical, words] of COMPOSITION) {
    for (const word of words) {
      if (!hasWord(text, word)) continue;
      const prefix = new RegExp(`(?<![\\w.,+\\-])(\\d+(?:[.,]\\d+)?)\\s*%\\s*${word}\\b`, "g");
      // Postfix percentages require a separator/end, so "60% cotton 40%
      // acrylic" cannot attach the acrylic percentage to cotton as well.
      const suffix = new RegExp(`\\b${word}\\s+(\\d+(?:[.,]\\d+)?)\\s*%(?=\\s*(?:[,;)]|$))`, "g");
      const percentages = [...text.matchAll(prefix), ...text.matchAll(suffix)].map(match => Number(match[1].replace(",", ".")));
      const percent = percentages[0] ?? null;
      if (percent !== null && (percent <= 0 || percent > 100 || percentages.some(value => value !== percent))) result.invalid = true;
      if (result.composition.has(canonical) && result.composition.get(canonical) !== percent) result.invalid = true;
      result.composition.set(canonical, percent);
    }
  }
  if (result.colors.size > 1 || result.grams.size > 1 || result.mm.size > 1 || result.thickness.size > 1) result.invalid = true;
  if ([...result.composition.values()].reduce<number>((sum, value) => sum + (value ?? 0), 0) > 100) result.invalid = true;
  return result;
}
function removeDictionary(text: string, entries: Array<[string, string[]]>): string {
  for (const [, words] of entries) for (const word of words) text = text.replace(wordPattern(word), " ");
  return text;
}
function understoodSource(text: string): boolean {
  let rest = text.replace(GRAMS, " ").replace(MILLIMETRES, " ");
  // Percentages are understood only when attached to a known composition.
  for (const [, words] of COMPOSITION) for (const word of words) rest = rest.replace(new RegExp(`(?<![\\w.,+\\-])\\d+(?:[.,]\\d+)?\\s*%\\s*${word}\\b`, "g"), " ");
  rest = removeDictionary(removeDictionary(removeDictionary(rest, COLORS), THICKNESS), COMPOSITION);
  for (const entry of FAMILIES) for (const word of entry.words) rest = rest.replace(wordPattern(word), " ");
  // Quantities concern the original list, not cart quantities. Only known unit
  // prefixes can be stripped; arbitrary numbers, yarn lengths or brands cannot.
  rest = rest.replace(/(?:^|:)\s*(?:\d+\s*[x×]\s*|\d+\s+(?=bollen?\b|bolletjes?\b|stuks?\b))/g, " ");
  rest = rest.replace(/\b(?:een|twee|drie|grote|bol|bollen|bolletje|bolletjes|stuk|stuks|van|per|kleur|en)\b/g, " ");
  // Signs/range separators are not punctuation filler, even before whitespace.
  // The materials parser already removed the ordinary source-list bullet.
  return !rest.replace(/[\s:,.()]/g, "");
}

// Two verbatim historical annotations, not a generic prose truncation rule.
// The figures in the annotations are consumption, never purchased ball weight.
const HISTORICAL_SOURCES = [
  {
    source: "Rood middelzwaar garen: één grote bol van 454 g voor maat M, geraamd op € 16,95. Omdat 445 g dicht bij een volle bol ligt, kan een extra rode bol verstandig zijn als je een langere trui wilt; die reserve zit niet in het basistotaal.",
    label: "Rood middelzwaar garen: één grote bol van 454 g",
  },
  {
    source: "Wit middelzwaar garen: één grote bol van 454 g, geraamd op € 16,95. Je koopt dus veel meer dan de opgegeven circa 110 g voor maat M; het overschot blijft voor een ander project.",
    label: "Wit middelzwaar garen: één grote bol van 454 g",
  },
];

function requirements(title: string): Requirement[] {
  if (typeof title !== "string" || title.length > 4000) return [];
  // This exact source postscript describes already-owned tools, not a negative
  // material attribute. No general negation-stripping heuristic is allowed.
  const historical = HISTORICAL_SOURCES.find(entry => normalized(entry.source) === normalized(title));
  const source = (historical?.label ?? title).replace(/\.\s*Wie deze al heeft, hoeft ze niet opnieuw te kopen\.\s*$/i, ".").replace(/;\s*$/, "");
  const segments = source.split(";");
  const result: Requirement[] = [];
  for (const raw of segments) {
    const segment = raw.trim();
    // A fully recognized, separate consumption annotation cannot replace the
    // purchased ball weight. Unknown prose/constraints invalidate the line.
    if (/^de bron noemt circa \d+(?:[.,]\d+)?\s*(?:g|gram)\s+gebruik\.?$/i.test(segment) && result.length > 0) continue;
    const label = segment.replace(/(?:[, :]\s*)?(?:geraamd op\s*)?€\s*\d+(?:[.,]\d+)?\.?\s*$/i, "").replace(/[,:.\s]+$/, "").trim();
    if (!label) return [];
    const text = normalized(label).replace(/\b(\d+)\s*(bollen?|bolletjes?|stuks?)\s*(?=\d+(?:[.,]\d+)?\s*(?:g|gr|gram|grams)\b)/g, "$1 $2 ");
    if (!safeEvidence(text)) return [];
    const found = families(text);
    if (found.length !== 1) return [];
    const facts = attributes(text);
    if (facts.invalid || !understoodSource(text)) return [];
    const family = found[0];
    // Generic yarn/hook names alone do not identify a purchasable variant.
    if (family === "yarn" && (facts.colors.size !== 1 || facts.grams.size !== 1 || facts.mm.size)) return [];
    if (family === "hook" && (facts.mm.size !== 1 || facts.grams.size || facts.composition.size)) return [];
    if (family !== "yarn" && family !== "hook" && (facts.colors.size || facts.grams.size || facts.mm.size || facts.thickness.size || facts.composition.size)) return [];
    result.push({ family, label, attributes: facts });
  }
  return result;
}

export function materialCatalogSearchTerms(materials: Array<SourceMaterial>): string[] {
  const needed = new Set(materials.flatMap(material => requirements(material.title).map(requirement => requirement.family)));
  return FAMILIES.filter(entry => needed.has(entry.family)).flatMap(entry => entry.terms).slice(0, 16);
}

function encodedSegment(slug: string): string | null {
  if (typeof slug !== "string" || !slug.trim() || slug !== slug.trim() || slug === "." || slug === ".." || slug.length > 180 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\/\\?#:%]/.test(slug)) return null;
  try { return encodeURIComponent(slug); } catch { return null; }
}
function encodedVariant(id: string): string | null {
  if (typeof id !== "string" || !id.trim() || id !== id.trim() || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id)) return null;
  try { return encodeURIComponent(id); } catch { return null; }
}
function eligible(candidate: MaterialCatalogCandidate): boolean {
  return !!candidate && typeof candidate.id === "string" && !!candidate.id.trim() && typeof candidate.title === "string" && candidate.title.length <= 1000 && candidate.is_active === true && candidate.status === "active" && candidate.product_type === "supply" && typeof candidate.medusa_product_id === "string" && !!candidate.medusa_product_id.trim() && candidate.medusa_product_id === candidate.medusa_product_id.trim() && encodedSegment(candidate.slug) !== null;
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function candidateSignature(candidate: MaterialCatalogCandidate): string {
  return JSON.stringify([candidate.id, candidate.medusa_product_id, candidate.slug, candidate.title, candidate.product_type, candidate.is_active, candidate.status]);
}

export function prefilterMaterialCatalog(materials: Array<SourceMaterial>, candidates: Array<MaterialCatalogCandidate>): MaterialCatalogCandidate[] {
  const needed = materials.flatMap(material => requirements(material.title));
  const unique = new Map<string, MaterialCatalogCandidate>();
  const conflicts = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== "string") continue;
    const previous = unique.get(candidate.id);
    if (previous && candidateSignature(previous) !== candidateSignature(candidate)) conflicts.add(candidate.id);
    else unique.set(candidate.id, candidate);
  }
  const buckets = new Map<Family, MaterialCatalogCandidate[]>();
  for (const candidate of [...unique.values()].sort((a, b) => compare(a.id, b.id))) {
    if (conflicts.has(candidate.id) || !eligible(candidate)) continue;
    const text = normalized(candidate.title);
    const found = families(text);
    if (!safeEvidence(text) || found.length !== 1 || !understoodEvidence(text)) continue;
    const facts = attributes(text);
    if (!validFamilyFacts(found[0], facts) || !needed.some(requirement => requirement.family === found[0] && !contradictsFacts(requirement.attributes, facts))) continue;
    const bucket = buckets.get(found[0]) ?? [];
    bucket.push(candidate);
    buckets.set(found[0], bucket);
  }
  // Discovery titles can disprove a candidate, not prove a missing dimension.
  // Allocate the shared hydration budget fairly, then retain stable offer order.
  const selected: MaterialCatalogCandidate[] = [];
  for (let index = 0; selected.length < 40; index++) {
    let added = false;
    for (const { family } of FAMILIES) {
      const candidate = buckets.get(family)?.[index];
      if (!candidate) continue;
      selected.push(candidate);
      added = true;
      if (selected.length === 40) break;
    }
    if (!added) break;
  }
  return selected.sort((a, b) => compare(a.id, b.id));
}

function mergeFacts(parts: Attributes[]): Attributes {
  const merged: Attributes = { colors: new Set(), grams: new Set(), mm: new Set(), thickness: new Set(), composition: new Map(), invalid: false };
  for (const part of parts) {
    if (part.invalid) merged.invalid = true;
    for (const value of part.colors) merged.colors.add(value);
    for (const value of part.grams) merged.grams.add(value);
    for (const value of part.mm) merged.mm.add(value);
    for (const value of part.thickness) merged.thickness.add(value);
    for (const [key, percent] of part.composition) {
      const previous = merged.composition.get(key);
      if (merged.composition.has(key) && previous !== null && percent !== null && previous !== percent) merged.invalid = true;
      if (!merged.composition.has(key) || percent !== null) merged.composition.set(key, percent);
    }
  }
  if (merged.colors.size > 1 || merged.grams.size > 1 || merged.mm.size > 1 || merged.thickness.size > 1) merged.invalid = true;
  if ([...merged.composition.values()].reduce<number>((sum, value) => sum + (value ?? 0), 0) > 100) merged.invalid = true;
  return merged;
}
function contradictsFacts(required: Attributes, known: Attributes): boolean {
  if (mergeFacts([required, known]).invalid) return true;
  if (required.composition.size) for (const name of known.composition.keys()) if (!required.composition.has(name)) return true;
  return false;
}
function validFamilyFacts(family: Family, facts: Attributes): boolean {
  if (facts.invalid) return false;
  if (family === "yarn") return facts.mm.size === 0;
  if (family === "hook") return facts.grams.size === 0 && facts.thickness.size === 0 && facts.composition.size === 0;
  return facts.colors.size === 0 && facts.grams.size === 0 && facts.mm.size === 0 && facts.thickness.size === 0 && facts.composition.size === 0;
}
function includesFacts(required: Attributes, evidence: Attributes): boolean {
  if (evidence.invalid) return false;
  for (const [wanted, actual] of [[required.colors, evidence.colors], [required.grams, evidence.grams], [required.mm, evidence.mm], [required.thickness, evidence.thickness]] as const) {
    for (const value of wanted) if (!(actual as Set<string | number>).has(value)) return false;
  }
  if (required.composition.size) {
    if (required.composition.size !== evidence.composition.size) return false;
    for (const [name, percent] of required.composition) {
      if (!evidence.composition.has(name) || (percent !== null && evidence.composition.get(name) !== percent)) return false;
    }
  }
  return true;
}

type Dimension = "colors" | "grams" | "mm" | "thickness" | "composition";
function removeComposition(text: string): string {
  for (const [, words] of COMPOSITION) for (const word of words) {
    text = text.replace(new RegExp(`(?<![\\w.,+\\-])\\d+(?:[.,]\\d+)?\\s*%\\s*${word}\\b`, "g"), " ");
    text = text.replace(new RegExp(`\\b${word}\\s+\\d+(?:[.,]\\d+)?\\s*%(?=\\s*(?:[,;)]|$))`, "g"), " ");
  }
  return removeDictionary(text, COMPOSITION);
}
function understoodEvidence(text: string, dimension?: Dimension): boolean {
  let rest = text;
  if (!dimension || dimension === "grams") rest = rest.replace(GRAMS, " ");
  if (!dimension || dimension === "mm") rest = rest.replace(MILLIMETRES, " ");
  if (!dimension || dimension === "composition") rest = removeComposition(rest);
  if (!dimension || dimension === "colors") rest = removeDictionary(rest, COLORS);
  if (!dimension || dimension === "thickness") rest = removeDictionary(rest, THICKNESS);
  if (!dimension) {
    for (const entry of FAMILIES) for (const word of entry.words) rest = rest.replace(wordPattern(word), " ");
    rest = rest.replace(/\b(?:default|variant)\b/g, " ");
  }
  // Hyphens/signs are intentionally not filler. Unknown modifiers (off white,
  // Red Heart, recycled cotton, accessories) must not become positive substrings.
  return !rest.replace(/[\s:,().]/g, "");
}

// Unrelated options and metadata never prove identity. Relevant options must be
// wholly understood within their own dimension; unknown values block inheritance.
function variantEvidence(variant: Variant): Attributes | null {
  if (!variant || typeof variant.title !== "string" || variant.title.length > 1000 || encodedVariant(variant.id) === null) return null;
  const title = normalized(variant.title);
  if (!safeEvidence(title) || !understoodEvidence(title)) return null;
  const parts = [attributes(title)];
  if (variant.options !== undefined && !Array.isArray(variant.options)) return null;
  for (const option of variant.options ?? []) {
    if (!option || typeof option.value !== "string" || option.value.length > 1000) return null;
    const label = typeof option.option?.title === "string" ? normalized(option.option.title) : "";
    let dimension: Dimension;
    let value = normalized(option.value);
    if (/^(?:color|colour|kleur)$/.test(label)) dimension = "colors";
    else if (/^(?:weight|gewicht|bolgewicht)(?:\s*\(\s*(?:g|gr|gram|grams)\s*\))?$/.test(label)) dimension = "grams";
    else if (/^(?:size|maat)(?:\s*\(\s*mm\s*\))?$/.test(label)) dimension = "mm";
    else if (/^(?:composition|samenstelling|material|materiaal)$/.test(label)) dimension = "composition";
    else if (/^(?:thickness|dikte)$/.test(label)) dimension = "thickness";
    else {
      if (/^(?:color|colour|kleur|weight|gewicht|bolgewicht|size|maat|composition|samenstelling|material|materiaal|thickness|dikte)\b/.test(label)) return null;
      // Explicit descriptive fields remain irrelevant; an unknown option must
      // not hide contradictory identity behind single-variant title inheritance.
      if (!/^(?:description|beschrijving|geschikt voor)$/.test(label) && !/^(?:default|variant)$/.test(value)) return null;
      continue;
    }
    if ((dimension === "grams" || dimension === "mm") && label.includes("(") && /^\d+(?:[.,]\d+)?$/.test(value)) value += dimension === "grams" ? " g" : " mm";
    if (!safeEvidence(value) || !understoodEvidence(value, dimension)) return null;
    const facts = attributes(value);
    if (facts.invalid || facts[dimension].size === 0 || (["colors", "grams", "mm", "thickness", "composition"] as const).some(other => other !== dimension && facts[other].size > 0)) return null;
    parts.push(facts);
  }
  const facts = mergeFacts(parts);
  return facts.invalid ? null : facts;
}
function priceFor(variant: Variant): ArticleMaterialOffer["price"] {
  const price = variant.calculated_price;
  if (!price || typeof price.calculated_amount !== "number" || !Number.isFinite(price.calculated_amount) || price.calculated_amount < 0 || typeof price.currency_code !== "string" || price.currency_code.toLowerCase() !== "eur") return null;
  // Shift the decimal representation, not a binary floating-point product.
  const [coefficient, exponent = "0"] = price.calculated_amount.toString().split("e");
  const amount = Math.round(Number(`${coefficient}e${Number(exponent) + 2}`));
  return Number.isSafeInteger(amount) && amount >= 0 ? { amount, currency_code: "eur" } : null;
}
function variantSignature(variant: Variant): string {
  return JSON.stringify([variant.title, variant.options, priceFor(variant)]);
}
function uniqueVariants(variants: Variant[]): Variant[] {
  const unique = new Map<string, Variant>();
  const conflicts = new Set<string>();
  for (const variant of variants) {
    if (!variant || typeof variant.id !== "string") continue;
    const previous = unique.get(variant.id);
    if (previous && variantSignature(previous) !== variantSignature(variant)) conflicts.add(variant.id);
    else unique.set(variant.id, variant);
  }
  return [...unique.values()].filter(variant => !conflicts.has(variant.id)).sort((a, b) => compare(a.id, b.id));
}

export function matchArticleMaterialOffers(
  materials: Array<SourceMaterial>,
  candidates: Array<MaterialCatalogCandidate>,
  commerce: ReadonlyMap<string, MaterialCommerceProduct | null>,
): SourceMaterialWithOffers[] {
  const selected = prefilterMaterialCatalog(materials, candidates);
  // Hydrate/inspect each bounded commerce product once, not for each source row.
  const evidence = selected.flatMap(candidate => {
    const product = commerce.get(candidate.medusa_product_id!);
    if (!product || product.id !== candidate.medusa_product_id || typeof product.title !== "string" || product.title.length > 1000 || !Array.isArray(product.variants) || product.variants.length > 256) return [];
    const catalogText = normalized(candidate.title);
    const commerceText = normalized(product.title);
    const family = families(catalogText)[0];
    const commerceFamilies = families(commerceText);
    if (!safeEvidence(commerceText) || !understoodEvidence(commerceText) || commerceFamilies.length !== 1 || commerceFamilies[0] !== family) return [];
    const titles = [attributes(catalogText), attributes(commerceText)];
    if (titles.some(facts => !validFamilyFacts(family, facts)) || mergeFacts(titles).invalid) return [];
    const singleVariant = new Set(product.variants.map(variant => variant?.id)).size === 1;
    const variants = uniqueVariants(product.variants).flatMap(variant => {
      const current = variantEvidence(variant);
      if (!current || families(normalized(variant.title)).some(found => found !== family) || !validFamilyFacts(family, current) || mergeFacts([...titles, current]).invalid) return [];
      // Catalog is conflict/discovery only. Commerce title is invariant evidence
      // only for a single distinct variant, never for a multi-variant Default.
      const facts = singleVariant ? mergeFacts([attributes(commerceText), current]) : current;
      return [{ variant, facts }];
    });
    return [{ candidate, product, family, variants, titleFacts: mergeFacts(titles) }];
  });
  return materials.map(material => {
    const offers: ArticleMaterialOffer[] = [];
    const seen = new Set<string>();
    for (const requirement of requirements(material.title)) {
      let count = 0;
      for (const entry of evidence) {
        if (entry.family !== requirement.family) continue;
        if (contradictsFacts(requirement.attributes, entry.titleFacts)) continue;
        const matching = entry.variants.filter(({ facts }) => includesFacts(requirement.attributes, facts));
        // Two different satisfying variants are still ambiguous. Do not choose
        // the first, cheapest, or every colour automatically.
        if (matching.length !== 1) continue;
        const variant = matching[0].variant;
        const identity = JSON.stringify([requirement.label, entry.candidate.id, variant.id]);
        if (seen.has(identity)) continue;
        seen.add(identity);
        offers.push({
          productId: entry.candidate.id,
          variantId: variant.id,
          productTitle: entry.candidate.title,
          variantTitle: variant.title,
          requirementLabel: requirement.label,
          href: `/product/${encodedSegment(entry.candidate.slug)!}?variant=${encodedVariant(variant.id)!}`,
          price: priceFor(variant),
        });
        if (++count === 2) break;
      }
    }
    return { key: material.key, title: material.title, offers };
  });
}
