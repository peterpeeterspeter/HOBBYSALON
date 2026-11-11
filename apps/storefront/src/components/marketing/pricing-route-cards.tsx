import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import type { PricingRouteCard } from "@/lib/pricing/public-pricing";

type PricingRouteCardsProps = {
  id?: string;
  title: string;
  description?: string;
  cards: PricingRouteCard[];
};

/** Features shown on the card; the rest lives on the route's own page. */
const CARD_FEATURES = 3;

/** One price card per route: role, task, price, top features, start. */
function PricingRouteCards({ id = "routes", title, description, cards }: PricingRouteCardsProps) {
  return (
    <section id={id} aria-labelledby={`${id}-titel`} className="scroll-mt-20">
      <Container className="py-16 md:py-24">
        <h2
          id={`${id}-titel`}
          className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] [text-wrap:balance] md:text-4xl"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)]">{description}</p>
        ) : null}
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li
              key={card.id}
              id={`route-${card.id}`}
              className="flex scroll-mt-24 flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow-sm)]"
            >
              <p className="text-base font-semibold uppercase tracking-wide text-[var(--accent-hover)]">{card.role}</p>
              <h3 className="mt-2 text-xl font-bold text-[var(--foreground)] [text-wrap:balance]">{card.title}</h3>
              <p className="mt-6 font-[family-name:var(--font-heading)] text-5xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
                {card.price}
              </p>
              <p className="mt-2 text-lg text-[var(--muted)] [text-wrap:pretty]">{card.priceNote}</p>
              <ul className="mt-6 space-y-3 border-t border-[var(--border)] pt-6">
                {card.features.slice(0, CARD_FEATURES).map((feature) => (
                  <li key={feature} className="flex gap-3 text-base leading-relaxed text-[var(--foreground)] md:text-lg">
                    <Check size={22} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent-hover)]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-2 pt-8">
                <Button
                  asChild
                  size="lg"
                  className="min-h-12 w-full bg-[var(--accent)] text-lg text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                >
                  <Link href={card.start.href}>{card.start.label}</Link>
                </Button>
                <Link
                  href={card.href}
                  className="inline-flex min-h-12 items-center justify-center gap-2 text-lg font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline"
                >
                  {card.ctaLabel}
                  <ArrowRight size={18} aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export { PricingRouteCards };
export type { PricingRouteCardsProps };
