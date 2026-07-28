import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ContentHubBrowser, type ContentHubItem } from "@/components/content/ContentHubBrowser";
import { EmptyState } from "@/components/ui/empty-state";
import { buildContentHubItems } from "@/lib/content/build-content-hub-items";
import {
  listArticleDomainLinks,
  listPublishedContentArticles,
} from "@/lib/platform/queries/articles";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Inspiratie: artikelen en tutorials | Hobbysalon",
  description:
    "Recente tutorials, technieken en creatieve ideeën om thuis aan de slag te gaan. Filter op hobby, niveau en soort artikel.",
  path: "/artikelen",
});

export default async function ArticlesHubPage() {
  const [articles, domains] = await Promise.all([
    listPublishedContentArticles(96),
    listActiveDomains(),
  ]);
  const links = await listArticleDomainLinks(articles.map((article) => article.id));
  const items: ContentHubItem[] = buildContentHubItems(articles, domains, links);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--section-highlight)]">
        <Container size="wide" className="py-6 sm:py-8">
          <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-[var(--foreground)]">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-[var(--foreground)]">Inspiratie</li>
            </ol>
          </nav>
          <div className="mt-5 grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.4fr)]">
            <div>
              <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl">
                Inspiratie om zelf aan de slag te gaan
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
                Tutorials, technieken en creatieve ideeën voor thuis. Dit overzicht toont
                recente inspiratie.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_10px_24px_rgb(38_58_47_/_0.06)]">
              <p className="text-sm font-semibold text-[var(--accent)]">
                Liever meteen maken?
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                Kies een patroon met materialenlijst
              </p>
              <Link
                href="/patronen"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-95 active:translate-y-px"
              >
                Bekijk patronen
              </Link>
            </div>
          </div>
        </Container>
      </div>
      <Container size="wide" className="pt-8 sm:pt-10">
        {items.length === 0 ? (
          <EmptyState
            title="Nog geen artikelen toegevoegd"
            description="Nieuwe gidsen en tutorials verschijnen hier binnenkort."
            action={{ label: "Naar home", href: "/" }}
          />
        ) : (
          <ContentHubBrowser items={items} kind="articles" />
        )}
      </Container>
    </>
  );
}
