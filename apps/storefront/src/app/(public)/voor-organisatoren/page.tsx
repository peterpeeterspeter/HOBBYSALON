import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  MarketingNarrativeSections,
  FinalCtaSection,
  AboutHobbysalonSection,
} from "@/components/marketing";
import { ORGANIZER_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: ORGANIZER_PAGE.metaTitle,
  description: ORGANIZER_PAGE.metaDescription,
  path: "/voor-organisatoren",
});

export default function VoorOrganisatorenPage() {
  return (
    <>
      <MarketingHero
        headline={ORGANIZER_PAGE.headline}
        subheadline={ORGANIZER_PAGE.subheadline}
        primaryCta={ORGANIZER_PAGE.primaryCta}
        secondaryCta={ORGANIZER_PAGE.secondaryCta}
      />
      <MarketingNarrativeSections sections={ORGANIZER_PAGE.sections} />
      <FinalCtaSection
        title={ORGANIZER_PAGE.headline}
        description="Zet je evenement eerst gratis in de kalender. Loopt het goed, dan kun je later nog altijd upgraden naar een volledige eventpagina."
        href={ORGANIZER_PAGE.primaryCta.href}
        ctaText={ORGANIZER_PAGE.primaryCta.label}
        secondaryHref={ORGANIZER_PAGE.secondaryCta?.href}
        secondaryText={ORGANIZER_PAGE.secondaryCta?.label}
      />
      <AboutHobbysalonSection />
    </>
  );
}
