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
  WORKSHOP_COMMISSION_NOTE,
  WORKSHOP_PLAN_FAQ,
  WORKSHOP_PLANS,
} from "@/lib/marketing/commercial-offers";

export const metadata = buildPageMetadata({
  title: "Workshops aanbieden via Hobbysalon | Geen commissie per deelnemer",
  description:
    "Plaats je creatieve workshops op Hobbysalon met een vaste jaarprijs. Bereik mensen die actief zoeken zonder commissie per deelnemer.",
  path: "/voor-workshopgevers",
});

const PAIN_POINTS = [
  "Je workshops vullen via Facebook kost veel tijd.",
  "Je bereikt vaak alleen je bestaande volgers.",
  "Losse posts verdwijnen snel.",
  "Administratie en aanvragen komen versnipperd binnen.",
];

const SOLUTION_ITEMS = [
  "Docentprofiel op Hobbysalon",
  "Workshopvermeldingen op het platform",
  "Boekingsaanvragen via Hobbysalon",
  "Plaatsing op categoriepagina's",
  "Geen commissie per deelnemer",
];

const WHY_ITEMS = [
  "Bereik mensen die actief zoeken naar creatieve workshops",
  "Nicheplatform — geen algemene advertentiekalender",
  "Vertrouwd merk in hobby, craft en handwerk",
  "Gerichte community en vindbaarheid",
];

const FAQ_ITEMS = [
  {
    question: "Nemen jullie commissie op mijn workshops?",
    answer:
      "Nee. Je betaalt een vaste jaarprijs en behoudt je workshopomzet.",
  },
  {
    question: "Moet ik een boekingssysteem van Hobbysalon gebruiken?",
    answer: WORKSHOP_PLAN_FAQ.bookingSystem,
  },
  {
    question: "Kan ik een externe boekingslink tonen?",
    answer: WORKSHOP_PLAN_FAQ.externalBooking,
  },
  {
    question: "Controleren jullie aanbieders?",
    answer: "Ja, we houden Hobbysalon gericht op echte creatieve workshops.",
  },
];

export default function VoorWorkshopgeversPage() {
  return (
    <>
      <MarketingHero
        headline="Plaats je creatieve workshops op Hobbysalon"
        subheadline="Bereik mensen die actief zoeken naar creatieve workshops. Jij behoudt je omzet; Hobbysalon zorgt voor zichtbaarheid en aanvragen via het platform."
        primaryCta={{ label: "Plaats je workshop", href: "/register/creator" }}
        secondaryCta={{ label: "Bekijk pakketten", href: "#pakketten" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <PlanCardsSection
        title="Kies je pakket"
        description={WORKSHOP_COMMISSION_NOTE}
        plans={WORKSHOP_PLANS}
      />
      <HowItWorksSection
        steps={[
          "Maak je docentprofiel aan",
          "Voeg je workshops toe",
          "Ontvang aanvragen via Hobbysalon",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Start met je eerste workshop"
        description="Registreer je, kies je pakket en bereik mensen die actief zoeken naar creatieve workshops."
        href="/register/creator"
        ctaText="Plaats je workshop"
        secondaryHref="#pakketten"
        secondaryText="Bekijk pakketten"
      />
    </>
  );
}
