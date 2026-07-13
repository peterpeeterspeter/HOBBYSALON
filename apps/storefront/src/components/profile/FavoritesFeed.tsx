"use client";

import { useMemo, useState } from "react";
import { GridLayout } from "@/components/layout/grid-layout";
import { SavedFeedCard } from "@/components/profile/SavedFeedCard";
import {
  filterFavoriteFeed,
  type FavoriteFeedFilterType,
} from "@/lib/profile/favorite-feed-filter";
import type { FavoriteFeedItem } from "@/lib/profile/favorite-feed";

const filterOptions: Array<{ value: FavoriteFeedFilterType; label: string }> = [
  { value: "all", label: "Alles" },
  { value: "startable", label: "Zelf starten (artikelen & projecten)" },
  { value: "workshops", label: "Workshops" },
  { value: "materials", label: "Materialen & producten" },
];

export function FavoritesFeed({ items }: { items: FavoriteFeedItem[] }) {
  const [type, setType] = useState<FavoriteFeedFilterType>("all");
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => filterFavoriteFeed(items, { type, search }), [items, search, type]);
  const hasActiveFilters = type !== "all" || search.trim() !== "";
  const clearFilters = () => {
    setType("all");
    setSearch("");
  };

  return (
    <section aria-label="Je bewaarde ideeën filteren">
      <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <label htmlFor="favorite-search" className="block text-base font-semibold text-[var(--foreground)]">
          Zoek in je bewaarde ideeën
        </label>
        <input
          id="favorite-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Bijvoorbeeld: wol, haken of Antwerpen"
          className="mt-2 min-h-12 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        />

        <fieldset className="mt-5">
          <legend className="text-base font-semibold text-[var(--foreground)]">Toon</legend>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Filter bewaarde ideeën">
            {filterOptions.map((option) => (
              <label
                key={option.value}
                className="flex min-h-12 cursor-pointer items-center rounded-md border border-[var(--border)] bg-[var(--background)] px-4 text-base font-medium text-[var(--foreground)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--section-highlight)]"
              >
                <input
                  type="radio"
                  name="favorite-type"
                  value={option.value}
                  checked={type === option.value}
                  onChange={() => setType(option.value)}
                  className="mr-2 h-5 w-5 accent-[var(--accent)]"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" aria-atomic="true" className="text-base font-semibold text-[var(--foreground)]">
            {filteredItems.length} {filteredItems.length === 1 ? "bewaard idee" : "bewaarde ideeën"} gevonden
          </p>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="min-h-12 rounded-md border border-[var(--border)] px-4 text-base font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Filters wissen
          </button>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <GridLayout cols={3} gap="lg">
          {filteredItems.map((item) => <SavedFeedCard key={`${item.entityType}:${item.id}`} item={item} />)}
        </GridLayout>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-base text-[var(--foreground)]">
          <h2 className="text-xl font-semibold">Geen bewaarde ideeën gevonden</h2>
          <p className="mt-2 text-[var(--muted)]">Probeer een andere zoekterm of wis de filters.</p>
        </div>
      )}
    </section>
  );
}
