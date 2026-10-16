import "server-only";
import { createPlatformClient } from "@/lib/platform/client";
import { sanitizeNewsletterHtml } from "@/lib/newsletter/sanitize-html";
import {
  SEED_NEWSLETTER_ISSUE,
  seedIssueListItem,
} from "@/lib/newsletter/seed-fixture";
import type {
  NewsletterIssue,
  NewsletterIssueListItem,
} from "@/lib/newsletter/types";

export type { NewsletterIssue, NewsletterIssueListItem };

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

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("newsletter_issues") &&
    (lower.includes("schema cache") ||
      lower.includes("does not exist") ||
      lower.includes("could not find"))
  );
}

/** Published issues for the archive list (newest first). */
export async function listPublishedNewsletterIssues(
  limit = 10
): Promise<NewsletterIssueListItem[]> {
  try {
    const supabase = createPlatformClient();
    const { data, error } = await supabase
      .from("newsletter_issues")
      .select("id, slug, title, subject, theme, published_at, excerpt")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(Math.max(1, Math.min(limit, 50)));

    if (error) {
      if (isMissingTableError(error.message)) {
        return [seedIssueListItem()].slice(0, limit);
      }
      return [];
    }
    if (!data) return [];
    return (data as Record<string, unknown>[]).map(mapListItem);
  } catch {
    return [seedIssueListItem()].slice(0, limit);
  }
}

/** Single published issue by slug, with sanitised HTML. */
export async function getPublishedNewsletterIssueBySlug(
  slug: string
): Promise<NewsletterIssue | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  try {
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

    if (error) {
      if (
        isMissingTableError(error.message) &&
        trimmed === SEED_NEWSLETTER_ISSUE.slug
      ) {
        return {
          ...SEED_NEWSLETTER_ISSUE,
          html: sanitizeNewsletterHtml(SEED_NEWSLETTER_ISSUE.html),
        };
      }
      return null;
    }
    if (!data) return null;
    const row = data as Record<string, unknown>;
    return {
      ...mapListItem(row),
      html: sanitizeNewsletterHtml(String(row.html ?? "")),
      created_at: String(row.created_at),
    };
  } catch {
    if (trimmed === SEED_NEWSLETTER_ISSUE.slug) {
      return {
        ...SEED_NEWSLETTER_ISSUE,
        html: sanitizeNewsletterHtml(SEED_NEWSLETTER_ISSUE.html),
      };
    }
    return null;
  }
}

/** Slugs for sitemap (published only). */
export async function listPublishedNewsletterIssueSlugs(): Promise<
  Array<{ slug: string; published_at: string }>
> {
  const issues = await listPublishedNewsletterIssues(500);
  return issues.map((issue) => ({
    slug: issue.slug,
    published_at: issue.published_at,
  }));
}
