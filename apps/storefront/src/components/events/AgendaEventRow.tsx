import Link from "next/link";
import { cn } from "@/lib/utils";
import { DateDisplay } from "@/components/domain/date-display";
import type { Event } from "@/types/platform";
import { AGENDA_EVENT_TYPE_OPTIONS } from "./AgendaFilterBar";

type AgendaEventRowProps = {
  event: Event;
  className?: string;
};

const TYPE_LABELS = Object.fromEntries(
  AGENDA_EVENT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

/** Editorial date-led row (Taste listing, matches homepage agenda teaser). */
export function AgendaEventRow({ event, className }: AgendaEventRowProps) {
  const typeLabel = TYPE_LABELS[event.event_type] ?? event.event_type;
  const place =
    event.city?.trim() || event.location_name?.trim() || "Locatie volgt";

  return (
    <Link
      href={`/agenda/${event.slug}`}
      className={cn(
        "group grid gap-3 py-5 transition-colors hover:bg-[var(--section-highlight)]/80 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-2",
        className
      )}
    >
      <div className="font-[family-name:var(--font-heading)] text-lg font-bold leading-tight text-[var(--accent)] sm:text-xl">
        <DateDisplay date={event.starts_at} format="short" />
      </div>
      <div className="flex min-w-0 items-start gap-4">
        {event.featured_image_url ? (
          <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
            <img
              src={event.featured_image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--muted)]">
            {place}
            {" · "}
            {typeLabel}
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
            {event.title}
          </h3>
        </div>
      </div>
      <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
        Bekijk event
      </span>
    </Link>
  );
}
