import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MaterialsPaginationProps = {
  page: number;
  hasNextPage: boolean;
  hrefForPage: (page: number) => string;
};

/**
 * Page navigation for the materials grid. The marketplace query is cursor-style
 * (no total count), so we expose styled prev / current / next controls.
 */
export function MaterialsPagination({
  page,
  hasNextPage,
  hrefForPage,
}: MaterialsPaginationProps) {
  if (page === 1 && !hasNextPage) return null;

  const base =
    "inline-flex min-h-10 items-center gap-1 rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginering">
      <Link
        href={hrefForPage(page - 1)}
        aria-label="Vorige pagina"
        aria-disabled={page <= 1}
        className={`${base} ${page <= 1 ? disabled : ""}`}
      >
        <ChevronLeft size={16} aria-hidden /> Vorige
      </Link>
      <span className="inline-flex min-h-10 items-center rounded-lg border-[1.5px] border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold text-white">
        {page}
      </span>
      <Link
        href={hrefForPage(page + 1)}
        aria-label="Volgende pagina"
        aria-disabled={!hasNextPage}
        className={`${base} ${!hasNextPage ? disabled : ""}`}
      >
        Volgende <ChevronRight size={16} aria-hidden />
      </Link>
    </nav>
  );
}
