import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
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
      <MarketingHero
        label={PRIJZEN_PAGE.heroLabel}
        headline={PRIJZEN_PAGE.heroHeadline}
        subheadline={PRIJZEN_PAGE.heroSubheadline}
        primaryCta={PRIJZEN_PAGE.primaryCta}
        secondaryCta={PRIJZEN_PAGE.secondaryCta}
      />
      <PricingRouteCards
        id="routes"
        title={PRIJZEN_PAGE.routesTitle}
        cards={PRICING_ROUTE_CARDS}
      />
      <PricingComparisonTable
        id="vergelijking"
        title={PRIJZEN_PAGE.comparisonTitle}
        description={PRIJZEN_PAGE.comparisonIntro}
        footnote={PRIJZEN_PAGE.comparisonFootnote}
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
