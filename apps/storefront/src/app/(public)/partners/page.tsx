import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  AudienceCardGrid,
  TrustBullets,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";
import { PARTNER_AUDIENCE_CARDS, PARTNERS_FAQ } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Zakelijk samenwerken met Hobbysalon | Makers, workshops, winkels en events",
  description:
    "Bereik de creatieve community via Hobbysalon. Voor contentmakers, P2P-makers, workshopgevers, organisatoren en hobbymaterialenwinkels.",
  path: "/partners",
});

export default function PartnersPage() {
  return (
    <>
      <MarketingHero
        headline="Bereik de creatieve community van Hobbysalon"
        subheadline="Content, handmade, workshops, events en materialen — verbonden in één platform. Kies de route die bij jou past."
        primaryCta={{ label: "Bekijk alle prijzen", href: "/prijzen" }}
        secondaryCta={{ label: "Ontdek de routes", href: "#mogelijkheden" }}
      />
      <AudienceCardGrid
        id="mogelijkheden"
        title="Vijf soorten aanbieders"
        description="Elke doelgroep heeft een eigen formule. Geen verouderde jaarplannen — zie /prijzen voor het actuele overzicht."
        cards={PARTNER_AUDIENCE_CARDS}
      />
      <TrustBullets
        items={[
          "Nicheplatform voor hobby, craft en handwerk",
          "Content en producten in één kennisgrafiek",
          "Gebouwd vanuit het vertrouwde Hobbysalon-merk",
        ]}
      />
      <FaqSection items={PARTNERS_FAQ} />
      <FinalCtaSection
        title="Klaar om samen te werken?"
        description="Vergelijk formules op de prijspagina en kies je route."
        href="/prijzen"
        ctaText="Bekijk prijzen"
        secondaryHref="#mogelijkheden"
        secondaryText="Ontdek de routes"
      />
    </>
  );
}
