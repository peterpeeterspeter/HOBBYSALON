import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  PublicPricingCards,
  PricingExplainerSections,
  FinalCtaSection,
} from "@/components/marketing";
import { PRICING_OVERVIEW_OFFERS } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Prijzen voor makers, workshops, winkels en events | Hobbysalon",
  description:
    "Bekijk de formules van Hobbysalon voor content creators, P2P-makers, workshopgevers, organisatoren en hobbymaterialenwinkels.",
  path: "/prijzen",
});

export default function PrijzenPage() {
  return (
    <>
      <MarketingHero
        headline="Formules voor elke soort aanbieder"
        subheadline="Hobbysalon is geen gewone webshop. Content, handmade, workshops, events en materialen hangen samen in één creatieve grafiek — met een formule die past bij jouw rol."
        primaryCta={{ label: "Kies je doelgroep", href: "#formules" }}
        secondaryCta={{ label: "Zakelijk overzicht", href: "/partners" }}
      />
      <PublicPricingCards
        id="formules"
        title="Vijf routes op Hobbysalon"
        description="Geen abonnementsvergelijkingstabel — wel een helder overzicht per type aanbieder."
        offers={PRICING_OVERVIEW_OFFERS}
      />
      <PricingExplainerSections />
      <FinalCtaSection
        title="Klaar om te starten?"
        description="Registreer je als creator of merchant, of bekijk de detailpagina voor jouw rol."
        href="/partners"
        ctaText="Bekijk alle routes"
        secondaryHref="/register/creator"
        secondaryText="Registreer als creator"
      />
    </>
  );
}
