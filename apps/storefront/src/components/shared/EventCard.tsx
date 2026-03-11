import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Event } from "@/types/platform";

const EVENT_TYPE_LABELS: Record<string, string> = {
  handmade_market: "Handmade markt",
  hobby_fair: "Hobbybeurs",
  pop_up: "Pop-up",
  open_atelier: "Open atelier",
  workshop_day: "Workshopdag",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

type EventCardProps = {
  event: Event;
  className?: string;
};

export function EventCard({ event, className }: EventCardProps) {
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;

  return (
    <Link
      href={`/agenda/${event.slug}`}
      className={cn(
        "block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md",
        className
      )}
    >
      <div className="aspect-video mb-3 overflow-hidden rounded-md bg-[var(--border)]">
        {event.featured_image_url ? (
          <img
            src={event.featured_image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted)] text-sm">
            {typeLabel}
          </div>
        )}
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        {typeLabel}
        {event.city && ` · ${event.city}`}
      </span>
      <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
        {event.title}
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {formatDate(event.starts_at)}
      </p>
      {event.short_description && (
        <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
          {event.short_description}
        </p>
      )}
    </Link>
  );
}
