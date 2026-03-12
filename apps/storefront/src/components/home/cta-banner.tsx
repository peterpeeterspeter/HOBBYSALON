import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type CTABannerProps = {
  title: string;
  description: string;
  href: string;
  ctaText: string;
  variant?: "warm" | "sage";
  className?: string;
};

const VARIANT_STYLES: Record<NonNullable<CTABannerProps["variant"]>, {
  bg: string;
  text: string;
  cta: string;
}> = {
  warm: {
    bg: "bg-[var(--accent)]",
    text: "text-white",
    cta: "bg-white text-[var(--accent)] hover:bg-white/90",
  },
  sage: {
    bg: "bg-[var(--accent-secondary)]",
    text: "text-white",
    cta: "bg-white text-[var(--accent-secondary)] hover:bg-white/90",
  },
};

/**
 * Horizontal call-to-action banner that breaks up content sections.
 * E.g. "Word creator op Hobbysalon" or "Start je eerste project".
 */
function CTABanner({
  title,
  description,
  href,
  ctaText,
  variant = "warm",
  className,
}: CTABannerProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        "rounded-2xl px-6 py-8 md:px-10 md:py-10",
        styles.bg,
        className
      )}
    >
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h3
            className={cn(
              "text-xl md:text-2xl font-bold font-[family-name:var(--font-heading)]",
              styles.text
            )}
          >
            {title}
          </h3>
          <p className={cn("mt-1 text-sm md:text-base opacity-90", styles.text)}>
            {description}
          </p>
        </div>
        <Link
          href={href}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[var(--touch-target-min)]",
            styles.cta
          )}
        >
          {ctaText}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export { CTABanner };
export type { CTABannerProps };
