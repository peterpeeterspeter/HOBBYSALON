import Link from "next/link";
import { cn } from "@/lib/utils";
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

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Expert",
};

function formatPrice(cents: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function WorkshopCard({ workshop, className }: WorkshopCardProps) {
  const priceStr =
    workshop.price_cents > 0
      ? formatPrice(workshop.price_cents, workshop.currency_code)
      : null;

  return (
    <Link
      href={`/workshop/${workshop.slug}`}
      className={cn(
        "block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md",
        className
      )}
    >
      <div className="aspect-video mb-3 overflow-hidden rounded-md bg-[var(--border)]">
        {workshop.featured_image_url ? (
          <img
            src={workshop.featured_image_url}
            alt={workshop.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted)] text-sm">
            Workshop
          </div>
        )}
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        {FORMAT_LABELS[workshop.format_type] ?? workshop.format_type} ·{" "}
        {DIFFICULTY_LABELS[workshop.difficulty_level] ?? workshop.difficulty_level}
      </span>
      <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
        {workshop.title}
      </h3>
      {workshop.short_description && (
        <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
          {workshop.short_description}
        </p>
      )}
      {priceStr && (
        <p className="mt-2 font-semibold text-[var(--foreground)]">{priceStr}</p>
      )}
    </Link>
  );
}
