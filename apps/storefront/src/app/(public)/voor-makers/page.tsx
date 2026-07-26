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
} from "@/components/marketing";

export const metadata = buildPageMetadata({
  title: "Handmade producten plaatsen via Hobbysalon",
  description:
    "Plaats je handmade producten gratis op Hobbysalon. Bezoekers nemen rechtstreeks contact met je op — geen commissie, geen checkout via Hobbysalon.",
  path: "/voor-makers",
});

const PAIN_POINTS = [
  "Social media geeft geen voorspelbare zichtbaarheid.",
  "Je producten verdwijnen tussen algemene marketplaces.",
  "Je bereikt moeilijk nieuwe kopers buiten je eigen volgers.",
  "Markten zijn tijdelijk; online zichtbaarheid moet doorlopen.",
];

const SOLUTION_ITEMS = [
  "Makerprofiel op Hobbysalon",
  "Handmade productpagina's",
  "Contact via Hobbysalon — geen checkout, geen commissie",
  "Gratis plaatsen",
  "Spotlight en maker van de maand",
];

const WHY_ITEMS = [
  "Kopers die actief zoeken naar handmade en creatieve producten",
  "Niche marketplace — geen algemene verkoopsite",
  "Rechtstreeks contact met geïnteresseerde kopers, geen tussenkomst van Hobbysalon",
  "Community van hobbyisten en makers, geen willekeurig verkeer",
];

const FAQ_ITEMS = [
  {
    question: "Verloopt de verkoop via Hobbysalon?",
    answer:
      "Nee. Een bezoeker die interesse heeft, stuurt een bericht via het contactformulier op je productpagina. Jij regelt de verkoop, betaling en verzending zelf, rechtstreeks met de koper.",
  },
  {
    question: "Wat is de commissie?",
    answer:
      "Geen. Hobbysalon verwerkt geen betaling voor handmade producten, dus er is niets om commissie op te nemen.",
  },
  {
    question: "Wat kost een plaatsing?",
    answer: "Niets. Plaatsen is momenteel gratis.",
  },
  {
    question: "Kan ik mijn Etsy of Instagram linken?",
    answer:
      "Niet als standaardfeature. Externe links kunnen later als extra optie beschikbaar komen.",
  },
];

export default function VoorMakersPage() {
  return (
    <>
      <MarketingHero
        headline="Plaats je handmade producten op Hobbysalon"
        subheadline="Plaats je creaties op een marketplace voor hobbyisten en makers. Geïnteresseerde kopers nemen rechtstreeks contact met je op — jij regelt de verkoop zelf, zonder commissie."
        primaryCta={{ label: "Start als maker", href: "/register/creator" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <CommercialModelBlock
        title="Gratis plaatsen, geen commissie"
        text="Handmade producten plaats je gratis op Hobbysalon. Een geïnteresseerde koper stuurt een bericht via je productpagina; jij regelt daarna zelf de verkoop, betaling en verzending. Hobbysalon verwerkt geen betaling en neemt geen commissie."
      />
      <HowItWorksSection
        steps={[
          "Maak je makerprofiel",
          "Plaats je creaties",
          "Beantwoord aanvragen en verkoop rechtstreeks aan de koper",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Start als maker op Hobbysalon"
        description="Registreer je en plaats je handmade producten — gratis, zonder commissie."
        href="/register/creator"
        ctaText="Start als maker"
      />
    </>
  );
}
