import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  PainPointsSection,
  SolutionSection,
  PlanCardsSection,
  HowItWorksSection,
  WhyHobbysalonSection,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";
import {
  ORGANIZER_PLAN_FAQ,
  ORGANIZER_PLANS,
} from "@/lib/marketing/commercial-offers";

export const metadata = buildPageMetadata({
  title: "Creatief event promoten via Hobbysalon",
  description:
    "Promoot je hobbybeurs, workshopdag, makers market of creatief event in de Hobbysalon-agenda.",
  path: "/voor-organisatoren",
});

const PAIN_POINTS = [
  "Bezoekers bereiken kost veel advertentiebudget.",
  "Standhouders vinden is telkens opnieuw werk.",
  "Je event is maar tijdelijk zichtbaar.",
  "Algemene eventkalenders trekken niet het juiste publiek.",
];

const SOLUTION_ITEMS = [
  "Eventpagina op Hobbysalon",
  "Plaatsing in de creatieve agenda",
  "Aanvraagflow via Hobbysalon",
  "Zichtbaarheid bij mensen die al hobby-events zoeken",
];

const WHY_ITEMS = [
  "Bezoekers die actief zoeken naar creatieve events",
  "Nicheplatform — geen algemene eventkalender",
  "Vertrouwd merk in hobby en handwerk",
  "Gerichte community, geen willekeurig advertentieverkeer",
];

const FAQ_ITEMS = [
  {
    question: "Verkopen jullie tickets?",
    answer: ORGANIZER_PLAN_FAQ.tickets,
  },
  {
    question: "Kunnen standhouders zich aanmelden?",
    answer: ORGANIZER_PLAN_FAQ.standhouders,
  },
  {
    question: "Voor welke events is dit geschikt?",
    answer:
      "Makers markets, hobbybeurzen, workshopdagen, open ateliers en creatieve pop-ups.",
  },
];

export default function VoorOrganisatorenPage() {
  return (
    <>
      <MarketingHero
        headline="Promoot je creatieve event via Hobbysalon"
        subheadline="Maak je hobbybeurs, workshopdag, open atelier of handmade market zichtbaar in dé agenda waar mensen creatieve events zoeken."
        primaryCta={{ label: "Plaats je event", href: "/register/creator" }}
        secondaryCta={{ label: "Bekijk eventpakketten", href: "#pakketten" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <PlanCardsSection
        title="Eventpakketten"
        description="Kies het pakket dat past bij je event. Prijzen per event, excl. btw."
        plans={ORGANIZER_PLANS}
      />
      <HowItWorksSection
        steps={[
          "Plaats je event",
          "Kies je zichtbaarheidspakket",
          "Ontvang aanvragen via Hobbysalon",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Plaats je event op Hobbysalon"
        description="Registreer je, maak je eventpagina en bereik bezoekers in de creatieve community."
        href="/register/creator"
        ctaText="Plaats je event"
        secondaryHref="#pakketten"
        secondaryText="Bekijk eventpakketten"
      />
    </>
  );
}
