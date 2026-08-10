import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import type { FeaturedListingItem } from "@/lib/listing/featured-hero";
import { cn } from "@/lib/utils";

type FeaturedListingHeroProps = {
  title: string;
  lead?: string;
  fallbackImageSrc: string;
  featured?: FeaturedListingItem | null;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Discovery listing hero: full-bleed featured entity (or fallback craft photo),
 * page framing, featured CTA block, then search as children.
 */
export function FeaturedListingHero({
  title,
  lead,
  fallbackImageSrc,
  featured = null,
  children,
  footer,
  className,
}: FeaturedListingHeroProps) {
  const imageSrc = featured?.imageUrl || fallbackImageSrc;

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border-b border-[var(--border)] bg-[var(--foreground)]",
        className
      )}
    >
      <div className="absolute inset-0" aria-hidden>
        <img
          src={imageSrc}
          alt=""
          className="listing-hero-media absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/92 via-[var(--foreground)]/58 to-[var(--foreground)]/28 md:bg-gradient-to-r md:from-[var(--foreground)]/90 md:via-[var(--foreground)]/55 md:to-[var(--foreground)]/22" />
      </div>

      <Container className="relative py-10 sm:py-12 lg:py-16">
        <p className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-[-0.03em] text-white/95 sm:text-2xl">
          Hobbysalon
        </p>

        <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-bold leading-[1.1] tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>

        {lead ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {lead}
          </p>
        ) : null}

        {featured ? (
          <div className="listing-hero-featured mt-7 max-w-xl border-l-4 border-[var(--accent)] pl-5 sm:pl-6">
            {featured.kicker ? (
              <p className="text-[15px] font-medium text-white/80">
                {featured.kicker}
              </p>
            ) : null}
            <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold leading-snug tracking-[-0.03em] text-white sm:text-3xl">
              {featured.title}
            </p>
            {featured.meta ? (
              <p className="mt-2 text-base text-white/85">{featured.meta}</p>
            ) : null}
            <Link
              href={featured.href}
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[0.75rem] bg-[var(--accent)] px-6 text-base font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
            >
              {featured.ctaLabel}
            </Link>
          </div>
        ) : null}

        {children ? <div className="mt-7 max-w-2xl">{children}</div> : null}
        {footer ? <div className="mt-4">{footer}</div> : null}
      </Container>
    </section>
  );
}
