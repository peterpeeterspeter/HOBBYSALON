import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";
import type { PricingRouteCard } from "@/lib/pricing/public-pricing";

type PricingRouteCardsProps = {
  id?: string;
  title: string;
  description?: string;
  cards: PricingRouteCard[];
};

function PricingRouteCards({
  id = "routes",
  title,
  description,
  cards,
}: PricingRouteCardsProps) {
  return (
    <Section spacing="lg" id={id}>
      <Container>
        <MarketingSectionHeader title={title} description={description} />
        <ul className="mt-12 flex flex-col gap-10 lg:gap-12">
          {cards.map((card) => (
            <li
              key={card.id}
              className="border-t-2 border-[var(--accent)] pt-8"
            >
              <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                {card.title}
              </h3>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {card.description}
              </p>
              <ul className="mt-5 space-y-2">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-base leading-relaxed text-[var(--foreground)] md:text-lg"
                  >
                    · {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={card.href}
                className="mt-6 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--accent)] hover:underline"
              >
                {card.ctaLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export { PricingRouteCards };
export type { PricingRouteCardsProps };
