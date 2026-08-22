/**
 * Copy for /over-ons — brand story / about page.
 */
export const ABOUT_PAGE = {
  metaTitle: "Over Hobbysalon - van beursvloer naar creatief platform",
  metaDescription:
    "Dertig jaar hobbybeurzen in de Nekkerhal, Antwerp Expo en Xpo Kortrijk. Vandaag een platform waar workshops, materialen, makers en evenementen samenkomen.",
  headline: "Wat begon op de beursvloer",
  /** Short hero line (viewport budget) */
  heroSubheadline:
    "Van de beurshal naar een platform dat het hele jaar open is voor makers en hobbyisten.",
  primaryCta: { label: "Verken Hobbysalon", href: "/" },
  secondaryCta: { label: "Bekijk de workshops", href: "/workshops" },
  origin: [
    "Hobbysalon is niet online ontstaan. Het begon in een hal, met tafels, garen en duizenden mensen die een dag lang rondliepen tussen standen.",
    "Jarenlang vulden we de Nekkerhal in Mechelen, Antwerp Expo, Xpo Kortrijk en Hasselt met bezoekers die kwamen voor materialen, demonstraties en de sfeer van een dag tussen gelijkgestemden. Mensen die elkaar jaar na jaar terugzagen bij dezelfde stand. Standhouders die hun vaste klanten herkenden voor die iets zeiden.",
    "Toen corona de beurshallen sloot, namen we de handelsvennootschap over, met de community van 70.000 abonnees erbij. Die mensen waren er nog. Alleen de plek om samen te komen was weg.",
    "Dus bouwden we een nieuwe. Geen zaal van één weekend per jaar, maar een platform dat het hele jaar open is.",
  ],
  beliefs: {
    title: "Waar we in geloven",
    items: [
      {
        title: "Maken is een vak, geen tijdverdrijf",
        body: "Wie dertig jaar haakt, weet meer over garen dan de meeste webshops. Die kennis verdient een plek waar ze gevonden wordt.",
      },
      {
        title: "Een goede hobby heeft mensen nodig",
        body: "De helft van wat een beurs waardevol maakte, was niet het aanbod maar het gesprek. Dat kun je niet volledig online nabouwen, maar je kunt het wel mogelijk maken.",
      },
      {
        title: "Duidelijk gaat voor slim",
        body: "Onze bezoekers zijn overwegend 55 tot 74 jaar. Grote knoppen, leesbare tekst, geen doolhof. Wie hier iets wil vinden, moet het vinden.",
      },
      {
        title: "Nederlandstalig en dichtbij",
        body: "België en Nederland, met workshops en beurzen die je op een namiddag bereikt.",
      },
    ],
  },
  audiences: {
    title: "Voor wie het is",
    hobbyist: {
      title: "Voor hobbyisten",
      body: "Je vindt hier workshops in je buurt, materialen van gespecialiseerde winkels, handgemaakt werk van andere makers, de agenda van hobbybeurzen en makers markets, en ruim 900 artikelen met tutorials en patronen.",
      note: "Rondkijken kan zonder account. Wil je favorieten bewaren, projecten bijhouden of materialenlijsten aanleggen, dan maak je er gratis een aan.",
      cta: { label: "Ontdek wat er te vinden is", href: "/voor-hobbyisten" },
    },
    providers: {
      title: "Voor makers en professionals",
      body: "Vijf soorten aanbieders vinden hier hun publiek: contentmakers die tutorials en patronen delen, particuliere makers die zelfgemaakt werk of overschot verkopen, workshopgevers, organisatoren van beurzen en makers markets, en professionele hobbymaterialenwinkels met een volledige webshop inclusief voorraad, betalingen en verzending.",
      note: "Je bereikt een publiek dat hier gericht voor komt. Geen algemene marktplaats waar handwerk verdwijnt tussen telefoonhoesjes.",
      cta: { label: "Bekijk de mogelijkheden", href: "/partners" },
    },
  },
  connected: {
    title: "Waarom alles met elkaar verbonden is",
    intro:
      "Dit is waar we anders zijn dan een webshop, een workshopsite of een agenda.",
    body: "Een tutorial over een gehaakte deken verwijst naar het garen dat je nodig hebt. Dat garen leidt naar de winkel die het verkoopt. Die winkel staat volgende maand op een beurs die in de agenda staat. En de maker die de deken haakte, geeft er een workshop over.",
    forWhom: [
      "Voor wie iets wil maken betekent dat: minder zoeken, meer maken.",
      "Voor wie iets aanbiedt: bezoekers die binnenkomen via ingangen die je zelf niet hoeft aan te leggen.",
    ],
    closing:
      "Op een beurs gebeurde dat vanzelf. Je liep van een demonstratie naar de stand met het juiste garen naar de mevrouw die de cursus gaf. Dat is wat we online proberen na te bouwen.",
  },
  roadmap: {
    title: "Waar we naartoe gaan",
    body: "We zijn niet af. In ontwikkeling: verkoop van digitale patronen, een affiliateprogramma waarmee contentmakers meeverdienen aan de materialen in hun tutorials, uitgebreidere promotie voor workshopgevers en verkoopanalyses voor winkels.",
    note: "En een forum, want de vraag die het vaakst terugkomt is niet \"waar koop ik dit\" maar \"hoe doen jullie dit\".",
  },
  team: {
    title: "Even voorstellen",
    body: "Hobbysalon wordt geleid door Nathalie Smolders en Peter Peeters, getest door hun dochter Charlie en goedgekeurd door hun honden Amigo & Pepe. De beurzen organiseren we niet meer. Het platform heeft onze volledige aandacht.",
    invite: "Vragen, ideeën of gewoon iets kwijt? We horen het graag.",
    contactCta: { label: "Neem contact op", href: "mailto:info@hobbysalon.be" },
  },
  closing: {
    title: "Begin met ontdekken",
    links: [
      { label: "Ga naar Hobbysalon", href: "/" },
      { label: "Bekijk de workshops", href: "/workshops" },
      { label: "Word aanbieder", href: "/partners" },
    ],
  },
} as const;
