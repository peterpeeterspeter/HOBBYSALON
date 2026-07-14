import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  Layers,
  ShoppingBag,
  CalendarDays,
  Users,
  Newspaper,
  Scissors,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import {
  WorkshopCard,
  ProductCard,
  CreatorCard,
  EventCard,
  ArticleCard,
} from "@/components/cards";
import { searchAll } from "@/lib/services/search-page";
import { getAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Zoeken | Hobbysalon",
  description:
    "Doorzoek workshops, materialen, creators, evenementen en artikelen op Hobbysalon.",
};

type SearchParams = Promise<{ q?: string; type?: string }>;

const TABS = [
  { id: "all", label: "Alles" },
  { id: "workshops", label: "Workshops" },
  { id: "materials", label: "Materialen" },
  { id: "creators", label: "Creators" },
  { id: "events", label: "Evenementen" },
  { id: "articles", label: "Artikelen" },
] as const;

const QUICK_LINKS = [
  { href: "/workshops", label: "Workshops", icon: Layers },
  { href: "/materials", label: "Materialen", icon: ShoppingBag },
  { href: "/agenda", label: "Evenementen", icon: CalendarDays },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/gratis-haakpatronen", label: "Patronen", icon: Scissors },
  { href: "/artikelen", label: "Artikelen", icon: Newspaper },
] as const;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q = "", type = "all" } = await searchParams;
  const query = q.trim();
  const hasQuery = query.length >= 2;
  const results = await searchAll(query);

  const counts = {
    all: results.total,
    workshops: results.workshops.length,
    materials: results.products.length,
    creators: results.creators.length,
    events: results.events.length,
    articles: results.articles.length,
  };

  const activeType = TABS.some((t) => t.id === type) ? type : "all";
  const show = (section: string) =>
    activeType === "all" || activeType === section;
  const hasArticleResults = hasQuery && results.total > 0 && results.articles.length > 0;
  const user = hasArticleResults ? await getAuthUser().catch(() => null) : null;
  const articleSearchParams = new URLSearchParams({ q: query, type: "articles" });
  const articleResultsHref = `/zoeken?${articleSearchParams.toString()}#zoekresultaten-artikelen`;
  const registerHref = `/register?next=${encodeURIComponent(
    `/zoeken?${articleSearchParams.toString()}`
  )}`;

  return (
    <>
      {/* Search hero */}
      <div className="border-b border-[var(--border)] bg-gradient-to-br from-[var(--section-highlight)] to-[var(--card)]">
        <Container className="py-10 sm:py-12">
          <h1 className="mb-5 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
            {hasQuery ? `Zoekresultaten voor "${query}"` : "Zoeken"}
          </h1>

          <form
            method="GET"
            action="/zoeken"
            role="search"
            className="mx-auto max-w-2xl"
          >
            <div className="relative">
              <Search
                size={20}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Zoek workshops, materialen, creators, evenementen..."
                aria-label="Zoekterm"
                autoFocus={!hasQuery}
                className="min-h-[52px] w-full rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--card)] py-3.5 pl-12 pr-4 text-[17px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
              />
            </div>
          </form>
        </Container>
      </div>

      <Container className="py-8">
        {/* No query state — category discovery */}
        {!hasQuery && (
          <div>
            <p className="mb-6 text-[var(--muted)]">
              Typ minstens twee letters om te zoeken, of blader direct door een categorie:
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-5 text-center transition-all hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 motion-reduce:hover:transform-none"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {hasQuery && results.total === 0 && (
          <EmptyState
            title={`Geen resultaten voor "${query}"`}
            description="Probeer een andere zoekterm of blader door de categorieën hieronder."
            action={{ label: "Alle workshops", href: "/workshops" }}
          />
        )}

        {/* Results */}
        {hasQuery && results.total > 0 && (
          <>
            {/* Type filter chips */}
            <div className="scrollbar-hide -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1">
              {TABS.map((tab) => {
                const count = counts[tab.id];
                if (tab.id !== "all" && count === 0) return null;
                const active = activeType === tab.id;
                const qs = new URLSearchParams({ q: query });
                if (tab.id !== "all") qs.set("type", tab.id);
                return (
                  <Link
                    key={tab.id}
                    href={`/zoeken?${qs.toString()}`}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`text-xs font-normal ${
                        active ? "opacity-80" : "text-[var(--muted)]"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>

            {hasArticleResults && (
              <aside className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--section-highlight)] px-5 py-5 sm:px-6">
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                  Van inspiratie naar maken
                </h2>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
                  U vindt hier niet alleen workshops en materialen, maar ook artikelen om rustig ideeën op te doen.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={articleResultsHref}
                    className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-base font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent)]/90"
                  >
                    Bekijk inspiratie over “{query}”
                  </Link>
                  <Link
                    href={user ? "/favorites" : registerHref}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-base font-semibold text-[var(--accent)] hover:underline"
                  >
                    {user ? "Mijn bewaarde ideeën" : "Bewaar uw ideeën"}
                  </Link>
                </div>
              </aside>
            )}

            <div className="space-y-12">
              {show("workshops") && results.workshops.length > 0 && (
                <ResultSection
                  tag="Workshops"
                  title="Workshops"
                  count={results.workshops.length}
                  href="/workshops"
                >
                  <GridLayout cols={3} gap="md">
                    {results.workshops.map((w) => (
                      <WorkshopCard key={w.id} workshop={w} />
                    ))}
                  </GridLayout>
                </ResultSection>
              )}
              {show("materials") && results.products.length > 0 && (
                <ResultSection
                  tag="Marktplaats"
                  title="Materialen"
                  count={results.products.length}
                  href="/materials"
                >
                  <GridLayout cols={4} gap="md">
                    {results.products.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </GridLayout>
                </ResultSection>
              )}
              {show("creators") && results.creators.length > 0 && (
                <ResultSection
                  tag="Makers"
                  title="Creators"
                  count={results.creators.length}
                  href="/creators"
                >
                  <GridLayout cols={4} gap="md">
                    {results.creators.map((c) => (
                      <CreatorCard key={c.id} creator={c} />
                    ))}
                  </GridLayout>
                </ResultSection>
              )}
              {show("events") && results.events.length > 0 && (
                <ResultSection
                  tag="Agenda"
                  title="Evenementen"
                  count={results.events.length}
                  href="/agenda"
                >
                  <GridLayout cols={3} gap="md">
                    {results.events.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </GridLayout>
                </ResultSection>
              )}
              {show("articles") && results.articles.length > 0 && (
                <ResultSection
                  tag="Inspiratie"
                  title="Artikelen"
                  count={results.articles.length}
                  href="/gratis-haakpatronen"
                  headingId="zoekresultaten-artikelen"
                >
                  <GridLayout cols={3} gap="md">
                    {results.articles.map((a) => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </GridLayout>
                </ResultSection>
              )}
            </div>
          </>
        )}
      </Container>
    </>
  );
}

function ResultSection({
  tag,
  title,
  count,
  href,
  headingId,
  children,
}: {
  tag: string;
  title: string;
  count: number;
  href: string;
  headingId?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">
          {tag}
        </span>
        <h2
          id={headingId}
          className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]"
        >
          {title}
        </h2>
        <span className="text-sm text-[var(--muted)]">{count}</span>
        <span className="hidden h-px flex-1 bg-[var(--border)] sm:block" />
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Bekijk alles →
        </Link>
      </div>
      <div className="mb-5" />
      {children}
    </section>
  );
}
