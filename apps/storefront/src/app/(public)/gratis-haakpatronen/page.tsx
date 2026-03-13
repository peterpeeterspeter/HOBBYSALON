import Link from "next/link";
import type { Metadata } from "next";

import { ArticleCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { listFreeDutchCrochetPatternArticles } from "@/lib/platform/queries/articles";

export const metadata: Metadata = {
  title: "Gratis Nederlandstalige haakpatronen | Hobbysalon",
  description:
    "Verzameling van gratis Nederlandstalige haakpatronen en betrouwbare bronnen.",
};

export default async function FreeDutchCrochetPatternsPage() {
  const articles = await listFreeDutchCrochetPatternArticles(120);

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
          <li className="text-[var(--foreground)]">Gratis NL haakpatronen</li>
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          Gratis Nederlandstalige haakpatronen
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Curatie van gratis haakpatronen in het Nederlands, verzameld per bron.
        </p>
      </header>

      {articles.length === 0 ? (
        <EmptyState
          title="Nog geen patronen toegevoegd"
          description="Importeer eerst bronnen om deze afdeling te vullen."
          action={{ label: "Naar home", href: "/" }}
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
