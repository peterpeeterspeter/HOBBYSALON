import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { DifficultyIndicator } from "@/components/domain/difficulty-indicator";
import { PriceDisplay } from "@/components/domain/price-display";
import type { Workshop } from "@/types/platform";

type WorkshopCardProps = {
  workshop: Workshop;
  className?: string;
};

const FORMAT_LABELS: Record<string, string> = {
  physical: "Fysiek",
  online: "Online",
  hybrid: "Hybride",
};

function WorkshopCard({ workshop, className }: WorkshopCardProps) {
  return (
    <Link href={`/workshop/${workshop.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <AspectImage
          ratio="video"
          src={workshop.featured_image_url}
          alt={workshop.title}
          className="-mx-4 -mt-4 mb-3"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="format">
            {FORMAT_LABELS[workshop.format_type] ?? workshop.format_type}
          </Badge>
          <DifficultyIndicator level={workshop.difficulty_level} />
        </div>
        <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
          {workshop.title}
        </h3>
        {workshop.short_description && (
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
            {workshop.short_description}
          </p>
        )}
        {workshop.price_cents > 0 && (
          <PriceDisplay
            amount={workshop.price_cents}
            currencyCode={workshop.currency_code}
            className="mt-2"
          />
        )}
      </CardShell>
    </Link>
  );
}

export { WorkshopCard };
export type { WorkshopCardProps };
