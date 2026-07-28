import Link from "next/link";
import type { Metadata } from "next";
import { Scissors } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ContentHubBrowser, type ContentHubItem } from "@/components/content/ContentHubBrowser";
import { EmptyState } from "@/components/ui/empty-state";
import { buildContentHubItems } from "@/lib/content/build-content-hub-items";
import {
  listArticleDomainLinks,
  listPublishedPatterns,
} from "@/lib/platform/queries/articles";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Patronen voor creatieve hobby's | Hobbysalon",
  description:
    "Ontdek patronen voor creatieve hobby's. Bekijk bijpassende materialen, hulpmiddelen, workshops en makers op Hobbysalon.",
  path: "/patronen",
});

export default async function PatternsHubPage() {
  const [patterns, domains] = await Promise.all([
    listPublishedPatterns(96),
    listActiveDomains(),
  ]);
  const links = await listArticleDomainLinks(patterns.map((article) => article.id));
  const items: ContentHubItem[] = buildContentHubItems(patterns, domains, links);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--section-highlight)]">
        <Container size="wide" className="py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-[var(--foreground)]">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-[var(--foreground)]">Patronen</li>
            </ol>
          </nav>
          <div className="mt-7 grid items-end gap-7 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.42fr)]">
            <div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                <Scissors size={24} aria-hidden />
              </span>
              <h1 className="mt-5 max-w-3xl font-[family-name:var(--font-heading)] text-4xl font-bold leading-tight text-[var(--foreground)] sm:text-5xl">
                Kies een patroon en begin met maken
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                Vind een project dat bij je past. We verbinden je patroon met materialen,
                tools, workshops en makers.
              </p>
            </div>
            <Link
              href="/gratis-haakpatronen"
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-[0_10px_24px_rgb(38_58_47_/_0.06)] transition-transform hover:-translate-y-0.5 active:translate-y-px"
            >
              <p className="text-sm font-semibold text-[var(--accent)]">Gratis beginnen</p>
              <p className="mt-2 text-xl font-semibold">Gratis haakpatronen</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Een afzonderlijke collectie met Nederlandstalige patronen.
              </p>
            </Link>
          </div>
        </Container>
      </div>
      <Container size="wide" className="pt-8 sm:pt-10">
        {items.length === 0 ? (
          <EmptyState
            title="Nog geen patronen toegevoegd"
            description="Nieuwe patronen verschijnen hier binnenkort."
            action={{ label: "Naar home", href: "/" }}
          />
        ) : (
          <ContentHubBrowser items={items} kind="patterns" />
        )}
      </Container>
    </>
  );
}
