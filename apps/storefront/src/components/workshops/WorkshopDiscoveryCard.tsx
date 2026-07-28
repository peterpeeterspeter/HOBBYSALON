import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DifficultyIndicator } from "@/components/domain/difficulty-indicator";
import { PriceDisplay } from "@/components/domain/price-display";
import { DateDisplay } from "@/components/domain/date-display";
import type { WorkshopDiscoveryItem } from "@/lib/platform/queries/workshops";
import { sessionDurationMinutes } from "@/lib/workshops/workshop-discovery-helpers";

const FORMAT_LABELS: Record<string, string> = {
  physical: "Fysiek",
  online: "Online",
  hybrid: "Hybride",
};

function placeOrOnlineLabel(item: WorkshopDiscoveryItem): string {
  if (item.format_type === "online") return "Online";
  return item.city?.trim() || item.location_name?.trim() || "Locatie volgt";
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours === 1 ? "1 uur" : `${hours} uur`.replace(".0", "");
}

type WorkshopDiscoveryCardProps = {
  workshop: WorkshopDiscoveryItem;
  className?: string;
};

export function WorkshopDiscoveryCard({
  workshop,
  className,
}: WorkshopDiscoveryCardProps) {
  const duration = formatDuration(sessionDurationMinutes(workshop.nextSession));
  const placeLabel = placeOrOnlineLabel(workshop);

  return (
    <Link
      href={`/workshop/${workshop.slug}`}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]",
        className
      )}
    >
      <div className="aspect-video overflow-hidden bg-[var(--border)]">
        {workshop.featured_image_url ? (
          <img
            src={workshop.featured_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyIndicator level={workshop.difficulty_level} />
          <Badge variant="format">
            {FORMAT_LABELS[workshop.format_type] ?? workshop.format_type}
          </Badge>
        </div>
        <h3 className="mt-2 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
          {workshop.title}
        </h3>
        <p className="mt-2 text-[15px] font-semibold text-[var(--foreground)]">
          <DateDisplay date={workshop.nextSession.startsAt} format="short" />
          {" · "}
          {placeLabel}
          {duration ? ` · ${duration}` : null}
        </p>
        {workshop.short_description ? (
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
            {workshop.short_description}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {workshop.price_cents > 0 ? (
            <PriceDisplay
              amount={workshop.price_cents}
              currencyCode={workshop.currency_code}
            />
          ) : (
            <span className="text-sm font-semibold text-[var(--muted)]">Gratis</span>
          )}
          <span className="text-[15px] font-bold text-[var(--accent)]">
            Bekijk workshop
          </span>
        </div>
      </div>
    </Link>
  );
}

type WorkshopDiscoveryRowProps = {
  workshop: WorkshopDiscoveryItem;
  className?: string;
};

export function WorkshopDiscoveryRow({
  workshop,
  className,
}: WorkshopDiscoveryRowProps) {
  const duration = formatDuration(sessionDurationMinutes(workshop.nextSession));
  const placeLabel = placeOrOnlineLabel(workshop);

  return (
    <Link
      href={`/workshop/${workshop.slug}`}
      className={cn(
        "flex gap-4 rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--accent)] sm:p-4",
        className
      )}
    >
      <div className="h-24 w-28 shrink-0 overflow-hidden rounded-[10px] bg-[var(--border)] sm:h-28 sm:w-36">
        {workshop.featured_image_url ? (
          <img
            src={workshop.featured_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyIndicator level={workshop.difficulty_level} />
          <Badge variant="format">
            {FORMAT_LABELS[workshop.format_type] ?? workshop.format_type}
          </Badge>
        </div>
        <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 sm:text-xl">
          {workshop.title}
        </h3>
        <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
          <DateDisplay date={workshop.nextSession.startsAt} format="short" />
          {" · "}
          {placeLabel}
          {duration ? ` · ${duration}` : null}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {workshop.price_cents > 0 ? (
            <PriceDisplay
              amount={workshop.price_cents}
              currencyCode={workshop.currency_code}
            />
          ) : (
            <span className="text-sm font-semibold text-[var(--muted)]">Gratis</span>
          )}
          <span className="text-[15px] font-bold text-[var(--accent)]">
            Bekijk workshop
          </span>
        </div>
      </div>
    </Link>
  );
}
