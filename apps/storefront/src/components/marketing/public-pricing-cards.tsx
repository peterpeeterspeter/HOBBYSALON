import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";
import {
  PRICING_STATUS_LABEL,
  type PublicPricingOffer,
} from "@/lib/pricing/public-pricing";

type PublicPricingCardsProps = {
  id?: string;
  title: string;
  description?: string;
  offers: PublicPricingOffer[];
};

function PublicPricingCards({
  id,
  title,
  description,
  offers,
}: PublicPricingCardsProps) {
  return (
    <Section spacing="lg" id={id}>
      <Container>
        <MarketingSectionHeader title={title} description={description} />
        <ul className="mt-12 flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-8">
          {offers.map((offer) => {
            const statusLabel = PRICING_STATUS_LABEL[offer.status];
            return (
              <li
                key={offer.id}
                className="flex flex-col border-t-2 border-[var(--accent)] pt-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {offer.audience}
                  </p>
                  {statusLabel ? (
                    <span className="text-sm font-medium text-[var(--muted)]">
                      {statusLabel}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
                  {offer.title}
                </h3>
                {offer.description ? (
                  <p className="mt-3 max-w-prose text-base leading-relaxed text-[var(--muted)]">
                    {offer.description}
                  </p>
                ) : null}
                <p className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight text-[var(--foreground)]">
                  {offer.priceLabel}
                </p>
                {offer.periodLabel ? (
                  <p className="mt-1 text-base font-medium text-[var(--muted)]">
                    {offer.periodLabel}
                  </p>
                ) : null}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {offer.features.map((feature) => (
                    <li
                      key={feature}
                      className="text-base leading-relaxed text-[var(--foreground)]"
                    >
                      {feature}
                    </li>
                  ))}
                </ul>
                {offer.limitations && offer.limitations.length > 0 ? (
                  <div className="mt-5 border-t border-[var(--border)] pt-5">
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      Niet inbegrepen
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {offer.limitations.map((item) => (
                        <li key={item} className="text-sm leading-relaxed text-[var(--muted)]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {offer.finePrint ? (
                  <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                    {offer.finePrint}
                  </p>
                ) : null}
                <Link
                  href={offer.href}
                  className="mt-6 inline-flex min-h-[var(--touch-target-min)] items-center gap-2 text-base font-semibold text-[var(--accent)] hover:underline"
                >
                  {offer.ctaLabel}
                  <ArrowRight size={18} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}

export { PublicPricingCards };
export type { PublicPricingCardsProps };
