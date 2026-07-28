import type { Article, Domain } from "@/types/platform";
import type { ArticleDomainLink } from "@/lib/platform/queries/articles";
import { getArticleTypeVisitorLabel } from "@/lib/content/article-display";

export type ContentHubItemData = {
  article: Article;
  domainNames: string[];
  domainSlugs: string[];
  domainName: string | null;
  domainSlug: string | null;
  searchText: string;
};

/**
 * Combine published articles with primary + linked domains (unique, sort_order).
 * Page components call listArticleDomainLinks; this helper only joins.
 */
export function buildContentHubItems(
  articles: Article[],
  domains: Domain[],
  links: ArticleDomainLink[]
): ContentHubItemData[] {
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));
  const linkedIdsByArticle = new Map<string, string[]>();

  for (const link of links) {
    const existing = linkedIdsByArticle.get(link.article_id) ?? [];
    existing.push(link.domain_id);
    linkedIdsByArticle.set(link.article_id, existing);
  }

  return articles.map((article) => {
    const idSet = new Set<string>();
    if (article.domain_id) idSet.add(article.domain_id);
    for (const domainId of linkedIdsByArticle.get(article.id) ?? []) {
      idSet.add(domainId);
    }

    const ordered = [...idSet]
      .map((id) => domainById.get(id))
      .filter((domain): domain is Domain => !!domain)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "nl-BE"));

    const domainNames = ordered.map((domain) => domain.name);
    const domainSlugs = ordered.map((domain) => domain.slug);
    const typeLabel = getArticleTypeVisitorLabel(article.article_type);
    const searchText = [article.title, article.excerpt, ...domainNames, typeLabel]
      .filter(Boolean)
      .join(" ");

    return {
      article,
      domainNames,
      domainSlugs,
      domainName: domainNames[0] ?? null,
      domainSlug: domainSlugs[0] ?? null,
      searchText,
    };
  });
}
