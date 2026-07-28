import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  PainPointsSection,
  SolutionSection,
  CommercialModelBlock,
  PlanCardsSection,
  HowItWorksSection,
  WhyHobbysalonSection,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";
import {
  SUPPLIER_COMMISSION_NOTE,
  SUPPLIER_PLANS,
} from "@/lib/marketing/commercial-offers";

export const metadata = buildPageMetadata({
  title: "Hobbymaterialen verkopen via Hobbysalon",
  description:
    "Verkoop garen, papier, stoffen en andere hobbymaterialen via de Hobbysalon checkout.",
  path: "/voor-winkels",
});

const PAIN_POINTS = [
  "Je webshop krijgt te weinig gericht hobbyverkeer.",
  "Algemene marketplaces tonen je naast niet-relevante producten.",
  "Klanten zoeken inspiratie, niet alleen losse producten.",
  "Promotie via social media kost veel tijd.",
];

const SOLUTION_ITEMS = [
  "Winkelprofiel op Hobbysalon",
  "Productcatalogus op het platform",
  "Verkoop via Hobbysalon checkout",
  "Plaatsing binnen categorieën",
  "10% commissie op materialen",
];

const WHY_ITEMS = [
  "Mensen die materialen zoeken in de context van workshops en inspiratie",
  "Nicheplatform — geen algemene webshop",
  "Verkoop via Hobbysalon checkout",
  "Community en SEO gericht op craft en handwerk",
];

const FAQ_ITEMS = [
  {
    question: "Gaat de klant naar mijn webshop?",
    answer: "Niet standaard. De verkoop verloopt via Hobbysalon checkout.",
  },
  {
    question: "Wat is de commissie?",
    answer: "10% op materialen/supply-producten.",
  },
  {
    question: "Hoe werken verzendkosten?",
    answer: "Verzendkosten worden apart verwerkt in de checkout.",
  },
  {
    question: "Wat kost Premium?",
    answer:
      "Winkel Premium kost €490 excl. btw per jaar, naast de 10% commissie op verkopen. Basis heeft geen abonnementskost.",
  },
];

export default function VoorWinkelsPage() {
  return (
    <>
      <MarketingHero
        headline="Verkoop je hobbymaterialen via Hobbysalon"
        subheadline="Bied garen, papier, stoffen, kralen en andere creatieve materialen aan op de plek waar mensen inspiratie, workshops en producten zoeken."
        primaryCta={{ label: "Start als winkel", href: "/register/merchant" }}
        secondaryCta={{ label: "Bekijk verkoopmodel", href: "#verkoopmodel" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <CommercialModelBlock
        id="verkoopmodel"
        title="Verkoop via Hobbysalon checkout"
        text={`Materialen worden verkocht via Hobbysalon. ${SUPPLIER_COMMISSION_NOTE} Extra zichtbaarheid is mogelijk via Winkel Premium.`}
      />
      <PlanCardsSection
        title="Verkooppakketten"
        description={`Basis: alleen commissie bij verkoop. Premium: extra zichtbaarheid via jaarabonnement. ${SUPPLIER_COMMISSION_NOTE}`}
        plans={SUPPLIER_PLANS}
      />
      <HowItWorksSection
        steps={[
          "Registreer je winkel",
          "Voeg je producten of catalogus toe",
          "Verkoop via Hobbysalon checkout",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Start als winkel op Hobbysalon"
        description="Registreer je als merchant en verkoop hobbymaterialen via Hobbysalon."
        href="/register/merchant"
        ctaText="Start als winkel"
        secondaryHref="#verkoopmodel"
        secondaryText="Bekijk verkoopmodel"
      />
    </>
  );
}
