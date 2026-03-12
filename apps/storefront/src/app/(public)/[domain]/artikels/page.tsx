import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listArticlesByDomain } from "@/lib/platform/queries/articles";
import { ArticleCard } from "@/components/cards";
import { Container } from "@/components/ui/container";
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

  return (
    <Container className="py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/${domain.slug}`} className="hover:text-[var(--foreground)]">
              {domain.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">Artikelen</li>
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          {domain.name} artikelen
        </h1>
      </header>

      {articles.length === 0 ? (
        <EmptyState
          title="Nog geen artikelen"
          description="Nog geen artikelen in dit domein."
          action={{ label: "Terug naar domein", href: `/${domain.slug}` }}
        />
      ) : (
        <GridLayout cols={3} gap="lg">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </GridLayout>
      )}
    </Container>
  );
}
