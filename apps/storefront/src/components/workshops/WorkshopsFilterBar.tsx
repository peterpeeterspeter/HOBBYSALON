import Link from "next/link";
import { cn } from "@/lib/utils";
import { WORKSHOP_EXTENDED_TAXONOMY_FILTERS_ENABLED } from "@/lib/platform/workshop-taxonomy";

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Gevorderd" },
  { value: "advanced", label: "Expert" },
] as const;

type WorkshopsFilterBarProps = {
  activeDifficulty?: string;
  activeCountry?: string;
  priceMin?: string;
  priceMax?: string;
  countries: string[];
  buildHref: (overrides: Record<string, string | undefined>) => string;
  clearHref: string;
  hasExtraFilters: boolean;
};

export function WorkshopsFilterBar({
  activeDifficulty,
  activeCountry,
  priceMin,
  priceMax,
  countries,
  buildHref,
  clearHref,
  hasExtraFilters,
}: WorkshopsFilterBarProps) {
  const difficultyLabel =
    DIFFICULTY_OPTIONS.find((o) => o.value === activeDifficulty)?.label ??
    "Niveau";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="relative">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden",
            activeDifficulty
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--card)]"
          )}
        >
          {activeDifficulty ? difficultyLabel : "Niveau"}
        </summary>
        <div className="absolute right-0 z-20 mt-2 flex w-52 flex-col gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)] sm:left-0 sm:right-auto">
          <Link
            href={buildHref({ difficulty: undefined, page: undefined })}
            className="min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]"
          >
            Alle niveaus
          </Link>
          {DIFFICULTY_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ difficulty: option.value, page: undefined })}
              className={cn(
                "min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]",
                activeDifficulty === option.value &&
                  "bg-[var(--accent)]/10 text-[var(--accent)]"
              )}
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
            hasExtraFilters
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--card)]"
          )}
        >
          Filters
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,20rem)] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-md)]">
          <form method="GET" action="/workshops" className="flex flex-col gap-3">
            <FilterHiddenFields buildHref={buildHref} />
            <label className="text-sm font-semibold" htmlFor="ws-price-min">
              Prijs vanaf (€)
            </label>
            <input
              id="ws-price-min"
              name="price_min"
              type="number"
              min={0}
              step={1}
              defaultValue={priceMin ?? ""}
              className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-base"
            />
            <label className="text-sm font-semibold" htmlFor="ws-price-max">
              Prijs tot (€)
            </label>
            <input
              id="ws-price-max"
              name="price_max"
              type="number"
              min={0}
              step={1}
              defaultValue={priceMax ?? ""}
              className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-base"
            />
            <label className="text-sm font-semibold" htmlFor="ws-country">
              Land
            </label>
            <select
              id="ws-country"
              name="country"
              defaultValue={activeCountry ?? ""}
              className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-base"
            >
              <option value="">Alle landen</option>
              {countries.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            {WORKSHOP_EXTENDED_TAXONOMY_FILTERS_ENABLED ? (
              <p className="text-sm text-[var(--muted)]">
                Extra taxonomyfilters volgen wanneer live.
              </p>
            ) : null}
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-[var(--accent)] px-4 font-bold text-[var(--accent-foreground)]"
            >
              Toepassen
            </button>
          </form>
          <Link
            href={clearHref}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-[15px] font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Wis alle filters
          </Link>
        </div>
      </details>
    </div>
  );
}

function FilterHiddenFields({
  buildHref,
}: {
  buildHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const href = buildHref({
    country: undefined,
    price_min: undefined,
    price_max: undefined,
    page: undefined,
  });
  const params = new URL(href, "https://hobbysalon.local").searchParams;
  const keys = [
    "q",
    "place",
    "when",
    "from",
    "to",
    "domain",
    "category",
    "difficulty",
    "format",
    "sort",
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

type WorkshopsSortControlProps = {
  activeSort: string;
  buildHref: (overrides: Record<string, string | undefined>) => string;
};

export function WorkshopsSortControl({
  activeSort,
  buildHref,
}: WorkshopsSortControlProps) {
  const options = [
    { value: "soon", label: "Binnenkort" },
    { value: "near", label: "Dichtbij" },
    { value: "price_asc", label: "Prijs laag–hoog" },
  ] as const;
  const current =
    options.find((o) => o.value === activeSort)?.label ?? "Binnenkort";

  return (
    <details className="relative">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        Sorteren: {current}
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-52 flex-col gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)]">
        {options.map((option) => (
          <Link
            key={option.value}
            href={buildHref({
              sort: option.value === "soon" ? undefined : option.value,
              page: undefined,
            })}
            className={cn(
              "min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]",
              (activeSort === option.value ||
                (!activeSort && option.value === "soon")) &&
                "bg-[var(--accent)]/10 text-[var(--accent)]"
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
