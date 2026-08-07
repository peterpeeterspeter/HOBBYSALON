import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { MarketingSectionHeader } from "./marketing-section-header";
import {
  PRICING_STATUS_LABEL,
  type PublicPricingOffer,
} from "@/lib/pricing/public-pricing";

type SingleOfferSectionProps = {
  id?: string;
  title?: string;
  description?: string;
  offer: PublicPricingOffer;
  secondaryOffer?: PublicPricingOffer;
};

function SingleOfferSection({
  id = "formule",
  title,
  description,
  offer,
  secondaryOffer,
}: SingleOfferSectionProps) {
  const statusLabel = PRICING_STATUS_LABEL[offer.status];

  return (
    <Section spacing="lg" id={id}>
      <Container>
        {(title || description) && (
          <MarketingSectionHeader title={title ?? offer.audience} description={description} />
        )}
        <div className="mx-auto mt-10 max-w-3xl border-t-2 border-[var(--accent)] pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              {offer.audience}
            </p>
            {statusLabel ? (
              <span className="text-sm font-medium text-[var(--muted)]">{statusLabel}</span>
            ) : null}
          </div>
          <h3 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)] md:text-4xl">
            {offer.title}
          </h3>
          {offer.description ? (
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-[var(--muted)]">
              {offer.description}
            </p>
          ) : null}
          <p className="mt-8 font-[family-name:var(--font-heading)] text-5xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
            {offer.priceLabel}
          </p>
          {offer.periodLabel ? (
            <p className="mt-2 text-lg font-medium text-[var(--muted)]">{offer.periodLabel}</p>
          ) : null}
          <ul className="mt-8 space-y-3">
            {offer.features.map((feature) => (
              <li key={feature} className="text-base leading-relaxed text-[var(--foreground)] md:text-lg">
                {feature}
              </li>
            ))}
          </ul>
          {offer.limitations && offer.limitations.length > 0 ? (
            <div className="mt-8 border-t border-[var(--border)] pt-6">
              <p className="text-sm font-semibold text-[var(--muted)]">Niet inbegrepen</p>
              <ul className="mt-3 space-y-2">
                {offer.limitations.map((item) => (
                  <li key={item} className="text-base leading-relaxed text-[var(--muted)]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {offer.finePrint ? (
            <p className="mt-6 text-base leading-relaxed text-[var(--muted)]">{offer.finePrint}</p>
          ) : null}
          <div className="mt-8">
            <Button asChild size="lg" className="min-h-12">
              <Link href={offer.href}>{offer.ctaLabel}</Link>
            </Button>
          </div>
        </div>

        {secondaryOffer ? (
          <div className="mx-auto mt-12 max-w-3xl border-t border-[var(--border)] pt-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              {secondaryOffer.title}
            </p>
            <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
              {secondaryOffer.description}
            </p>
            <ul className="mt-4 space-y-2">
              {secondaryOffer.features.map((feature) => (
                <li key={feature} className="text-base text-[var(--foreground)]">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}

export { SingleOfferSection };
export type { SingleOfferSectionProps };
