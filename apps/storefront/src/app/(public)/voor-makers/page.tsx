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
  title: "Handmade creaties tonen via Hobbysalon",
  description:
    "Toon je creaties op Hobbysalon en ontvang geïnteresseerde kopers via het platform. Gemaakt voor makers in België en Nederland.",
  path: "/voor-makers",
});

const PAIN_POINTS = [
  "Social media geeft geen voorspelbare zichtbaarheid.",
  "Je creaties verdwijnen tussen algemene marketplaces.",
  "Je bereikt moeilijk nieuwe kopers buiten je eigen volgers.",
  "Markten zijn tijdelijk; online zichtbaarheid moet doorlopen.",
];

const SOLUTION_ITEMS = [
  "Makerprofiel op Hobbysalon",
  "Plaatsingen van je handmade creaties",
  "Geïnteresseerde kopers sturen een aanvraag via Hobbysalon",
  "Jij regelt de verkoop verder rechtstreeks met de koper",
];

const WHY_ITEMS = [
  "Bezoekers die actief zoeken naar handmade en creatieve producten",
  "Nicheplatform, geen algemene verkoopsite",
  "Je werk staat in de context van workshops, materialen en inspiratie",
  "Community van makers en mensen die graag iets moois maken",
];

const FAQ_ITEMS = [
  {
    question: "Hoe werkt een aanvraag?",
    answer:
      "Een bezoeker die interesse heeft, stuurt een bericht via Hobbysalon. Jij ziet de aanvraag en neemt zelf contact op om de verkoop, betaling en verzending verder te regelen.",
  },
  {
    question: "Verkoop ik via de Hobbysalon-checkout?",
    answer:
      "Nieuwe handmade plaatsingen zijn gericht op aanvragen: jij toont je creaties en ontvangt geïnteresseerde kopers via Hobbysalon. Hoe je daarna betaalt en verzendt, regel je met de koper.",
  },
  {
    question: "Wat kost een plaatsing?",
    answer: "Starten en plaatsen is momenteel gratis.",
  },
  {
    question: "Kan ik ook workshops of een winkel hebben?",
    answer:
      "Ja. Veel makers combineren rollen. Kies in je account wat bij je past, of bekijk de pagina’s voor workshopgevers en winkels.",
  },
];

export default function VoorMakersPage() {
  return (
    <>
      <MarketingHero
        headline="Toon je creaties en ontvang geïnteresseerde kopers"
        subheadline="Plaats je handmade werk op Hobbysalon. Bezoekers die iets moois zoeken, sturen je een aanvraag. Jij regelt de verkoop verder rechtstreeks met hen."
        primaryCta={{ label: "Start als maker", href: "/register/creator" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <CommercialModelBlock
        title="Zichtbaarheid via aanvragen"
        text="Toon je creaties en ontvang geïnteresseerde kopers via Hobbysalon. Zo sta je tussen workshops, materialen en events, op een plek waar mensen al zin hebben om iets moois te maken of te kopen."
      />
      <HowItWorksSection
        steps={[
          "Maak je makerprofiel",
          "Plaats je creaties",
          "Beantwoord aanvragen en regel de verkoop met de koper",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Start als maker op Hobbysalon"
        description="Registreer je, maak je profiel en toon je creaties aan mensen die gericht zoeken."
        href="/register/creator"
        ctaText="Start als maker"
      />
    </>
  );
}
