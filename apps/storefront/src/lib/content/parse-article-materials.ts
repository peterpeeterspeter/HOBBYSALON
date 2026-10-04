/**
 * Heading-driven materials extraction from article body_markdown.
 * Recognizes Materialenlijst, Benodigdheden, and related Dutch/English aliases.
 */

import {
  findArticleHeadings,
  isMaterialsSectionHeading,
} from "./article-section-headings";

export type ParsedArticleMaterial = {
  key: string;
  title: string;
};

const LIST_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;

function stripMarkdownInline(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeChecklistLine(raw: string): string {
  return stripMarkdownInline(raw)
    .replace(/^\d+\s*[x×]\s*/i, "")
    .replace(/^\d+\s+(?!\s*(?:mm\b|%))/i, "")
    .trim();
}

export function normalizeMaterialTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+\s*[x×]\s*/i, "")
    .replace(/^\d+\s+(?!\s*(?:mm\b|%))/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyMaterialTitle(title: string): string {
  const normalized = normalizeMaterialTitle(title);
  const slug = normalized.replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
  return slug || "materiaal";
}

function extractMaterialsSection(bodyMarkdown: string): string | null {
  const headings = findArticleHeadings(bodyMarkdown);
  const materialHeading = headings.find((h) =>
    isMaterialsSectionHeading(h.text)
  );
  if (!materialHeading) return null;

  const nextBoundary = headings.find(
    (h) => h.start > materialHeading.start && h.level <= materialHeading.level
  );
  const end = nextBoundary ? nextBoundary.start : bodyMarkdown.length;
  return bodyMarkdown.slice(materialHeading.end, end);
}

/**
 * Parse checklist material titles from a materials / benodigdheden section.
 */
export function parseArticleMaterials(
  bodyMarkdown: string | null | undefined
): ParsedArticleMaterial[] {
  if (!bodyMarkdown?.trim()) return [];

  const section = extractMaterialsSection(bodyMarkdown);
  if (!section?.trim()) return [];

  const seen = new Set<string>();
  const items: ParsedArticleMaterial[] = [];

  for (const line of section.split(/\n/)) {
    const match = line.match(LIST_LINE_RE);
    if (!match) continue;
    const title = normalizeChecklistLine(match[1]);
    if (!title || title.length < 2) continue;
    const keySlug = slugifyMaterialTitle(title);
    if (seen.has(keySlug)) continue;
    seen.add(keySlug);
    items.push({
      key: `material:list:${keySlug}`,
      title,
    });
  }

  return items;
}

/**
 * Preserve the author's display quantities, separate from saved checklist normalization.
 * Blank fenced examples before heading detection so fake headings cannot delimit prose.
 */
export function parseArticleSourceMaterials(
  bodyMarkdown: string | null | undefined
): ParsedArticleMaterial[] {
  if (!bodyMarkdown?.trim()) return [];
  let fence: { marker: string; length: number } | null = null;
  const prose = bodyMarkdown.split(/\r?\n/).map(line => {
    let fenceLine = line;
    let previous: string;
    do {
      previous = fenceLine;
      fenceLine = fenceLine.replace(/^[ \t]*(?:>[ \t]?|(?:[-+*]|\d+[.)])[ \t]+)/, "");
    } while (fenceLine !== previous);
    const marker = fenceLine.match(/^[ \t]*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return "";
    }
    if (marker) {
      fence = { marker: marker[1][0], length: marker[1].length };
      return "";
    }
    return line;
  }).join("\n");
  const headings = findArticleHeadings(prose);
  const seen = new Set<string>();
  const items: ParsedArticleMaterial[] = [];
  let cursor = 0;
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (heading.start < cursor || !isMaterialsSectionHeading(heading.text)) continue;
    const end = headings.slice(index + 1).find(next => next.level <= heading.level)?.start ?? prose.length;
    for (const line of prose.slice(heading.end, end).split("\n")) {
      const match = line.match(LIST_LINE_RE);
      if (!match) continue;
      const title = stripMarkdownInline(match[1]);
      if (!title || title.length < 2 || seen.has(title)) continue;
      seen.add(title);
      // The full display title is a lossless identity: no truncated slugs,
      // quantity normalization or insertion-order suffix collisions.
      items.push({ key: `material:source:${encodeURIComponent(title)}`, title });
    }
    cursor = end;
  }
  return items;
}

/**
 * Whether a catalog product title is a strong enough match for a checklist material line.
 */
export function materialsTitlesMatch(
  checklistTitle: string,
  productTitle: string
): boolean {
  const a = normalizeMaterialTitle(checklistTitle);
  const b = normalizeMaterialTitle(productTitle);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;

  const tokensA = new Set(a.split(" ").filter((t) => t.length >= 3));
  const tokensB = new Set(b.split(" ").filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap += 1;
  }
  const minSize = Math.min(tokensA.size, tokensB.size);
  return overlap >= Math.max(1, Math.ceil(minSize * 0.6)) && overlap >= 2;
}

export type ProductCandidate = {
  id: string;
  title: string;
  slug: string;
  short_description?: string | null;
};

export type MergedMaterialItem = {
  key: string;
  title: string;
  detail: string | null;
  href?: string;
  linkLabel?: string;
  kind: "material";
};

export type OfferItem = {
  key: string;
  title: string;
  detail: string | null;
  href?: string;
  linkLabel?: string;
  kind: "offer";
};

/**
 * Attach matching products onto checklist items; unmatched products become offers.
 */
export function mergeMaterialsWithProducts(
  checklist: ParsedArticleMaterial[],
  products: ProductCandidate[]
): { materials: MergedMaterialItem[]; offers: OfferItem[] } {
  const materials: MergedMaterialItem[] = checklist.map((item) => ({
    key: item.key,
    title: item.title,
    detail: null,
    kind: "material" as const,
  }));

  const offers: OfferItem[] = [];
  const usedMaterialIndexes = new Set<number>();

  for (const product of products) {
    let matchIndex = -1;
    for (let i = 0; i < materials.length; i++) {
      if (usedMaterialIndexes.has(i)) continue;
      if (materialsTitlesMatch(materials[i].title, product.title)) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex >= 0) {
      usedMaterialIndexes.add(matchIndex);
      materials[matchIndex] = {
        ...materials[matchIndex],
        href: `/product/${product.slug}`,
        linkLabel: "Bekijk",
        detail: product.short_description ?? materials[matchIndex].detail,
      };
    } else {
      offers.push({
        key: `offer:product:${product.id}`,
        title: product.title,
        detail: product.short_description ?? null,
        href: `/product/${product.slug}`,
        linkLabel: "Bekijk aanbod",
        kind: "offer",
      });
    }
  }

  return { materials, offers };
}
