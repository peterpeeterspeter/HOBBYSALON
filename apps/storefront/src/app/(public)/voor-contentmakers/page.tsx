import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  PainPointsSection,
  SolutionSection,
  CommercialModelBlock,
  HowItWorksSection,
  WhyHobbysalonSection,
  FaqSection,
  FinalCtaSection,
  SingleOfferSection,
} from "@/components/marketing";
import { CONTENT_CREATOR_OFFER, CONTENT_FAQ } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Gratis content publiceren op Hobbysalon | Tutorials en projecten",
  description:
    "Publiceer gratis tutorials, projecten, patronen, reviews en video's. Materialen koppelen aan de productgrafiek. Credits alleen voor optionele AI en promotie.",
  path: "/voor-contentmakers",
});

const PAIN_POINTS = [
  "Je content bereikt moeilijk mensen buiten je eigen volgers.",
  "Materialen in tutorials zijn lastig te koppelen aan echte producten.",
  "Je wilt inspiratie delen zonder direct een webshop te runnen.",
  "Promotie kost tijd die je liever aan maken besteedt.",
];

const SOLUTION_ITEMS = [
  "Gratis publiceren van tutorials, projecten en patronen",
  "Materialen koppelen aan de centrale productdatabase",
  "Vindbaarheid via inspiratie en SEO",
  "Makersprofiel naast workshops en events",
  "Credits optioneel voor AI, vertalingen of extra zichtbaarheid",
];

const WHY_ITEMS = [
  "Bezoekers zoeken actief naar tutorials en projecten",
  "Content staat in context van materialen en workshops",
  "Geen verplichte abonnementskost om te publiceren",
  "Community van makers en hobbyisten",
];

export default function VoorContentmakersPage() {
  return (
    <>
      <MarketingHero
        headline="Deel je tutorials en projecten — gratis"
        subheadline="Publiceer creatieve content op Hobbysalon. Materialen koppelen aan producten en winkels. Affiliate-inkomsten staan in voorbereiding."
        primaryCta={{ label: "Start als contentmaker", href: "/register/creator" }}
        secondaryCta={{ label: "Alle prijzen", href: "/prijzen" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <SingleOfferSection
        id="formule"
        offer={CONTENT_CREATOR_OFFER}
      />
      <CommercialModelBlock
        title="Affiliate en credits"
        text="Affiliate-inkomsten op gekoppelde materialen staan in voorbereiding — we publiceren geen vaste verdeling. Credits gebruik je alleen voor optionele AI-hulp, vertalingen, SEO of extra promotie. Gewone content publiceren blijft gratis."
      />
      <HowItWorksSection
        steps={[
          "Maak je makersprofiel",
          "Publiceer tutorials, projecten of patronen",
          "Koppel materialen aan de productgrafiek",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={CONTENT_FAQ} />
      <FinalCtaSection
        title="Start met je eerste tutorial"
        description="Registreer je en publiceer gratis content op Hobbysalon."
        href="/register/creator"
        ctaText="Start als contentmaker"
        secondaryHref="/prijzen"
        secondaryText="Bekijk alle formules"
      />
    </>
  );
}
