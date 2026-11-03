/**
 * Copy for /voor-hobbyisten: consumer discovery landing.
 * Numbers are not written here; the page counts them live.
 */
export const HOBBYIST_PAGE = {
  metaTitle: "Voor iedereen die graag iets moois maakt | Hobbysalon",
  metaDescription:
    "Vind creatieve workshops, patronen, uitleg en gratis hobbytools. Bewaar wat je leuk vindt en maak automatisch een stappenplan. België en Nederland.",
  headline: "Voor iedereen die graag iets moois maakt",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "Workshops, patronen, materialen en makers bij elkaar. Rustig ontdekken, zonder twintig tabbladen.",
  /** One primary action on the whole page: pick a hobby. */
  primaryCta: { label: "Kies je hobby", href: "#hobby" },
  secondaryCta: { label: "Maak een gratis account", href: "/register" },
  hobbyPicker: {
    title: "Waar heb je zin in?",
    body: "Kies je hobby. Je ziet meteen patronen, uitleg, workshops en materialen die erbij horen.",
    ideasLabel: (n: number) => (n === 1 ? "1 idee" : `${n} ideeën`),
  },
  pain: {
    title: "Herken je dit?",
    items: [
      "Je ziet iets moois voorbijkomen op Facebook, maar je vindt het patroon nergens meer terug.",
      "Je wilt een rustige workshop volgen, waar je niet de enige beginner bent. Maar je weet niet waar je moet zoeken.",
      "Je hebt het garen, maar niet de uitleg. Of de uitleg, maar je weet niet waar je dat garen koopt.",
      "Je wilt eerst gewoon rondkijken, zonder dat er meteen iets van je gevraagd wordt.",
    ],
    closer: "Daar is Hobbysalon voor.",
  },
  discover: {
    title: "Alles op één plek, en het hangt samen",
    body: "Lees je een uitleg over een gehaakte deken, dan staat de wol erbij en de winkel die hem verkoopt. Wil je het liever van iemand leren, dan zie je welke workshop dat geeft.",
    items: [
      {
        title: "Workshops",
        body: "Creatieve workshops in België en Nederland. Je ziet vooraf wat je maakt, wat het kost en wat je meebrengt.",
        href: "/workshops",
        cta: "Naar workshops",
      },
      {
        title: "Patronen en uitleg",
        body: "Patronen, tutorials en projectgidsen, geschreven door mensen die het zelf maken.",
        href: "/patronen",
        cta: "Naar patronen",
      },
      {
        title: "Materialen",
        body: "Garen, papier, kralen, stof en gereedschap van gespecialiseerde winkels, met voorraad en verzending gewoon zichtbaar.",
        href: "/materials",
        cta: "Naar materialen",
      },
      {
        title: "Makersmarkt",
        body: "Handgemaakt werk van makers en hun overschot aan materiaal. Vaak precies dat ene kleurtje dat je nog zocht.",
        href: "/creators",
        cta: "Naar de makers",
      },
      {
        title: "Agenda",
        body: "Hobbybeurzen en makersmarkten, met datum, plaats en wie er staat.",
        href: "/agenda",
        cta: "Naar de agenda",
      },
    ],
  },
  fromInspiration: {
    title: "Van inspiratie naar project",
    body: "Bewaar artikelen en patronen die je wilt maken. Uit de bestaande instructies maakt Hobbysalon automatisch een stappenplan, klaar om af te vinken.",
    moments: [
      {
        title: "Vinden en bewaren",
        body: "Zet een tutorial of patroon bij je favorieten. Zo raak je het niet kwijt tussen Facebook en losse pdf's.",
      },
      {
        title: "Automatisch stappenplan",
        body: "De stappen, toeren of instructies uit het artikel worden een overzichtelijk plan voor jouw project.",
      },
      {
        title: "Aan de slag",
        body: "Open het plan wanneer het jou past. Materialen staan erbij, zodat je weet wat je nog nodig hebt.",
      },
    ],
    cta: { label: "Naar artikelen en patronen", href: "/artikelen" },
  },
  hobbyTools: {
    title: "Gratis hobbytools",
    body: (n: number) =>
      `${n} rekenhulpen voor stof, garen, quilts, kaarsenwas, hars, kralen en papier. Vul in wat je wilt maken en zie meteen hoeveel materiaal je nodig hebt. Zonder account.`,
    cta: { label: "Alle hobbytools", href: "/tools" },
  },
  howItWorks: {
    title: "Hoe het werkt",
    steps: [
      {
        title: "Kies een hobby of zoek op plaats",
        body: "Ga uit van je techniek, zoals haken, kaarten maken of naaien. Of kijk wat er in je buurt te doen is.",
      },
      {
        title: "Ontdek workshops, materialen of events",
        body: "Rustig rondkijken kan zonder account. Niets verplicht, niets dat je eerst moet invullen.",
      },
      {
        title: "Bewaar wat je leuk vindt",
        body: "Met een gratis account houd je favorieten bij. Uit een bewaard patroon of artikel kun je meteen een project met stappenplan starten.",
      },
    ],
  },
  why: {
    title: "Waarom Hobbysalon",
    items: [
      {
        title: "Gemaakt voor mensen die graag met hun handen werken",
        body: "Geen algemene activiteitensite waar een haakcursus tussen teambuilding en kooklessen verdwijnt. Alles hier is creatief.",
      },
      {
        title: "Rustig en overzichtelijk",
        body: "Duidelijke pagina's, grote knoppen, leesbare tekst. Werkt net zo goed op je tablet als op je computer.",
      },
      {
        title: "Lokaal én online",
        body: "Workshops en evenementen in heel België en Nederland, plus online lessen als je liever thuis blijft.",
      },
      {
        title: "Een naam die je misschien kent",
        body: "Hobbysalon organiseerde jarenlang de hobbybeurzen in de Nekkerhal, Antwerp Expo en Xpo Kortrijk. Dezelfde mensen, dezelfde liefde voor het vak, nu het hele jaar door open.",
      },
    ],
  },
  faqTitle: "Veelgestelde vragen",
  faq: [
    {
      question: "Moet ik een account hebben om te kijken?",
      answer:
        "Nee. Workshops, materialen, events en artikelen kun je vrij bekijken. Een account heb je pas nodig als je iets wil bewaren.",
    },
    {
      question: "Wat krijg ik met een gratis account?",
      answer:
        "Je favorieten op één plek, een overzicht van je projecten, je eigen materialenlijsten en de mogelijkheid om je regio in te stellen zodat je vooral ziet wat in de buurt gebeurt. Het account is en blijft gratis.",
    },
    {
      question: "Hoe werkt een stappenplan vanuit een artikel?",
      answer:
        "Bewaar een artikel of patroon als favoriet. Hobbysalon leest de instructies uit en zet ze om in een stappenplan voor jouw project. Je kunt dat plan later verder aanvullen.",
    },
    {
      question: "Wat zijn Hobbytools?",
      answer:
        "Gratis rekenhulpen voor makers: hoeveel stof, garen, was of kralen je nodig hebt, of hoe groot je quilt wordt. Je hebt er geen account voor nodig.",
    },
    {
      question: "Krijg ik automatisch de nieuwsbrief?",
      answer:
        "Nee. Je schrijft je alleen in als je dat zelf aangeeft, en je kunt je op elk moment weer uitschrijven.",
    },
    {
      question: "Kost het iets om een workshop te boeken?",
      answer:
        "De prijs van de workshop bepaalt de workshopgever, en je regelt de inschrijving rechtstreeks met hem of haar. Hobbysalon rekent jou niets extra aan.",
    },
    {
      question: "Is het ook geschikt als ik net begin?",
      answer:
        "Zeker. Bij elke workshop staat voor wie die bedoeld is, en veel van de artikelen zijn geschreven voor wie voor het eerst een haaknaald of naaimachine vastpakt.",
    },
    {
      question: "Ik kom er niet uit op de website. Kan iemand helpen?",
      answer:
        "Ja. Neem gerust contact op via de contactpagina, dan kijken we met je mee.",
      contactHref: "/over-ons#contact",
    },
  ],
  closing: {
    title: "Begin met ontdekken",
    body: "Geen haast. Kijk eerst rond, en maak een gratis account wanneer het jou past.",
    primaryCta: { label: "Kies je hobby", href: "#hobby" },
    secondaryCta: { label: "Maak een gratis account", href: "/register" },
  },
} as const;
