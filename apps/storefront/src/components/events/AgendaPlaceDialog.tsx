import Link from "next/link";
import { MapPin } from "lucide-react";
import { updateLocationPreferenceAction } from "@/app/actions/location";
import { cn } from "@/lib/utils";

type AgendaPlaceDialogProps = {
  placeValue: string | null;
  placeLabel: string | null;
  cities: string[];
  buildHref: (overrides: Record<string, string | undefined>) => string;
  currentHref: string;
  savedRegionLabel: string | null;
};

/**
 * Temporary place for this search (URL `near` only).
 * Saving to cookies / preferences is explicit via “Bewaar … als mijn regio”.
 */
export function AgendaPlaceDialog({
  placeValue,
  placeLabel,
  cities,
  buildHref,
  currentHref,
  savedRegionLabel,
}: AgendaPlaceDialogProps) {
  const chipLabel = placeLabel ?? "Kies een plaats";
  const showSave =
    Boolean(placeValue) &&
    placeValue?.trim().toLowerCase() !== savedRegionLabel?.trim().toLowerCase();

  return (
    <details className="relative">
      <summary
        className={cn(
          "inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors [&::-webkit-details-marker]:hidden",
          placeValue
            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
        )}
      >
        <MapPin aria-hidden="true" size={17} className="text-[var(--accent)]" />
        {chipLabel}
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-md)]">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Filter voor deze zoekopdracht. Je regio wordt niet automatisch bewaard.
        </p>
        <form method="GET" action="/agenda" className="flex flex-col gap-3">
          <PlaceHiddenFields buildHref={buildHref} />
          <label htmlFor="agenda-near" className="text-sm font-semibold">
            Plaats of stad
          </label>
          <input
            id="agenda-near"
            name="near"
            type="text"
            list="agenda-city-suggestions"
            defaultValue={placeValue ?? ""}
            placeholder="Bijv. Herentals"
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base"
            autoComplete="address-level2"
          />
          <datalist id="agenda-city-suggestions">
            {cities.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-[var(--accent)] px-4 font-bold text-[var(--accent-foreground)]"
          >
            Toon events
          </button>
        </form>

        {placeValue ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
            <Link
              href={buildHref({ near: undefined, page: undefined })}
              className="min-h-11 text-center text-[15px] font-semibold text-[var(--accent)] underline underline-offset-4"
            >
              Wis plaats
            </Link>
            {showSave ? (
              <form action={updateLocationPreferenceAction}>
                <input type="hidden" name="city" value={placeValue} />
                <input type="hidden" name="next" value={currentHref} />
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-lg border border-[var(--border)] px-4 text-[15px] font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
                >
                  Bewaar {placeValue} als mijn regio
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {savedRegionLabel && !placeValue ? (
          <Link
            href={buildHref({ near: savedRegionLabel, page: undefined })}
            className="mt-3 inline-flex min-h-11 items-center text-[15px] font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            Gebruik mijn regio: {savedRegionLabel}
          </Link>
        ) : null}
      </div>
    </details>
  );
}

function PlaceHiddenFields({
  buildHref,
}: {
  buildHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const href = buildHref({ near: undefined, page: undefined });
  const params = new URL(href, "https://hobbysalon.local").searchParams;
  const keys = ["q", "when", "from", "to", "domain", "type", "country"] as const;
  return (
    <>
      {keys.map((key) => {
        const value = params.get(key);
        return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
      })}
    </>
  );
}
