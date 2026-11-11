import type { Article, Domain } from "@/types/platform";

export type ArticleBreadcrumbItem = {
  name: string;
  path?: string;
};

function craftLabel(value: string): string {
  return value.charAt(0).toLocaleUpperCase("nl-BE") + value.slice(1);
}

/** Hub + hobby trail from article facets/domain (already synced metadata). */
export function buildArticleBreadcrumbTrail(
  article: Pick<Article, "slug" | "title" | "article_type" | "crafts" | "domain_id">,
  domain: Pick<Domain, "name" | "slug"> | null
): ArticleBreadcrumbItem[] {
  const isPattern = article.article_type === "pattern";
  const hubPath = isPattern ? "/patronen" : "/artikelen";
  const hubName = isPattern ? "Patronen" : "Artikelen";

  const trail: ArticleBreadcrumbItem[] = [
    { name: "Home", path: "/" },
    { name: hubName, path: hubPath },
  ];

  if (domain) {
    trail.push({
      name: domain.name,
      path: `${hubPath}?domain=${encodeURIComponent(domain.slug)}`,
    });
  } else if (article.crafts?.[0]) {
    trail.push({ name: craftLabel(article.crafts[0]) });
  }

  trail.push({ name: article.title, path: `/artikel/${article.slug}` });
  return trail;
}
