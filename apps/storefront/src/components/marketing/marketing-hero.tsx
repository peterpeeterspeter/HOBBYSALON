import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";

type MarketingHeroProps = {
  headline: string;
  subheadline: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  trustLine?: string;
  /** Full-bleed craft photo; defaults to community landing image */
  imageSrc?: string;
};

function MarketingHero({
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  trustLine,
  imageSrc,
}: MarketingHeroProps) {
  const src = imageSrc?.trim() || LANDING_IMAGES.community;

  return (
    <section className="relative isolate overflow-hidden bg-[var(--foreground)]">
      <div className="absolute inset-0" aria-hidden>
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/90 via-[var(--foreground)]/55 to-[var(--foreground)]/25 md:bg-gradient-to-r md:from-[var(--foreground)]/88 md:via-[var(--foreground)]/55 md:to-[var(--foreground)]/20" />
      </div>

      <Container className="relative py-20 md:py-28">
        <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
          Hobbysalon
        </p>
        <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-white md:text-5xl lg:text-6xl">
          {headline}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl">
          {subheadline}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Button
            asChild
            size="lg"
            className="min-h-12 bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
          >
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
          {secondaryCta && (
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="min-h-12 border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          )}
        </div>
        {trustLine && (
          <p className="mt-8 text-sm text-white/75 md:text-base">{trustLine}</p>
        )}
      </Container>
    </section>
  );
}

export { MarketingHero };
export type { MarketingHeroProps };
