"use client";

import { useMemo, useState } from "react";
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
];

type ToolsBrowserProps = {
  tools: ToolSummary[];
};

/**
 * Client-side browser for the tools hub: instant text search + category
 * filtering over the static registry (no server round-trip needed). Results
 * are grouped by category in the canonical order.
 */
export function ToolsBrowser({ tools }: ToolsBrowserProps) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ToolCategory | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (activeCat !== "all" && tool.category !== activeCat) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      );
    });
  }, [tools, query, activeCat]);

  const groups = useMemo(
    () =>
      CATEGORY_META.map((cat) => ({
        ...cat,
        tools: filtered.filter((t) => t.category === cat.id),
      })).filter((g) => g.tools.length > 0),
    [filtered]
  );

  return (
    <div>
      {/* Search + category filters */}
      <div className="mb-8 flex flex-col gap-4">
        <div className="relative max-w-xl">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een tool, bijv. garen, gauge, kleur..."
            aria-label="Zoek tools"
            className="min-h-[48px] w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-3 pl-11 pr-4 text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>

        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <CategoryChip
            label="Alle"
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
          />
          {CATEGORY_META.map((cat) => (
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

      {/* Results */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] py-16 text-center">
          <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
            Geen tools gevonden
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Probeer een andere zoekterm of kies een andere categorie.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.id}>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <group.icon size={18} aria-hidden />
                </span>
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                  {group.label}
                </h2>
                <span className="text-sm font-medium text-[var(--muted)]">
                  {group.tools.length}
                </span>
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
    >
      {Icon && <Icon size={15} aria-hidden />}
      {label}
    </button>
  );
}
