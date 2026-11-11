import type {
  ArticleMaterialOffer,
  MaterialCatalogCandidate,
  MaterialCommerceProduct,
  SourceMaterialWithOffers,
} from "./article-material-offers";

type BrowseFamily = "yarn" | "hook" | "stuffing" | "embroidery" | "foam_clay" | "foam_base";

const FAMILIES: Array<{ family: BrowseFamily; words: string[]; terms: string[] }> = [
  { family: "yarn", words: ["haakgaren", "breigaren", "garen", "yarn", "wol", "wool"], terms: ["haakgaren", "garen", "yarn", "wol"] },
  { family: "hook", words: ["haaknaald", "haaknaalden", "crochet hook"], terms: ["haaknaald", "crochet hook"] },
  { family: "embroidery", words: ["borduurgaren", "embroidery"], terms: ["borduurgaren", "garen"] },
  { family: "stuffing", words: ["fiberfill", "vulling", "stuffing", "polyestervlok"], terms: ["fiberfill", "vulling", "stuffing"] },
  { family: "foam_clay", words: ["foam clay", "foamclay", "klei"], terms: ["foam clay", "foamclay"] },
  { family: "foam_base", words: ["basisfiguur", "basisfiguurtje", "isomooi"], terms: ["foam clay basic", "basis"] },
];

const COLORS: Array<[string, string[]]> = [
  ["wit", ["wit", "witte", "white"]],
  ["rood", ["rood", "rode", "red"]],
  ["blauw", ["blauw", "blauwe", "blue"]],
  ["zwart", ["zwart", "zwarte", "black"]],
  ["groen", ["groen", "groene", "green"]],
  ["geel", ["geel", "gele", "yellow"]],
  ["roze", ["roze", "pink"]],
  ["bruin", ["bruin", "bruine", "brown"]],
];

function normalized(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function hasWord(text: string, word: string): boolean {
  if (word.includes(" ")) return text.includes(word);
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

function familyOf(title: string): BrowseFamily | null {
  const text = normalized(title);
  for (const entry of FAMILIES) {
    if (entry.words.some((word) => hasWord(text, word))) return entry.family;
  }
  return null;
}

function millimetres(title: string): number | null {
  const match = normalized(title).match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function colorsOf(title: string): string[] {
  const text = normalized(title);
  return COLORS.filter(([, words]) => words.some((word) => hasWord(text, word))).map(([canonical]) => canonical);
}

function neededFamilies(materials: Array<{ title: string }>): Set<BrowseFamily> {
  return new Set(
    materials.flatMap((material) => {
      const family = familyOf(material.title);
      return family ? [family] : [];
    })
  );
}

/** Internal search literals only — never author punctuation. */
export function materialBrowseSearchTerms(materials: Array<{ title: string }>): string[] {
  const needed = neededFamilies(materials);
  return [...new Set(FAMILIES.filter((entry) => needed.has(entry.family)).flatMap((entry) => entry.terms))];
}

/** Keep shop candidates that belong to a mentioned material family. */
export function prefilterMaterialBrowseCatalog(
  materials: Array<{ title: string }>,
  candidates: MaterialCatalogCandidate[]
): MaterialCatalogCandidate[] {
  const needed = neededFamilies(materials);
  if (!needed.size) return [];
  const unique = new Map<string, MaterialCatalogCandidate>();
  for (const candidate of candidates) {
    if (!candidate?.id || unique.has(candidate.id)) continue;
    if (!candidate.is_active || candidate.status !== "active" || candidate.product_type !== "supply") continue;
    if (!candidate.medusa_product_id || !encodedSegment(candidate.slug)) continue;
    const family = familyOf(candidate.title);
    if (!family || !needed.has(family)) continue;
    unique.set(candidate.id, candidate);
  }
  return [...unique.values()];
}

function encodedSegment(slug: string): string | null {
  if (
    typeof slug !== "string" ||
    !slug.trim() ||
    slug !== slug.trim() ||
    slug === "." ||
    slug === ".." ||
    slug.length > 180 ||
    /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\/\\?#:%]/.test(slug)
  ) {
    return null;
  }
  try {
    return encodeURIComponent(slug);
  } catch {
    return null;
  }
}

function scoreCandidate(
  family: BrowseFamily,
  sourceTitle: string,
  candidateTitle: string
): number {
  const source = normalized(sourceTitle);
  const title = normalized(candidateTitle);
  const candidateFamily = familyOf(candidateTitle);
  if (candidateFamily !== family) return 0;
  let score = 10;
  const wantedMm = millimetres(source);
  const foundMm = millimetres(title);
  if (wantedMm != null && foundMm != null) score += wantedMm === foundMm ? 20 : -8;
  const wantedColors = colorsOf(source);
  const foundColors = colorsOf(title);
  if (wantedColors.length && foundColors.some((color) => wantedColors.includes(color))) score += 8;
  return score;
}

/** Looser shop suggestions from the article checklist. Up to 3 options per line. */
export function matchArticleMaterialBrowseOffers(
  materials: Array<{ key: string; title: string }>,
  candidates: MaterialCatalogCandidate[],
  commerce: ReadonlyMap<string, MaterialCommerceProduct | null>
): SourceMaterialWithOffers[] {
  return materials.map((material) => {
    const family = familyOf(material.title);
    // Signed/hyphenated dimensions are not interchangeable shop suggestions.
    if (!family || /[-+±]\s*\d|\d\s*[-+±]/.test(material.title)) {
      return { key: material.key, title: material.title, offers: [] };
    }

    const ranked = candidates
      .filter(
        (candidate) =>
          candidate.is_active &&
          candidate.status === "active" &&
          candidate.product_type === "supply" &&
          candidate.medusa_product_id &&
          encodedSegment(candidate.slug)
      )
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(family, material.title, candidate.title),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title, "nl"));

    const offers: ArticleMaterialOffer[] = [];
    const seen = new Set<string>();
    for (const { candidate } of ranked) {
      if (offers.length >= 3) break;
      const product = commerce.get(candidate.medusa_product_id!);
      const variant = product?.variants?.[0];
      if (!variant?.id) continue;
      const identity = `${candidate.id}:${variant.id}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const price = variant.calculated_price;
      offers.push({
        productId: candidate.id,
        variantId: variant.id,
        productTitle: candidate.title,
        variantTitle: variant.title,
        requirementLabel: material.title,
        href: `/product/${encodedSegment(candidate.slug)!}`,
        price:
          price &&
          typeof price.calculated_amount === "number" &&
          Number.isFinite(price.calculated_amount) &&
          price.calculated_amount >= 0 &&
          price.currency_code?.toLowerCase() === "eur"
            ? { amount: Math.round(Number(`${price.calculated_amount}e2`)), currency_code: "eur" }
            : null,
      });
    }
    return { key: material.key, title: material.title, offers };
  });
}
