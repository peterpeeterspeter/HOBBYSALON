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

export const metadata = buildPageMetadata({
  title: "Hobbymaterialen verkopen via Hobbysalon",
  description:
    "Verkoop garen, papier, stoffen, kits en andere hobbymaterialen via de Hobbysalon marketplace.",
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
  "Productcatalogus op de marketplace",
  "Verkoop via Hobbysalon checkout",
  "Producttegels binnen categorieën",
  "Koppeling met workshops en kits",
  "Sponsored tutorials",
  "Categoriepartnerschap",
  "Nieuwsbriefpromoties",
];

const PLANS = [
  {
    title: "Basis verkoper",
    price: "€0 / maand",
    features: [
      "Geen vaste maandelijkse kosten",
      "10% commissie per verkoop",
      "Winkelprofiel",
      "Producten verkopen via Hobbysalon",
      "Verzendkosten apart",
      "Afrekenkosten apart",
      "Basis categorieplaatsing",
    ],
  },
  {
    title: "Premium winkel",
    price: "€29 / maand excl. btw",
    featured: true,
    features: [
      "10% commissie per verkoop",
      "Meer productzichtbaarheid",
      "Bulk upload indien beschikbaar",
      "Uitgelichte winkel",
      "Kitvermeldingen",
      "Promotiekansen",
    ],
  },
  {
    title: "Pro / categoriepartner",
    price: "Prijs op maat",
    features: [
      "10% commissie per verkoop",
      "Categorieboost",
      "Sponsored tutorial",
      "Nieuwsbriefdeal",
      "Homepage/categorieplaatsing",
      "Seizoenscampagnes",
    ],
  },
];

const WHY_ITEMS = [
  "Hobbyisten die materialen zoeken in de context van workshops en inspiratie",
  "Niche marketplace — geen algemene webshop",
  "Verkoop via Hobbysalon checkout, niet alleen leads",
  "Community en SEO gericht op craft en handwerk",
];

const FAQ_ITEMS = [
  {
    question: "Gaat de klant naar mijn webshop?",
    answer:
      "Niet standaard. De verkoop verloopt via Hobbysalon checkout.",
  },
  {
    question: "Wat is de commissie?",
    answer: "10% op materialen/supply producten.",
  },
  {
    question: "Hoe werken verzendkosten?",
    answer:
      "Verzendkosten worden apart verwerkt in de checkout.",
  },
  {
    question: "Kan ik workshops koppelen aan mijn materialen?",
    answer:
      "Ja, materiaalpakketten en kits kunnen aan workshops gekoppeld worden.",
  },
  {
    question: "Kan ik mijn winkel extra promoten?",
    answer:
      "Ja, via premium zichtbaarheid, sponsored tutorials en categoriepartnerschap.",
  },
];

export default function VoorWinkelsPage() {
  return (
    <>
      <MarketingHero
        headline="Verkoop je hobbymaterialen via de Hobbysalon marketplace"
        subheadline="Bied garen, papier, stoffen, kralen, kits, patronen en andere creatieve materialen aan op de plek waar hobbyisten inspiratie, workshops en producten zoeken."
        primaryCta={{ label: "Start als winkel", href: "/register/merchant" }}
        secondaryCta={{ label: "Bekijk verkoopmodel", href: "#verkoopmodel" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <CommercialModelBlock
        id="verkoopmodel"
        title="Verkoop via Hobbysalon checkout"
        text="Materialen worden verkocht via de Hobbysalon marketplace. Op supply/material producten geldt 10% commissie. Verzendkosten en afrekenkosten worden apart verwerkt. Extra zichtbaarheid is mogelijk via premium pakketten en sponsoring."
      />
      <PlanCardsSection
        title="Verkooppakketten"
        description="Basis: alleen commissie bij verkoop. Premium en Pro: extra zichtbaarheid via abonnement. Op alle pakketten geldt 10% commissie op materialen."
        plans={PLANS}
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
        description="Registreer je als merchant en verkoop hobbymaterialen via de Hobbysalon marketplace."
        href="/register/merchant"
        ctaText="Start als winkel"
        secondaryHref="#verkoopmodel"
        secondaryText="Bekijk verkoopmodel"
      />
    </>
  );
}
