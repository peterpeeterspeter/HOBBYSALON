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

export const metadata = buildPageMetadata({
  title: "Creatief event promoten via Hobbysalon",
  description:
    "Promoot je hobbybeurs, workshopdag, makers market of creatief event bij bezoekers en standhouders.",
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
  "Agenda/categorieplaatsing",
  "Standhouder-aanvraagflow",
  "Bezoekerscampagne",
  "Nieuwsbrief/social promotie",
  "Event spotlight",
  "Later: interne ticketing",
];

const PLANS = [
  {
    title: "Event Essential",
    price: "vanaf €49 excl. btw / event",
    features: [
      "Eventpagina",
      "Basis agenda-vermelding",
      "Locatie, datum, thema's",
      "Aanvraagflow via Hobbysalon",
    ],
  },
  {
    title: "Event Premium",
    price: "vanaf €249 excl. btw / event",
    featured: true,
    features: [
      "Alles van Essential",
      "Uitgelichte eventplaatsing",
      "Hogere ranking",
      "Social/newsletter promotiekansen",
      "Standhouder CTA",
      "Premium eventbadge",
    ],
  },
  {
    title: "Full Promo Pack",
    price: "vanaf €750 excl. btw",
    features: [
      "Bezoekerscampagne",
      "Standhouderwerving",
      "Nieuwsbriefblok",
      "Social content",
      "Post-event artikel",
      "Spotlightperiode",
    ],
  },
];

const WHY_ITEMS = [
  "Bezoekers en standhouders die actief zoeken naar creatieve events",
  "Nicheplatform — geen algemene eventkalender",
  "Vertrouwd merk in hobby en handwerk",
  "Gerichte community, geen willekeurig advertentieverkeer",
];

const FAQ_ITEMS = [
  {
    question: "Verkopen jullie tickets?",
    answer:
      "Nog niet als standaard. Interne ticketing kan later volgen.",
  },
  {
    question: "Kan ik een externe ticketlink tonen?",
    answer:
      "Alleen binnen een premium of tracked pakket.",
  },
  {
    question: "Kunnen standhouders zich aanmelden?",
    answer:
      "Ja, via een Hobbysalon-aanvraagflow.",
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
        headline="Promoot je creatieve event of makers market via Hobbysalon"
        subheadline="Maak je hobbybeurs, workshopdag, open atelier of handmade market zichtbaar bij bezoekers, makers, winkels en standhouders."
        primaryCta={{ label: "Plaats je event", href: "/register/creator" }}
        secondaryCta={{ label: "Bekijk eventpakketten", href: "#pakketten" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <PlanCardsSection
        title="Eventpakketten"
        description="Kies het pakket dat past bij je event."
        plans={PLANS}
      />
      <HowItWorksSection
        steps={[
          "Plaats je event",
          "Kies bezoekerspromotie of standhouderwerving",
          "Ontvang aanvragen via Hobbysalon",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Plaats je event op Hobbysalon"
        description="Registreer je als creator, maak je eventpagina en bereik bezoekers en standhouders in de creatieve community."
        href="/register/creator"
        ctaText="Plaats je event"
        secondaryHref="#pakketten"
        secondaryText="Bekijk eventpakketten"
      />
    </>
  );
}
