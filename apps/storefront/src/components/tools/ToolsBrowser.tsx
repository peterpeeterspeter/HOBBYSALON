"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Scissors,
  Ruler,
  PenTool,
  Palette,
  LayoutGrid,
  ClipboardList,
  Shirt,
  Circle,
  Frame,
  Layers,
  Flame,
  Droplets,
  Gem,
  FileText,
  Briefcase,
  ArrowRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { ToolCard } from "./ToolCard";
import type { ToolCategory, ToolSummary } from "@/lib/tools/registry";

/** Ordered category metadata (label + icon) for the browser navigation. */
const CATEGORY_META: { id: ToolCategory; label: string; icon: LucideIcon }[] = [
  { id: "garen-draad", label: "Garen & draad", icon: Scissors },
  { id: "maat-stekenproef", label: "Maat & stekenproef", icon: Ruler },
  { id: "naaldmaat", label: "Naaldmaat & haaknaald", icon: PenTool },
  { id: "kleur", label: "Kleur & draadkleur", icon: Palette },
  { id: "patroon", label: "Patroon & grafieken", icon: LayoutGrid },
  { id: "planning", label: "Projectplanning", icon: ClipboardList },
  { id: "breien", label: "Breien", icon: Shirt },
  { id: "haken", label: "Haken", icon: Circle },
  { id: "borduren", label: "Borduren", icon: Frame },
  { id: "naaien", label: "Naaien & quilten", icon: Layers },
  { id: "kaarsen", label: "Kaarsen maken", icon: Flame },
  { id: "hars", label: "Resin & hars", icon: Droplets },
  { id: "sieraden", label: "Sieraden & kralen", icon: Gem },
  { id: "papier", label: "Papier & kaarten", icon: FileText },
  { id: "zakelijk", label: "Zakelijk voor makers", icon: Briefcase },
];

/** High-intent calculators surfaced first on the unfiltered hub. */
const FEATURED_SLUGS = [
  "stofcalculator",
  "quiltcalculator",
  "garencalculator",
  "papier-snijcalculator",
  "kaarsen-wascalculator",
  "workshop-break-even",
] as const;

type ToolsBrowserProps = {
  tools: ToolSummary[];
};

/**
 * Client-side browser for the tools hub: instant text search + category
 * filtering over the static registry. Senior-friendly: large controls,
 * wrap filters (no hidden horizontal scroll), featured pick, clear reset.
 */
export function ToolsBrowser({ tools }: ToolsBrowserProps) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ToolCategory | "all">("all");

  const categoriesWithTools = useMemo(() => {
    const present = new Set(tools.map((t) => t.category));
    return CATEGORY_META.filter((cat) => present.has(cat.id));
  }, [tools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (activeCat !== "all" && tool.category !== activeCat) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [tools, query, activeCat]);

  const filtersActive = activeCat !== "all" || query.trim().length > 0;

  const featured = useMemo(() => {
    if (filtersActive) {
      return filtered[0] ?? null;
    }
    for (const slug of FEATURED_SLUGS) {
      const match = filtered.find((t) => t.slug === slug);
      if (match) return match;
    }
    return filtered[0] ?? null;
  }, [filtered, filtersActive]);

  const gridTools = useMemo(() => {
    if (!featured) return filtered;
    return filtered.filter((t) => t.slug !== featured.slug);
  }, [filtered, featured]);

  const groups = useMemo(
    () =>
      CATEGORY_META.map((cat) => ({
        ...cat,
        tools: gridTools.filter((t) => t.category === cat.id),
      })).filter((g) => g.tools.length > 0),
    [gridTools]
  );

  function resetFilters() {
    setQuery("");
    setActiveCat("all");
  }

  return (
    <div>
      <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--section-highlight)] p-4 sm:p-5">
        <div className="relative">
          <Search
            size={20}
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een calculator, bijv. stof, garen, kaars…"
            aria-label="Zoek tools"
            className="min-h-12 w-full rounded-[0.85rem] border border-[var(--border)] bg-[var(--card)] py-3 pl-12 pr-4 text-base text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">
            Filter op hobby
          </p>
          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label="Alle tools"
              active={activeCat === "all"}
              onClick={() => setActiveCat("all")}
            />
            {categoriesWithTools.map((cat) => (
              <CategoryChip
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                active={activeCat === cat.id}
                onClick={() =>
                  setActiveCat((prev) => (prev === cat.id ? "all" : cat.id))
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]/70 pt-3">
          <p className="text-sm text-[var(--muted)]" aria-live="polite">
            <span className="font-semibold text-[var(--foreground)]">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "tool" : "tools"}
            {activeCat !== "all"
              ? ` in ${categoriesWithTools.find((c) => c.id === activeCat)?.label ?? "deze categorie"}`
              : ""}
            {query.trim() ? ` voor “${query.trim()}”` : ""}
          </p>
          {filtersActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              <X size={16} aria-hidden />
              Filters wissen
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-[1.25rem] border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center">
          <p className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Geen tools gevonden
          </p>
          <p className="mx-auto mt-2 max-w-md text-base text-[var(--muted)]">
            Probeer een kortere zoekterm, of wis de filters om alles weer te zien.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-[var(--accent)] px-5 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
          >
            Toon alle tools
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {featured ? (
            <FeaturedTool
              tool={featured}
              eyebrow={filtersActive ? "Gekozen voor jou" : "Uitgelicht"}
            />
          ) : null}

          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`tools-${group.id}`}>
              <div className="mb-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                    <group.icon size={20} aria-hidden />
                  </span>
                  <div>
                    <h2
                      id={`tools-${group.id}`}
                      className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]"
                    >
                      {group.label}
                    </h2>
                    <span
                      className="mt-1.5 block h-[3px] w-10 rounded-full bg-[var(--accent)]"
                      aria-hidden
                    />
                  </div>
                  <span className="ml-auto text-sm font-medium text-[var(--muted)]">
                    {group.tools.length}
                  </span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedTool({
  tool,
  eyebrow,
}: {
  tool: ToolSummary;
  eyebrow: string;
}) {
  return (
    <section aria-labelledby="featured-tool-title">
      <Link
        href={`/tools/${tool.slug}`}
        className="group block overflow-hidden rounded-[1.25rem] border border-[var(--accent)]/25 bg-[var(--card)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--accent)]"
      >
        <div className="grid md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center p-6 sm:p-8 md:p-10">
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
              {eyebrow}
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--muted)]">
              {tool.categoryLabel}
            </p>
            <h2
              id="featured-tool-title"
              className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl"
            >
              {tool.title}
            </h2>
            <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-[var(--muted)] sm:text-lg">
              {tool.description}
            </p>
            <span className="mt-6 inline-flex min-h-12 w-fit items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-base font-semibold text-[var(--accent-foreground)] transition-colors group-hover:bg-[var(--accent-hover)]">
              Open calculator
              <ArrowRight
                size={18}
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
              />
            </span>
          </div>
          <div
            className="relative min-h-[180px] bg-[var(--section-alt)] md:min-h-full"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_55%),radial-gradient(ellipse_at_80%_70%,color-mix(in_srgb,var(--accent-secondary)_18%,transparent),transparent_50%)]" />
            <div className="absolute inset-6 flex flex-col justify-end rounded-[1rem] border border-[var(--border)]/80 bg-[var(--card)]/80 p-5 backdrop-blur-[2px]">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Direct in je browser
              </p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                Gratis · geen account
              </p>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

function CategoryChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
    >
      {Icon ? <Icon size={16} aria-hidden /> : null}
      {label}
    </button>
  );
}
