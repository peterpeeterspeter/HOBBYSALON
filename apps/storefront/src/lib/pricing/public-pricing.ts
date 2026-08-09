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

export const SUPPLIER_COMMISSION_NOTE =
  "Op materialen via Hobbysalon checkout geldt 10% commissie. Verzendkosten en afrekenkosten worden apart verwerkt.";

export const P2P_COMMISSION_NOTE =
  "Geen commissie op P2P-verkoop. Je regelt betaling en verzending rechtstreeks met de koper.";

/* -------------------------------------------------------------------------- */
/* /prijzen — page chrome                                                     */
/* -------------------------------------------------------------------------- */

export const PRIJZEN_PAGE = {
  metaTitle: "Prijzen en mogelijkheden voor aanbieders | Hobbysalon",
  metaDescription:
    "Vergelijk de formules voor contentmakers, makers, workshopgevers, organisatoren en hobbymaterialenwinkels. Begin gratis of betaal alleen voor wat je publiceert.",
  heroLabel: "Prijzen en mogelijkheden",
  heroHeadline: "Ontdek de route die bij jou past",
  heroSubheadline:
    "Deel creatieve kennis, bied handmade werk aan, promoot workshops en evenementen of verkoop hobbymaterialen. Je betaalt voor wat bij jouw aanbod hoort — niet voor één abonnement dat alles moet dekken.",
  primaryCta: { label: "Ontdek de routes", href: "#routes" },
  secondaryCta: { label: "Vergelijk de mogelijkheden", href: "#vergelijking" },
  routesTitle: "Wat wil je aanbieden?",
  comparisonTitle: "Basis of extra zichtbaarheid?",
  comparisonIntro:
    "Je kunt laagdrempelig starten. Uitbreidingen zijn optioneel en lonen pas wanneer je meer bereik of inzicht nodig hebt.",
  comparisonFootnote:
    'Uitbreiden betekent niet automatisch een abonnement: afhankelijk van je route werk je met credits, een eventpagina, een promotiepakket of een afspraak op maat. Bij "binnenkort" is de functie gepland, maar nog niet beschikbaar.',
  howtoTitle: "Hoe werkt de prijsopbouw?",
  faqTitle: "Veelgestelde vragen",
  closingTitle: "Klaar om jouw aanbod zichtbaar te maken?",
  closingDescription:
    "Kies je route. Op elke detailpagina vind je de volledige uitleg en de eerste stap.",
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
    title: "Contentmaker — gratis publiceren",
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
    title: "Maker — 3 gratis advertenties, daarna credits",
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
    title: "Workshopgever — €9,99 per workshop, 3 maanden zichtbaar",
    description:
      "Presenteer je workshop met foto's, sessiedata, locatie, prijs en materialen. Deelnemers schrijven zich rechtstreeks bij jou in.",
    features: [
      "Tot drie sessiedata in één vermelding",
      "Geen commissie per deelnemer",
      "Drie maanden zichtbaar, daarna opnieuw te activeren",
      "Extra promotie: binnenkort",
    ],
    href: "/voor-workshopgevers",
    ctaLabel: "Bekijk de mogelijkheden",
  },
  {
    id: "organizer",
    title: "Organisator — gratis in de kalender, uitgebreid vanaf €50",
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
    title: "Hobbymaterialenwinkel — €0 per maand, 10% commissie",
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
];

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    audience: "Contentmaker",
    now: "Gratis tutorials, patronen, reviews en video's publiceren",
    expansion: "Digitale patronen verkopen en affiliate-inkomsten — binnenkort",
    benefit: "Je verdient mee aan de materialen en patronen bij je content",
  },
  {
    audience: "Maker",
    now: "Gratis profiel en je eerste 3 advertenties gratis",
    expansion: "Tot 10 extra advertenties en boosts met credits",
    benefit:
      "Meer werk tegelijk aanbieden en geselecteerde advertenties tijdelijk hoger in de overzichten",
  },
  {
    audience: "Workshopgever",
    now: "€9,99 per workshop, drie maanden zichtbaar",
    expansion: "Promotie en bereikstatistieken — binnenkort",
    benefit: "Prominentere plaatsing en meetbaar resultaat",
  },
  {
    audience: "Organisator",
    now: "Gratis vermelding in de evenementenkalender",
    expansion:
      "Eventpagina vanaf €50 per maand (hobbybeurs) of €69 per event (makers market)",
    benefit:
      "Een volledige pagina met programma, standhouders en updates in plaats van alleen datum en locatie",
  },
  {
    audience: "Hobbymaterialenwinkel",
    now: "€0 per maand, 10% commissie bij verkoop",
    expansion: "Premium zichtbaarheid en analyses — binnenkort",
    benefit: "Meer bereik voor je producten en inzicht in prestaties",
  },
];

export const PRICING_HOWTO_BLOCKS: PricingHowtoBlock[] = [
  {
    title: "Laagdrempelig beginnen.",
    text: "Een profiel aanmaken, content publiceren, je eerste drie advertenties plaatsen en je evenement in de kalender zetten is gratis. Verder betaal je per plaatsing, met credits, of alleen wanneer er echt iets verkocht wordt.",
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
      "Nee. Contentmakers publiceren gratis, makers werken met credits, organisatoren staan gratis in de kalender, workshopgevers betalen per vermelding en winkels betalen in de basis alleen commissie bij verkoop.",
  },
  {
    question: "Wat kan ik gratis doen op Hobbysalon?",
    answer:
      "Een profiel aanmaken, tutorials en patronen publiceren, je eerste drie makersadvertenties plaatsen, en je hobbybeurs of makers market in de evenementenkalender zetten. Daar zijn geen kosten aan verbonden.",
  },
  {
    question: "Wat zijn credits?",
    answer:
      "Credits gebruik je voor concrete acties: een advertentie publiceren, verlengen of extra promoten. De pakketten worden bij de commerciële lancering getoond.",
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
  href: "/register/creator",
  ctaLabel: "Word contentmaker",
};

export const P2P_MAKER_OFFER: PublicPricingOffer = {
  id: "handmade",
  audience: "Makers",
  title: "Handmade en destash",
  priceLabel: "3 gratis",
  periodLabel: "daarna tot 10 extra met credits · geen commissie",
  status: "confirmed",
  description:
    "Start met drie gratis advertenties voor je handmade werk of destash. Wil je meer aanbieden, dan breid je uit tot 10 extra advertenties met credits.",
  features: [
    "Eerste 3 advertenties gratis",
    "Tot 10 extra met credits",
    "Geen commissie op je verkoop",
    "Boosts met extra credits",
  ],
  href: "/register/creator",
  ctaLabel: "Maak je makersprofiel",
  finePrint:
    "De creditpakketten en tarieven worden bij de commerciële lancering getoond.",
};

export const WORKSHOP_OFFER: PublicPricingOffer = {
  id: "workshop",
  audience: "Workshopgevers",
  title: "Workshopvermelding",
  priceLabel: "€9,99",
  periodLabel: "per workshop, 3 maanden zichtbaar",
  status: "confirmed",
  description:
    "Presenteer je workshop met foto's, sessiedata, locatie, prijs en materialen. Deelnemers schrijven zich rechtstreeks bij jou in.",
  features: [
    "Tot drie sessiedata in één vermelding",
    "Geen commissie per deelnemer",
    "Drie maanden zichtbaar, daarna opnieuw te activeren",
    "Extra promotie: binnenkort",
  ],
  href: "/register/creator",
  ctaLabel: "Plaats je workshop",
  finePrint: "Prijsmodel voor lancering.",
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
  href: "/register/creator",
  ctaLabel: "Bespreek een eventpagina",
  finePrint: "Pilotprijs — registreren en aanbod bekijken, nog geen checkout.",
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
  href: "/register/creator",
  ctaLabel: "Bespreek een eventpagina",
  finePrint: "Pilotprijs — registreren en aanbod bekijken, nog geen checkout.",
};

export const SUPPLIER_OFFER: PublicPricingOffer = {
  id: "webshop",
  audience: "Hobbymaterialenwinkels",
  title: "Basisformule",
  priceLabel: "€0 / maand",
  periodLabel: "10% commissie op verkopen via Hobbysalon",
  status: "confirmed",
  description:
    "Verkoop professionele hobbymaterialen via Hobbysalon. Geen vast maandbedrag in de basisformule.",
  features: [
    "Productcatalogus met varianten en voorraad",
    "Checkout en orderbeheer",
    "Verzending via je eigen instellingen",
    "Premium zichtbaarheid en analyses: binnenkort",
  ],
  href: "/register/merchant",
  ctaLabel: "Meld je winkel aan",
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

export const CONTENT_PAGE: DetailPageCopy = {
  metaTitle: "Contentmakers | Gratis publiceren",
  metaDescription:
    "Publiceer tutorials, patronen en praktische gidsen onder je eigen makersprofiel — gratis. Materialen koppelen aan producten. Affiliate en digitale patronen: binnenkort.",
  headline: "Deel je kennis. Verdien mee aan wat je maakt.",
  subheadline:
    "Publiceer tutorials, patronen en praktische gidsen onder je eigen makersprofiel — gratis, vanaf vandaag. Hobbysalon zorgt dat je content vindbaar is bij een community van ruim 40.000 hobbyisten.",
  primaryCta: { label: "Word contentmaker", href: "/register/creator" },
  secondaryCta: { label: "Alle prijzen", href: "/prijzen" },
  sections: [
    {
      title: "Zo werkt de materiaalkoppeling",
      paragraphs: [
        "Hobbysalon herkent de materialen die je in je tutorial gebruikt en koppelt ze aan passende producten uit de catalogus. Je lezer ziet direct waar het garen, papier of gereedschap te koop is en hoeft niet zelf te zoeken. Jij hoeft alleen je project te beschrijven.",
      ],
    },
    {
      title: "Binnenkort: verkopen en verdienen",
      paragraphs: [
        "De verkoop van digitale patronen en het affiliateprogramma voor contentmakers zijn in ontwikkeling. Bij een aankoop via jouw persoonlijke link ontvang je dan een vergoeding. Voorwaarden en inkomstenverdeling maken we bekend zodra de functie live gaat. Publiceer je nu al, dan staat je content klaar op het moment dat het zover is.",
      ],
    },
  ],
};

export const MAKERS_PAGE: DetailPageCopy = {
  metaTitle: "Handmade en destash verkopen | Makers",
  metaDescription:
    "Maak gratis een makersprofiel en plaats je eerste drie advertenties zonder te betalen. Tot 10 extra met credits. Geen commissie op je verkoop.",
  headline: "Verkoop je handmade werk. Zonder commissie.",
  subheadline:
    "Maak gratis een makersprofiel aan en plaats je eerste drie advertenties zonder te betalen: handgemaakte creaties, of materialen uit je eigen voorraad die je niet meer gebruikt. Geïnteresseerden nemen rechtstreeks contact met je op — Hobbysalon zit niet tussen jou en je koper.",
  primaryCta: { label: "Maak je makersprofiel", href: "/register/creator" },
  secondaryCta: { label: "Alle prijzen", href: "/prijzen" },
  sections: [
    {
      title: "Zo werkt het",
      paragraphs: [
        "Je plaatst een advertentie met foto's, beschrijving en vraagprijs. Een geïnteresseerde stuurt je een bericht via je profiel. Prijs, betaling en verzending spreek je onderling af. Wat je verkoopt, houd je volledig zelf.",
      ],
    },
    {
      title: "Twee soorten advertenties",
      bullets: [
        "Handmade — je eigen creaties: gehaakt, genaaid, gedraaid, geschilderd. Alles wat je met de hand maakt.",
        "Destash — garen, stof, kralen, gereedschap of materiaal uit je voorraad dat een nieuwe bestemming verdient.",
      ],
    },
    {
      title: "Begin met drie gratis advertenties",
      paragraphs: [
        "Je profiel en je eerste drie advertenties kosten niets. Genoeg om te testen of Hobbysalon werkt voor jouw werk, zonder vooraf iets uit te geven.",
      ],
    },
    {
      title: "Uitbreiden met credits",
      paragraphs: [
        "Wil je meer aanbieden, dan plaats je tot 10 extra advertenties met credits. Je betaalt per plaatsing, niet per maand — geen abonnement, geen vaste kost. Ook het verlengen van een aflopende advertentie gaat met credits. Verleng je niet, dan verdwijnt de advertentie vanzelf uit de overzichten en komt de plek weer vrij.",
        "Met extra credits kun je een advertentie tijdelijk boosten: hij verschijnt dan hoger in de overzichten en in de uitgelichte plaatsingen op relevante pagina's. Nuttig voor seizoensgebonden werk of een grote destash die snel weg moet.",
        "De creditpakketten en tarieven worden bij de commerciële lancering getoond.",
      ],
    },
    {
      title: "Waarom hier en niet op een algemene marktplaats",
      paragraphs: [
        "De bezoekers van Hobbysalon zijn zelf hobbyist. Ze weten wat merinowol kost, herkennen goed afgewerkt werk en zoeken gericht naar materialen voor hun eigen project. Je hoeft minder uit te leggen en je verkoopt aan mensen die de waarde van handwerk kennen.",
      ],
    },
  ],
};

export const WORKSHOP_PAGE = {
  metaTitle: "Workshops aanbieden | €9,99 voor 3 maanden",
  metaDescription:
    "Zet je workshop op de kaart bij hobbyisten die gericht zoeken. €9,99 per vermelding, drie maanden zichtbaar. Geen commissie per deelnemer.",
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
    title: "€9,99 per workshopvermelding",
    body: "Drie maanden zichtbaar, met maximaal drie sessiedata in dezelfde vermelding. Loopt de periode af, dan kun je de workshop opnieuw activeren.",
  },
} as const;

export const ORGANIZER_PAGE: DetailPageCopy = {
  metaTitle: "Hobbybeurzen en makers markets | Organisatoren",
  metaDescription:
    "Zet je hobbybeurs of makers market gratis in de evenementenkalender. Eventpagina vanaf €50 per maand (hobbybeurs) of €69 per event (makers market).",
  headline: "Begin gratis in de kalender",
  subheadline:
    "Elke hobbybeurs en elke makers market kan gratis worden opgenomen in de evenementenkalender van Hobbysalon. Bezoekers die naar creatieve evenementen zoeken, vinden je daar terug — zonder dat je iets betaalt.",
  primaryCta: {
    label: "Zet je evenement in de kalender",
    href: "/register/creator",
  },
  secondaryCta: {
    label: "Bespreek een eventpagina",
    href: "/register/creator",
  },
  sections: [
    {
      title: "Wat een gratis kalendervermelding toont",
      bullets: [
        "Naam van je evenement",
        "datum en openingsuren",
        "locatie",
        "eventtype (hobbybeurs of makers market)",
        "een link naar je eigen website of Facebookpagina",
      ],
      paragraphs: [
        "Dat is genoeg om gevonden te worden. Meer heb je niet nodig om te starten.",
      ],
    },
    {
      title: "Wil je meer laten zien? Kies een eventpagina",
      listIntro: "Een eventpagina is je eigen plek op Hobbysalon, met ruimte voor het volledige verhaal:",
      bullets: [
        "Programma en tijdschema",
        "Deelnemende standhouders en makers",
        "Workshops en activiteiten tijdens het evenement",
        "Foto's en sfeerbeelden van vorige edities",
        "Praktische informatie: parkeren, toegangsprijs, bereikbaarheid",
        "Updates voor bezoekers in de aanloop naar de dag zelf",
      ],
    },
    {
      title: "Tarieven tijdens de pilot",
      paragraphs: [
        "Hobbybeurs: eventpagina vanaf €50 per maand · Makers market: eventpagina vanaf €69 per event.",
        "Extra promotie — nieuwsbrief, uitgelichte plaatsing of een bredere zichtbaarheidscampagne — bespreken we tijdens de pilot op maat.",
      ],
    },
    {
      title: "Twijfel je?",
      paragraphs: [
        "Zet je evenement eerst gratis in de kalender. Loopt het goed, dan kun je later nog altijd upgraden naar een volledige eventpagina.",
      ],
    },
  ],
};

export const SUPPLIER_PAGE: DetailPageCopy = {
  metaTitle: "Hobbymaterialen verkopen | €0 + 10% commissie",
  metaDescription:
    "Verkoop professionele hobbymaterialen via Hobbysalon. €0 per maand, 10% commissie bij verkoop. Geen instapkosten, geen listinglimiet, geen jaarcontract.",
  headline: "Verkoop je hobbymaterialen aan een publiek dat weet wat het zoekt",
  subheadline:
    "Hobbysalon brengt professionele hobbymaterialenwinkels samen met een community van ruim 40.000 creatieve hobbyisten. Je betaalt geen vast maandbedrag: in de basisformule reken je alleen af wanneer er daadwerkelijk verkocht wordt.",
  primaryCta: { label: "Meld je winkel aan", href: "/register/merchant" },
  secondaryCta: { label: "Alle prijzen", href: "/prijzen" },
  sections: [
    {
      title: "€0 per maand · 10% commissie op verkopen via Hobbysalon",
      paragraphs: [
        "Geen instapkosten, geen listinglimiet, geen jaarcontract. Verkoop je niets, dan betaal je niets.",
      ],
    },
    {
      title: "Wat je krijgt",
      bullets: [
        "Volledige productcatalogus met varianten (kleur, maat, gewicht), voorraadbeheer en eigen verzendinstellingen.",
        "Checkout en orderbeheer binnen Hobbysalon — je klant rondt af zonder de site te verlaten, jij verwerkt de bestelling vanuit je eigen dashboard.",
        "Winkelprofiel met je verhaal, assortiment en — als je een fysieke winkel hebt — je locatie en openingsuren.",
        "Koppeling met content: gebruikt een contentmaker jouw product in een tutorial, dan verschijnt het bij de materialenlijst van dat artikel. Zo bereik je kopers op het moment dat ze het materiaal echt nodig hebben.",
      ],
    },
    {
      title: "Zowel online als fysiek",
      paragraphs: [
        "Heb je een winkel in de straat en geen webshop? Dan is Hobbysalon je online verkoopkanaal. Heb je er al een? Dan is dit een extra vindplaats voor je assortiment, gericht op de doelgroep die je toch al bedient.",
      ],
    },
    {
      title: "Binnenkort",
      paragraphs: [
        "Premium zichtbaarheid (uitgelichte plaatsing in categorieën en nieuwsbrief) en verkoopanalyses zijn in ontwikkeling. Tarieven en beschikbaarheid volgen. De basisformule blijft ongewijzigd beschikbaar.",
      ],
    },
    {
      title: "Onboarding",
      paragraphs: [
        "Je hoeft je catalogus niet met de hand in te voeren. Bij aanmelding kijken we samen naar de snelste route om je assortiment binnen te halen.",
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Legacy explainers / FAQs kept for imports                                  */
/* -------------------------------------------------------------------------- */

export const CREDITS_EXPLANATION = {
  title: "Wat zijn credits?",
  paragraphs: [
    "Credits gebruik je voor concrete acties: een advertentie publiceren, verlengen of extra promoten. De pakketten worden bij de commerciële lancering getoond.",
  ],
};

export const WHY_DIFFERENT_FORMULAS = {
  title: "Hoe werkt de prijsopbouw?",
  text: "Een profiel aanmaken, content publiceren, je eerste drie advertenties plaatsen en je evenement in de kalender zetten is gratis. Verder betaal je per plaatsing, met credits, of alleen wanneer er echt iets verkocht wordt.",
};

export const WORKSHOP_FAQ: PricingFaqItem[] = [
  {
    question: "Nemen jullie commissie op mijn workshops?",
    answer:
      "Nee. Je betaalt per workshopvermelding (€9,99 voor drie maanden zichtbaar). Er is geen commissie per deelnemer.",
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
      "Je eerste drie advertenties zijn gratis. Wil je meer aanbieden, dan plaats je tot 10 extra advertenties met credits.",
  },
  {
    question: "Wat kosten credits?",
    answer:
      "De creditpakketten en tarieven worden bij de commerciële lancering getoond.",
  },
];

export const SUPPLIER_FAQ: PricingFaqItem[] = [
  {
    question: "Gaat de klant naar mijn eigen webshop?",
    answer: "Nee. Verkoop verloopt via Hobbysalon checkout.",
  },
  {
    question: "Wat is de commissie?",
    answer: "10% op materialen verkocht via Hobbysalon.",
  },
  {
    question: "Wat kost het per maand?",
    answer: "€0 vaste maandelijkse basiskost. Alleen commissie bij verkoop.",
  },
  {
    question: "Wat is Premium?",
    answer:
      "Premium zichtbaarheid en analyses: binnenkort. Tarieven volgen. De basisformule blijft ongewijzigd.",
  },
];

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
      "Contentmakers, makers, workshopgevers, hobbymaterialenwinkels en eventorganisatoren — plus hobbyisten die iets moois willen maken.",
  },
  {
    question: "Waar vind ik alle prijzen?",
    answer: "Op /prijzen staat een overzicht per doelgroep.",
  },
  {
    question: "Kan ik meerdere rollen hebben?",
    answer:
      "Ja, vanuit hetzelfde profiel. Je kunt bijvoorbeeld contentmaker én workshopgever zijn.",
  },
  {
    question: "Werkt Hobbysalon met commissie?",
    answer:
      "Alleen op merchant-verkoop van materialen (10%). Makers hebben geen commissie. Workshops: vaste vermelding, geen commissie per deelnemer.",
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
