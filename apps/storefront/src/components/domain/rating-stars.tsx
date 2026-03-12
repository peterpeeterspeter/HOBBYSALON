import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

type RatingStarsProps = {
  rating: number;
  count?: number;
  maxStars?: number;
  className?: string;
};

function RatingStars({ rating, count, maxStars = 5, className }: RatingStarsProps) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div className="flex gap-0.5" aria-label={`${rating} van ${maxStars} sterren`}>
        {Array.from({ length: maxStars }, (_, i) => {
          const filled = i < Math.round(rating);
          return (
            <Star
              key={i}
              size={16}
              className={cn(
                "shrink-0",
                filled
                  ? "fill-[var(--warning)] text-[var(--warning)]"
                  : "text-[var(--border)]"
              )}
              aria-hidden="true"
            />
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-xs text-[var(--muted)]">({count})</span>
      )}
    </div>
  );
}

export { RatingStars };
export type { RatingStarsProps };
