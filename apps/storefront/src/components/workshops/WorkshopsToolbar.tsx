"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

const SORT_OPTIONS = [
  { value: "relevance", label: "Aanbevolen" },
  { value: "newest", label: "Nieuwste eerst" },
  { value: "price_asc", label: "Prijs (laag → hoog)" },
];

type WorkshopsToolbarProps = {
  resultCount: number;
  totalCount: number;
  view: "grid" | "list";
};

/**
 * Client toolbar for the workshops listing: result count, sort selector and a
 * grid/list view toggle. Sort and view are reflected in the URL so the server
 * keeps rendering the right layout (senior-friendly, shareable, no client state).
 */
export function WorkshopsToolbar({
  resultCount,
  totalCount,
  view,
}: WorkshopsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sort = params.get("sort") ?? "relevance";

  function hrefWith(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key !== "view") next.delete("page");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const viewBtn =
    "flex h-8 w-8 items-center justify-center rounded-md transition-colors";

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <p className="text-[15px] text-[var(--muted)]">
        <strong className="font-bold text-[var(--foreground)]">{totalCount}</strong>{" "}
        workshop{totalCount === 1 ? "" : "s"} gevonden
        {totalCount > resultCount ? (
          <span className="text-[var(--muted)]"> · {resultCount} op deze pagina</span>
        ) : null}
      </p>
      <div className="flex items-center gap-3">
        <label htmlFor="workshops-sort" className="text-sm font-medium text-[var(--muted)]">
          Sorteren:
        </label>
        <select
          id="workshops-sort"
          value={sort}
          onChange={(e) => router.push(hrefWith("sort", e.target.value))}
          className="min-h-9 cursor-pointer rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5">
          <button
            type="button"
            aria-label="Rasterweergave"
            aria-pressed={view === "grid"}
            onClick={() => router.push(hrefWith("view", "grid"))}
            className={`${viewBtn} ${view === "grid" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--accent)]"}`}
          >
            <LayoutGrid size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Lijstweergave"
            aria-pressed={view === "list"}
            onClick={() => router.push(hrefWith("view", "list"))}
            className={`${viewBtn} ${view === "list" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--accent)]"}`}
          >
            <List size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
