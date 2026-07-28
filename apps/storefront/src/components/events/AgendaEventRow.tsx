import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DateDisplay } from "@/components/domain/date-display";
import { LocationBadge } from "@/components/domain/location-badge";
import type { Event } from "@/types/platform";
import { AGENDA_EVENT_TYPE_OPTIONS } from "./AgendaFilterBar";

type AgendaEventRowProps = {
  event: Event;
  className?: string;
};

const TYPE_LABELS = Object.fromEntries(
  AGENDA_EVENT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

/**
 * Wide horizontal row for sparse agenda results (≤3 events).
 */
export function AgendaEventRow({ event, className }: AgendaEventRowProps) {
  const typeLabel = TYPE_LABELS[event.event_type] ?? event.event_type;

  return (
    <Link
      href={`/agenda/${event.slug}`}
      className={cn(
        "flex gap-4 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--accent)] sm:p-4",
        className
      )}
    >
      <div className="h-24 w-28 shrink-0 overflow-hidden rounded-[10px] bg-[var(--border)] sm:h-28 sm:w-36">
        {event.featured_image_url ? (
          <img
            src={event.featured_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="domain">{typeLabel}</Badge>
          <LocationBadge city={event.city} />
        </div>
        <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 sm:text-xl">
          {event.title}
        </h3>
        <DateDisplay date={event.starts_at} format="long" className="mt-1" />
        {event.short_description ? (
          <p className="mt-1 hidden text-[15px] text-[var(--muted)] line-clamp-2 sm:block">
            {event.short_description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
