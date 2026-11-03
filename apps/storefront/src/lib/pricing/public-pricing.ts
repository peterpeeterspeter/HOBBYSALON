/**
 * PUBLIC PRESENTATION ONLY — not billing or access-control source.
 * Commercial enforcement uses seed-commercial-plans.sql, commercial-enforcement.ts
 * and COMMERCIAL_GATING_ENABLED. Marketing copy may diverge until launch migration.
 *
 * Copy source: approved marketing brief. Do not paraphrase on pages — render these strings.
 */

export type PricingStatus = "confirmed" | "pilot" | "pending";

export type PublicPricingOffer = {
  id: string;
  audience: string;
  title: string;
  priceLabel: string;
  periodLabel?: string;
  status: PricingStatus;
  features: string[];
  limitations?: string[];
  href: string;
  ctaLabel: string;
  vatNote?: string;
  finePrint?: string;
  description?: string;
};

export type PricingRouteCard = {
  id: string;
  title: string;
  description: string;
  features: string[];
  href: string;
  ctaLabel: string;
  /** Optional senior-friendly clarification under the feature list */
  note?: string;
  /** Who this route is for, shown above the card title. */
  role: string;
  /** The price in a few characters, shown large. */
  price: string;
  priceNote: string;
  /** Direct sign up for this route. */
  start: { label: string; href: string };
};

export type PricingComparisonRow = {
  audience: string;
  now: string;
  expansion: string;
  benefit: string;
};

export type PricingHowtoBlock = {
  title: string;
  text: string;
};

export type PricingFaqItem = {
  question: string;
  answer: string;
};

export type DetailPageCopy = {
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subheadline: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  sections: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
    listIntro?: string;
  }>;
};

export const PRICING_STATUS_LABEL: Record<PricingStatus, string | null> = {
  confirmed: null,
  pilot: "Pilotprijs",
  pending: "Binnenkort",
};

export const WORKSHOP_COMMISSION_NOTE =
  "Geen abonnement en geen commissie per deelnemer.";

/** Shared shop (hobbymaterialenwinkel) pricing — use verbatim on marketing surfaces. */
export const SHOP_PRICING_BODY =
  "€0 vaste kosten. 10% commissie op de totale verkoopprijs, inclusief btw en verzendkosten. Betaalkosten van de betaalprovider zijn voor de winkel en worden per bestelling afgetrokken van je uitbetaling. Uitbetaling gebeurt dagelijks. Bij een retour krijg je de commissie op het terugbetaalde bedrag terug.";

export const SHOP_PRICING_EXAMPLE =
  "Voorbeeld: product €40 + verzending €5 = €45 → commissie €4,50 (excl. btw).";

/** No hardcoded Stripe/provider fee amounts in this repo — refer generically. */
export const SHOP_PAYMENT_PROVIDER_NOTE =
  "De betaalkosten volgen de tarieven van onze betaalprovider.";

export const SUPPLIER_COMMISSION_NOTE = SHOP_PRICING_BODY;

export const P2P_COMMISSION_NOTE =
  "Geen commissie op je verkoop. Je regelt betaling en verzending rechtstreeks met de koper.";

/** Workshop/event listing prices on /prijzen are excl. btw. */
export const PRIJZEN_LISTING_VAT_NOTE =
  "Prijzen voor workshopvermeldingen (€9,99) en eventpagina's (€50, €69) zijn excl. btw.";

/* -------------------------------------------------------------------------- */
/* /prijzen — page chrome                                                     */
/* -------------------------------------------------------------------------- */

export const PRIJZEN_PAGE = {
  metaTitle: "Prijzen en mogelijkheden voor aanbieders | Hobbysalon",
  metaDescription:
    "Vergelijk de formules voor contentmakers, makers, workshopgevers, organisatoren en hobbymaterialenwinkels. Begin gratis of betaal alleen voor wat je publiceert.",
  heroLabel: "Prijzen en mogelijkheden",
  heroHeadline: "Gratis beginnen. Betalen voor wat je extra wil.",
  heroSubheadline:
    "Een profiel, content en je eerste advertenties of workshops kosten niets. Kies wat je wil aanbieden en zie meteen wat het kost.",
  heroChipsLabel: "Wat wil je doen?",
  routesTitle: "Prijzen per route",
  comparisonTitle: "Basis of extra zichtbaarheid?",
  comparisonIntro:
    "Je kunt laagdrempelig starten. Uitbreidingen zijn optioneel en lonen pas wanneer je meer bereik of inzicht nodig hebt.",
  comparisonFootnote:
    'Uitbreiden betekent niet automatisch een abonnement: afhankelijk van je route werk je met tegoed, een eventpagina, een promotiepakket of een afspraak op maat. Bij "binnenkort" is de functie gepland, maar nog niet beschikbaar.',
  listingVatNote: PRIJZEN_LISTING_VAT_NOTE,
  howtoTitle: "Hoe werkt de prijsopbouw?",
  faqTitle: "Veelgestelde vragen",
  closingTitle: "Nog niet zeker welke route bij je past?",
  closingDescription:
    "Op elke pagina vind je de volledige uitleg, voorbeelden en antwoorden op de meest gestelde vragen.",
  closingLinks: [
    { label: "Content delen", href: "/voor-contentmakers" },
    { label: "Verkopen als maker", href: "/voor-makers" },
    { label: "Workshop publiceren", href: "/voor-workshopgevers" },
    { label: "Event aankondigen", href: "/voor-organisatoren" },
    { label: "Materialen verkopen", href: "/voor-winkels" },
  ] as const,
};

export const PRICING_ROUTE_CARDS: PricingRouteCard[] = [
  {
    id: "content",
    role: "Contentmaker",
    title: "Tutorials en patronen delen",
    price: "Gratis",
    priceNote: "en dat blijft zo",
    start: { label: "Word contentmaker", href: "/register/creator?focus=maker" },
    description:
      "Deel tutorials, patronen, projecten en reviews. Hobbysalon herkent de materialen in je content en koppelt ze aan producten, zodat lezers meteen verder kunnen.",
    features: [
      "Publiceren is gratis",
      "Eigen makersprofiel",
      "Materialenlijsten gekoppeld",
      "Verdienen via affiliate en digitale patronen: binnenkort",
    ],
    href: "/voor-contentmakers",
    ctaLabel: "Meer uitleg",
  },
  {
    id: "maker",
    role: "Maker",
    title: "Zelfgemaakt werk en overschot verkopen",
    price: "3 gratis",
    priceNote: "advertenties, daarna per plaatsing met tegoed",
    start: { label: "Maak je makersprofiel", href: "/register/creator?focus=maker" },
    description:
      "Start met drie gratis advertenties voor je zelfgemaakte werk of overschot. Nodig een vriend uit: jullie krijgen allebei 3 extra gratis advertenties. Wil je meer aanbieden, dan breid je uit tot 10 extra advertenties met tegoed.",
    features: [
      "Eerste 3 advertenties gratis",
      "+3 gratis per uitgenodigde vriend, tot 15 extra",
      "Tot 10 extra met tegoed",
      "Geen commissie op je verkoop",
      "Uitlichten met extra tegoed",
    ],
    href: "/voor-makers",
    ctaLabel: "Meer uitleg",
  },
  {
    id: "workshop",
    role: "Workshopgever",
    title: "Workshops aanbieden",
    price: "3 gratis",
    priceNote: "workshops tot 1 december, daarna €9,99 per vermelding (excl. btw)",
    start: { label: "Plaats je workshop", href: "/register/creator?focus=workshopgever" },
    description:
      "Presenteer je workshop met foto's, sessiedata, locatie, prijs en materialen. Deelnemers schrijven zich rechtstreeks bij jou in.",
    features: [
      "Tot 1 december: max. 3 workshops gratis (blijven gratis)",
      "Daarna €9,99 per extra vermelding, 2 maanden zichtbaar (excl. btw)",
      "Tot drie sessiedata in één vermelding",
      "Geen commissie per deelnemer",
    ],
    href: "/voor-workshopgevers",
    ctaLabel: "Meer uitleg",
  },
  {
    id: "organizer",
    role: "Organisator",
    title: "Een hobbybeurs of makersmarkt aankondigen",
    price: "Gratis",
    priceNote: "in de kalender, eventpagina vanaf €50 (excl. btw)",
    start: { label: "Zet je evenement in de kalender", href: "/register/creator?focus=organizer" },
    description:
      "Zet je hobbybeurs of makers market gratis in de evenementenkalender. Wil je meer dan datum en locatie tonen, dan kies je een eventpagina.",
    features: [
      "Gratis kalendervermelding voor beide eventtypes",
      "Eventpagina hobbybeurs vanaf €50 per maand (excl. btw)",
      "Eventpagina makers market vanaf €69 per event (excl. btw)",
      "Promotie op maat tijdens de pilot",
    ],
    href: "/voor-organisatoren",
    ctaLabel: "Meer uitleg",
  },
  {
    id: "supplier",
    role: "Winkel",
    title: "Hobbymaterialen verkopen",
    price: "€0",
    priceNote: "vaste kosten, 10% commissie alleen bij verkoop",
    start: { label: "Meld je winkel aan", href: "/register/merchant" },
    description: SHOP_PRICING_BODY,
    features: [
      SHOP_PRICING_EXAMPLE,
      SHOP_PAYMENT_PROVIDER_NOTE,
      "Productcatalogus met varianten en voorraad",
      "Afrekenen, bestellingen beheren en dagelijkse uitbetaling",
      "Premium zichtbaarheid en analyses: binnenkort",
    ],
    href: "/voor-winkels",
    ctaLabel: "Meer uitleg",
  },
];

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    audience: "Contentmaker",
    now: "Gratis tutorials, patronen, reviews en video's publiceren",
    expansion: "Digitale patronen verkopen en affiliate-inkomsten, binnenkort",
    benefit: "Je verdient mee aan de materialen en patronen bij je content",
  },
  {
    audience: "Maker",
    now: "Gratis profiel, je eerste 3 advertenties gratis en 3 extra per uitgenodigde vriend",
    expansion: "Tot 10 extra advertenties en uitlichten met tegoed",
    benefit:
      "Meer werk tegelijk aanbieden en geselecteerde advertenties tijdelijk hoger in de overzichten",
  },
  {
    audience: "Workshopgever",
    now: "Lanceraanbod: 3 workshops gratis tot 1 december (blijven gratis)",
    expansion:
      "Extra vermeldingen €9,99 / 2 maanden (excl. btw); promotie volgt binnenkort",
    benefit: "Prominentere plaatsing en meetbaar resultaat",
  },
  {
    audience: "Organisator",
    now: "Gratis vermelding in de evenementenkalender",
    expansion:
      "Eventpagina vanaf €50 per maand (hobbybeurs) of €69 per event (makers market), excl. btw",
    benefit:
      "Een volledige pagina met programma, standhouders en updates in plaats van alleen datum en locatie",
  },
  {
    audience: "Hobbymaterialenwinkel",
    now: "€0 vaste kosten, 10% commissie op de totale verkoopprijs (incl. btw en verzending)",
    expansion: "Premium zichtbaarheid en analyses, binnenkort",
    benefit:
      "Betaalkosten voor de winkel (tarieven van onze betaalprovider); dagelijkse uitbetaling",
  },
];

export const PRICING_HOWTO_BLOCKS: PricingHowtoBlock[] = [
  {
    title: "Laagdrempelig beginnen.",
    text: "Een profiel aanmaken, content publiceren, je eerste drie advertenties plaatsen en je evenement in de kalender zetten is gratis. Verder betaal je per plaatsing, met tegoed, of alleen wanneer er echt iets verkocht wordt.",
  },
  {
    title: "Uitbreiden wanneer het nuttig wordt.",
    text: "Extra zichtbaarheid en analyses zijn optioneel. Gebruik je ze niet, dan blijft je basisaanbod gewoon staan.",
  },
  {
    title: "Rollen combineren.",
    text: "Een maker kan ook tutorials delen of workshops geven. De formule geldt per soort activiteit, niet per persoon.",
  },
];

export const PRICING_PAGE_FAQ: PricingFaqItem[] = [
  {
    question: "Moet ik een abonnement nemen?",
    answer:
      "Nee. Contentmakers publiceren gratis, makers werken met tegoed, organisatoren staan gratis in de kalender, workshopgevers starten met een lanceraanbod (3 gratis tot 1 december) en betalen daarna per extra vermelding, en winkels betalen in de basis alleen commissie bij verkoop.",
  },
  {
    question: "Wat kan ik gratis doen op Hobbysalon?",
    answer:
      "Een profiel aanmaken, tutorials en patronen publiceren, je eerste drie makersadvertenties plaatsen, en je hobbybeurs of makers market in de evenementenkalender zetten. Daar zijn geen kosten aan verbonden.",
  },
  {
    question: "Wat is tegoed?",
    answer:
      "Tegoed gebruik je voor concrete acties: een advertentie publiceren, verlengen of extra promoten. De pakketten volgen binnenkort.",
  },
  {
    question: "Kan ik meerdere soorten aanbod publiceren?",
    answer:
      "Ja, vanuit hetzelfde profiel. Je kunt bijvoorbeeld contentmaker én workshopgever zijn.",
  },
  {
    question: 'Wat betekent "binnenkort"?',
    answer:
      "De functie is gepland, maar heeft nog geen tarief of vaste datum. Je hoeft er niet op te wachten om met de basisformule te starten.",
  },
];

/* -------------------------------------------------------------------------- */
/* Offer cards (detail / SingleOfferSection)                                  */
/* -------------------------------------------------------------------------- */

export const CONTENT_CREATOR_OFFER: PublicPricingOffer = {
  id: "content",
  audience: "Contentmakers",
  title: "Gratis publiceren",
  priceLabel: "Gratis",
  periodLabel: "tutorials, patronen, projecten en reviews",
  status: "confirmed",
  description:
    "Deel tutorials, patronen, projecten en reviews. Hobbysalon herkent de materialen in je content en koppelt ze aan producten, zodat lezers meteen verder kunnen.",
  features: [
    "Publiceren is gratis",
    "Eigen makersprofiel",
    "Materialenlijsten gekoppeld",
    "Verdienen via affiliate en digitale patronen: binnenkort",
  ],
  href: "/register/creator?focus=maker",
  ctaLabel: "Word contentmaker",
};

export const P2P_MAKER_OFFER: PublicPricingOffer = {
  id: "handmade",
  audience: "Makers",
  title: "Zelfgemaakt en overschot",
  priceLabel: "3 gratis",
  periodLabel: "daarna tot 10 extra met tegoed · geen commissie",
  status: "confirmed",
  description:
    "Start met drie gratis advertenties voor je zelfgemaakte werk of overschot. Nodig een vriend uit: jullie krijgen allebei 3 extra gratis advertenties. Wil je meer aanbieden, dan breid je uit tot 10 extra advertenties met tegoed.",
  features: [
    "Eerste 3 advertenties gratis",
    "Tot 10 extra met tegoed",
    "Geen commissie op je verkoop",
    "Uitlichten met extra tegoed",
  ],
  href: "/register/creator?focus=maker",
  ctaLabel: "Maak je makersprofiel",
  finePrint:
    "De tegoedpakketten en tarieven volgen binnenkort.",
};

export const WORKSHOP_OFFER: PublicPricingOffer = {
  id: "workshop",
  audience: "Workshopgevers",
  title: "Workshopvermelding",
  priceLabel: "3 gratis",
  periodLabel: "tot 1 december · daarna €9,99 / 2 maanden",
  status: "confirmed",
  description:
    "Presenteer je workshop met foto's, sessiedata, locatie, prijs en materialen. Deelnemers schrijven zich rechtstreeks bij jou in.",
  features: [
    "Tot 1 december: max. 3 workshops gratis (blijven gratis)",
    "Extra vermeldingen: €9,99 voor 2 maanden zichtbaar",
    "Tot drie sessiedata in één vermelding",
    "Geen commissie per deelnemer",
  ],
  href: "/register/creator?focus=workshopgever",
  ctaLabel: "Plaats je workshop",
  finePrint: "Lanceraanbod tot 1 december 2026.",
};

export const HOBBYBEURZEN_OFFER: PublicPricingOffer = {
  id: "hobbybeurzen",
  audience: "Organisatoren",
  title: "Eventpagina hobbybeurs",
  priceLabel: "vanaf €50",
  periodLabel: "per maand · Pilotprijs",
  status: "pilot",
  description:
    "Gratis in de evenementenkalender. Wil je meer dan datum en locatie tonen, dan kies je een eventpagina.",
  features: [
    "Programma en tijdschema",
    "Deelnemende standhouders en makers",
    "Workshops en activiteiten tijdens het evenement",
    "Foto's en sfeerbeelden van vorige edities",
    "Praktische informatie: parkeren, toegangsprijs, bereikbaarheid",
    "Updates voor bezoekers in de aanloop naar de dag zelf",
  ],
  href: "/register/creator?focus=organizer",
  ctaLabel: "Bespreek een eventpagina",
  finePrint: "Pilotprijs — registreren en aanbod bekijken, nog niet online betalen.",
};

export const MAKERS_MARKET_OFFER: PublicPricingOffer = {
  id: "makers_market",
  audience: "Organisatoren",
  title: "Eventpagina makers market",
  priceLabel: "vanaf €69",
  periodLabel: "per event · Pilotprijs",
  status: "pilot",
  description:
    "Gratis in de evenementenkalender. Wil je meer dan datum en locatie tonen, dan kies je een eventpagina.",
  features: [
    "Programma en tijdschema",
    "Deelnemende standhouders en makers",
    "Workshops en activiteiten tijdens het evenement",
    "Foto's en sfeerbeelden van vorige edities",
    "Praktische informatie: parkeren, toegangsprijs, bereikbaarheid",
    "Updates voor bezoekers in de aanloop naar de dag zelf",
  ],
  href: "/register/creator?focus=organizer",
  ctaLabel: "Bespreek een eventpagina",
  finePrint: "Pilotprijs — registreren en aanbod bekijken, nog niet online betalen.",
};

export const SUPPLIER_OFFER: PublicPricingOffer = {
  id: "webshop",
  audience: "Hobbymaterialenwinkels",
  title: "Basisformule",
  priceLabel: "€0 vaste kosten",
  periodLabel: "10% commissie op de totale verkoopprijs",
  status: "confirmed",
  description: SHOP_PRICING_BODY,
  features: [
    SHOP_PRICING_EXAMPLE,
    SHOP_PAYMENT_PROVIDER_NOTE,
    "Productcatalogus met varianten en voorraad",
    "Afrekenen, bestellingen beheren en dagelijkse uitbetaling",
    "Premium zichtbaarheid en analyses: binnenkort",
  ],
  href: "/register/merchant",
  ctaLabel: "Meld je winkel aan",
  finePrint: "Geen instapkosten, geen limiet op het aantal advertenties, geen minimumduur.",
};

export const SUPPLIER_PREMIUM_NOTE: PublicPricingOffer = {
  id: "webshop_premium",
  audience: "Hobbymaterialenwinkels",
  title: "Premium zichtbaarheid",
  priceLabel: "Binnenkort",
  status: "pending",
  description:
    "Premium zichtbaarheid (uitgelichte plaatsing in categorieën en nieuwsbrief) en verkoopanalyses zijn in ontwikkeling. Tarieven en beschikbaarheid volgen.",
  features: [
    "Uitgelichte plaatsing in categorieën",
    "Nieuwsbrief",
    "Verkoopanalyses",
  ],
  href: "/register/merchant",
  ctaLabel: "Meld je winkel aan",
};

/** @deprecated Prefer PRICING_ROUTE_CARDS — kept for any remaining offer-array consumers */
export const PRICING_OVERVIEW_OFFERS: PublicPricingOffer[] = [
  CONTENT_CREATOR_OFFER,
  P2P_MAKER_OFFER,
  WORKSHOP_OFFER,
  {
    ...HOBBYBEURZEN_OFFER,
    title: "Organisator — gratis in de kalender, uitgebreid vanaf €50",
    description:
      "Zet je hobbybeurs of makers market gratis in de evenementenkalender. Wil je meer dan datum en locatie tonen, dan kies je een eventpagina.",
    href: "/voor-organisatoren",
    ctaLabel: "Bekijk de mogelijkheden",
  },
  SUPPLIER_OFFER,
];

/* -------------------------------------------------------------------------- */
/* Detail pages — verbatim brief                                              */
/* -------------------------------------------------------------------------- */

export const CONTENT_PAGE = {
  metaTitle: "Contentmakers | Gratis publiceren",
  metaDescription:
    "Deel tutorials, patronen en praktische gidsen onder je eigen makersprofiel. Gratis publiceren voor een community van ruim 40.000 hobbyisten. Materialen koppelen aan producten.",
  headline: "Deel je kennis. Bereik lezers die er echt iets mee doen.",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "Gratis tutorials en patronen voor hobbyisten die gericht zoeken naar wat jij uitlegt.",
  primaryCta: { label: "Word contentmaker", href: "/register/creator?focus=maker" },
  secondaryCta: { label: "Alle prijzen", href: "/prijzen" },
  intro:
    "Publiceer tutorials, patronen en praktische gidsen onder je eigen makersprofiel, gratis, vanaf vandaag. Je schrijft voor een community van ruim 40.000 hobbyisten die gericht op zoek zijn naar wat jij uitlegt.",
  publish: {
    title: "Wat je publiceert",
    body: "Stap-voor-stap tutorials met foto's, haakpatronen en naaipatronen, projectbeschrijvingen, materiaalreviews en technieksuggesties. Alles verschijnt onder je eigen naam en profiel, met een overzicht van je werk waar lezers je kunnen volgen.",
  },
  materials: {
    title: "Zo werkt de materiaalkoppeling",
    body: "Hobbysalon herkent de materialen die je in je tutorial gebruikt en koppelt ze aan passende producten uit de catalogus. Je lezer ziet direct waar het garen, papier of gereedschap te koop is en hoeft niet zelf op zoek. Jij beschrijft alleen je project.",
    note: "Dat scheelt je lezer het vervelendste deel van een tutorial volgen: uitzoeken wat je precies nodig hebt en waar je het vindt.",
  },
  why: {
    title: "Waarom hier publiceren",
    items: [
      {
        title: "Je content staat niet op zichzelf",
        body: "Een tutorial over amigurumi verwijst naar het garen, naar de winkel die het verkoopt en naar de workshop waar iemand de techniek onder begeleiding leert. Je lezer kan meteen verder, en jij bereikt mensen die via die andere ingangen binnenkomen.",
      },
      {
        title: "Een publiek dat leest om te maken",
        body: "De bezoekers van Hobbysalon zijn zelf hobbyist. Ze scrollen niet langs je patroon. Ze printen het uit.",
      },
      {
        title: "Geen algoritme dat je bereik bepaalt",
        body: "Wat je publiceert blijft vindbaar, ook over een jaar. Anders dan een post die na twee dagen verdwenen is.",
      },
    ],
  },
  comingSoon: {
    title: "Binnenkort: verkopen en verdienen",
    body: "De verkoop van digitale patronen en het affiliateprogramma voor contentmakers zijn in ontwikkeling. Bij een aankoop via jouw persoonlijke link ontvang je dan een vergoeding. Voorwaarden en inkomstenverdeling maken we bekend zodra de functie live gaat.",
    note: "Publiceer je nu al, dan staat je content klaar op het moment dat het zover is.",
  },
  pricing: {
    title: "Wat het kost",
    body: "Niets. Publiceren, je profiel en de materiaalkoppeling zijn gratis en blijven dat.",
  },
} as const;

export const MAKERS_PAGE = {
  metaTitle: "Zelfgemaakt werk en overschot verkopen | Makers",
  metaDescription:
    "Maak gratis een makersprofiel en plaats je eerste drie advertenties zonder te betalen. Tot 10 extra met tegoed. Geen commissie op je verkoop. Geen btw-nummer nodig bij aanmaken.",
  headline: "Verkoop je zelfgemaakte werk. Zonder commissie.",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "Gratis profiel en drie gratis advertenties. Kopers nemen rechtstreeks contact met jou op, en wat je verkoopt houd je volledig zelf.",
  primaryCta: {
    label: "Maak je gratis makersprofiel",
    href: "/register/creator?focus=maker",
  },
  heroProof: ["Geen commissie", "Geen abonnement", "Geen btw-nummer nodig"],
  steps: {
    title: "Zo werkt het",
    items: [
      {
        title: "Maak je profiel",
        body: "Een naam, een foto en een paar zinnen over wat je maakt. Een btw-nummer heb je niet nodig.",
      },
      {
        title: "Plaats je advertentie",
        body: "Foto's, een beschrijving en een vraagprijs. Voor je eigen creaties of voor materiaal dat je niet meer gebruikt.",
      },
      {
        title: "Een koper stuurt je een bericht",
        body: "Je krijgt een e-mail bij elke aanvraag. Prijs, betaling en verzending spreek je samen af, zoals op een makersmarkt.",
      },
    ],
  },
  adTypes: {
    title: "Wat kun je verkopen?",
    items: [
      {
        title: "Zelfgemaakt",
        body: "Je eigen creaties. Gehaakt, genaaid, gedraaid, geschilderd of gesoldeerd: alles wat je met de hand maakt.",
      },
      {
        title: "Overschot",
        body: "De wol die de verkeerde kleur bleek, stofrestjes, kralen of gereedschap dat je niet meer gebruikt. Voor jou overschot, voor iemand anders precies wat die zocht.",
      },
    ],
    note: "Iedereen die zelf maakt is welkom: hobbyisten en makers met een eigen zaak. Verkoop je vooral materialen uit voorraad? Dan past de route voor winkels beter.",
  },
  offer: {
    title: "Wat kost het?",
    free: {
      label: "Gratis",
      title: "Je begint zonder iets te betalen",
      items: [
        "Je profiel",
        "Je eerste 3 advertenties",
        "+3 gratis advertenties per vriend die je uitnodigt, tot 15 extra",
      ],
    },
    paid: {
      label: "Daarna",
      title: "Je betaalt per plaatsing, met tegoed",
      items: [
        "Tot 10 extra advertenties met tegoed",
        "Een advertentie verlengen of uitlichten kan ook met tegoed",
        "Geen abonnement en geen vaste kost: niets als je even niets verkoopt",
      ],
      note: "De tegoedpakketten en tarieven volgen binnenkort.",
    },
    commission: "Op je verkoop rekent Hobbysalon nooit commissie.",
    pricesLink: { label: "Bekijk alle prijzen", href: "/prijzen" },
  },
  why: {
    title: "Waarom hier en niet op een algemene marktplaats",
    items: [
      {
        title: "Een publiek dat handwerk kent",
        body: "De bezoekers van Hobbysalon zijn zelf hobbyist. Ze weten wat merinowol kost en zien aan een foto of een naad netjes is afgewerkt. Je hoeft niet uit te leggen waarom handwerk tijd kost.",
      },
      {
        title: "Je advertentie staat niet alleen",
        body: "Wie een tutorial over amigurumi leest of een haakworkshop bekijkt, kan bij jouw garen of jouw werk uitkomen.",
      },
      {
        title: "Een naam die mensen kennen",
        body: "Hobbysalon organiseerde jarenlang de hobbybeurzen in de Nekkerhal, Antwerp Expo en Xpo Kortrijk. Dezelfde mensen, nu het hele jaar door open.",
      },
    ],
  },
  faqTitle: "Veelgestelde vragen",
  faq: [
    {
      question: "Hoe krijg ik betaald?",
      answer:
        "Je spreekt de betaling rechtstreeks met je koper af, bijvoorbeeld via overschrijving of bij afhalen. Hobbysalon zit niet tussen jou en je koper en houdt niets in.",
    },
    {
      question: "Wie regelt de verzending?",
      answer:
        "Jij en je koper. Je spreekt samen af of de koper het komt afhalen of dat je het opstuurt, en wie de verzendkosten betaalt.",
    },
    {
      question: "Heb ik een btw-nummer nodig?",
      answer: "Nee. Als hobbyist heb je geen btw-nummer nodig. Heb je een eigen zaak, dan ben je ook welkom.",
    },
    {
      question: "Wat gebeurt er na mijn 3 gratis advertenties?",
      answer:
        "Je kunt tot 10 extra advertenties plaatsen met tegoed. Je betaalt per plaatsing, zonder abonnement. Of je nodigt vrienden uit: per vriend die zich registreert, krijgen jullie allebei 3 extra gratis advertenties.",
    },
    {
      question: "Hoe weet ik dat iemand interesse heeft?",
      answer: "Elke aanvraag komt binnen als e-mail. Je ziet ze ook in je dashboard.",
    },
    {
      question: "Kan ik ook materiaal verkopen dat ik niet meer gebruik?",
      answer: "Ja. Dat heet overschot: garen, stof, kralen of gereedschap uit je eigen voorraad.",
    },
  ],
  closing: {
    title: "Begin vandaag met verkopen",
    body: "Je profiel en je eerste drie advertenties zijn gratis. Je zit nergens aan vast.",
  },
} as const;

export const WORKSHOP_PAGE = {
  metaTitle: "Workshops aanbieden | 3 gratis tot 1 december",
  metaDescription:
    "Zet je workshop op de kaart bij hobbyisten die gericht zoeken. Tot 1 december 3 workshops gratis (blijven gratis). Extra vermeldingen €9,99 voor 2 maanden. Geen commissie per deelnemer.",
  headline: "Zet je workshop op de kaart",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "Hobbyisten zoeken hier gericht naar workshops. Inschrijvingen lopen rechtstreeks bij jou, zonder commissie.",
  primaryCta: {
    label: "Plaats je workshop",
    href: "/register/creator?focus=workshopgever",
  },
  secondaryCta: { label: "Alle prijzen", href: "/prijzen" },
  intro: [
    "Er zijn hobbyisten die al maanden willen leren haken, quilten of zilver smeden, en die nog niet weten dat jij hun workshop geeft. Op Hobbysalon vinden ze je, tussen een publiek dat hier komt om creatief bezig te zijn en nergens anders voor.",
    "Deelnemers schrijven zich rechtstreeks bij jou in. Geen commissie per deelnemer, geen tussenpersoon: wat je vraagt, houd je.",
  ],
  listing: {
    title: "Wat er in je vermelding staat",
    items: [
      "Foto's, beschrijving en praktische informatie",
      "Datum, locatie, prijs en voor wie de workshop bedoeld is",
      "Tot drie sessiedata binnen dezelfde vermelding",
      "De benodigde materialen, gekoppeld aan de catalogus. Deelnemers zien meteen wat ze nodig hebben en waar het te koop is",
      "Je eigen contactgegevens of een link naar je eigen inschrijfsysteem",
    ],
  },
  reasons: {
    title: "Waarom hier",
    items: [
      {
        title: "Een publiek dat je niet hoeft te overtuigen",
        body: "De bezoekers van Hobbysalon zijn hobbyist. Ze zoeken gericht naar workshops in hun techniek en hun regio, en weten wat een goede workshop waard is.",
      },
      {
        title: "Je workshop staat niet alleen",
        body: "Materialen, tutorials en evenementen zijn op Hobbysalon met elkaar verbonden. Wie een artikel over amigurumi leest, kan van daaruit bij jouw haakworkshop uitkomen.",
      },
      {
        title: "Geen abonnement, geen commissie",
        body: "Je betaalt per vermelding. Geef je één workshop per jaar, dan betaal je één keer.",
      },
    ],
  },
  publishNote: {
    title: "Controleer je data vóór je publiceert",
    body: "De sessiedata worden vastgelegd op het moment van publiceren en kunnen daarna niet meer worden aangepast. Neem datums, tijden en locatie dus rustig door voor je op publiceren klikt. Bij een fout moet de vermelding opnieuw worden aangemaakt.",
  },
  pricing: {
    title: "Lanceraanbod: 3 workshops gratis tot 1 december",
    body: "Tot 1 december 2026 mag je tot 3 workshops gratis plaatsen. Die drie blijven daarna gratis. Extra vermeldingen kosten €9,99 en blijven 2 maanden zichtbaar. Geen commissie per deelnemer.",
  },
} as const;

export const ORGANIZER_PAGE = {
  metaTitle: "Hobbybeurzen en makers markets | Organisatoren",
  metaDescription:
    "Zet je hobbybeurs of makers market gratis in de evenementenkalender. Eventpagina vanaf €50 per maand (hobbybeurs) of €69 per event (makers market).",
  headline: "Begin gratis in de kalender",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "Elke hobbybeurs en makers market gratis in de kalender. Bezoekers vinden je zonder dat je iets betaalt.",
  primaryCta: {
    label: "Zet je evenement in de kalender",
    href: "/register/creator?focus=organizer",
  },
  secondaryCta: {
    label: "Bespreek een eventpagina",
    href: "/register/creator?focus=organizer",
  },
  intro:
    "Elke hobbybeurs en elke makers market kan gratis in de evenementenkalender van Hobbysalon. Bezoekers die zoeken naar iets creatiefs om te doen, vinden je daar terug, zonder dat je iets betaalt.",
  freeListing: {
    title: "Wat een gratis vermelding toont",
    items: [
      "Naam van je evenement",
      "Datum en openingsuren",
      "Locatie",
      "Type (hobbybeurs of makers market)",
      "Een link naar je eigen website of Facebookpagina",
    ],
    note: "Genoeg om gevonden te worden. Meer heb je niet nodig om te starten.",
  },
  eventPage: {
    title: "Wil je meer laten zien? Kies een eventpagina",
    intro:
      "Een eventpagina is je eigen plek op Hobbysalon, met ruimte voor het volledige verhaal:",
    items: [
      "Programma en tijdschema",
      "Deelnemende standhouders en makers",
      "Workshops en activiteiten tijdens het evenement",
      "Foto's en sfeerbeelden van vorige edities",
      "Praktische informatie: parkeren, toegangsprijs, bereikbaarheid",
      "Updates voor bezoekers in de aanloop naar de dag zelf",
    ],
  },
  exhibitors: {
    title: "Je exposanten kunnen zich aansluiten",
    body: "Workshopgevers en materialenwinkels die op Hobbysalon staan, kunnen aangeven dat ze bij jouw evenement aanwezig zijn. Zo groeit je eventpagina mee naarmate de standenlijst zich vult, en zien bezoekers vooraf wie ze zullen tegenkomen, vaak net de reden waarom iemand besluit te komen.",
  },
  audience: {
    title: "Een publiek dat hiervoor komt",
    body: "Hobbysalon organiseerde jarenlang zelf hobbybeurzen in de Nekkerhal, Antwerp Expo en Xpo Kortrijk. De bezoekers van toen zijn de community van nu: mensen die een dag creatief rondstruinen als vanzelfsprekend zien, en die de kalender afgaan op zoek naar de volgende.",
  },
  pricing: {
    title: "Tarieven tijdens de pilot",
    items: [
      {
        label: "Hobbybeurs",
        value: "Eventpagina vanaf €50 per maand",
      },
      {
        label: "Makers market",
        value: "Eventpagina vanaf €69 per event",
      },
    ],
    note: "Extra promotie (nieuwsbrief, uitgelichte plaatsing of een bredere zichtbaarheidscampagne) bespreken we tijdens de pilot op maat.",
  },
  doubt: {
    title: "Twijfel je?",
    body: "Zet je evenement eerst gratis in de kalender. Loopt het goed, dan kun je later nog altijd upgraden naar een volledige eventpagina.",
  },
} as const;

export const SUPPLIER_PAGE = {
  metaTitle: "Hobbymaterialen verkopen | €0 + 10% commissie",
  metaDescription:
    "Verkoop professionele hobbymaterialen via Hobbysalon. €0 vaste kosten, 10% commissie op de totale verkoopprijs. Geen instapkosten, geen limiet op het aantal advertenties, geen minimumduur.",
  headline: "Verkoop je hobbymaterialen aan een publiek dat weet wat het zoekt",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "€0 vaste kosten. Alleen 10% commissie wanneer er echt verkocht wordt.",
  primaryCta: { label: "Meld je winkel aan", href: "/register/merchant" },
  secondaryCta: { label: "Alle prijzen", href: "/prijzen" },
  intro:
    "Hobbysalon brengt professionele hobbymaterialenwinkels samen met een community van ruim 40.000 creatieve hobbyisten. Geen vast maandbedrag: in de basisformule reken je alleen af wanneer er daadwerkelijk verkocht wordt.",
  pricingHighlight: {
    title: "€0 vaste kosten",
    subtitle: "10% commissie op de totale verkoopprijs",
    body: SHOP_PRICING_BODY,
    example: SHOP_PRICING_EXAMPLE,
    paymentNote: SHOP_PAYMENT_PROVIDER_NOTE,
    finePrint:
      "Geen instapkosten, geen limiet op het aantal advertenties, geen minimumduur. Verkoop je niets, dan betaal je niets.",
  },
  features: {
    title: "Wat je krijgt",
    items: [
      {
        title: "Productcatalogus",
        body: "Een volledige productcatalogus met varianten voor kleur, maat en gewicht, voorraadbeheer en je eigen verzendinstellingen.",
      },
      {
        title: "Afrekenen en bestellingen",
        body: "Afrekenen en bestellingen beheren gebeurt binnen Hobbysalon. Je klant rondt de bestelling af zonder de site te verlaten; jij verwerkt en volgt op vanuit je eigen dashboard.",
      },
      {
        title: "Winkelprofiel",
        body: "Een winkelprofiel met je verhaal en assortiment. Heb je een fysieke winkel, dan komen je locatie en openingsuren erbij.",
      },
      {
        title: "Koppeling met content",
        body: "Gebruikt een contentmaker jouw garen in een haaktutorial, dan verschijnt je product bij de materialenlijst van dat artikel. Je bereikt de koper op het moment dat die weet wat ze nodig heeft en wil beginnen.",
      },
    ],
  },
  connected: {
    title: "Verkopen waar het project ontstaat",
    body: "Dat laatste is het verschil met een gewone marktplaats. Op Hobbysalon staan de tutorials, de patronen, de workshops en de evenementen naast je producten, en ze verwijzen naar elkaar. Iemand leest hoe je een deken haakt, ziet welke wol daarvoor nodig is, en komt bij jou terecht: niet na een zoekopdracht op prijs, maar met een project in gedachten.",
    note: "Het is dezelfde beweging als in je winkel, waar iemand met een idee binnenkomt en met het juiste garen buitengaat.",
  },
  channels: {
    title: "Zowel online als fysiek",
    body: "Heb je een winkel in de straat en geen webshop? Dan is Hobbysalon je online verkoopkanaal, zonder dat je zelf iets hoeft te bouwen of te onderhouden. Heb je er al een? Dan is dit een extra vindplaats voor je assortiment, gericht op precies de doelgroep die je toch al bedient.",
  },
  onboarding: {
    title: "Aan de slag",
    body: "Je hoeft je catalogus niet met de hand in te voeren. Bij aanmelding kijken we samen naar de snelste route om je assortiment binnen te halen.",
  },
  comingSoon: {
    title: "Binnenkort",
    body: "Premium zichtbaarheid (uitgelichte plaatsing in categorieën en in de nieuwsbrief) en verkoopanalyses zijn in ontwikkeling. Tarieven en beschikbaarheid volgen. De basisformule blijft ongewijzigd beschikbaar.",
  },
  closing: {
    title: "Klaar om te starten?",
    body: "€0 vaste kosten, 10% commissie op de totale verkoopprijs. Geen minimumduur, geen opzegtermijn.",
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Legacy explainers / FAQs kept for imports                                  */
/* -------------------------------------------------------------------------- */

export const CREDITS_EXPLANATION = {
  title: "Wat is tegoed?",
  paragraphs: [
    "Tegoed gebruik je voor concrete acties: een advertentie publiceren, verlengen of extra promoten. De pakketten volgen binnenkort.",
  ],
};

export const WHY_DIFFERENT_FORMULAS = {
  title: "Hoe werkt de prijsopbouw?",
  text: "Een profiel aanmaken, content publiceren, je eerste drie advertenties plaatsen en je evenement in de kalender zetten is gratis. Verder betaal je per plaatsing, met tegoed, of alleen wanneer er echt iets verkocht wordt.",
};

export const WORKSHOP_FAQ: PricingFaqItem[] = [
  {
    question: "Nemen jullie commissie op mijn workshops?",
    answer:
      "Nee. Tot 1 december 2026 mag je tot 3 workshops gratis plaatsen (die blijven gratis). Extra vermeldingen kosten €9,99 voor twee maanden zichtbaar. Er is geen commissie per deelnemer.",
  },
  {
    question: "Moet ik een boekingssysteem van Hobbysalon gebruiken?",
    answer:
      "Nee. Deelnemers schrijven zich rechtstreeks bij jou in. Een externe inschrijflink is mogelijk waar de workshop-UI dat toelaat.",
  },
  {
    question: "Kunnen sessiedata na publicatie nog wijzigen?",
    answer:
      "Nee. De sessiedata worden vastgelegd op het moment dat je publiceert. Controleer datums en tijden rustig vóór je publiceert.",
  },
];

export const MAKERS_FAQ: PricingFaqItem[] = [
  {
    question: "Hoe werkt een aanvraag?",
    answer:
      "Een geïnteresseerde stuurt je een bericht via je profiel. Prijs, betaling en verzending spreek je onderling af.",
  },
  {
    question: "Betaal ik commissie?",
    answer: "Nee. Geen commissie op je verkoop.",
  },
  {
    question: "Hoeveel advertenties kan ik tonen?",
    answer:
      "Je eerste drie advertenties zijn gratis. Wil je meer aanbieden, dan plaats je tot 10 extra advertenties met tegoed.",
  },
  {
    question: "Wat kost tegoed?",
    answer:
      "De tegoedpakketten en tarieven volgen binnenkort.",
  },
];

export const SUPPLIER_FAQ: PricingFaqItem[] = [
  {
    question: "Gaat de klant naar mijn eigen webshop?",
    answer: "Nee. Je klant rekent af op Hobbysalon.",
  },
  {
    question: "Wat is de commissie?",
    answer: SHOP_PRICING_BODY,
  },
  {
    question: "Wat kost het per maand?",
    answer:
      "€0 vaste kosten. Alleen 10% commissie bij verkoop. Geen minimumduur.",
  },
  {
    question: "Wie betaalt de betaalkosten?",
    answer: `${SHOP_PAYMENT_PROVIDER_NOTE} Die kosten zijn voor de winkel en worden per bestelling afgetrokken van je uitbetaling.`,
  },
  {
    question: "Wat is Premium?",
    answer:
      "Premium zichtbaarheid en analyses: binnenkort. Tarieven volgen. De basisformule blijft ongewijzigd.",
  },
];

/** Pilot block copy for /register/merchant */
export const MERCHANT_REGISTER_PILOT = {
  title: "Pilot: maximaal 20 winkels",
  body: SHOP_PRICING_BODY,
  example: SHOP_PRICING_EXAMPLE,
  paymentNote: SHOP_PAYMENT_PROVIDER_NOTE,
} as const;

export const ORGANIZER_FAQ: PricingFaqItem[] = [
  {
    question: "Moet ik betalen om in de kalender te staan?",
    answer:
      "Nee. Elke hobbybeurs en elke makers market kan gratis worden opgenomen in de evenementenkalender.",
  },
  {
    question: "Wat is een eventpagina?",
    answer:
      "Een volledige pagina met programma, standhouders, workshops, foto's, praktische info en updates — meer dan alleen datum en locatie.",
  },
  {
    question: "Wat kosten eventpagina's tijdens de pilot?",
    answer:
      "Hobbybeurs: vanaf €50 per maand. Makers market: vanaf €69 per event. Extra promotie bespreken we op maat.",
  },
];

export const CONTENT_FAQ: PricingFaqItem[] = [
  {
    question: "Betaal ik om content te publiceren?",
    answer: "Nee. Publiceren is gratis.",
  },
  {
    question: "Verdien ik aan affiliate?",
    answer:
      "Verdienen via affiliate en digitale patronen: binnenkort. Voorwaarden maken we bekend zodra de functie live gaat.",
  },
];

export const PARTNERS_FAQ: PricingFaqItem[] = [
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
];

/** @deprecated Use WORKSHOP_OFFER */
export const WORKSHOP_PLANS = [] as const;

/** @deprecated Use SUPPLIER_OFFER */
export const SUPPLIER_PLANS = [] as const;

/** @deprecated Use organizer offers */
export const ORGANIZER_PLANS = [] as const;

export const WORKSHOP_PLAN_FAQ = {
  externalBooking:
    "Ja, waar de workshop-UI een externe inschrijflink toelaat. Geen apart Premium-pakket nodig.",
  bookingSystem:
    "Nee. Jij regelt inschrijving en betaling. Hobbysalon levert zichtbaarheid en contact.",
};

export const ORGANIZER_PLAN_FAQ = {
  tickets: "Niet als standaard. Externe ticketlinks zijn mogelijk binnen pilotpromotie.",
  standhouders: "Ja. Bezoekers en standhouders kunnen via Hobbysalon contact opnemen.",
};

export type MarketingPlanCard = {
  code: string;
  title: string;
  price: string;
  features: string[];
  featured?: boolean;
};
