"use client";

import { useState } from "react";
import {
  ArticleCard,
  EventCard,
  ProductCard,
  WorkshopCard,
} from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import type { DiscoveryFeedItem } from "@/lib/services/discovery-feed";
import type { Article, Event, Product, Workshop } from "@/types/platform";
import {
  filterDiscoveryFeed,
  type DiscoveryFeedFilter,
} from "./discovery-feed-filters";

type HomeDiscoveryFeedItem = DiscoveryFeedItem<
  Article,
  Product & { price?: { amount: number; currency_code: string } | null },
  Workshop,
  Event
>;

const FILTER_OPTIONS: { value: DiscoveryFeedFilter; label: string }[] = [
  { value: "all", label: "Alles" },
  { value: "articles", label: "Artikelen" },
  { value: "materials", label: "Materialen" },
  { value: "workshops", label: "Workshops" },
  { value: "events", label: "Evenementen" },
];

function DiscoveryFeedCard({ item }: { item: HomeDiscoveryFeedItem }) {
  switch (item.type) {
    case "article":
      return <ArticleCard article={item.item} />;
    case "supply":
      return <ProductCard product={item.item} />;
    case "workshop":
      return <WorkshopCard workshop={item.item} />;
    case "event":
      return <EventCard event={item.item} />;
  }
}

export function DiscoveryFeed({ items }: { items: HomeDiscoveryFeedItem[] }) {
  const [filter, setFilter] = useState<DiscoveryFeedFilter>("all");
  const filteredItems = filterDiscoveryFeed(items, filter);
  const selectedLabel = FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "Alles";
  const resultLabel = `${filteredItems.length} ${filteredItems.length === 1 ? "resultaat" : "resultaten"} voor ${selectedLabel.toLowerCase()}`;

  return (
    <div className="mt-6">
      <fieldset>
        <legend className="sr-only">Filter ontdekkingen</legend>
        <div className="flex flex-wrap gap-3" aria-label="Filter ontdekkingen">
          {FILTER_OPTIONS.map((option) => {
            const isSelected = filter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setFilter(option.value)}
                className={`min-h-12 rounded-xl border px-5 py-2 text-base font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
          {filter !== "all" && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="min-h-12 rounded-xl px-5 py-2 text-base font-semibold text-[var(--foreground)] underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Wis filter
            </button>
          )}
        </div>
      </fieldset>

      <p className="mt-4 text-base font-medium text-[var(--muted)]" role="status" aria-live="polite" aria-atomic="true">
        {resultLabel}
      </p>

      {filteredItems.length > 0 ? (
        <GridLayout cols={4} gap="md" className="mt-5">
          {filteredItems.map((item) => (
            <DiscoveryFeedCard key={`${item.type}-${item.item.id}`} item={item} />
          ))}
        </GridLayout>
      ) : (
        <p className="mt-5 text-lg text-[var(--muted)]">Er zijn nu geen items in deze categorie.</p>
      )}
    </div>
  );
}
