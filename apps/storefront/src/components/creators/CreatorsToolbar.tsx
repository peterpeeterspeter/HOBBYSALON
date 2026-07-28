import Link from "next/link";
import { cn } from "@/lib/utils";

type CreatorsToolbarProps = {
  totalCount: number;
  activeSort: "recommended" | "newest";
  buildHref: (overrides: Record<string, string | undefined>) => string;
};

export function CreatorsToolbar({
  totalCount,
  activeSort,
  buildHref,
}: CreatorsToolbarProps) {
  const label =
    totalCount === 1 ? "1 maker gevonden" : `${totalCount} makers gevonden`;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[15px] text-[var(--muted)]">
        <strong className="font-bold text-[var(--foreground)]">{label}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--muted)]">Sorteer:</span>
        <Link
          href={buildHref({ sort: undefined, page: undefined })}
          className={cn(
            "inline-flex min-h-11 items-center rounded-lg border px-3 text-[14px] font-semibold",
            activeSort === "recommended"
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--card)]"
          )}
        >
          Aanbevolen
        </Link>
        <Link
          href={buildHref({ sort: "newest", page: undefined })}
          className={cn(
            "inline-flex min-h-11 items-center rounded-lg border px-3 text-[14px] font-semibold",
            activeSort === "newest"
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--card)]"
          )}
        >
          Nieuw
        </Link>
      </div>
    </div>
  );
}
