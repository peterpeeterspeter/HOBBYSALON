import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Domain } from "@/types/platform";
import {
  CREATOR_INTENT_CHIPS,
  type CreatorIntent,
} from "@/lib/creators/creators-directory-helpers";

type CreatorsFilterBarProps = {
  domains: Domain[];
  activeDomainId?: string;
  activeIntent?: CreatorIntent | null;
  activePlace?: string | null;
  cities: string[];
  showPlaceFilter: boolean;
  buildHref: (overrides: Record<string, string | undefined>) => string;
  clearHref: string;
  hasFilters: boolean;
};

/**
 * Compact filters: Hobby · Wat zoek je? · Plaats (gated). No duplicate search.
 */
export function CreatorsFilterBar({
  domains,
  activeDomainId,
  activeIntent,
  activePlace,
  cities,
  showPlaceFilter,
  buildHref,
  clearHref,
  hasFilters,
}: CreatorsFilterBarProps) {
  const domainLabel =
    domains.find((d) => d.id === activeDomainId)?.name ?? "Hobby";
  const intentLabel =
    CREATOR_INTENT_CHIPS.find((c) => c.intent === activeIntent)?.label ??
    "Wat zoek je?";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <details className="relative">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden",
            activeDomainId
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--card)]"
          )}
        >
          {activeDomainId ? domainLabel : "Hobby"}
        </summary>
        <div className="absolute left-0 z-20 mt-2 flex max-h-72 w-56 flex-col gap-1 overflow-y-auto rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)]">
          <Link
            href={buildHref({ domain: undefined, page: undefined })}
            className="min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]"
          >
            Alle hobby&apos;s
          </Link>
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={buildHref({ domain: domain.id, page: undefined })}
              className={cn(
                "min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]",
                activeDomainId === domain.id &&
                  "bg-[var(--accent)]/10 text-[var(--accent)]"
              )}
            >
              {domain.name}
            </Link>
          ))}
        </div>
      </details>

      <details className="relative">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden",
            activeIntent
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--card)]"
          )}
        >
          {activeIntent ? intentLabel : "Wat zoek je?"}
        </summary>
        <div className="absolute left-0 z-20 mt-2 flex w-60 flex-col gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)]">
          <Link
            href={buildHref({ intent: undefined, page: undefined })}
            className="min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]"
          >
            Alles
          </Link>
          {CREATOR_INTENT_CHIPS.map((chip) => (
            <Link
              key={chip.intent}
              href={buildHref({ intent: chip.intent, page: undefined })}
              className={cn(
                "min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold hover:bg-[var(--section-highlight)]",
                activeIntent === chip.intent &&
                  "bg-[var(--accent)]/10 text-[var(--accent)]"
              )}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </details>

      {showPlaceFilter ? (
        <details className="relative">
          <summary
            className={cn(
              "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden",
              activePlace
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border)] bg-[var(--card)]"
            )}
          >
            {activePlace ? activePlace : "Plaats"}
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-[min(100vw-2rem,18rem)] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-md)]">
            <form method="GET" action="/creators" className="flex flex-col gap-3">
              <PlaceHiddenFields buildHref={buildHref} />
              <label className="text-sm font-semibold" htmlFor="creators-place">
                Stad of gemeente
              </label>
              {cities.length > 0 ? (
                <select
                  id="creators-place"
                  name="place"
                  defaultValue={activePlace ?? ""}
                  className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-base"
                >
                  <option value="">Alle plaatsen</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="creators-place"
                  name="place"
                  type="text"
                  defaultValue={activePlace ?? ""}
                  placeholder="Bijv. Gent"
                  className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-base"
                />
              )}
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-[var(--accent)] px-4 font-bold text-[var(--accent-foreground)]"
              >
                Toepassen
              </button>
            </form>
            {activePlace ? (
              <Link
                href={buildHref({ place: undefined, page: undefined })}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-[15px] font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
              >
                Wis plaats
              </Link>
            ) : null}
          </div>
        </details>
      ) : null}

      {hasFilters ? (
        <Link
          href={clearHref}
          className="inline-flex min-h-11 items-center px-2 text-[15px] font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
        >
          Wis filters
        </Link>
      ) : null}
    </div>
  );
}

function PlaceHiddenFields({
  buildHref,
}: {
  buildHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const href = buildHref({ place: undefined, page: undefined });
  const params = new URL(href, "https://hobbysalon.local").searchParams;
  const keys = ["q", "intent", "domain", "sort"] as const;
  return (
    <>
      {keys.map((key) => {
        const value = params.get(key);
        return value ? (
          <input key={key} type="hidden" name={key} value={value} />
        ) : null;
      })}
    </>
  );
}
