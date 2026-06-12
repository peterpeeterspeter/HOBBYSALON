import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type CTABannerProps = {
  title: string;
  description: string;
  href: string;
  ctaText: string;
  /** "dark" uses foreground bg, centered text, and an optional second CTA */
  variant?: "warm" | "sage" | "dark";
  secondaryHref?: string;
  secondaryText?: string;
  className?: string;
};

const INLINE_STYLES: Record<"warm" | "sage", { bg: string; text: string; cta: string }> = {
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

function CTABanner({
  title,
  description,
  href,
  ctaText,
  variant = "warm",
  secondaryHref,
  secondaryText,
  className,
}: CTABannerProps) {
  if (variant === "dark") {
    return (
      <div
        className={cn(
          "px-6 py-16 text-center md:px-10",
          "bg-[var(--foreground)]",
          className
        )}
      >
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-[540px] text-base leading-relaxed text-white/75 md:text-lg">
          {description}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={href}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            {ctaText}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {secondaryHref && secondaryText && (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-[48px] items-center rounded-lg px-6 py-3 text-sm font-semibold text-white/90 transition-colors hover:text-white"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1.5px solid rgba(255,255,255,0.30)",
              }}
            >
              {secondaryText}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const styles = INLINE_STYLES[variant];

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
