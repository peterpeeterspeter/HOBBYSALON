/**
 * Public filter facets derived from the article metadata sidecar.
 * Pure helpers, shared by the sync script and the listing pages.
 */
import type { ArticleMetadata } from "./article-metadata-sidecar";

export type ArticleFacets = {
  content_kind: string | null;
  crafts: string[];
  techniques: string[];
  themes: string[];
  audience: string[];
};

export const FACET_KEYS = ["crafts", "techniques", "themes", "audience"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** Lowercase, trim and collapse spaces, so "Haken " and "haken" merge. */
export function normalizeFacetValue(label: string): string | null {
  const value = label.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("nl-BE");
  if (!value || value.length > 48) return null;
  return value;
}

function unique(labels: { label: string }[]): string[] {
  const out = new Set<string>();
  for (const { label } of labels) {
    const value = normalizeFacetValue(label);
    if (value) out.add(value);
  }
  return [...out].slice(0, 12);
}

export function facetsFromMetadata(metadata: ArticleMetadata): ArticleFacets {
  return {
    content_kind: metadata.content_kind ?? null,
    crafts: unique(metadata.crafts),
    techniques: unique(metadata.techniques),
    themes: unique(metadata.themes),
    audience: audienceBuckets(metadata.audience),
  };
}

/** Fixed audience levels. Free text like "beginners die recht breien" maps here. */
export const AUDIENCE_BUCKETS = ["beginners", "gevorderde beginners", "gevorderden", "kinderen"] as const;

export function audienceBucket(label: string): string | null {
  const v = normalizeFacetValue(label) ?? "";
  if (/kind|jeugd|tiener/.test(v)) return "kinderen";
  if (/gevorderde?n? beginner|beginner.*(basis|ervaring)|basisvaardig/.test(v)) return "gevorderde beginners";
  if (/beginner|starter|nieuw/.test(v)) return "beginners";
  if (/gevorderd|ervaren|expert/.test(v)) return "gevorderden";
  return null;
}

function audienceBuckets(labels: { label: string }[]): string[] {
  const out = new Set<string>();
  for (const { label } of labels) {
    const bucket = audienceBucket(label);
    if (bucket) out.add(bucket);
  }
  return AUDIENCE_BUCKETS.filter((b) => out.has(b));
}

/**
 * Dutch plural and inflection key: the last word loses -en, -s or -n, then -e,
 * so "stokje/stokjes", "bloem/bloemen" and "vaste/vasten" share one key.
 */
export function facetStem(value: string): string {
  const words = value.split(" ");
  let last = words[words.length - 1];
  for (const suffix of ["en", "s", "n"]) {
    if (last.endsWith(suffix) && last.length - suffix.length >= 3) {
      last = last.slice(0, -suffix.length);
      break;
    }
  }
  if (last.endsWith("e") && last.length > 3) last = last.slice(0, -1);
  words[words.length - 1] = last;
  return words.join(" ");
}

/**
 * Corpus pass: inside each facet, all values with the same stem get the
 * most frequent form. Run on every article before writing.
 */
export function canonicalizeCorpus(all: ArticleFacets[]): ArticleFacets[] {
  const keys = ["crafts", "techniques", "themes"] as const;
  const canonical = new Map<string, Map<string, string>>();
  for (const key of keys) {
    const counts = new Map<string, Map<string, number>>();
    for (const facets of all) {
      for (const value of facets[key]) {
        const stem = facetStem(value);
        const forms = counts.get(stem) ?? new Map<string, number>();
        forms.set(value, (forms.get(value) ?? 0) + 1);
        counts.set(stem, forms);
      }
    }
    const map = new Map<string, string>();
    for (const [stem, forms] of counts) {
      const best = [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      map.set(stem, best);
    }
    canonical.set(key, map);
  }
  return all.map((facets) => {
    const next = { ...facets };
    for (const key of keys) {
      const map = canonical.get(key)!;
      next[key] = [...new Set(facets[key].map((v) => map.get(facetStem(v)) ?? v))];
    }
    return next;
  });
}

export const CONTENT_KIND_LABELS: Record<string, string> = {
  full_tutorial: "Stap voor stap",
  pattern_overview: "Patronenoverzicht",
  technique_guide: "Techniek leren",
  inspiration_roundup: "Inspiratie",
  reference_guide: "Naslag",
  interview: "Interview",
  other: "Overig",
};

export function facetLabel(value: string): string {
  return value.charAt(0).toLocaleUpperCase("nl-BE") + value.slice(1);
}
