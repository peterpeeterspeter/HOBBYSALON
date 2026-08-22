import Link from "next/link";
import { cn } from "@/lib/utils";

type MaterialsSort = "recommended" | "newest" | "price_asc" | "price_desc";

type MaterialsCatalogToolbarProps = {
  totalCount: number;
  activeSort: MaterialsSort;
  buildHref: (overrides: Record<string, string | undefined>) => string;
};

const SORT_LINKS: Array<{ value: MaterialsSort | undefined; label: string }> = [
  { value: undefined, label: "Aanbevolen" },
  { value: "newest", label: "Nieuw" },
  { value: "price_asc", label: "Prijs ↑" },
  { value: "price_desc", label: "Prijs ↓" },
];

export function MaterialsCatalogToolbar({
  totalCount,
  activeSort,
  buildHref,
}: MaterialsCatalogToolbarProps) {
  const label =
    totalCount === 1 ? "1 materiaal" : `${totalCount} materialen`;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[15px] text-[var(--muted)]">
        <strong className="font-bold text-[var(--foreground)]">{label}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--muted)]">Sorteer:</span>
        {SORT_LINKS.map((link) => {
          const isActive =
            (link.value == null && activeSort === "recommended") ||
            link.value === activeSort;
          return (
            <Link
              key={link.label}
              href={buildHref({
                sort: link.value,
                page: undefined,
              })}
              className={cn(
                "inline-flex min-h-11 items-center rounded-lg border px-3 text-[14px] font-semibold",
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--card)]"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
