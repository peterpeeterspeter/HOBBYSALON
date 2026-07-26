import { buildPageMetadata } from "@/lib/seo";
import {
  MarketingHero,
  AudienceCardGrid,
  TrustBullets,
  FaqSection,
  FinalCtaSection,
} from "@/components/marketing";

export const metadata = buildPageMetadata({
  title: "Zakelijk samenwerken met Hobbysalon | Workshops, makers, winkels en events",
  description:
    "Bereik creatieve hobbyisten via Hobbysalon. Voor workshopgevers, makers, hobbymaterialen winkels en organisatoren.",
  path: "/partners",
});

const AUDIENCE_CARDS = [
  {
    title: "Vul je creatieve workshops",
    text: "Plaats je workshops op Hobbysalon met een vaste jaarprijs. Geen commissie per deelnemer.",
    ctaLabel: "Voor workshopgevers",
    href: "/voor-workshopgevers",
  },
  {
    title: "Verkoop je handmade producten",
    text: "Plaats je creaties op de Hobbysalon marketplace en verkoop via onze checkout.",
    ctaLabel: "Voor makers",
    href: "/voor-makers",
  },
  {
    title: "Verkoop materialen aan hobbyisten",
    text: "Bied garen, papier, stoffen, kits en andere materialen aan via de Hobbysalon shop.",
    ctaLabel: "Voor winkels",
    href: "/voor-winkels",
  },
  {
    title: "Promoot je creatief event",
    text: "Maak je hobbybeurs, makers market of workshopdag zichtbaar bij bezoekers en standhouders.",
    ctaLabel: "Voor organisatoren",
    href: "/voor-organisatoren",
  },
];

const FAQ_ITEMS = [
  {
    question: "Voor wie is Hobbysalon?",
    answer:
      "Hobbysalon is een nicheplatform voor hobby, craft en handwerk. We werken samen met workshopgevers, handmade makers, hobbymaterialen winkels en organisatoren van creatieve events.",
  },
  {
    question: "Kan ik meerdere rollen hebben?",
    answer:
      "Ja. Veel partners combineren rollen — bijvoorbeeld workshopgever én maker, of winkel én organisator. Kies de route die het best past bij wat je wilt bereiken.",
  },
  {
    question: "Kan ik eerst gratis starten?",
    answer:
      "Ja. Je registreert je, zet je profiel op en plaatst je eerste creaties, workshops of events gratis. Voor workshops geldt op termijn een vaste jaarprijs, voor winkels commissie op verkoop en voor organisatoren eventpakketten — makers plaatsen hun handmade producten gratis, zonder commissie.",
  },
  {
    question: "Werkt Hobbysalon met commissie?",
    answer:
      "Dat hangt af van je segment. Workshopgevers betalen een vaste jaarprijs zonder commissie per deelnemer. Makers betalen geen commissie op handmade verkoop — Hobbysalon verwerkt die betaling niet, dus koper en maker regelen dat rechtstreeks. Winkels betalen 10% commissie op materialen. Organisatoren betalen per eventpakket voor zichtbaarheid en aanvragen.",
  },
];

export default function PartnersPage() {
  return (
    <>
      <MarketingHero
        headline="Bereik de creatieve community van Hobbysalon"
        subheadline="Promoot je workshops, verkoop hobbymaterialen, toon je handmade producten of breng je creatieve event onder de aandacht bij hobbyisten die actief zoeken naar inspiratie."
        primaryCta={{ label: "Ontdek de mogelijkheden", href: "#mogelijkheden" }}
      />
      <AudienceCardGrid cards={AUDIENCE_CARDS} />
      <TrustBullets
        items={[
          "Nicheplatform voor hobby, craft en handwerk",
          "Bereik via content, nieuwsbrief, SEO en community",
          "Gebouwd vanuit het vertrouwde Hobbysalon-merk",
        ]}
      />
      <FaqSection items={FAQ_ITEMS} />
      <FinalCtaSection
        title="Klaar om samen te werken?"
        description="Kies de route die bij jou past en bereik hobbyisten die actief op zoek zijn naar workshops, producten, materialen en events."
        href="#mogelijkheden"
        ctaText="Ontdek de mogelijkheden"
      />
    </>
  );
}
