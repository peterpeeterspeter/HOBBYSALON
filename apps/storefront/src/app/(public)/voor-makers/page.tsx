import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  MarketingNarrativeSections,
  FinalCtaSection,
  AboutHobbysalonSection,
} from "@/components/marketing";
import { MAKERS_PAGE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: MAKERS_PAGE.metaTitle,
  description: MAKERS_PAGE.metaDescription,
  path: "/voor-makers",
});

export default function VoorMakersPage() {
  return (
    <>
      <MarketingHero
        headline={MAKERS_PAGE.headline}
        subheadline={MAKERS_PAGE.subheadline}
        primaryCta={MAKERS_PAGE.primaryCta}
        secondaryCta={MAKERS_PAGE.secondaryCta}
      />
      <MarketingNarrativeSections sections={MAKERS_PAGE.sections} />
      <FinalCtaSection
        title={MAKERS_PAGE.headline}
        description="Je profiel en je eerste drie advertenties kosten niets. Genoeg om te testen of Hobbysalon werkt voor jouw werk, zonder vooraf iets uit te geven."
        href={MAKERS_PAGE.primaryCta.href}
        ctaText={MAKERS_PAGE.primaryCta.label}
        secondaryHref="/prijzen"
        secondaryText="Alle prijzen"
      />
      <AboutHobbysalonSection />
    </>
  );
}
