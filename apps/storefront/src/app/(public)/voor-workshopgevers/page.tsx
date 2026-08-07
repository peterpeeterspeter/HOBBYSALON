import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  MarketingNarrativeSections,
  FinalCtaSection,
} from "@/components/marketing";
import { WORKSHOP_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: WORKSHOP_PAGE.metaTitle,
  description: WORKSHOP_PAGE.metaDescription,
  path: "/voor-workshopgevers",
});

export default function VoorWorkshopgeversPage() {
  return (
    <>
      <MarketingHero
        headline={WORKSHOP_PAGE.headline}
        subheadline={WORKSHOP_PAGE.subheadline}
        primaryCta={WORKSHOP_PAGE.primaryCta}
        secondaryCta={WORKSHOP_PAGE.secondaryCta}
      />
      <MarketingNarrativeSections sections={WORKSHOP_PAGE.sections} />
      <FinalCtaSection
        title="€9,99 per workshopvermelding."
        description="Drie maanden zichtbaar, daarna opnieuw te activeren."
        href={WORKSHOP_PAGE.primaryCta.href}
        ctaText={WORKSHOP_PAGE.primaryCta.label}
        secondaryHref="/prijzen"
        secondaryText="Alle prijzen"
      />
    </>
  );
}
