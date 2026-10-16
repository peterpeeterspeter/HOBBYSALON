import "server-only";
import { createPlatformClient } from "@/lib/platform/client";
import { sanitizeNewsletterHtml } from "@/lib/newsletter/sanitize-html";

export type NewsletterIssueListItem = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  theme: string;
  published_at: string;
  excerpt: string | null;
};

export type NewsletterIssue = NewsletterIssueListItem & {
  html: string;
  created_at: string;
};

function mapListItem(row: Record<string, unknown>): NewsletterIssueListItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subject: String(row.subject),
    theme: String(row.theme),
    published_at: String(row.published_at),
    excerpt: row.excerpt == null ? null : String(row.excerpt),
  };
}

/** Published issues for the archive list (newest first). */
export async function listPublishedNewsletterIssues(
  limit = 10
): Promise<NewsletterIssueListItem[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("newsletter_issues")
    .select("id, slug, title, subject, theme, published_at, excerpt")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)));

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapListItem);
}

/** Single published issue by slug, with sanitised HTML. */
export async function getPublishedNewsletterIssueBySlug(
  slug: string
): Promise<NewsletterIssue | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("newsletter_issues")
    .select(
      "id, slug, title, subject, theme, published_at, excerpt, html, created_at"
    )
    .eq("slug", trimmed)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...mapListItem(row),
    html: sanitizeNewsletterHtml(String(row.html ?? "")),
    created_at: String(row.created_at),
  };
}

/** Slugs for sitemap (published only). */
export async function listPublishedNewsletterIssueSlugs(): Promise<
  Array<{ slug: string; published_at: string }>
> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("newsletter_issues")
    .select("slug, published_at")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(500);

  if (error || !data) return [];
  return (data as Array<{ slug: string; published_at: string }>).map((row) => ({
    slug: row.slug,
    published_at: row.published_at,
  }));
}
