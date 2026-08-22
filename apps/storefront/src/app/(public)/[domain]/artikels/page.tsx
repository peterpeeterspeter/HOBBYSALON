import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listArticlesByDomain } from "@/lib/platform/queries/articles";
import { ArticleCard } from "@/components/cards";
import { DomainSubListingShell } from "@/components/domain/DomainSubListingShell";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) return { title: "Niet gevonden" };
  return {
    title: `${domain.name} artikelen | Hobbysalon`,
    description: domain.short_description ?? undefined,
  };
}

export default async function DomainArticlesPage({ params }: Props) {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) notFound();

  const articles = await listArticlesByDomain(domain.id);

  const lead =
    articles.length > 0
      ? `${articles.length} artikel${articles.length !== 1 ? "en" : ""}`
      : undefined;

  return (
    <DomainSubListingShell
      domain={domain}
      title="Artikelen & tutorials"
      lead={lead}
      breadcrumbLabel="Artikelen"
    >
      {articles.length === 0 ? (
        <EmptyState
          title="Nog geen artikelen"
          description="Nog geen artikelen in dit domein."
          action={{ label: `Terug naar ${domain.name}`, href: `/${domain.slug}` }}
        />
      ) : (
        <GridLayout cols={3} gap="lg">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </GridLayout>
      )}
    </DomainSubListingShell>
  );
}
