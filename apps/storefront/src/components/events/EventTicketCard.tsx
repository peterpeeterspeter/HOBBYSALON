import { CalendarPlus, ShieldCheck, MapPin, Ticket } from "lucide-react";
import { PriceDisplay } from "@/components/domain/price-display";
import type { Event } from "@/types/platform";

type EventTicketCardProps = {
  event: Event;
  dateRangeLabel: string;
  locationLabel: string | null;
  allowExternalTickets?: boolean;
};

/** Formats an ISO timestamp as the compact UTC stamp Google Calendar expects. */
function toCalendarStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildGoogleCalendarUrl(event: Event, locationLabel: string | null): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarStamp(event.starts_at)}/${toCalendarStamp(event.ends_at)}`,
  });
  if (event.short_description) params.set("details", event.short_description);
  if (locationLabel) params.set("location", locationLabel);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Sticky ticket panel on the event detail page: price, ticket action (external
 * partner or free entry) and an "add to calendar" link. Only renders claims that
 * follow from the event data — no invented availability or policies.
 */
export function EventTicketCard({
  event,
  dateRangeLabel,
  locationLabel,
  allowExternalTickets = false,
}: EventTicketCardProps) {
  const isFree =
    event.ticket_price_cents == null || event.ticket_price_cents <= 0;
  const hasExternalTickets =
    allowExternalTickets &&
    event.ticketing_mode === "external_link" &&
    Boolean(event.ticket_url);
  const calendarUrl = buildGoogleCalendarUrl(event, locationLabel);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)] lg:sticky lg:top-24">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--color-amber-700)] px-6 py-5">
        <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">
          Tickets
        </p>
        <p className="mt-0.5 text-sm text-white/85">{dateRangeLabel}</p>
        {locationLabel && (
          <p className="text-sm text-white/85">{locationLabel}</p>
        )}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 px-6 pt-5">
        {isFree ? (
          <span className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--accent)]">
            Gratis
          </span>
        ) : (
          <>
            <PriceDisplay
              amount={event.ticket_price_cents as number}
              currencyCode={event.currency_code ?? "EUR"}
              size="lg"
            />
            <span className="text-sm text-[var(--muted)]">per ticket</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 px-6 pb-2 pt-4">
        {hasExternalTickets ? (
          <a
            href={event.ticket_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[var(--touch-target-min)] w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            <Ticket size={18} aria-hidden />
            Tickets bestellen
          </a>
        ) : isFree ? (
          <span className="inline-flex min-h-[var(--touch-target-min)] w-full items-center justify-center rounded-lg border-[1.5px] border-[var(--accent)] bg-[var(--accent)]/5 px-6 py-3 font-semibold text-[var(--accent)]">
            Gratis toegang — geen ticket nodig
          </span>
        ) : (
          <span className="inline-flex min-h-[var(--touch-target-min)] w-full items-center justify-center rounded-lg border-[1.5px] border-[var(--border)] px-6 py-3 font-semibold text-[var(--muted)]">
            Tickets binnenkort beschikbaar
          </span>
        )}
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[var(--touch-target-min)] w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-[var(--border)] px-6 py-3 font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <CalendarPlus size={18} aria-hidden />
          Toevoegen aan agenda
        </a>
      </div>

      {/* Honest reassurances */}
      <div className="flex flex-col gap-2 px-6 pb-6 pt-3 text-[13px] text-[var(--muted)]">
        {hasExternalTickets && (
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--accent)]" aria-hidden />
            Je wordt doorgestuurd naar de officiële ticketpartner
          </span>
        )}
        {locationLabel && (
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-[var(--accent)]" aria-hidden />
            {locationLabel}
          </span>
        )}
      </div>
    </div>
  );
}
