import { createPlatformClient } from "../client";
import type { Article } from "@/types/platform";

export const HUB_PAGE_SIZE = 24;

/** URL params of /artikelen and /patronen. One value per facet. */
export type ArticleHubFilters = {
  q?: string;
  type?: string;
  domain?: string;
  niveau?: string;
  soort?: string;
  techniek?: string;
  thema?: string;
  voor?: string;
  pagina?: number;
};

export const HUB_PARAM_KEYS = [
  "q", "type", "domain", "niveau", "techniek", "thema", "voor",
] as const;

/** Filters that only make sense inside one hobby. */
export const HOBBY_SCOPED_KEYS = ["techniek", "thema", "voor"] as const;

export type FacetCount = {
  facet: string;
  value: string;
  label: string | null;
  sort: number | null;
  n: number;
};

export function parseHubFilters(
  params: Record<string, string | string[] | undefined>,
): ArticleHubFilters {
  const one = (key: string) => {
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    return value ? value.slice(0, 80) : undefined;
  };
  const page = Number(one("pagina"));
  const domain = one("domain");
  return {
    q: one("q"), type: one("type"), domain, niveau: one("niveau"),
    // Technique, theme and audience belong to one hobby.
    techniek: domain ? one("techniek") : undefined,
    thema: domain ? one("thema") : undefined,
    voor: domain ? one("voor") : undefined,
    pagina: Number.isInteger(page) && page > 1 ? Math.min(page, 200) : 1,
  };
}

/** Search input for ilike: strip characters with pattern meaning. */
function safeSearch(value: string): string {
  return value.replace(/[%_,.()*\\:"']/g, " ").replace(/\s+/g, " ").trim();
}

function rpcArgs(patterns: boolean, filters: ArticleHubFilters) {
  const term = filters.q ? safeSearch(filters.q) : "";
  return {
    p_patterns: patterns,
    p_domain: filters.domain ?? null,
    p_niveau: filters.niveau ?? null,
    p_soort: filters.soort ?? null,
    p_type: patterns ? null : filters.type ?? null,
    p_techniek: filters.techniek ?? null,
    p_thema: filters.thema ?? null,
    p_voor: filters.voor ?? null,
    p_q: term || null,
  };
}

export async function listArticleHub(
  patterns: boolean,
  filters: ArticleHubFilters,
): Promise<{ articles: Article[]; total: number }> {
  const page = filters.pagina ?? 1;
  const { data, error } = await createPlatformClient().rpc("article_hub_page", {
    ...rpcArgs(patterns, filters),
    p_offset: (page - 1) * HUB_PAGE_SIZE,
    p_limit: HUB_PAGE_SIZE,
  });
  if (error || !Array.isArray(data)) return { articles: [], total: 0 };
  const rows = data as { article: Article; total: number | string }[];
  return { articles: rows.map((row) => row.article), total: Number(rows[0]?.total ?? 0) };
}

/** Counts per facet over the rows that match every other active filter. */
export async function listArticleFacetCounts(
  patterns: boolean,
  filters: ArticleHubFilters,
): Promise<FacetCount[]> {
  const { data, error } = await createPlatformClient().rpc("article_hub_facets", rpcArgs(patterns, filters));
  if (error || !Array.isArray(data)) return [];
  return (data as { facet: string; value: string; label: string | null; sort: number | null; n: number | string }[])
    .map((row) => ({ ...row, n: Number(row.n) }));
}
