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
  hobby?: string;
  techniek?: string;
  thema?: string;
  voor?: string;
  pagina?: number;
};

export const HUB_PARAM_KEYS = [
  "q", "type", "domain", "niveau", "soort", "hobby", "techniek", "thema", "voor",
] as const;

export type FacetCount = { facet: string; value: string; n: number };

export function parseHubFilters(
  params: Record<string, string | string[] | undefined>,
): ArticleHubFilters {
  const one = (key: string) => {
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    return value ? value.slice(0, 80) : undefined;
  };
  const page = Number(one("pagina"));
  return {
    q: one("q"), type: one("type"), domain: one("domain"), niveau: one("niveau"),
    soort: one("soort"), hobby: one("hobby"), techniek: one("techniek"),
    thema: one("thema"), voor: one("voor"),
    pagina: Number.isInteger(page) && page > 1 ? Math.min(page, 200) : 1,
  };
}

/** PostgREST `or`/`ilike` input: strip characters with filter meaning. */
function safeSearch(value: string): string {
  return value.replace(/[%_,.()*\\:"']/g, " ").replace(/\s+/g, " ").trim();
}

export async function listArticleHub(
  patterns: boolean,
  filters: ArticleHubFilters,
): Promise<{ articles: Article[]; total: number }> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("articles")
    .select("*", { count: "exact" })
    .eq("is_published", true);
  query = patterns ? query.eq("article_type", "pattern") : query.neq("article_type", "pattern");

  if (filters.type && !patterns) query = query.eq("article_type", filters.type);
  if (filters.niveau) query = query.eq("difficulty_level", filters.niveau);
  if (filters.soort) query = query.eq("content_kind", filters.soort);
  if (filters.hobby) query = query.contains("crafts", [filters.hobby]);
  if (filters.techniek) query = query.contains("techniques", [filters.techniek]);
  if (filters.thema) query = query.contains("themes", [filters.thema]);
  if (filters.voor) query = query.contains("audience", [filters.voor]);

  if (filters.domain) {
    const { data: domain } = await supabase
      .from("domains").select("id").eq("slug", filters.domain).maybeSingle();
    if (!domain) return { articles: [], total: 0 };
    const { data: links } = await supabase
      .from("article_domains").select("article_id").eq("domain_id", domain.id).limit(2000);
    const ids = (links ?? []).map((l: { article_id: string }) => l.article_id);
    query = ids.length
      ? query.or(`domain_id.eq.${domain.id},id.in.(${ids.join(",")})`)
      : query.eq("domain_id", domain.id);
  }

  const term = filters.q ? safeSearch(filters.q) : "";
  if (term) query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);

  const page = filters.pagina ?? 1;
  const from = (page - 1) * HUB_PAGE_SIZE;
  const { data, count, error } = await query
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, from + HUB_PAGE_SIZE - 1);

  if (error) return { articles: [], total: 0 };
  return { articles: (data ?? []) as Article[], total: count ?? 0 };
}

export async function listArticleFacetCounts(patterns: boolean): Promise<FacetCount[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase.rpc("article_facet_counts", { p_patterns: patterns });
  if (error || !Array.isArray(data)) return [];
  return (data as { facet: string; value: string; n: number | string }[]).map((row) => ({
    facet: row.facet, value: row.value, n: Number(row.n),
  }));
}
