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
  title: "Workshops aanbieden via Hobbysalon | Geen commissie per deelnemer",
  description:
    "Plaats je creatieve workshops op Hobbysalon met een vaste jaarprijs. Bereik hobbyisten zonder commissie per deelnemer.",
  path: "/voor-workshopgevers",
});

const PAIN_POINTS = [
  "Je workshops vullen via Facebook kost veel tijd.",
  "Je bereikt vaak alleen je bestaande volgers.",
  "Losse posts verdwijnen snel.",
  "Administratie en aanvragen komen versnipperd binnen.",
];

const SOLUTION_ITEMS = [
  "Professioneel Hobbysalon-docentprofiel",
  "Workshopvermeldingen op het platform",
  "Aanvragen via Hobbysalon",
  "Plaatsing op categoriepagina's",
  "Zichtbaarheid via content, nieuwsbrief, Facebook, Pinterest en Google",
  "Geen commissie per deelnemer",
];

const PLANS = [
  {
    title: "Essential",
    price: "€190 excl. btw / jaar",
    features: [
      "Hobbysalon-docentprofiel",
      "Tot 5 actieve workshops",
      "Aanvragen via Hobbysalon",
      "Foto's en praktische info",
      "Categorieplaatsing",
      "Basiszichtbaarheid",
      "Geen commissie per deelnemer",
    ],
  },
  {
    title: "Tracked",
    price: "€390 excl. btw / jaar",
    features: [
      "Alles van Essential",
      "Tot 20 actieve workshops",
      "Externe boekingslink tonen",
      "Conversie-tracking op je workshopknop",
      "Maandelijkse performance update",
      "Geen commissie per deelnemer",
    ],
  },
  {
    title: "Premium",
    price: "€690 excl. btw / jaar",
    featured: true,
    features: [
      "Alles van Essential",
      "Onbeperkte actieve workshops",
      "Hogere ranking",
      "Uitgelichte rotatie",
      "Video toevoegen",
      "Hulp bij workshopteksten",
      "Extra promotiekansen",
      "Premium badge",
      "Geen commissie per deelnemer",
    ],
  },
];

const ADDONS = [
  "Spotlight boost",
  "Nieuwsbrief feature",
  "Signature class campagne",
  "Copywriting upgrade",
];

const WHY_ITEMS = [
  "Bereik hobbyisten die actief zoeken naar creatieve workshops",
  "Nicheplatform — geen algemene advertentie- of eventkalender",
  "Vertrouwd merk in hobby, craft en handwerk",
  "Geen willekeurig verkeer — gerichte community en SEO",
];

const FAQ_ITEMS = [
  {
    question: "Nemen jullie commissie op mijn workshops?",
    answer:
      "Nee, bij dit model betaal je een vaste jaarprijs. Je behoudt je volledige workshopomzet.",
  },
  {
    question: "Moet ik een boekingssysteem van Hobbysalon gebruiken?",
    answer:
      "Nee. Bij de start hoeven deelnemers niet via een nieuwe bookingtool te boeken. Zij sturen een aanvraag via Hobbysalon, waarna jij zelf contact opneemt en de inschrijving verder regelt. Heb je al een eigen boekingssysteem? Met het Tracked- of Premium-pakket kun je daar rechtstreeks naar linken. Een Hobbysalon-bookingtool kan later als extra optie worden toegevoegd.",
  },
  {
    question: "Kan ik een externe boekingslink tonen?",
    answer:
      "Ja, binnen het Tracked- of Premium-pakket. Bij Essential werken we met de aanvraagflow via Hobbysalon.",
  },
  {
    question: "Controleren jullie aanbieders?",
    answer:
      "Ja, we houden Hobbysalon gericht op echte creatieve workshops.",
  },
];

export default function VoorWorkshopgeversPage() {
  return (
    <>
      <MarketingHero
        headline="Plaats je creatieve workshops op Hobbysalon — zonder commissie per deelnemer"
        subheadline="Bereik hobbyisten die actief zoeken naar creatieve workshops. Jij behoudt je volledige workshopomzet; Hobbysalon zorgt voor zichtbaarheid, vindbaarheid en aanvragen via het platform."
        primaryCta={{ label: "Plaats je workshop", href: "/register/creator" }}
        secondaryCta={{ label: "Bekijk pakketten", href: "#pakketten" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <PlanCardsSection
        title="Kies je pakket"
        description="Vaste jaarprijs — geen commissie per deelnemer."
        plans={PLANS}
        addons={ADDONS}
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
        description="Registreer je als creator, kies je pakket en bereik hobbyisten die actief zoeken naar creatieve workshops."
        href="/register/creator"
        ctaText="Plaats je workshop"
        secondaryHref="#pakketten"
        secondaryText="Bekijk pakketten"
      />
    </>
  );
}
