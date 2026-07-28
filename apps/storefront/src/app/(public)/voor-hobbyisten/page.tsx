import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  PainPointsSection,
  SolutionSection,
  HowItWorksSection,
  WhyHobbysalonSection,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";

export const metadata = buildPageMetadata({
  title: "Ontdek workshops, materialen en events | Hobbysalon",
  description:
    "Alles voor wie graag iets moois maakt: workshops, makers, materialen, events en inspiratie op één plek in België en Nederland.",
  path: "/voor-hobbyisten",
});

const PAIN_POINTS = [
  "Inspiratie zit verspreid over tientallen tabbladen en social feeds.",
  "Je vindt moeilijk een rustige eerste workshop of markt bij jou in de buurt.",
  "Materialen, lessen en events staan zelden samen.",
  "Je wilt eerst rustig rondkijken, zonder meteen iets te moeten kopen.",
];

const SOLUTION_ITEMS = [
  "Workshops, makers, materialen, agenda, artikelen, tools en patronen op één plek",
  "Ontdekken mag zonder account",
  "Gratis account voor favorieten, projecten, materialenlijst en locatievoorkeur",
  "Je kunt je inschrijven voor de nieuwsbrief",
];

const WHY_ITEMS = [
  "Gemaakt voor mensen die graag iets met hun handen maken",
  "Duidelijke pagina’s, grote knoppen, rustige navigatie",
  "Lokaal én online: België en Nederland",
  "Van eerste idee tot workshop, materiaal of event",
];

const FAQ_ITEMS = [
  {
    question: "Moet ik een account hebben om te kijken?",
    answer:
      "Nee. Je kunt workshops, materialen, makers en events gewoon bekijken. Een gratis account helpt om favorieten en projecten bij te houden.",
  },
  {
    question: "Wat krijg ik met een gratis account?",
    answer:
      "Je kunt favorieten bewaren, projecten starten, een materialenlijst bijhouden en een locatievoorkeur instellen voor betere aanbevelingen.",
  },
  {
    question: "Krijg ik automatisch de nieuwsbrief?",
    answer:
      "Nee. Je kunt je apart inschrijven voor de nieuwsbrief wanneer je dat wilt.",
  },
];

export default function VoorHobbyistenPage() {
  return (
    <>
      <MarketingHero
        headline="Voor iedereen die graag iets moois maakt"
        subheadline="Vind workshops, materialen, makers en creatieve events op één plek. Rustig ontdekken, zonder twintig tabbladen."
        primaryCta={{ label: "Bekijk creatieve events", href: "/agenda" }}
        secondaryCta={{ label: "Vind een workshop", href: "/workshops" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <HowItWorksSection
        steps={[
          "Kies een hobby of zoek op plaats",
          "Ontdek workshops, materialen of events",
          "Bewaar wat je leuk vindt met een gratis account",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Begin met ontdekken"
        description="Geen haast. Kijk eerst rond, of maak een gratis account wanneer het jou past."
        href="/agenda"
        ctaText="Bekijk de agenda"
        secondaryHref="/register"
        secondaryText="Maak een gratis account"
      />
    </>
  );
}
