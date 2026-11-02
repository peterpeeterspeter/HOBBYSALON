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
    audience: unique(metadata.audience),
  };
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
