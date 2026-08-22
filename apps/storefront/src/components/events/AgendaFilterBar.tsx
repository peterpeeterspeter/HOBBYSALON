import Link from "next/link";
import { cn } from "@/lib/utils";

export const AGENDA_EVENT_TYPE_OPTIONS = [
  { value: "handmade_market", label: "Handmade markt" },
  { value: "hobby_fair", label: "Hobbybeurs" },
  { value: "pop_up", label: "Pop-up" },
  { value: "open_atelier", label: "Open atelier" },
  { value: "workshop_day", label: "Workshopdag" },
] as const;

type AgendaFilterBarProps = {
  activeType?: string;
  activeCountry?: string;
  countries: string[];
  buildHref: (overrides: Record<string, string | undefined>) => string;
  clearHref: string;
  hasExtraFilters: boolean;
};

/**
 * Compact bar: Type event + Meer filters (land, clear). No date duplicate.
 */
export function AgendaFilterBar({
  activeType,
  activeCountry,
  countries,
  buildHref,
  clearHref,
  hasExtraFilters,
}: AgendaFilterBarProps) {
  const typeLabel =
    AGENDA_EVENT_TYPE_OPTIONS.find((o) => o.value === activeType)?.label ??
    "Type event";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="relative">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden",
            activeType
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
          )}
        >
          {activeType ? typeLabel : "Type event"}
        </summary>
        <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)] sm:left-0 sm:right-auto">
          <Link
            href={buildHref({ type: undefined, page: undefined })}
            className="min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]"
          >
            Alle types
          </Link>
          {AGENDA_EVENT_TYPE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ type: option.value, page: undefined })}
              className={cn(
                "min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]",
                activeType === option.value && "bg-[var(--accent)]/10 text-[var(--accent)]"
              )}
              aria-current={activeType === option.value ? "true" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </details>

      <details className="relative">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden",
            activeCountry || hasExtraFilters
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--card)]"
          )}
        >
          Filters
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,18rem)] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-md)]">
          <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">Land</p>
          <div className="mb-3 flex max-h-48 flex-col gap-1 overflow-y-auto">
            <Link
              href={buildHref({ country: undefined, page: undefined })}
              className="min-h-10 rounded-lg px-2 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]"
            >
              Alle landen
            </Link>
            {countries.map((code) => (
              <Link
                key={code}
                href={buildHref({ country: code, page: undefined })}
                className={cn(
                  "min-h-10 rounded-lg px-2 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]",
                  activeCountry === code && "bg-[var(--accent)]/10 text-[var(--accent)]"
                )}
              >
                {code}
              </Link>
            ))}
          </div>
          <Link
            href={clearHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--border)] text-[15px] font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Wis alle filters
          </Link>
        </div>
      </details>
    </div>
  );
}
