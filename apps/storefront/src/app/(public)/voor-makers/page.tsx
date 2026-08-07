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
import { MAKERS_FAQ, P2P_MAKER_OFFER, P2P_COMMISSION_NOTE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Handmade en destash tonen via Hobbysalon | P2P-makers",
  description:
    "Gratis makersprofiel, maximaal 10 actieve advertenties, geen commissie op P2P-verkoop. Credits voor publicatie en boosts.",
  path: "/voor-makers",
});

const PAIN_POINTS = [
  "Social media geeft geen voorspelbare zichtbaarheid.",
  "Je creaties verdwijnen tussen algemene marketplaces.",
  "Je bereikt moeilijk nieuwe kopers buiten je eigen volgers.",
  "Markten zijn tijdelijk; online zichtbaarheid moet doorlopen.",
];

const SOLUTION_ITEMS = [
  "Gratis makersprofiel",
  "Maximaal 10 actieve handmade- of destash-advertenties",
  "Geïnteresseerde kopers sturen een aanvraag via Hobbysalon",
  "Geen commissie — jij regelt verkoop en betaling",
  "Credits voor publicatie, verlenging en extra zichtbaarheid",
];

const WHY_ITEMS = [
  "Bezoekers die actief zoeken naar handmade en creatieve producten",
  "Nicheplatform, geen algemene verkoopsite",
  "Je werk staat in de context van workshops, materialen en inspiratie",
  "Laagdrempeliger dan een professionele merchant-webshop",
];

export default function VoorMakersPage() {
  return (
    <>
      <MarketingHero
        headline="Toon je handmade creaties — zonder commissie"
        subheadline="Voor P2P-handmade en destash: maximaal 10 actieve advertenties, aanvragen via Hobbysalon, geen verkoopcommissie. Professionele materialen? Bekijk hobbymaterialenwinkels."
        primaryCta={{ label: "Start als maker", href: "/register/creator" }}
        secondaryCta={{ label: "Alle prijzen", href: "/prijzen" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <SingleOfferSection id="formule" offer={P2P_MAKER_OFFER} />
      <CommercialModelBlock
        title="P2P, geen merchant"
        text={`${P2P_COMMISSION_NOTE} Deze route is voor handmade en destash — niet voor professionele materialenverkoop. Verkoop je hobbymaterialen als winkel? Bekijk /voor-winkels voor checkout, voorraad en 10% commissie.`}
      />
      <HowItWorksSection
        steps={[
          "Maak je makerprofiel",
          "Publiceer je creaties met credits",
          "Beantwoord aanvragen en regel de verkoop met de koper",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={MAKERS_FAQ} />
      <FinalCtaSection
        title="Start als P2P-maker"
        description="Registreer je, maak je profiel en toon je creaties aan mensen die gericht zoeken."
        href="/register/creator"
        ctaText="Start als maker"
        secondaryHref="/voor-winkels"
        secondaryText="Professionele materialen?"
      />
    </>
  );
}
