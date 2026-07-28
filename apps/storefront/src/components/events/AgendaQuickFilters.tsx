import Link from "next/link";
import { cn } from "@/lib/utils";
import { AgendaPlaceDialog } from "./AgendaPlaceDialog";

type AgendaQuickFiltersProps = {
  placeLabel: string | null;
  placeValue: string | null;
  activeWhen: string | null;
  customFrom?: string;
  customTo?: string;
  buildHref: (overrides: Record<string, string | undefined>) => string;
  /** Current agenda URL for save-region redirect. */
  currentHref: string;
  cities: string[];
  savedRegionLabel: string | null;
};

const DATE_PRESETS: Array<{ when: string; label: string }> = [
  { when: "weekend", label: "Dit weekend" },
  { when: "month", label: "Deze maand" },
];

/**
 * Place chip + date presets + custom date picker. Date lives here only.
 */
export function AgendaQuickFilters({
  placeLabel,
  placeValue,
  activeWhen,
  customFrom,
  customTo,
  buildHref,
  currentHref,
  cities,
  savedRegionLabel,
}: AgendaQuickFiltersProps) {
  const isCustom = Boolean(customFrom || customTo) && !activeWhen;

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AgendaPlaceDialog
          placeValue={placeValue}
          placeLabel={placeLabel}
          cities={cities}
          buildHref={buildHref}
          currentHref={currentHref}
          savedRegionLabel={savedRegionLabel}
        />

        {DATE_PRESETS.map((preset) => {
          const active = activeWhen === preset.when;
          return (
            <Link
              key={preset.when}
              href={buildHref({
                when: active ? undefined : preset.when,
                from: undefined,
                to: undefined,
                page: undefined,
              })}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
              )}
              aria-current={active ? "true" : undefined}
            >
              {preset.label}
            </Link>
          );
        })}

        <details className="relative">
          <summary
            className={cn(
              "inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border px-4 text-[15px] font-semibold transition-colors [&::-webkit-details-marker]:hidden",
              isCustom
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
            )}
          >
            Kies datum
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-[min(100vw-2rem,20rem)] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-md)]">
            <form method="GET" action="/agenda" className="flex flex-col gap-3">
              {/* Preserve non-date params via buildHref keys passed as hidden — caller embeds via children? Use known fields from buildHref empty merge */}
              <CustomDateHiddenFields buildHref={buildHref} />
              <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="agenda-from">
                Vanaf
              </label>
              <input
                id="agenda-from"
                type="date"
                name="from"
                defaultValue={customFrom ?? ""}
                className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base"
              />
              <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="agenda-to">
                Tot en met
              </label>
              <input
                id="agenda-to"
                type="date"
                name="to"
                defaultValue={customTo ?? ""}
                className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base"
              />
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-[var(--accent)] px-4 font-bold text-[var(--accent-foreground)]"
              >
                Toepassen
              </button>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}

/** Hidden fields so custom date GET keeps q/near/domain/type/country. */
function CustomDateHiddenFields({
  buildHref,
}: {
  buildHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const href = buildHref({ when: undefined, from: undefined, to: undefined, page: undefined });
  const params = new URL(href, "https://hobbysalon.local").searchParams;
  const keys = ["q", "near", "domain", "type", "country"] as const;
  return (
    <>
      {keys.map((key) => {
        const value = params.get(key);
        return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
      })}
    </>
  );
}
