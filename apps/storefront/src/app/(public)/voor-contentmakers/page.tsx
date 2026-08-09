import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  MarketingNarrativeSections,
  FinalCtaSection,
  AboutHobbysalonSection,
} from "@/components/marketing";
import { CONTENT_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: CONTENT_PAGE.metaTitle,
  description: CONTENT_PAGE.metaDescription,
  path: "/voor-contentmakers",
});

export default function VoorContentmakersPage() {
  return (
    <>
      <MarketingHero
        headline={CONTENT_PAGE.headline}
        subheadline={CONTENT_PAGE.subheadline}
        primaryCta={CONTENT_PAGE.primaryCta}
        secondaryCta={CONTENT_PAGE.secondaryCta}
      />
      <MarketingNarrativeSections sections={CONTENT_PAGE.sections} />
      <FinalCtaSection
        title={CONTENT_PAGE.headline}
        description={CONTENT_PAGE.subheadline}
        href={CONTENT_PAGE.primaryCta.href}
        ctaText={CONTENT_PAGE.primaryCta.label}
        secondaryHref="/prijzen"
        secondaryText="Alle prijzen"
      />
      <AboutHobbysalonSection />
    </>
  );
}
