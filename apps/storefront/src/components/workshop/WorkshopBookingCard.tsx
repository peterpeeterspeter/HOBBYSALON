import { CardShell } from "@/components/ui/card-shell";
import { PriceDisplay } from "@/components/domain/price-display";
import { WorkshopBookingRequestForm } from "@/components/workshop/WorkshopBookingRequestForm";
import { Clock, MapPin, Users, Layers, ShieldCheck, MessageCircle } from "lucide-react";
import type { Workshop, Creator } from "@/types/platform";

const FORMAT_LABELS: Record<string, string> = {
  physical: "Fysiek",
  online: "Online",
  hybrid: "Hybride",
};

type BookingSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity?: number | null;
  remaining_spots?: number | null;
  booking_status?: string;
};

type WorkshopBookingCardProps = {
  workshop: Workshop;
  creator: Creator | null;
  sessions: BookingSession[];
  allowExternalBooking?: boolean;
};

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} uur`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} u ${minutes % 60} min`;
  return `${minutes} min`;
}

/**
 * Sticky booking panel on the workshop detail page: price, key facts and the
 * booking action (request form or external link). Only renders facts that exist
 * in the data — no invented availability or policy claims.
 */
export function WorkshopBookingCard({
  workshop,
  creator,
  sessions,
  allowExternalBooking = false,
}: WorkshopBookingCardProps) {
  const capacity = sessions.find((s) => s.capacity != null)?.capacity ?? null;

  const metaRows: { icon: typeof Clock; label: string; value: string }[] = [
    {
      icon: Layers,
      label: "Vorm",
      value: FORMAT_LABELS[workshop.format_type] ?? workshop.format_type,
    },
  ];
  if (workshop.duration_minutes) {
    metaRows.push({
      icon: Clock,
      label: "Duur",
      value: formatDuration(workshop.duration_minutes),
    });
  }
  if (capacity != null) {
    metaRows.push({
      icon: Users,
      label: "Groepsgrootte",
      value: `Max. ${capacity} personen`,
    });
  }
  if (workshop.location_name) {
    metaRows.push({
      icon: MapPin,
      label: "Locatie",
      value: workshop.city
        ? `${workshop.location_name}, ${workshop.city}`
        : workshop.location_name,
    });
  }

  return (
    <CardShell variant="default" padding="none" className="overflow-hidden rounded-2xl">
      <div className="flex items-baseline gap-2 px-6 pt-6">
        {workshop.price_cents > 0 ? (
          <PriceDisplay
            amount={workshop.price_cents}
            currencyCode={workshop.currency_code}
            size="lg"
          />
        ) : (
          <span className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--accent)]">
            Gratis
          </span>
        )}
        <span className="text-sm text-[var(--muted)]">per persoon</span>
      </div>

      <dl className="mt-4 flex flex-col gap-3 border-y border-[var(--border)] px-6 py-4">
        {metaRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-[15px]">
            <dt className="flex items-center gap-2 text-[var(--muted)]">
              <row.icon size={15} className="text-[var(--accent)]" aria-hidden />
              {row.label}
            </dt>
            <dd className="font-semibold text-[var(--foreground)]">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="px-6 pb-2">
        {allowExternalBooking &&
        workshop.booking_mode === "external_link" &&
        workshop.booking_url ? (
          <a
            href={workshop.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-[var(--touch-target-min)] w-full items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            Boek nu
          </a>
        ) : creator ? (
          <WorkshopBookingRequestForm
            workshopId={workshop.id}
            creatorId={workshop.creator_id}
            sessions={sessions}
          />
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Boeken is momenteel niet beschikbaar voor deze workshop.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 px-6 pb-6 pt-2 text-[13px] text-[var(--muted)]">
        {creator && (
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--accent)]" aria-hidden />
            Geverifieerde workshopgever
          </span>
        )}
        <span className="flex items-center gap-2">
          <MessageCircle size={14} className="text-[var(--accent)]" aria-hidden />
          Direct contact met de workshopgever
        </span>
      </div>
    </CardShell>
  );
}
