import type { MetadataRoute } from "next";
import { listPublishedNewsletterIssueSlugs } from "@/lib/newsletter/issues";
import { createPlatformClient } from "@/lib/platform/client";
import { REGIONAL_LANDING_PATHS } from "@/lib/markets/regional-seo";
import { getRequestMarket } from "@/lib/markets/request";
import {
  isNlSeoPublished,
  marketSeoDecision,
} from "@/lib/markets/seo-policy";
import { absoluteUrl } from "@/lib/seo";
import { getAllTools } from "@/lib/tools/registry";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const ARTICLE_PAGE_SIZE = 1000;

/** Belgian indexable static routes (existing surface + regional landings). */
const BE_STATIC_PATHS = [
  ...REGIONAL_LANDING_PATHS,
  "/crochet",
  "/knitting",
  "/card-making",
  "/sewing",
  "/jewelry",
  "/scrapbooking",
  "/pottery",
  "/diy",
  "/tools",
  "/prijzen",
  "/partners",
  "/adverteren",
  "/voor-contentmakers",
  "/voor-makers",
  "/voor-workshopgevers",
  "/voor-organisatoren",
  "/voor-winkels",
  "/voor-hobbyisten",
  "/over-ons",
  "/nieuwsbrief",
] as const;

type SitemapArticle = {
  slug: string;
  updated_at: string | null;
  published_at: string | null;
  created_at: string;
};

function sitemapUrl(path: string, origin: string): string {
  return absoluteUrl(path, origin).replace(/\/$/, "") || origin;
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
  const resolution = await getRequestMarket();
  const seo = marketSeoDecision(resolution);
  const origin = seo.canonicalOrigin;

  // NL host: only regional landings, and only after controlled launch.
  if (seo.marketCode === "NL") {
    if (!isNlSeoPublished() || !seo.index) {
      return [];
    }
    return REGIONAL_LANDING_PATHS.map((path) => ({
      url: sitemapUrl(path, origin),
      changeFrequency: path === "/" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : 0.9,
    }));
  }

  // Untrusted / preview hosts must not publish an indexable sitemap.
  if (!seo.index) {
    return [];
  }

  const staticEntries: MetadataRoute.Sitemap = BE_STATIC_PATHS.map((path) => ({
    url: sitemapUrl(path, origin),
    changeFrequency: path === "/" ? ("daily" as const) : ("weekly" as const),
    priority: path === "/" ? 1 : 0.9,
  }));

  const articles = await listPublishedArticles();
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: sitemapUrl(`/artikel/${article.slug}`, origin),
    lastModified:
      article.updated_at ?? article.published_at ?? article.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const toolEntries: MetadataRoute.Sitemap = getAllTools().map((tool) => ({
    url: sitemapUrl(`/tools/${tool.slug}`, origin),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const newsletterIssues = await listPublishedNewsletterIssueSlugs().catch(
    () => []
  );
  const newsletterEntries: MetadataRoute.Sitemap = newsletterIssues.map(
    (issue) => ({
      url: sitemapUrl(`/nieuwsbrief/${issue.slug}`, origin),
      lastModified: issue.published_at,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })
  );

  return [
    ...staticEntries,
    ...toolEntries,
    ...articleEntries,
    ...newsletterEntries,
  ];
}
