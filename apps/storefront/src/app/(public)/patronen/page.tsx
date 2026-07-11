import Link from "next/link";
import { Scissors } from "lucide-react";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { listPublishedPatterns } from "@/lib/platform/queries/articles";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Patronen voor creatieve hobby's | Hobbysalon",
  description:
    "Ontdek patronen voor creatieve hobby's. Bekijk bijpassende materialen, hulpmiddelen, workshops en makers op Hobbysalon.",
  path: "/patronen",
});

export default async function PatternsHubPage() {
  const patterns = await listPublishedPatterns();

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
              <li className="text-[var(--foreground)]">Patronen</li>
            </ol>
          </nav>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <Scissors size={24} aria-hidden />
            </span>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl">
                Patronen voor je volgende project
              </h1>
              <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                Kies een patroon en ontdek meteen welke materialen, tools,
                workshops en makers erbij passen.
              </p>
              <Link
                href="/gratis-haakpatronen"
                className="mt-4 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                Alleen gratis Nederlandstalige haakpatronen bekijken →
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-10">
        {patterns.length === 0 ? (
          <EmptyState
            title="Nog geen patronen toegevoegd"
            description="Nieuwe patronen verschijnen hier binnenkort."
            action={{ label: "Naar home", href: "/" }}
          />
        ) : (
          <GridLayout cols={3} gap="lg">
            {patterns.map((pattern) => (
              <ArticleCard key={pattern.id} article={pattern} />
            ))}
          </GridLayout>
        )}
      </Container>
    </>
  );
}
