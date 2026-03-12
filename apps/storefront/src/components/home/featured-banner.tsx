import Link from "next/link";
import { cn } from "@/lib/utils";
import { AspectImage, type AspectImageProps } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

type FeaturedBannerProps = {
  title: string;
  description?: string;
  imageUrl?: string | null;
  imageFallback?: AspectImageProps["fallbackImage"];
  href: string;
  badge?: string;
  ctaText?: string;
  /** Visual variant for different section themes */
  variant?: "warm" | "sage" | "neutral";
  className?: string;
};

const VARIANT_STYLES: Record<NonNullable<FeaturedBannerProps["variant"]>, string> = {
  warm: "from-[var(--accent)]/90 to-[var(--accent)]/60",
  sage: "from-[var(--accent-secondary)]/90 to-[var(--accent-secondary)]/60",
  neutral: "from-[var(--foreground)]/80 to-[var(--foreground)]/50",
};

/**
 * Full-width hero-style banner for featuring a single item prominently.
 * Used to break the monotony of card grids by showcasing one workshop, event, etc.
 */
function FeaturedBanner({
  title,
  description,
  imageUrl,
  imageFallback,
  href,
  badge,
  ctaText = "Bekijk details",
  variant = "warm",
  className,
}: FeaturedBannerProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group/banner relative block overflow-hidden rounded-2xl min-h-[280px] md:min-h-[340px]",
        className
      )}
    >
      {/* Background image */}
      <div className="absolute inset-0">
        <AspectImage
          ratio="banner"
          src={imageUrl}
          alt=""
          fallbackImage={imageFallback}
          className="h-full w-full object-cover !rounded-none"
          aria-hidden="true"
        />
      </div>

      {/* Gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r",
          VARIANT_STYLES[variant]
        )}
      />

      {/* Content */}
      <div className="relative flex h-full min-h-[280px] md:min-h-[340px] flex-col justify-end p-6 md:p-10">
        <div className="max-w-lg">
          {badge && (
            <Badge variant="format" className="mb-3 bg-white/20 text-white border-white/30">
              {badge}
            </Badge>
          )}
          <h3 className="text-2xl md:text-3xl font-bold text-white font-[family-name:var(--font-heading)] line-clamp-2">
            {title}
          </h3>
          {description && (
            <p className="mt-2 text-base text-white/90 line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white border-b border-white/50 pb-0.5 group-hover/banner:border-white transition-colors">
            {ctaText}
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="transition-transform duration-[var(--transition-fast)] group-hover/banner:translate-x-1"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

export { FeaturedBanner };
export type { FeaturedBannerProps };
