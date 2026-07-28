import type { Metadata } from "next";
import Link from "next/link";
import {
  Layers,
  ShoppingBag,
  CalendarDays,
  Users,
  Newspaper,
  Scissors,
} from "lucide-react";
import {
  ListingHeroBand,
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import {
  WorkshopCard,
  ProductCard,
  ArticleCard,
} from "@/components/cards";
import { AgendaEventRow } from "@/components/events/AgendaEventRow";
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
      <ListingHeroBand
        title={hasQuery ? `Zoekresultaten voor "${query}"` : "Zoeken"}
        lead={
          hasQuery
            ? undefined
            : "Vind workshops, materialen, makers, evenementen en artikelen."
        }
        imageSrc={LANDING_IMAGES.craftsGrid}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="text-sm text-white/75">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-white">Zoeken</li>
            </ol>
          </nav>
        }
      >
        <form method="GET" action="/zoeken" role="search">
          <ListingSearchShell
            id="zoeken-q"
            name="q"
            placeholder="Zoek workshops, materialen, creators, evenementen..."
            defaultValue={query}
            label="Zoekterm"
          />
        </form>
      </ListingHeroBand>

      <Container className="py-8">
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
                  className="flex flex-col items-center gap-2.5 rounded-[1rem] bg-[var(--section-alt)] px-4 py-5 text-center transition-colors hover:bg-[var(--section-highlight)]"
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

        {hasQuery && results.total === 0 && (
          <EmptyState
            title={`Geen resultaten voor "${query}"`}
            description="Probeer een andere zoekterm of blader door de categorieën hieronder."
            action={{ label: "Alle workshops", href: "/workshops" }}
          />
        )}

        {hasQuery && results.total > 0 && (
          <>
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
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
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
              <aside className="mb-8 rounded-[1.25rem] bg-[var(--section-highlight)] px-5 py-5 sm:px-6">
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                  Van inspiratie naar maken
                </h2>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
                  U vindt hier niet alleen workshops en materialen, maar ook artikelen om rustig ideeën op te doen.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={articleResultsHref}
                    className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-base font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
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
                  title="Creators"
                  count={results.creators.length}
                  href="/creators"
                >
                  <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 [scrollbar-width:thin]">
                    {results.creators.map((c) => (
                      <Link
                        key={c.id}
                        href={`/creator/${c.slug}`}
                        className="group w-36 shrink-0 sm:w-auto"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]">
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--muted)]/40">
                              {c.display_name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <p className="mt-2 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--foreground)] line-clamp-2">
                          {c.display_name}
                        </p>
                        {c.city ? (
                          <p className="mt-0.5 text-sm text-[var(--muted)]">{c.city}</p>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </ResultSection>
              )}
              {show("events") && results.events.length > 0 && (
                <ResultSection
                  title="Evenementen"
                  count={results.events.length}
                  href="/agenda"
                >
                  <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {results.events.map((e) => (
                      <li key={e.id}>
                        <AgendaEventRow event={e} />
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}
              {show("articles") && results.articles.length > 0 && (
                <ResultSection
                  title="Artikelen"
                  count={results.articles.length}
                  href="/gratis-haakpatronen"
                  headingId="zoekresultaten-artikelen"
                >
                  {activeType === "all" ? (
                    <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                      {results.articles.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/artikel/${a.slug}`}
                            className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                          >
                            {a.featured_image_url ? (
                              <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                                <img
                                  src={a.featured_image_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                                {a.title}
                              </h3>
                              {a.excerpt ? (
                                <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                                  {a.excerpt}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                              Lees
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <GridLayout cols={3} gap="md">
                      {results.articles.map((a) => (
                        <ArticleCard key={a.id} article={a} />
                      ))}
                    </GridLayout>
                  )}
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
  title,
  count,
  href,
  headingId,
  children,
}: {
  title: string;
  count: number;
  href: string;
  headingId?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2
            id={headingId}
            className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]"
          >
            {title}
          </h2>
          <span className="text-sm text-[var(--muted)]">{count}</span>
        </div>
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Bekijk alles
        </Link>
      </div>
      {children}
    </section>
  );
}
