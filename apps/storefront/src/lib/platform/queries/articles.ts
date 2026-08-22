import { createPlatformClient } from "../client";
import type { Article } from "@/types/platform";

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = createPlatformClient();
  const candidates = new Set([slug, decodeURIComponentSafe(slug), slug.normalize("NFC")]);

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("slug", candidate)
      .eq("is_published", true)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as Article;
  }

  return null;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function listArticlesByDomain(domainId: string): Promise<Article[]> {
  const supabase = createPlatformClient();
  const { data: adData } = await supabase
    .from("article_domains")
    .select("article_id")
    .eq("domain_id", domainId);
  const linkedIds = new Set((adData ?? []).map((r) => r.article_id));

  const { data: directData, error: directError } = await supabase
    .from("articles")
    .select("*")
    .eq("domain_id", domainId)
    .eq("is_published", true);

  if (directError) return [];

  const directArticles = (directData ?? []) as Article[];
  const directIds = new Set(directArticles.map((a) => a.id));

  const allIds = new Set([...linkedIds, ...directIds]);
  if (allIds.size === 0) return directArticles;

  const idsToFetch = [...allIds].filter((id) => !directIds.has(id));
  if (idsToFetch.length === 0) return directArticles;

  const { data: linkedData, error: linkedError } = await supabase
    .from("articles")
    .select("*")
    .in("id", idsToFetch)
    .eq("is_published", true);

  if (linkedError) return directArticles;

  const linkedArticles = (linkedData ?? []) as Article[];
  const combined = [...directArticles];
  for (const a of linkedArticles) {
    if (!directIds.has(a.id)) combined.push(a);
  }
  return combined.sort((a, b) => {
    const aDate = a.published_at ?? a.created_at;
    const bDate = b.published_at ?? b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

export async function listArticlesByIds(ids: string[]): Promise<Article[]> {
  if (!ids.length) return [];

  const uniqueIds = [...new Set(ids)];
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .in("id", uniqueIds)
    .eq("is_published", true);

  if (error || !data) return [];

  const byId = new Map((data as Article[]).map((article) => [article.id, article]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((article): article is Article => !!article);
}

export async function listLatestArticles(limit = 8): Promise<Article[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as Article[];
}

export async function listPublishedContentArticles(limit = 48): Promise<Article[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .neq("article_type", "pattern")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 96)));

  if (error) return [];
  return (data ?? []) as Article[];
}

export async function listPublishedPatterns(limit = 48): Promise<Article[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .eq("article_type", "pattern")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 96)));

  if (error) return [];
  return (data ?? []) as Article[];
}

export async function listFreeDutchCrochetPatternArticles(
  limit = 60
): Promise<Article[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .eq("article_type", "pattern")
    .or("slug.like.gratis-haakpatronen-%,slug.like.ravelry-pattern-%")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as Article[];
}

export async function listArticlesByAuthor(creatorId: string): Promise<Article[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("author_creator_id", creatorId)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as Article[];
}

export type ArticleDomainLink = {
  article_id: string;
  domain_id: string;
};

/** Batched public SELECT of article↔domain links for hub enrichment. */
export async function listArticleDomainLinks(
  articleIds: string[]
): Promise<ArticleDomainLink[]> {
  if (!articleIds.length) return [];

  const uniqueIds = [...new Set(articleIds)];
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("article_domains")
    .select("article_id, domain_id")
    .in("article_id", uniqueIds);

  if (error || !data) return [];
  return data as ArticleDomainLink[];
}
