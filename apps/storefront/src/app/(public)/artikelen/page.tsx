import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { listPublishedContentArticles } from "@/lib/platform/queries/articles";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Artikelen, gidsen en tutorials | Hobbysalon",
  description:
    "Praktische gidsen en tutorials voor creatieve hobby's. Ontdek ideeën, leer technieken en vind materialen, workshops en makers.",
  path: "/artikelen",
});

export default async function ArticlesHubPage() {
  const articles = await listPublishedContentArticles();

  return (
    <>
      <div className="border-b border-[var(--border)] bg-gradient-to-br from-[var(--section-highlight)] to-[var(--card)]">
        <Container className="py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-[var(--foreground)]">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li className="text-[var(--foreground)]">Artikelen</li>
            </ol>
          </nav>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <BookOpen size={24} aria-hidden />
            </span>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl">
                Artikelen, gidsen en tutorials
              </h1>
              <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                Leer nieuwe technieken, vind inspiratie en ga daarna meteen verder
                met passende materialen, workshops en makers.
              </p>
              <Link
                href="/patronen"
                className="mt-4 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                Op zoek naar een patroon? Bekijk alle patronen →
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-10">
        {articles.length === 0 ? (
          <EmptyState
            title="Nog geen artikelen toegevoegd"
            description="Nieuwe gidsen en tutorials verschijnen hier binnenkort."
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
    </>
  );
}
