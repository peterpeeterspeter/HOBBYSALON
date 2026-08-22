import Link from "next/link";
import { cn } from "@/lib/utils";
import { WorkshopsPlaceDialog } from "./WorkshopsPlaceDialog";

type WorkshopsQuickFiltersProps = {
  placeLabel: string | null;
  placeValue: string | null;
  activeWhen: string | null;
  customFrom?: string;
  customTo?: string;
  beginnerActive: boolean;
  onlineActive: boolean;
  buildHref: (overrides: Record<string, string | undefined>) => string;
  currentHref: string;
  cities: string[];
  savedRegionLabel: string | null;
};

/**
 * Place + date presets + beginners + online. Date lives here only.
 */
export function WorkshopsQuickFilters({
  placeLabel,
  placeValue,
  activeWhen,
  customFrom,
  customTo,
  beginnerActive,
  onlineActive,
  buildHref,
  currentHref,
  cities,
  savedRegionLabel,
}: WorkshopsQuickFiltersProps) {
  const isCustom = Boolean(customFrom || customTo) && !activeWhen;

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors",
      active
        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
        : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
    );

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <WorkshopsPlaceDialog
        placeValue={placeValue}
        placeLabel={placeLabel}
        cities={cities}
        buildHref={buildHref}
        currentHref={currentHref}
        savedRegionLabel={savedRegionLabel}
      />

      <Link
        href={buildHref({
          when: activeWhen === "weekend" ? undefined : "weekend",
          from: undefined,
          to: undefined,
          page: undefined,
        })}
        className={chipClass(activeWhen === "weekend")}
        aria-current={activeWhen === "weekend" ? "true" : undefined}
      >
        Dit weekend
      </Link>

      <Link
        href={buildHref({
          when: activeWhen === "month" ? undefined : "month",
          from: undefined,
          to: undefined,
          page: undefined,
        })}
        className={chipClass(activeWhen === "month")}
        aria-current={activeWhen === "month" ? "true" : undefined}
      >
        Deze maand
      </Link>

      <Link
        href={buildHref({
          difficulty: beginnerActive ? undefined : "beginner",
          page: undefined,
        })}
        className={chipClass(beginnerActive)}
        aria-current={beginnerActive ? "true" : undefined}
      >
        Voor beginners
      </Link>

      <Link
        href={buildHref({
          format: onlineActive ? undefined : "online",
          page: undefined,
        })}
        className={chipClass(onlineActive)}
        aria-current={onlineActive ? "true" : undefined}
      >
        Online
      </Link>

      <details className="relative">
        <summary
          className={cn(
            chipClass(isCustom),
            "cursor-pointer list-none [&::-webkit-details-marker]:hidden"
          )}
        >
          Kies datum
        </summary>
        <div className="absolute left-0 z-20 mt-2 w-[min(100vw-2rem,20rem)] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-md)]">
          <form method="GET" action="/workshops" className="flex flex-col gap-3">
            <CustomDateHiddenFields buildHref={buildHref} />
            <label className="text-sm font-semibold" htmlFor="workshops-from">
              Vanaf
            </label>
            <input
              id="workshops-from"
              type="date"
              name="from"
              defaultValue={customFrom ?? ""}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base"
            />
            <label className="text-sm font-semibold" htmlFor="workshops-to">
              Tot en met
            </label>
            <input
              id="workshops-to"
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
  );
}

function CustomDateHiddenFields({
  buildHref,
}: {
  buildHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const href = buildHref({
    when: undefined,
    from: undefined,
    to: undefined,
    page: undefined,
  });
  const params = new URL(href, "https://hobbysalon.local").searchParams;
  const keys = [
    "q",
    "place",
    "domain",
    "category",
    "difficulty",
    "format",
    "sort",
    "country",
    "price_min",
    "price_max",
  ] as const;
  return (
    <>
      {keys.map((key) => {
        const value = params.get(key);
        return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
      })}
    </>
  );
}
