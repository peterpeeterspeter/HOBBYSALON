import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  PainPointsSection,
  SolutionSection,
  HowItWorksSection,
  WhyHobbysalonSection,
  FaqSection,
  FinalCtaSection,
  SingleOfferSection,
} from "@/components/marketing";
import { WORKSHOP_FAQ, WORKSHOP_OFFER, WORKSHOP_COMMISSION_NOTE } from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Workshops aanbieden via Hobbysalon | €9,99 voor 3 maanden",
  description:
    "Plaats je workshop drie maanden op Hobbysalon voor €9,99. Geen abonnement en geen commissie per deelnemer.",
  path: "/voor-workshopgevers",
});

const PAIN_POINTS = [
  "Je workshops vullen via social media kost veel tijd.",
  "Je bereikt vaak alleen je bestaande volgers.",
  "Losse posts verdwijnen snel.",
  "Administratie en aanvragen komen versnipperd binnen.",
];

const SOLUTION_ITEMS = [
  "Workshopvermelding op Hobbysalon",
  "Drie maanden zichtbaar per workshop",
  "Geen commissie per deelnemer",
  "Jij regelt contact, inschrijving en betaling",
  "Materialenlijst en docentprofiel",
];

const WHY_ITEMS = [
  "Bereik mensen die actief zoeken naar creatieve workshops",
  "Nicheplatform, geen algemene advertentiekalender",
  "Vertrouwd merk in hobby, craft en handwerk",
  "Eenvoudige prijs — geen jaarabonnement",
];

export default function VoorWorkshopgeversPage() {
  return (
    <>
      <MarketingHero
        headline="Plaats je workshop drie maanden voor €9,99"
        subheadline={`Bereik mensen die actief zoeken naar creatieve workshops. ${WORKSHOP_COMMISSION_NOTE} Jij behoudt je omzet en regelt inschrijving zelf.`}
        primaryCta={{ label: "Plaats je workshop", href: "/register/creator" }}
        secondaryCta={{ label: "Alle prijzen", href: "/prijzen" }}
      />
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <SingleOfferSection
        id="formule"
        title="Workshopformule"
        description="Eén eenvoudige vermelding — geen Essential, Tracked of Premium."
        offer={WORKSHOP_OFFER}
      />
      <HowItWorksSection
        steps={[
          "Maak je docentprofiel aan",
          "Voeg je workshop toe",
          "Ontvang aanvragen en regel inschrijving zelf",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={WORKSHOP_FAQ} />
      <FinalCtaSection
        title="Start met je eerste workshop"
        description="Registreer je en plaats je workshop op Hobbysalon."
        href="/register/creator"
        ctaText="Plaats je workshop"
        secondaryHref="/prijzen"
        secondaryText="Bekijk alle formules"
      />
    </>
  );
}
