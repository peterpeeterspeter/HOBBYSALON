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
  title: "Handmade producten verkopen via Hobbysalon",
  description:
    "Verkoop je handmade producten via de Hobbysalon marketplace. Gebruik listingcredits voor zichtbaarheid en bereik creatieve kopers.",
  path: "/voor-makers",
});

const PAIN_POINTS = [
  "Social media geeft geen voorspelbare verkoop.",
  "Je producten verdwijnen tussen algemene marketplaces.",
  "Je bereikt moeilijk nieuwe kopers buiten je eigen volgers.",
  "Markten zijn tijdelijk; online zichtbaarheid moet doorlopen.",
];

const SOLUTION_ITEMS = [
  "Makerprofiel op Hobbysalon",
  "Handmade productpagina's",
  "Verkoop via Hobbysalon checkout",
  "6% commissie op handmade verkoop",
  "Listingcredits voor publicatie en zichtbaarheid",
  "Spotlight en maker van de maand",
  "Optionele aanvraagknop voor maatwerk — niet als vervanging van kopen",
];

const CREDIT_PACKS = [
  {
    title: "Starter",
    price: "10 credits — €9",
    features: ["Ideaal om te starten met je eerste listings"],
  },
  {
    title: "Maker",
    price: "25 credits — €19",
    features: ["Voor regelmatige nieuwe producten"],
  },
  {
    title: "Growth",
    price: "60 credits — €39",
    features: ["Meer zichtbaarheid en bumps"],
    featured: true,
  },
  {
    title: "Pro",
    price: "150 credits — €79",
    features: ["Voor actieve makers met groter aanbod"],
  },
  {
    title: "Market Pack",
    price: "350 credits — €149",
    features: ["Maximale zichtbaarheid en promotie"],
  },
];

const CREDIT_USE = [
  "Productlisting: 1 credit",
  "Bump: 1 credit",
  "Spotlight 7 dagen: 5 credits",
  "Collectiepagina: 3 credits",
  "Nieuwsbrief feature: premium/add-on",
];

const WHY_ITEMS = [
  "Kopers die actief zoeken naar handmade en creatieve producten",
  "Niche marketplace — geen algemene verkoopsite",
  "Verkoop via Hobbysalon checkout, geen lead-gen",
  "Community van hobbyisten en makers, geen willekeurig verkeer",
];

const FAQ_ITEMS = [
  {
    question: "Verloopt de verkoop via mijn eigen webshop?",
    answer:
      "Nee, standaard koopt de klant via Hobbysalon checkout op de marketplace.",
  },
  {
    question: "Kan ik mijn Etsy of Instagram linken?",
    answer:
      "Niet als gratis standaardfeature. Externe links kunnen later premium of tracked worden.",
  },
  {
    question: "Wat is de commissie?",
    answer: "6% op handmade producten.",
  },
  {
    question: "Betaal ik ook voor listings?",
    answer:
      "Ja, via listingcredits. Zo betaal je voor zichtbaarheid en behoudt Hobbysalon kwaliteit.",
  },
];

export default function VoorMakersPage() {
  return (
    <>
      <MarketingHero
        headline="Verkoop je handmade producten via Hobbysalon"
        subheadline="Plaats je creaties op een marketplace voor hobbyisten en makers. Klanten kopen via Hobbysalon checkout; jij krijgt extra zichtbaarheid binnen een creatieve community."
        primaryCta={{ label: "Start als maker", href: "/register/creator" }}
        secondaryCta={{ label: "Bekijk listingcredits", href: "#pakketten" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <CommercialModelBlock
        title="Betaal voor zichtbaarheid, verkoop via Hobbysalon"
        text="Handmade producten worden verkocht via de Hobbysalon marketplace. Op verkoop geldt 6% commissie. Voor extra zichtbaarheid gebruik je listingcredits, bijvoorbeeld voor nieuwe listings, bumps of spotlight."
      />
      <PlanCardsSection
        title="Listingcredits"
        description="Kies een creditpakket voor publicatie en zichtbaarheid."
        plans={CREDIT_PACKS}
        addons={CREDIT_USE}
        addonsTitle="Waarvoor gebruik je credits?"
      />
      <HowItWorksSection
        steps={[
          "Maak je makerprofiel",
          "Koop of gebruik listingcredits",
          "Publiceer je creaties en verkoop via Hobbysalon",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Start als maker op Hobbysalon"
        description="Registreer je, publiceer je handmade producten en verkoop via de Hobbysalon marketplace."
        href="/register/creator"
        ctaText="Start als maker"
        secondaryHref="#pakketten"
        secondaryText="Bekijk listingcredits"
      />
    </>
  );
}
