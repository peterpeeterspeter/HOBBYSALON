import { createPlatformClient } from "@/lib/platform/client";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_NEWS_ARTICLES = 1000;

type NewsArticle = {
  slug: string;
  title: string;
  published_at: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function listRecentNewsArticles(): Promise<NewsArticle[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - NEWS_WINDOW_MS);
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("slug, title, published_at")
    .eq("is_published", true)
    .eq("article_type", "news")
    .not("published_at", "is", null)
    .gte("published_at", cutoff.toISOString())
    .lte("published_at", now.toISOString())
    .order("published_at", { ascending: false })
    .limit(MAX_NEWS_ARTICLES);

  if (error) {
    throw new Error(`Failed to generate news sitemap: ${error.message}`);
  }

  return (data ?? []) as NewsArticle[];
}

export async function GET() {
  const articles = await listRecentNewsArticles();
  const urls = articles
    .map(
      (article) => `  <url>
    <loc>${escapeXml(absoluteUrl(`/artikel/${article.slug}`))}</loc>
    <news:news>
      <news:publication>
        <news:name>Hobbysalon</news:name>
        <news:language>nl</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(article.published_at)}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
    </news:news>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
