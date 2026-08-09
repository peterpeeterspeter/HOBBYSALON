import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  MarketingNarrativeSections,
  FinalCtaSection,
  AboutHobbysalonSection,
} from "@/components/marketing";
import { SUPPLIER_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: SUPPLIER_PAGE.metaTitle,
  description: SUPPLIER_PAGE.metaDescription,
  path: "/voor-winkels",
});

export default function VoorWinkelsPage() {
  return (
    <>
      <MarketingHero
        headline={SUPPLIER_PAGE.headline}
        subheadline={SUPPLIER_PAGE.subheadline}
        primaryCta={SUPPLIER_PAGE.primaryCta}
        secondaryCta={SUPPLIER_PAGE.secondaryCta}
      />
      <MarketingNarrativeSections sections={SUPPLIER_PAGE.sections} />
      <FinalCtaSection
        title="€0 per maand · 10% commissie op verkopen via Hobbysalon"
        description="Geen instapkosten, geen listinglimiet, geen jaarcontract. Verkoop je niets, dan betaal je niets."
        href={SUPPLIER_PAGE.primaryCta.href}
        ctaText={SUPPLIER_PAGE.primaryCta.label}
        secondaryHref="/prijzen"
        secondaryText="Alle prijzen"
      />
      <AboutHobbysalonSection />
    </>
  );
}
