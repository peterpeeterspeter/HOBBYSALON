import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Container } from "@/components/ui/container";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  WorkshopCard,
  ProductCard,
  CreatorCard,
  EventCard,
  ArticleCard,
} from "@/components/cards";
import { searchAll } from "@/lib/services/search-page";

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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q = "", type = "all" } = await searchParams;
  const query = q.trim();
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
  const show = (section: string) => activeType === "all" || activeType === section;

  return (
    <Container className="py-8">
      <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
        Zoeken
      </h1>

      <form method="GET" action="/zoeken" role="search" className="mt-4 flex max-w-2xl gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--muted)]"
          />
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Zoek workshops, materialen, creators..."
            aria-label="Zoekterm"
            className="pl-10"
          />
        </div>
        <Button type="submit">Zoeken</Button>
      </form>

      {query.length < 2 ? (
        <p className="mt-8 text-[var(--muted)]">
          Typ minstens twee letters om te zoeken.
        </p>
      ) : results.total === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={`Geen resultaten voor "${query}"`}
            description="Probeer een andere zoekterm of bekijk alle workshops."
            action={{ label: "Alle workshops", href: "/workshops" }}
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-[var(--muted)]">
            <strong className="text-[var(--foreground)]">{results.total}</strong>{" "}
            resultaten voor{" "}
            <strong className="text-[var(--foreground)]">&ldquo;{query}&rdquo;</strong>
          </p>

          <div className="mt-4 flex flex-wrap gap-1 border-b border-[var(--border)]">
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
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab.label}{" "}
                  <span className="text-xs font-normal">({count})</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 space-y-12">
            {show("workshops") && results.workshops.length > 0 && (
              <ResultSection title="Workshops" href="/workshops">
                <GridLayout cols={3} gap="md">
                  {results.workshops.map((w) => (
                    <WorkshopCard key={w.id} workshop={w} />
                  ))}
                </GridLayout>
              </ResultSection>
            )}
            {show("materials") && results.products.length > 0 && (
              <ResultSection title="Materialen" href="/materials">
                <GridLayout cols={4} gap="md">
                  {results.products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </GridLayout>
              </ResultSection>
            )}
            {show("creators") && results.creators.length > 0 && (
              <ResultSection title="Creators" href="/creators">
                <GridLayout cols={4} gap="md">
                  {results.creators.map((c) => (
                    <CreatorCard key={c.id} creator={c} />
                  ))}
                </GridLayout>
              </ResultSection>
            )}
            {show("events") && results.events.length > 0 && (
              <ResultSection title="Evenementen" href="/agenda">
                <GridLayout cols={3} gap="md">
                  {results.events.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </GridLayout>
              </ResultSection>
            )}
            {show("articles") && results.articles.length > 0 && (
              <ResultSection title="Artikelen" href="/gratis-haakpatronen">
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
  );
}

function ResultSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
          {title}
        </h2>
        <span className="h-px flex-1 bg-[var(--border)]" />
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Bekijk alle →
        </Link>
      </div>
      {children}
    </section>
  );
}
