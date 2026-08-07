import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  PricingRouteCards,
  TrustBullets,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";
import { PRICING_ROUTE_CARDS, PARTNERS_FAQ } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Zakelijk samenwerken met Hobbysalon | Makers, workshops, winkels en events",
  description:
    "Bereik de creatieve community via Hobbysalon. Voor contentmakers, makers, workshopgevers, organisatoren en hobbymaterialenwinkels.",
  path: "/partners",
});

export default function PartnersPage() {
  return (
    <>
      <MarketingHero
        headline="Bereik de creatieve community van Hobbysalon"
        subheadline="Content, handmade, workshops, events en materialen — verbonden in één platform. Kies de route die bij jou past."
        primaryCta={{ label: "Bekijk alle prijzen", href: "/prijzen" }}
        secondaryCta={{ label: "Ontdek de routes", href: "#routes" }}
      />
      <PricingRouteCards
        id="routes"
        title="Wat wil je aanbieden?"
        cards={PRICING_ROUTE_CARDS}
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
        title="Klaar om jouw aanbod zichtbaar te maken?"
        description="Kies je route. Op elke detailpagina vind je de volledige uitleg en de eerste stap."
        href="/prijzen"
        ctaText="Bekijk alle prijzen"
        secondaryHref="#routes"
        secondaryText="Ontdek de routes"
      />
    </>
  );
}
