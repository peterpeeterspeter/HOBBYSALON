import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

type LocationBadgeProps = {
  city?: string | null;
  country?: string | null;
  className?: string;
};

function LocationBadge({ city, country, className }: LocationBadgeProps) {
  if (!city && !country) return null;

  const parts = [city, country].filter(Boolean).join(", ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm text-[var(--muted)]",
        className
      )}
    >
      <MapPin size={14} aria-hidden="true" className="shrink-0" />
      {parts}
    </span>
  );
}

export { LocationBadge };
export type { LocationBadgeProps };
