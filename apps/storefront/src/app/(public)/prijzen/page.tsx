import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import {
  PricingRouteCards,
  PricingComparisonTable,
  PricingExplainerSections,
  PricingClosingLinks,
} from "@/components/marketing";
import {
  PRIJZEN_PAGE,
  PRICING_ROUTE_CARDS,
  PRICING_COMPARISON_ROWS,
} from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Prijzen en mogelijkheden voor aanbieders",
  description: PRIJZEN_PAGE.metaDescription,
  path: "/prijzen",
});

export default function PrijzenPage() {
  return (
    <>
      {/* Compact hero: a pricing page is a reference, the cards are the action. */}
      <section className="border-b border-[var(--border)] bg-[var(--section-highlight)]">
        <Container className="py-14 md:py-20">
          <p className="text-base font-semibold uppercase tracking-wide text-[var(--accent-hover)]">
            {PRIJZEN_PAGE.heroLabel}
          </p>
          <h1 className="mt-3 max-w-[680px] font-[family-name:var(--font-heading)] text-4xl font-bold leading-tight tracking-[-0.035em] text-[var(--foreground)] [text-wrap:balance] md:text-5xl">
            {PRIJZEN_PAGE.heroHeadline}
          </h1>
          <p className="mt-5 max-w-[680px] text-lg leading-relaxed text-[var(--muted)] [text-wrap:pretty] md:text-xl">
            {PRIJZEN_PAGE.heroSubheadline}
          </p>
          <nav aria-label={PRIJZEN_PAGE.heroChipsLabel} className="mt-8">
            <p className="text-lg font-semibold text-[var(--foreground)]">{PRIJZEN_PAGE.heroChipsLabel}</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {PRICING_ROUTE_CARDS.map((card) => (
                <li key={card.id}>
                  <Link
                    href={`#route-${card.id}`}
                    className="inline-flex min-h-12 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-lg font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {card.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>
      <PricingRouteCards id="routes" title={PRIJZEN_PAGE.routesTitle} cards={PRICING_ROUTE_CARDS} />
      <PricingComparisonTable
        id="vergelijking"
        title={PRIJZEN_PAGE.comparisonTitle}
        description={PRIJZEN_PAGE.comparisonIntro}
        footnote={`${PRIJZEN_PAGE.listingVatNote} ${PRIJZEN_PAGE.comparisonFootnote}`}
        rows={PRICING_COMPARISON_ROWS}
      />
      <PricingExplainerSections />
      <PricingClosingLinks
        title={PRIJZEN_PAGE.closingTitle}
        description={PRIJZEN_PAGE.closingDescription}
        links={PRIJZEN_PAGE.closingLinks}
      />
    </>
  );
}
