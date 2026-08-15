/**
 * Copy for /partners — aanbieder hub landing.
 */
export const PARTNERS_PAGE = {
  metaTitle:
    "Zakelijk samenwerken met Hobbysalon | Makers, workshops, winkels en events",
  metaDescription:
    "Bereik de creatieve community van Hobbysalon. Vijf routes voor contentmakers, makers, workshopgevers, organisatoren en hobbymaterialenwinkels.",
  headline: "Bereik de creatieve community van Hobbysalon",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "Vijf soorten aanbieders, één platform. Kies de route die bij jou past.",
  intro:
    "Wat je hier plaatst, staat niet op zichzelf: een tutorial verwijst naar de materialen, de materialen naar de winkel, de winkel naar de workshop waar je de techniek leert.",
  primaryCta: { label: "Ontdek de routes", href: "#routes" },
  secondaryCta: { label: "Bekijk alle prijzen", href: "/prijzen" },
  routesTitle: "Wat wil je aanbieden?",
  routes: [
    {
      id: "content",
      role: "Contentmaker",
      priceLabel: "Gratis publiceren",
      description:
        "Deel tutorials, patronen, projecten en reviews. Hobbysalon herkent de materialen in je content en koppelt ze aan producten, zodat lezers meteen verder kunnen.",
      features: [
        "Publiceren is gratis",
        "Eigen makersprofiel",
        "Materialenlijsten gekoppeld",
        "Verdienen via affiliate en digitale patronen: binnenkort",
      ],
      href: "/voor-contentmakers",
      ctaLabel: "Bekijk de mogelijkheden",
    },
    {
      id: "maker",
      role: "Maker",
      priceLabel: "3 gratis advertenties, daarna credits",
      description:
        "Start met drie gratis advertenties voor je handmade werk of destash. Wil je meer aanbieden, dan breid je uit tot 10 extra advertenties met credits.",
      features: [
        "Eerste 3 advertenties gratis",
        "Tot 10 extra met credits",
        "Geen commissie op je verkoop",
        "Boosts met extra credits",
      ],
      href: "/voor-makers",
      ctaLabel: "Bekijk de mogelijkheden",
    },
    {
      id: "workshop",
      role: "Workshopgever",
      priceLabel: "3 gratis tot 1 oktober, daarna €9,99 / 2 maanden",
      description:
        "Presenteer je workshop met foto's, sessiedata, locatie, prijs en materialen. Deelnemers schrijven zich rechtstreeks bij jou in.",
      features: [
        "Tot 1 oktober: max. 3 workshops gratis (blijven gratis)",
        "Extra vermeldingen: €9,99 voor 2 maanden",
        "Geen commissie per deelnemer",
        "Tot drie sessiedata in één vermelding",
      ],
      href: "/voor-workshopgevers",
      ctaLabel: "Bekijk de mogelijkheden",
    },
    {
      id: "organizer",
      role: "Organisator",
      priceLabel: "Gratis in de kalender, uitgebreid vanaf €50",
      description:
        "Zet je hobbybeurs of makers market gratis in de evenementenkalender. Wil je meer dan datum en locatie tonen, dan kies je een eventpagina.",
      features: [
        "Gratis kalendervermelding voor beide eventtypes",
        "Eventpagina hobbybeurs vanaf €50 per maand",
        "Eventpagina makers market vanaf €69 per event",
        "Promotie op maat tijdens de pilot",
      ],
      href: "/voor-organisatoren",
      ctaLabel: "Bekijk de mogelijkheden",
    },
    {
      id: "supplier",
      role: "Hobbymaterialenwinkel",
      priceLabel: "€0 per maand, 10% commissie",
      description:
        "Verkoop professionele hobbymaterialen via Hobbysalon. Geen vast maandbedrag in de basisformule.",
      features: [
        "Productcatalogus met varianten en voorraad",
        "Checkout en orderbeheer",
        "Verzending via je eigen instellingen",
        "Premium zichtbaarheid en analyses: binnenkort",
      ],
      href: "/voor-winkels",
      ctaLabel: "Bekijk de mogelijkheden",
    },
  ],
  whyTitle: "Waarom Hobbysalon",
  why: [
    {
      title: "Een publiek dat hier gericht komt",
      body: "Geen algemene marktplaats waar handwerk tussen telefoonhoesjes en tuinmeubelen verdwijnt. Iedereen die hier rondkijkt, doet dat voor hobby, craft of handwerk.",
    },
    {
      title: "Alles is met elkaar verbonden",
      body: "Content, workshops, materialen en evenementen verwijzen naar elkaar. Wie een patroon leest, vindt de wol; wie de wol koopt, ziet de workshop; wie de workshop boekt, ontdekt op welke beurs die maker straks staat.",
    },
    {
      title: "Een naam die de doelgroep al kent",
      body: "Hobbysalon vulde jarenlang de Nekkerhal, Antwerp Expo en Xpo Kortrijk. Die community, en dat vertrouwen, reis je niet vanaf nul op.",
    },
  ],
  faqTitle: "Veelgestelde vragen",
  faq: [
    {
      question: "Voor wie is Hobbysalon?",
      answer:
        "Voor iedereen die iets creatiefs aanbiedt: contentmakers, hobbyisten die zelfgemaakt werk of overschot verkopen, workshopgevers, organisatoren van beurzen en makers markets, en professionele hobbymaterialenwinkels. Aan de andere kant staat een community van creatieve hobbyisten in België en Nederland.",
    },
    {
      question: "Kan ik meerdere rollen combineren?",
      answer:
        "Ja, vanuit hetzelfde profiel. Een workshopgever die ook tutorials schrijft en materialen verkoopt, hoeft geen drie accounts aan te maken. De formule geldt per soort activiteit.",
    },
    {
      question: "Werkt Hobbysalon met commissie?",
      answer:
        "Alleen bij hobbymaterialenwinkels: 10% op wat er via het platform verkocht wordt. Makers betalen geen commissie op hun verkoop, workshopgevers geen commissie per deelnemer.",
    },
    {
      question: "Wat kan ik gratis doen?",
      answer:
        "Content publiceren, je eerste drie makersadvertenties plaatsen en je evenement in de kalender zetten. Een profiel aanmaken kost niets.",
    },
    {
      question: "Waar vind ik alle prijzen bij elkaar?",
      answer:
        "Op de prijzenpagina staan de vijf routes naast elkaar in één vergelijking.",
    },
  ],
  closingTitle: "Klaar om jouw aanbod zichtbaar te maken?",
  closingDescription:
    "Kies je route. Op elke detailpagina lees je de volledige uitleg en de eerste stap.",
} as const;
