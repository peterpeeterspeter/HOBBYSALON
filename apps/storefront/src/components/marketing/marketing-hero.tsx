import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

type MarketingHeroProps = {
  headline: string;
  subheadline: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  trustLine?: string;
};

function MarketingHero({
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  trustLine,
}: MarketingHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[var(--foreground)] text-[var(--background)]">
      <Container className="py-20 md:py-28">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight font-[family-name:var(--font-heading)] md:text-5xl lg:text-6xl">
          {headline}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed opacity-95 md:text-xl">
          {subheadline}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Button
            asChild
            size="lg"
            className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
          >
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
          {secondaryCta && (
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          )}
        </div>
        {trustLine && (
          <p className="mt-8 text-sm opacity-75 md:text-base">{trustLine}</p>
        )}
      </Container>
    </section>
  );
}

export { MarketingHero };
export type { MarketingHeroProps };
