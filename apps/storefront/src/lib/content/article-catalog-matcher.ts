export type CatalogCandidate = {
  targetType: "product" | "workshop" | "event";
  targetId: string;
  title: string;
  description?: string | null;
  domainIds: string[];
  productType?: string | null;
};

export type ArticleMatchInput = {
  title: string;
  excerpt?: string | null;
  bodyMarkdown?: string | null;
  domainId: string | null;
  materialTitles: string[];
};

export type ArticleCatalogMatch = {
  candidate: CatalogCandidate;
  score: number;
  proposedRelation: "related_product" | "related";
  evidence: string[];
  compatibility: "unknown" | "textual";
};

// Deliberately small: token equality, not substring or fuzzy matching.
const SYNONYMS: Record<string, string[]> = {
  haken: ["haak"], gehaakt: ["haak"], gehaakte: ["haak"], haaknaalden: ["haak", "haaknaald"],
  haaknaald: ["haak", "haaknaald"], haakgaren: ["haak", "garen"],
  breien: ["brei"], gebreid: ["brei"], gebreide: ["brei"], breinaald: ["brei", "breinaald"],
  breinaalden: ["brei", "breinaald"], breiwol: ["brei", "wol", "garen"],
  katoenen: ["katoen"], cotton: ["katoen"], wollen: ["wol"], wool: ["wol"],
  garens: ["garen"], yarn: ["garen"], acryl: ["acryl"], acrylic: ["acryl"],
  linnen: ["linnen"], linen: ["linnen"], zijde: ["zijde"], silk: ["zijde"],
  polyester: ["polyester"], nylon: ["nylon"], bamboe: ["bamboe"], bamboo: ["bamboe"],
  stoffen: ["stof"], koorden: ["koord"], knopen: ["knoop"], knoop: ["knoop"],
};
const STOPWORDS = new Set((
  "een het de dit dat deze die en of met van voor door over naar aan uit op in om te je jouw uw we wij " +
  "is zijn maak maken gemaakt hoe wat welke iets onze ons ook tot als dan maar niet kun kan leren leer " +
  "gebruik gebruiken nodig benodigd benodigdheden materiaal materialen material materials shop winkel " +
  "beginner beginners beginnersvriendelijk stap stappen tutorial tutorials uitleg tips handleiding inspiratie inspirerend " +
  "creatief creatieve project projecten hobby hobbies workshop workshops cursus event evenement festival " +
  "bollen bol gram mm cm per voor naalden naald kleur kleuren inclusief set stuks collectie"
).split(/\s+/));
const COMPOSITIONS = new Set(["katoen", "wol", "acryl", "linnen", "zijde", "polyester", "nylon", "bamboe"]);
const TOOLS = new Set(["haaknaald", "breinaald", "borduurnaald", "schaar", "penseel"]);
const MATERIAL_KINDS = new Set(["garen", "stof", "vilt", "koord", "knoop", "verf", "papier", "klei", "kraal", "hout"]);
const BUDGET: Record<CatalogCandidate["targetType"], number> = { product: 3, workshop: 2, event: 1 };

type Text = { tokens: Set<string>; original: string; source: string };
type Requirement = Text & { fragment: string; kinds: Set<string> };

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function tokens(value: string): Set<string> {
  const result = new Set<string>();
  for (const word of fold(value).match(/[a-z]+/g) ?? []) {
    for (const token of SYNONYMS[word] ?? [word]) {
      if (!STOPWORDS.has(token) && (token.length >= 4 || token === "wol")) result.add(token);
    }
  }
  return result;
}

function intersection(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter(token => right.has(token)).sort();
}

function text(original: string, source: string): Text {
  return { original, source, tokens: tokens(original) };
}

// Only explicit material headings introduce requirements. Prose outside these sections
// remains low-weight topic evidence for products, never material compatibility.
function articleBody(body: string): { prose: string; lines: string[] } {
  const prose: string[] = [];
  const lines: string[] = [];
  let materialDepth = 0;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (materialDepth && heading[1].length <= materialDepth) materialDepth = 0;
      if (/\b(materialen|benodigdheden|gereedschap|tools|materials)\b/.test(fold(heading[2]))) {
        materialDepth = heading[1].length;
        continue;
      }
    }
    if (materialDepth) {
      const clean = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim();
      if (clean && !heading) lines.push(clean);
    } else prose.push(line);
  }
  return { prose: prose.join("\n"), lines };
}

function fragments(line: string): string[] {
  // Decimal commas and composition slashes are intentionally preserved.
  return line.split(/\s+en\s+|\s*[;+\n]\s*|,(?!\d)|\s*\/\s*(?=(?:haaknaald|breinaald|borduurnaald|schaar|penseel)\b)/i)
    .map(part => part.trim()).filter(Boolean);
}

function componentFragments(line: string): string[] {
  // A component introduced by "met" must not lend its composition or dimensions
  // to the preceding yarn/tool. Preserve decimal punctuation and blend slashes.
  return fragments(line).flatMap(part => part.split(/\s+met\s+|\.(?!\d)\s+/i))
    .map(part => part.trim()).filter(Boolean);
}

function kinds(value: Set<string>): Set<string> {
  return new Set([...value].filter(token => TOOLS.has(token) || MATERIAL_KINDS.has(token)));
}

function requirements(lines: string[]): Requirement[] {
  return lines.flatMap(original => componentFragments(original).map(fragment => {
    const value = text(original, "materiaal");
    value.tokens = tokens(fragment);
    return { ...value, fragment, kinds: kinds(value.tokens) };
  }));
}

function sizes(value: string): number[] {
  return [...fold(value).matchAll(/\b(\d+(?:[.,]\d+)?)\s*mm\b/g)]
    .map(match => Number(match[1].replace(",", ".")));
}

function labelledNeedleSizes(value: string): number[] {
  return [...fold(value).matchAll(/\bnaalddikte\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm\b/g)]
    .map(match => Number(match[1].replace(",", ".")));
}

function toolSizes(value: string): number[] {
  // Even without "met", dimensions following a handle label are not needle sizes.
  const beforeHandle = value.split(/\b(?:handvat|handvaten|handgreep|greep)\b/i)[0];
  return [...new Set([...sizes(beforeHandle), ...labelledNeedleSizes(value)])];
}

function bareComposition(part: Text): boolean {
  // Attach a bare fibre/blend description only when no other component is named.
  // "Katoenen opbergtas" is not a bare yarn composition.
  const words = (fold(part.original).match(/[a-z]+/g) ?? [])
    .flatMap(word => SYNONYMS[word] ?? [word]).filter(word => !STOPWORDS.has(word));
  return intersection(part.tokens, COMPOSITIONS).length > 0 &&
    words.every(token => COMPOSITIONS.has(token) ||
      token === "haak" || token === "brei" || token === "samenstelling");
}

function percentages(value: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const match of fold(value).matchAll(/\b(\d+(?:[.,]\d+)?)\s*%\s*([a-z]+)/g)) {
    const composition = (SYNONYMS[match[2]] ?? [match[2]])[0];
    if (COMPOSITIONS.has(composition)) result.set(composition, Number(match[1].replace(",", ".")));
  }
  // "Cotton garen 100%" is unambiguous only with a single named composition
  // and a single percentage. Do not guess the allocation of an unlabeled blend.
  const compositions = intersection(tokens(value), COMPOSITIONS);
  const allPercentages = [...fold(value).matchAll(/\b(\d+(?:[.,]\d+)?)\s*%/g)];
  if (!result.size && compositions.length === 1 && allPercentages.length === 1) {
    result.set(compositions[0], Number(allPercentages[0][1].replace(",", ".")));
  }
  return result;
}

type MaterialResult = { rejected: boolean; score: number; textual: boolean; evidence: string[] };

function materialEvidence(required: Requirement[], candidate: CatalogCandidate, productText: Text): MaterialResult {
  const result: MaterialResult = { rejected: false, score: 0, textual: false, evidence: [] };
  // Both requirement and candidate components must keep their own properties.
  const candidateKinds = kinds(productText.tokens);
  const candidateParts = componentFragments(productText.original).map(original => {
    const part = text(original, "catalogus");
    return { ...part, kinds: kinds(part.tokens) };
  });
  for (const requirement of required) {
    const sharedKinds = intersection(requirement.kinds, candidateKinds);
    const requiredCompositions = new Set(intersection(requirement.tokens, COMPOSITIONS));
    const tool = sharedKinds.find(kind => TOOLS.has(kind));
    const scopedParts = candidateParts.filter(part =>
      (part.kinds.size === 1 && (intersection(part.kinds, requirement.kinds).length > 0 ||
        (requirement.kinds.size === 0 && ![...part.kinds].some(kind => TOOLS.has(kind))))) ||
      (part.kinds.size === 0 && candidateKinds.size <= 1 && bareComposition(part) &&
        ![...candidateKinds, ...requirement.kinds].some(kind => TOOLS.has(kind))));
    const scopedTokens = new Set(scopedParts.flatMap(part => [...part.tokens]));
    const candidateCompositions = new Set(intersection(scopedTokens, COMPOSITIONS));
    const candidatePercentages = scopedParts.map(part => percentages(part.original));
    const sharedCompositions = intersection(requiredCompositions, candidateCompositions);
    // Bare composition ("100% katoen") can describe yarn, but not a finished good or tool.
    const compositionOnly = (requirement.kinds.size === 0 || candidateKinds.size === 0) &&
      requiredCompositions.size > 0 && candidateCompositions.size > 0 &&
      ![...requirement.kinds, ...candidateKinds].some(kind => TOOLS.has(kind));
    const sameMaterial = sharedKinds.length > 0 || compositionOnly;
    if (!sameMaterial) continue;

    let compatible = false;
    if (tool) {
      const expected = toolSizes(requirement.fragment);
      const singleNeedle = candidateKinds.size === 1 && /^(?:haaknaald|breinaald|borduurnaald)$/.test(tool);
      const actual = [...new Set(candidateParts.flatMap(part =>
        part.kinds.size === 1 && part.kinds.has(tool) ? toolSizes(part.original) :
          singleNeedle && part.kinds.size === 0 ? labelledNeedleSizes(part.original) : []))];
      if (expected.length && actual.length && !expected.some(size => actual.includes(size))) {
        result.rejected = true;
        return result;
      }
      // Missing size information is discovery evidence, not compatibility evidence.
      compatible = expected.length === 1 && actual.length === 1 && expected[0] === actual[0];
    } else {
      const expectedPercentages = percentages(requirement.fragment);
      const conflictingComposition = requiredCompositions.size > 0 && candidateCompositions.size > 0 &&
        (sharedCompositions.length === 0 || [...requiredCompositions].some(value => !candidateCompositions.has(value)));
      const conflictingPercentage = [...expectedPercentages].some(([composition, percentage]) =>
        candidatePercentages.some(values => values.has(composition) && values.get(composition) !== percentage));
      const pureCompositionConflict = [...expectedPercentages.values()].includes(100) &&
        [...candidateCompositions].some(value => !requiredCompositions.has(value));
      if (conflictingComposition || conflictingPercentage || pureCompositionConflict) {
        // Hard veto: topic overlap cannot rescue a contradictory requirement.
        result.rejected = true;
        return result;
      }
      compatible = requiredCompositions.size > 0 && sharedCompositions.length === requiredCompositions.size &&
        [...expectedPercentages].every(([composition, percentage]) =>
          candidatePercentages.some(values => values.get(composition) === percentage));
    }
    // An ambiguous multi-kind fragment may support discovery by kind, not fibre.
    const shared = intersection(requirement.tokens, new Set([...scopedTokens, ...sharedKinds]));
    if (shared.length) {
      result.score += compatible ? 40 : 12;
      result.textual ||= compatible;
      result.evidence.push(`Materiaal: ${requirement.original} → ${candidate.title} (${shared.join(", ")})`);
    }
  }
  return result;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareMatches(a: ArticleCatalogMatch, b: ArticleCatalogMatch): number {
  return b.score - a.score || compareText(a.candidate.targetType, b.candidate.targetType) ||
    compareText(a.candidate.targetId, b.candidate.targetId);
}

function recordKey(candidate: CatalogCandidate): string {
  // Ignore undeclared merchant/author fields; even duplicate selection uses only this API.
  return JSON.stringify([candidate.title,
    [Object.hasOwn(candidate, "description"), candidate.description === undefined ? "undefined" : "value", candidate.description],
    [Object.hasOwn(candidate, "productType"), candidate.productType === undefined ? "undefined" : "value", candidate.productType],
    candidate.domainIds]);
}

/**
 * Deterministic discovery recommendations only. `textual` is not verified material
 * compatibility and never proposes a required/optional role. No IO or input mutation.
 * Primary topic tokens score 20 each; body-only product tokens 5; a shared domain
 * adds 3 only after textual qualification. Material evidence scores 40/12.
 */
export function matchArticleCatalog(
  input: ArticleMatchInput,
  candidates: CatalogCandidate[],
  existingKeys?: ReadonlySet<string>
): ArticleCatalogMatch[] {
  const primary = [text(input.title, "titel"), text(input.excerpt ?? "", "excerpt")];
  const body = articleBody(input.bodyMarkdown ?? "");
  const secondary = text(body.prose, "artikeltekst");
  const required = requirements([...input.materialTitles, ...body.lines]);
  const byKey = new Map<string, ArticleCatalogMatch>();

  for (const candidate of candidates) {
    const key = `${candidate.targetType}:${candidate.targetId}`;
    if (existingKeys?.has(key)) continue;
    const productText = text([candidate.title, candidate.description ?? ""].join("\n"), "catalogus");
    const evidence: string[] = [];
    const seenTopic = new Set<string>();
    let score = 0;
    for (const source of primary) {
      const overlap = intersection(source.tokens, productText.tokens).filter(token => !seenTopic.has(token));
      if (overlap.length) {
        overlap.forEach(token => seenTopic.add(token));
        score += overlap.length * 20;
        evidence.push(`Onderwerp (${source.source}): ${source.original} → ${candidate.title} (${overlap.join(", ")})`);
      }
    }
    let compatibility: ArticleCatalogMatch["compatibility"] = "unknown";
    if (candidate.targetType === "product") {
      const overlap = intersection(secondary.tokens, productText.tokens).filter(token => !seenTopic.has(token));
      if (overlap.length) {
        score += overlap.length * 5;
        evidence.push(`Onderwerp (artikeltekst): ${overlap.join(", ")} → ${candidate.title}`);
      }
      if (candidate.productType === "supply" || candidate.productType === "destash") {
        const material = materialEvidence(required, candidate, productText);
        if (material.rejected) continue;
        score += material.score;
        evidence.push(...material.evidence);
        if (material.textual) compatibility = "textual";
      }
    }
    if (!score) continue;
    if (input.domainId !== null && candidate.domainIds.includes(input.domainId)) {
      score += 3;
      evidence.push("Gedeeld domein (ondersteunend, niet zelfstandig)");
    }
    evidence.push(compatibility === "textual"
      ? "Aanbeveling op tekstuele overeenkomst; niet geverifieerd en geen vereist materiaal."
      : "Aanbeveling; materiaalcompatibiliteit onbekend.");
    const match: ArticleCatalogMatch = {
      candidate, score, evidence: [...new Set(evidence)], compatibility,
      proposedRelation: candidate.targetType === "product" ? "related_product" : "related",
    };
    const previous = byKey.get(key);
    if (!previous || compareMatches(match, previous) < 0 ||
      (compareMatches(match, previous) === 0 && compareText(recordKey(candidate), recordKey(previous.candidate)) < 0)) {
      byKey.set(key, match);
    }
  }
  const counts = { product: 0, workshop: 0, event: 0 };
  return [...byKey.values()].sort(compareMatches).filter(match => {
    const type = match.candidate.targetType;
    return counts[type]++ < BUDGET[type];
  });
}
