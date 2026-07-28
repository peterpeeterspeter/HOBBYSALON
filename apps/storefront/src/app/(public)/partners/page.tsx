import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  AudienceCardGrid,
  TrustBullets,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";
import {
  SUPPLIER_COMMISSION_NOTE,
  WORKSHOP_COMMISSION_NOTE,
} from "@/lib/marketing/commercial-offers";

export const metadata = buildPageMetadata({
  title: "Zakelijk samenwerken met Hobbysalon | Workshops, makers, winkels en events",
  description:
    "Bereik de creatieve community via Hobbysalon. Voor workshopgevers, makers, hobbymaterialenwinkels en organisatoren.",
  path: "/partners",
});

const AUDIENCE_CARDS = [
  {
    title: "Voor iedereen die graag iets moois maakt",
    text: "Ontdek workshops, materialen, makers en events op één plek.",
    ctaLabel: "Ontdek Hobbysalon",
    href: "/voor-hobbyisten",
  },
  {
    title: "Toon je handmade creaties",
    text: "Toon je werk en ontvang geïnteresseerde kopers via Hobbysalon.",
    ctaLabel: "Voor makers",
    href: "/voor-makers",
  },
  {
    title: "Vul je creatieve workshops",
    text: `Plaats je workshops op Hobbysalon. ${WORKSHOP_COMMISSION_NOTE}`,
    ctaLabel: "Voor workshopgevers",
    href: "/voor-workshopgevers",
  },
  {
    title: "Verkoop materialen aan hobbyisten",
    text: `Bied materialen aan via Hobbysalon checkout. ${SUPPLIER_COMMISSION_NOTE}`,
    ctaLabel: "Voor winkels",
    href: "/voor-winkels",
  },
  {
    title: "Promoot je creatief event",
    text: "Maak je hobbybeurs, makers market of workshopdag zichtbaar in de agenda.",
    ctaLabel: "Voor organisatoren",
    href: "/voor-organisatoren",
  },
];

const FAQ_ITEMS = [
  {
    question: "Voor wie is Hobbysalon?",
    answer:
      "Hobbysalon is een nicheplatform voor hobby, craft en handwerk. We werken samen met mensen die graag iets maken, workshopgevers, handmade makers, hobbymaterialenwinkels en organisatoren van creatieve events.",
  },
  {
    question: "Kan ik meerdere rollen hebben?",
    answer:
      "Ja. Veel partners combineren rollen, bijvoorbeeld workshopgever én maker, of winkel én organisator. Kies de route die het best past bij wat je wilt bereiken.",
  },
  {
    question: "Kan ik eerst gratis starten?",
    answer:
      "Ja. Je registreert je, zet je profiel op en kunt starten met creaties, workshops of events. Voor workshops gelden jaarplannen, voor winkels commissie op verkoop, voor organisatoren eventpakketten. Makers tonen hun creaties en ontvangen aanvragen via Hobbysalon.",
  },
  {
    question: "Werkt Hobbysalon met commissie?",
    answer:
      "Dat hangt af van je segment. Workshopgevers betalen een vaste jaarprijs zonder commissie per deelnemer. Makers ontvangen geïnteresseerde kopers via aanvragen en regelen de verkoop verder zelf. Winkels betalen 10% commissie op materialen via checkout. Organisatoren betalen per eventpakket voor zichtbaarheid.",
  },
];

export default function PartnersPage() {
  return (
    <>
      <MarketingHero
        headline="Bereik de creatieve community van Hobbysalon"
        subheadline="Promoot je workshops, toon je creaties, verkoop hobbymaterialen of breng je event onder de aandacht bij mensen die actief zoeken naar inspiratie."
        primaryCta={{ label: "Ontdek de mogelijkheden", href: "#mogelijkheden" }}
      />
      <AudienceCardGrid cards={AUDIENCE_CARDS} />
      <TrustBullets
        items={[
          "Nicheplatform voor hobby, craft en handwerk",
          "Bereik via content, SEO en community",
          "Gebouwd vanuit het vertrouwde Hobbysalon-merk",
        ]}
      />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Klaar om samen te werken?"
        description="Kies de route die bij jou past en bereik mensen die actief zoeken naar workshops, creaties, materialen en events."
        href="#mogelijkheden"
        ctaText="Ontdek de mogelijkheden"
      />
    </>
  );
}
