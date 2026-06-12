import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { DifficultyIndicator } from "@/components/domain/difficulty-indicator";
import { PriceDisplay } from "@/components/domain/price-display";
import type { Workshop } from "@/types/platform";

const FORMAT_LABELS: Record<string, string> = {
  physical: "Fysiek",
  online: "Online",
  hybrid: "Hybride",
};

/** Horizontal workshop card used by the workshops listing list view. */
export function WorkshopRow({ workshop }: { workshop: Workshop }) {
  const location = workshop.city ?? workshop.location_name;
  return (
    <Link
      href={`/workshop/${workshop.slug}`}
      className="group flex overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)]"
    >
      <div className="w-40 shrink-0 sm:w-44">
        <AspectImage
          ratio="square"
          src={workshop.featured_image_url}
          alt={workshop.title}
          fallbackImage="placeholderWorkshop"
        />
      </div>
      <div className="flex flex-1 items-start gap-5 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="format">
              {FORMAT_LABELS[workshop.format_type] ?? workshop.format_type}
            </Badge>
            <DifficultyIndicator level={workshop.difficulty_level} />
          </div>
          <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--foreground)] line-clamp-2">
            {workshop.title}
          </h3>
          {workshop.short_description && (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
              {workshop.short_description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            {workshop.duration_minutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} aria-hidden />
                {workshop.duration_minutes} min
              </span>
            ) : null}
            {location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} aria-hidden />
                {location}
              </span>
            ) : null}
          </div>
        </div>
        {workshop.price_cents > 0 && (
          <div className="shrink-0 text-right">
            <PriceDisplay
              amount={workshop.price_cents}
              currencyCode={workshop.currency_code}
              size="lg"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
