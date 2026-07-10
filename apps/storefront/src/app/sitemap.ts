import type { MetadataRoute } from "next";
import { createPlatformClient } from "@/lib/platform/client";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const ARTICLE_PAGE_SIZE = 1000;

const STATIC_PATHS = [
  "/",
  "/crochet",
  "/knitting",
  "/card-making",
  "/sewing",
  "/jewelry",
  "/scrapbooking",
  "/pottery",
  "/diy",
] as const;

type SitemapArticle = {
  slug: string;
  updated_at: string | null;
  published_at: string | null;
  created_at: string;
};

function sitemapUrl(path: string): string {
  return new URL(path, `${getSiteUrl()}/`).toString().replace(/\/$/, "");
}

async function listPublishedArticles(): Promise<SitemapArticle[]> {
  const supabase = createPlatformClient();
  const articles: SitemapArticle[] = [];

  for (let from = 0; ; from += ARTICLE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("articles")
      .select("slug, updated_at, published_at, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: true })
      .range(from, from + ARTICLE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to generate sitemap: ${error.message}`);
    }

    const page = (data ?? []) as SitemapArticle[];
    articles.push(...page);

    if (page.length < ARTICLE_PAGE_SIZE) {
      return articles;
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: sitemapUrl(path),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.9,
  }));

  const articles = await listPublishedArticles();
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: sitemapUrl(`/artikel/${article.slug}`),
    lastModified:
      article.updated_at ?? article.published_at ?? article.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...articleEntries];
}
