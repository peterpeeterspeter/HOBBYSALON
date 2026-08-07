import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import {
  MarketingHero,
  PainPointsSection,
  SolutionSection,
  SingleOfferSection,
  HowItWorksSection,
  WhyHobbysalonSection,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";
import {
  HOBBYBEURZEN_OFFER,
  MAKERS_MARKET_OFFER,
  ORGANIZER_FAQ,
} from "@/lib/pricing/public-pricing";

export const metadata = buildPageMetadata({
  title: "Creatief event promoten via Hobbysalon | Hobbybeurzen en makers markets",
  description:
    "Promoot je hobbybeurs of makers market in de Hobbysalon-agenda. Pilotformules: vanaf €50 per maand of vanaf €69 per event.",
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
  "Deelnemende standhouders en makers tonen",
  "Zichtbaarheid bij mensen die hobby-events zoeken",
];

const WHY_ITEMS = [
  "Bezoekers die actief zoeken naar creatieve events",
  "Nicheplatform, geen algemene eventkalender",
  "Vertrouwd merk in hobby en handwerk",
  "Aparte formules voor hobbybeurzen en makers markets",
];

export default function VoorOrganisatorenPage() {
  return (
    <>
      <MarketingHero
        headline="Promoot je creatieve event via Hobbysalon"
        subheadline="Hobbybeurzen en makers markets hebben elk een eigen formule. Pilotprijzen — registreren en aanbod bekijken, nog geen checkout op deze pagina."
        primaryCta={{ label: "Plaats je event", href: "/register/creator" }}
        secondaryCta={{ label: "Alle prijzen", href: "/prijzen" }}
      />
      <Section spacing="sm">
        <Container>
          <nav
            aria-label="Eventtypes"
            className="flex flex-wrap gap-4 border-b border-[var(--border)] pb-4 text-base font-semibold"
          >
            <Link href="#hobbybeurzen" className="min-h-12 text-[var(--accent)] hover:underline">
              Hobbybeurzen
            </Link>
            <Link href="#makers-markets" className="min-h-12 text-[var(--accent)] hover:underline">
              Makers markets
            </Link>
          </nav>
        </Container>
      </Section>
      <PainPointsSection items={PAIN_POINTS} />
      <SolutionSection items={SOLUTION_ITEMS} />
      <SingleOfferSection
        id="hobbybeurzen"
        title="Hobbybeurzen"
        description="Grotere periodieke events met programma, standhouders en workshops."
        offer={HOBBYBEURZEN_OFFER}
      />
      <SingleOfferSection
        id="makers-markets"
        title="Makers markets"
        description="Compactere events met deelnemende makers en demonstraties."
        offer={MAKERS_MARKET_OFFER}
      />
      <HowItWorksSection
        steps={[
          "Registreer je als organisator",
          "Maak je eventpagina",
          "Ontvang aanvragen via Hobbysalon",
        ]}
      />
      <WhyHobbysalonSection items={WHY_ITEMS} />
      <FaqSection items={ORGANIZER_FAQ} />
      <FinalCtaSection
        title="Plaats je event op Hobbysalon"
        description="Registreer je en maak je event zichtbaar in de creatieve community."
        href="/register/creator"
        ctaText="Plaats je event"
        secondaryHref="/prijzen"
        secondaryText="Bekijk alle formules"
      />
    </>
  );
}
