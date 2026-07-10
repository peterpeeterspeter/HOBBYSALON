import Link from "next/link";
import { X } from "lucide-react";

export type FilterChip = {
  label: string;
  /** URL with this filter removed. */
  removeHref: string;
};

type ActiveFilterChipsProps = {
  chips: FilterChip[];
  clearHref: string;
};

/**
 * Removable chips summarising the active filters, with an "Alles wissen" reset.
 * Pure links — works without JavaScript.
 */
export function ActiveFilterChips({ chips, clearHref }: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="shrink-0 text-[13px] font-semibold text-[var(--muted)]">Filters:</span>
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.removeHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[13px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
        >
          {chip.label}
          <X size={13} aria-hidden />
        </Link>
      ))}
      <Link
        href={clearHref}
        className="rounded-full px-2 py-1 text-[13px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--error)]"
      >
        Alles wissen
      </Link>
    </div>
  );
}
