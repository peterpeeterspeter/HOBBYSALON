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
import {
  SUPPLIER_FAQ,
  SUPPLIER_OFFER,
  SUPPLIER_PREMIUM_NOTE,
  SUPPLIER_COMMISSION_NOTE,
} from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Hobbymaterialen verkopen via Hobbysalon | €0 + 10% commissie",
  description:
    "Verkoop garen, papier, stoffen en andere hobbymaterialen via Hobbysalon checkout. €0 per maand, 10% commissie per verkoop.",
  path: "/voor-winkels",
});

const PAIN_POINTS = [
  "Je webshop krijgt te weinig gericht hobbyverkeer.",
  "Algemene marketplaces tonen je naast niet-relevante producten.",
  "Klanten zoeken inspiratie, niet alleen losse producten.",
  "Promotie via social media kost veel tijd.",
];

const SOLUTION_ITEMS = [
  "Merchantprofiel en productcatalogus",
  "Verkoop via Hobbysalon checkout",
  "Voorraad, varianten, bestellingen en verzending",
  "Zichtbaarheid naast tutorials en workshops",
  "10% commissie — geen vaste maandelijkse basiskost",
];

const WHY_ITEMS = [
  "Mensen die materialen zoeken in de context van workshops en inspiratie",
  "Meer catalogus- en ordermogelijkheden dan P2P-makers",
  "Professionele winkelidentiteit",
  "Community en SEO gericht op craft en handwerk",
];

export default function VoorWinkelsPage() {
  return (
    <>
      <MarketingHero
        headline="Verkoop hobbymaterialen als merchant"
        subheadline="€0 per maand en 10% commissie op verkopen via Hobbysalon. Meer mogelijkheden dan P2P-handmade: catalogus, checkout, voorraad en verzending."
        primaryCta={{ label: "Start als winkel", href: "/register/merchant" }}
        secondaryCta={{ label: "Alle prijzen", href: "/prijzen" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <SingleOfferSection
        id="verkoopmodel"
        title="Basismodel"
        description="Professionele materialenverkoop — niet voor handmade P2P."
        offer={SUPPLIER_OFFER}
        secondaryOffer={SUPPLIER_PREMIUM_NOTE}
      />
      <CommercialModelBlock
        id="p2p-verschil"
        title="Waarom meer dan P2P?"
        text={`Merchants krijgen onbeperkter assortiment, varianten, checkout, orderbeheer en verzending. P2P-makers tonen maximaal 10 handmade-advertenties zonder commissie. ${SUPPLIER_COMMISSION_NOTE}`}
      />
      <HowItWorksSection
        steps={[
          "Registreer je als merchant",
          "Voeg je producten of catalogus toe",
          "Verkoop via Hobbysalon checkout",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={SUPPLIER_FAQ} />
      <FinalCtaSection
        title="Start als winkel op Hobbysalon"
        description="Registreer je als merchant en verkoop hobbymaterialen via Hobbysalon."
        href="/register/merchant"
        ctaText="Start als winkel"
        secondaryHref="/voor-makers"
        secondaryText="Handmade P2P?"
      />
    </>
  );
}
