import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { DateDisplay } from "@/components/domain/date-display";
import { LocationBadge } from "@/components/domain/location-badge";
import type { Event } from "@/types/platform";

type EventCardProps = {
  event: Event;
  className?: string;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  handmade_market: "Handmade markt",
  hobby_fair: "Hobbybeurs",
  pop_up: "Pop-up",
  open_atelier: "Open atelier",
  workshop_day: "Workshopdag",
};

function EventCard({ event, className }: EventCardProps) {
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;

  return (
    <Link href={`/agenda/${event.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <AspectImage
          ratio="video"
          src={event.featured_image_url}
          alt={event.title}
          className="-mx-4 -mt-4 mb-3"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="domain">{typeLabel}</Badge>
          <LocationBadge city={event.city} />
        </div>
        <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
          {event.title}
        </h3>
        <DateDisplay date={event.starts_at} format="long" className="mt-1" />
        {event.short_description && (
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
            {event.short_description}
          </p>
        )}
      </CardShell>
    </Link>
  );
}

export { EventCard };
export type { EventCardProps };
