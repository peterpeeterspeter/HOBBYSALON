/**
 * PUBLIC PRESENTATION ONLY — not billing or access-control source.
 * Commercial enforcement uses seed-commercial-plans.sql, commercial-enforcement.ts
 * and COMMERCIAL_GATING_ENABLED. Marketing copy may diverge until launch migration.
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

export const PRICING_STATUS_LABEL: Record<PricingStatus, string | null> = {
  confirmed: null,
  pilot: "Pilotprijs",
  pending: "In voorbereiding",
};

export const WORKSHOP_COMMISSION_NOTE =
  "Geen abonnement en geen commissie per deelnemer.";

export const SUPPLIER_COMMISSION_NOTE =
  "Op materialen via Hobbysalon checkout geldt 10% commissie. Verzendkosten en afrekenkosten worden apart verwerkt.";

export const P2P_COMMISSION_NOTE =
  "Geen commissie op P2P-verkoop. Je regelt betaling en verzending rechtstreeks met de koper.";

export const CREDITS_EXPLANATION = {
  title: "Credits voor publicatie en zichtbaarheid",
  paragraphs: [
    "Sommige formules werken met credits: je gebruikt ze om advertenties te publiceren, actief te houden of extra zichtbaarheid te kopen.",
    "P2P-makers kunnen maximaal 10 actieve handmade- of destash-advertenties hebben. Contentmakers kunnen credits gebruiken voor optionele AI-hulp, vertalingen of promotie — niet om gewone content te publiceren.",
    "Exacte creditprijzen en betaling volgen bij de commerciële lancering. Op deze pagina's tonen we geen pack-tarieven.",
  ],
};

export const WHY_DIFFERENT_FORMULAS = {
  title: "Waarom verschillende formules?",
  text: "Een hobbyist met enkele handmade creaties heeft iets anders nodig dan een professionele materialenwinkel, workshopgever of beursorganisator. Hobbysalon houdt P2P laagdrempelig — zonder commissie op directe verkoop — terwijl merchants meer catalogus-, checkout- en ordermogelijkheden krijgen voor grotere assortimenten.",
};

export const CONTENT_CREATOR_OFFER: PublicPricingOffer = {
  id: "content",
  audience: "Content creators",
  title: "Gratis publiceren",
  priceLabel: "Gratis",
  periodLabel: "tutorials, projecten, patronen, reviews en video's",
  status: "confirmed",
  description:
    "Publiceer creatieve content zonder te betalen voor een plaatsing. Materialen kunnen gekoppeld worden aan de centrale productdatabase.",
  features: [
    "Tutorials, projecten, patronen, reviews en video's",
    "Materialenlijsten koppelen aan producten en winkels",
    "Makersprofiel en vindbaarheid in inspiratie",
    "Credits optioneel voor AI, vertalingen, SEO of extra promotie",
  ],
  limitations: [
    "Affiliate-inkomsten staan in voorbereiding — geen vaste verdeling gepubliceerd",
    "Geen checkout voor content zelf",
  ],
  href: "/register/creator",
  ctaLabel: "Start als contentmaker",
  finePrint: "Gratis publiceren geldt voor standaard content. Optionele credits volgen later.",
};

export const P2P_MAKER_OFFER: PublicPricingOffer = {
  id: "handmade",
  audience: "P2P-makers",
  title: "Handmade en destash",
  priceLabel: "Credits",
  periodLabel: "maximaal 10 actieve advertenties · geen commissie",
  status: "confirmed",
  description:
    "Voor hobbyisten en makers die zelfgemaakte creaties of destash tonen — niet voor professionele materiaalverkoop.",
  features: [
    "Gratis makersprofiel",
    "Maximaal 10 actieve handmade- of destash-advertenties",
    "Geen commissie op P2P-verkoop",
    "Aanvragen via Hobbysalon; jij regelt verkoop en betaling",
    "Credits voor publicatie, verlenging en boosts",
  ],
  limitations: [
    "Geen professionele webshop-checkout",
    "Minder catalogus- en ordertools dan een merchant",
    "Professionele materialen → zie hobbymaterialenwinkels",
  ],
  href: "/register/creator",
  ctaLabel: "Start als maker",
};

export const WORKSHOP_OFFER: PublicPricingOffer = {
  id: "workshop",
  audience: "Workshopgevers",
  title: "Workshopvermelding",
  priceLabel: "€9,99",
  periodLabel: "3 maanden zichtbaar per unieke workshop",
  status: "confirmed",
  description:
    "Eén prijs per workshopvermelding, inclusief sessiedata binnen de zichtbaarheidstermijn. Jij beheert contact, inschrijving en betaling.",
  features: [
    "Workshoppagina met foto's, beschrijving en praktische info",
    "Datum, locatie, prijs en doelgroep",
    "Materialenlijst en koppeling met tutorials",
    "Profiel van de workshopgever",
    "Contact of externe inschrijflink waar de UI dat toelaat",
    "Geen commissie per deelnemer",
  ],
  limitations: [
    "Geen abonnement",
    "Geen automatische verlenging — na 3 maanden opnieuw zichtbaar maken",
    "Geen betaling per lead of per boeking via Hobbysalon",
  ],
  href: "/register/creator",
  ctaLabel: "Plaats je workshop",
  finePrint:
    "Prijsmodel voor lancering; betalen en checkout volgen later. Zichtbaarheid start bij publicatie.",
};

export const HOBBYBEURZEN_OFFER: PublicPricingOffer = {
  id: "hobbybeurs",
  audience: "Organisatoren",
  title: "Hobbybeurs promotie",
  priceLabel: "vanaf €50",
  periodLabel: "per maand (pilot)",
  status: "pilot",
  description: "Uitgebreide eventpagina, agenda en optionele promotie voor hobbybeurzen.",
  features: [
    "Uitgebreide beurs- en programmapagina",
    "Datum, locatie en programma",
    "Zichtbaarheid in de agenda",
    "Deelnemende standhouders en workshopgevers tonen",
    "Optionele promotie en bereikstatistieken wanneer beschikbaar",
  ],
  limitations: [
    "Pilotprijs — definitieve scope en checkout volgen",
    "Geen automatische ticketverkoop als standaard",
  ],
  href: "/register/creator",
  ctaLabel: "Bekijk aanbod voor organisatoren",
};

export const MAKERS_MARKET_OFFER: PublicPricingOffer = {
  id: "makers_market",
  audience: "Organisatoren",
  title: "Makers market promotie",
  priceLabel: "vanaf €69",
  periodLabel: "per event (pilot)",
  status: "pilot",
  description: "Eventvermelding voor makers markets met deelnemende makers en workshops.",
  features: [
    "Uitgebreide eventpagina",
    "Vermelding in de evenementenkalender",
    "Deelnemende makers tonen",
    "Workshops en demonstraties",
    "Optionele promotie via inspiratie en nieuwsbrief",
  ],
  limitations: [
    "Pilotprijs — definitieve scope en checkout volgen",
    "Eenmalige eventvermelding, geen maandabonnement",
  ],
  href: "/register/creator",
  ctaLabel: "Bekijk aanbod voor organisatoren",
};

export const SUPPLIER_OFFER: PublicPricingOffer = {
  id: "webshop",
  audience: "Hobbymaterialenwinkels",
  title: "Merchant verkoop",
  priceLabel: "€0",
  periodLabel: "per maand + 10% commissie per verkoop",
  status: "confirmed",
  description:
    "Professionele materialenverkoop via Hobbysalon checkout — meer mogelijkheden dan P2P-handmade.",
  features: [
    "Merchantprofiel en professionele productcatalogus",
    "Voorraad, varianten, bestellingen en verzending",
    "Checkout en orderbeheer via Hobbysalon",
    "Zichtbaarheid naast tutorials, projecten en workshops",
    "10% commissie op verkopen via het platform",
  ],
  limitations: [
    "Geen P2P-aanvraagflow — dit is merchant-commerce",
    "Premium promotie en analytics: in voorbereiding, geen vast tarief gepubliceerd",
  ],
  href: "/register/merchant",
  ctaLabel: "Start als winkel",
  finePrint: SUPPLIER_COMMISSION_NOTE,
};

export const SUPPLIER_PREMIUM_NOTE: PublicPricingOffer = {
  id: "webshop_premium",
  audience: "Hobbymaterialenwinkels",
  title: "Premium zichtbaarheid",
  priceLabel: "Optioneel",
  status: "pending",
  description: "Extra zichtbaarheid, promotie en analytics voor merchants — tarief volgt bij lancering.",
  features: [
    "Hogere categoriepositie",
    "Uitgelichte winkel",
    "Promotie in inspiratiecontext",
    "Uitgebreidere analyses",
  ],
  href: "/register/merchant",
  ctaLabel: "Start als winkel",
};

export const PRICING_OVERVIEW_OFFERS: PublicPricingOffer[] = [
  CONTENT_CREATOR_OFFER,
  P2P_MAKER_OFFER,
  WORKSHOP_OFFER,
  {
    ...HOBBYBEURZEN_OFFER,
    title: "Eventpromotie",
    description: "Hobbybeurzen en makers markets — aparte pilotformules.",
    href: "/voor-organisatoren",
    ctaLabel: "Voor organisatoren",
  },
  SUPPLIER_OFFER,
];

export const PARTNER_AUDIENCE_CARDS = [
  {
    title: "Content creators",
    text: "Publiceer gratis tutorials, projecten en patronen. Materialen koppelen aan de productgrafiek.",
    ctaLabel: "Voor contentmakers",
    href: "/voor-contentmakers",
  },
  {
    title: "P2P-makers",
    text: "Maximaal 10 handmade-advertenties, geen commissie. Credits voor publicatie en boosts.",
    ctaLabel: "Voor makers",
    href: "/voor-makers",
  },
  {
    title: "Workshopgevers",
    text: `Plaats je workshop drie maanden voor €9,99. ${WORKSHOP_COMMISSION_NOTE}`,
    ctaLabel: "Voor workshopgevers",
    href: "/voor-workshopgevers",
  },
  {
    title: "Organisatoren",
    text: "Promoot hobbybeurzen en makers markets in de creatieve agenda.",
    ctaLabel: "Voor organisatoren",
    href: "/voor-organisatoren",
  },
  {
    title: "Hobbymaterialenwinkels",
    text: "€0 per maand en 10% commissie op verkopen via Hobbysalon checkout.",
    ctaLabel: "Voor winkels",
    href: "/voor-winkels",
  },
  {
    title: "Iets moois maken",
    text: "Ontdek workshops, materialen, makers en events op één plek.",
    ctaLabel: "Voor hobbyisten",
    href: "/voor-hobbyisten",
  },
];

export const WORKSHOP_FAQ = [
  {
    question: "Nemen jullie commissie op mijn workshops?",
    answer:
      "Nee. Je betaalt per workshopvermelding (€9,99 voor drie maanden zichtbaar). Er is geen commissie per deelnemer.",
  },
  {
    question: "Moet ik een boekingssysteem van Hobbysalon gebruiken?",
    answer:
      "Nee. Deelnemers kunnen contact opnemen via Hobbysalon. Jij regelt inschrijving en betaling zelf. Een externe inschrijflink is mogelijk waar de workshop-UI dat toelaat.",
  },
  {
    question: "Wanneer start de zichtbaarheid?",
    answer: "Bij publicatie van je workshopvermelding. Na drie maanden is de vermelding niet meer actief zichtbaar tot je vernieuwt.",
  },
  {
    question: "Is er automatische verlenging?",
    answer: "Nee. Na afloop maak je opnieuw zichtbaar via betaling of credits — dat volgt bij de commerciële lancering.",
  },
];

export const MAKERS_FAQ = [
  {
    question: "Hoe werkt een aanvraag?",
    answer:
      "Een bezoeker stuurt een bericht via Hobbysalon. Jij neemt contact op om verkoop, betaling en verzending te regelen.",
  },
  {
    question: "Betaal ik commissie?",
    answer: "Nee. Op P2P-handmade en destash geldt geen verkoopcommissie.",
  },
  {
    question: "Hoeveel advertenties kan ik tonen?",
    answer: "Maximaal 10 actieve handmade- of destash-advertenties tegelijk.",
  },
  {
    question: "Verkoop ik materialen als winkel?",
    answer:
      "Nee. Professionele materialenverkoop hoort bij hobbymaterialenwinkels (merchant). Zie /voor-winkels.",
  },
  {
    question: "Wat kosten credits?",
    answer:
      "Credits gebruik je voor publicatie, verlenging en extra zichtbaarheid. Packprijzen publiceren we pas bij de lancering.",
  },
];

export const SUPPLIER_FAQ = [
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
    question: "Hoe verschilt dit van P2P-makers?",
    answer:
      "Merchants krijgen catalogus, voorraad, varianten, checkout, verzending en grotere assortimenten. P2P-makers tonen maximaal 10 handmade-advertenties zonder commissie.",
  },
  {
    question: "Wat is Premium?",
    answer:
      "Optionele extra zichtbaarheid en analytics — tarief volgt bij lancering. Geen verplicht abonnement.",
  },
];

export const ORGANIZER_FAQ = [
  {
    question: "Verkopen jullie tickets?",
    answer: "Niet als standaard. Met pilotpromotie kun je bezoekers naar je eigen ticketflow leiden.",
  },
  {
    question: "Wat is het verschil tussen hobbybeurs en makers market?",
    answer:
      "Hobbybeurzen zijn grotere periodieke events (pilot: vanaf €50/maand). Makers markets zijn compactere events (pilot: vanaf €69 per event).",
  },
  {
    question: "Kunnen standhouders zich aanmelden?",
    answer: "Ja. Bezoekers en standhouders kunnen via Hobbysalon contact opnemen.",
  },
];

export const CONTENT_FAQ = [
  {
    question: "Betaal ik om content te publiceren?",
    answer: "Nee. Tutorials, projecten, patronen, reviews en video's publiceren is gratis.",
  },
  {
    question: "Verdien ik aan affiliate?",
    answer:
      "Affiliate-inkomsten staan in voorbereiding. We publiceren geen vaste verdeling tot het model live is.",
  },
  {
    question: "Waarvoor gebruik ik credits?",
    answer: "Optioneel voor AI-teksten, vertalingen, SEO-hulp of extra zichtbaarheid — niet voor standaard publicatie.",
  },
];

export const PARTNERS_FAQ = [
  {
    question: "Voor wie is Hobbysalon?",
    answer:
      "Contentmakers, P2P-makers, workshopgevers, hobbymaterialenwinkels en eventorganisatoren — plus hobbyisten die iets moois willen maken.",
  },
  {
    question: "Waar vind ik alle prijzen?",
    answer: "Op /prijzen staat een overzicht per doelgroep, zonder verouderde jaarplannen.",
  },
  {
    question: "Kan ik meerdere rollen hebben?",
    answer: "Ja. Veel partners combineren rollen. Kies per activiteit de juiste formule.",
  },
  {
    question: "Werkt Hobbysalon met commissie?",
    answer:
      "Alleen op merchant-verkoop van materialen (10%). P2P-handmade heeft geen commissie. Workshops: vaste vermelding, geen commissie per deelnemer.",
  },
];

/** @deprecated Use WORKSHOP_OFFER — kept for imports migrating off plan cards */
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
