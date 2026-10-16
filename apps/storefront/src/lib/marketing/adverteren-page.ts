/**
 * Copy for /adverteren — nieuwsbrief sponsoring.
 * Flemish Dutch, simple language for senior-friendly presentation.
 */
export const ADVERTEREN_PAGE = {
  metaTitle: "Adverteren in de Hobbysalon-nieuwsbrief | Sponsoring",
  metaDescription:
    "Bereik duizenden creatieve hobbyisten via de Hobbysalon-nieuwsbrief. Sponsoring vanaf €49: uitgelichte workshop, maker van de week, sponsorblok of themaweek-partner.",
  headline: "Adverteren in de nieuwsbrief",
  heroSubheadline:
    "Bereik een trouwe community van creatieve hobbyisten. Duidelijke formules, vaste prijzen.",
  primaryCta: {
    label: "Mail naar info@hobbysalon.be",
    href: "mailto:info@hobbysalon.be?subject=Adverteren%20in%20de%20nieuwsbrief",
  },
  secondaryCta: { label: "Bekijk de formules", href: "#formules" },
  audienceTitle: "Wie leest de nieuwsbrief?",
  audienceIntro:
    "De Hobbysalon-nieuwsbrief gaat naar mensen die écht bezig zijn met handwerk en hobby. Geen toevallige klikkers.",
  audienceStats: [
    {
      label: "Abonnees",
      value: "ongeveer 45.000",
      detail: "waarvan 12.250 actief in de laatste 12 maanden",
    },
    {
      label: "Publiek",
      value: "97%+ vrouwen",
      detail: "ongeveer 60% is tussen 55 en 74 jaar",
    },
  ],
  hobbiesTitle: "Populairste hobby’s",
  hobbies: [
    "Haken",
    "Kaarten maken",
    "Breien",
    "Borduren en handwerk",
    "Naaien",
    "Juwelen",
  ],
  tiersTitle: "Formules en prijzen",
  tiersIntro:
    "Kies wat bij je past. Alle vermeldingen verschijnen in de nieuwsbrief. We helpen je graag met de tekst.",
  tiers: [
    {
      id: "uitgelicht",
      name: "Uitgelichte workshop of event",
      price: "€49",
      priceNote: "per editie",
      description: "Een korte vermelding met een link naar je workshop of event.",
      includes: ["Korte tekst", "Link naar je pagina"],
    },
    {
      id: "maker-week",
      name: "Maker of workshopgever van de week",
      price: "€99",
      priceNote: "per editie",
      description:
        "Een persoonlijke voorstelling: foto, korte tekst van ongeveer 60 woorden, en een link.",
      includes: ["Foto", "Tekst van ongeveer 60 woorden", "Link"],
    },
    {
      id: "sponsorblok",
      name: "Exclusief sponsorblok",
      price: "€149",
      priceNote: "per editie",
      description:
        "Een opvallend blok met beeld, tekst en knop. Er is maar één sponsorblok per editie.",
      includes: ["Beeld", "Tekst", "Knop met link", "Maximaal 1 per editie"],
    },
    {
      id: "themaweek",
      name: "Themaweek-partner",
      price: "€299",
      priceNote: "per themaweek",
      description:
        "Sponsorblok in de nieuwsbrief, plus vermelding in het thema-artikel en op sociale media.",
      includes: [
        "Sponsorblok in de nieuwsbrief",
        "Vermelding in het thema-artikel",
        "Vermelding op sociale media",
      ],
    },
  ],
  packageTitle: "Pakket van 4 edities",
  packageBody:
    "Boek vier edities in één keer en krijg 15% korting op de totale prijs.",
  packageHighlight: "15% korting",
  conditionsTitle: "Voorwaarden",
  conditions: [
    "Elke sponsoring is duidelijk gelabeld als “Gesponsord”.",
    "Er is maximaal één exclusief sponsorblok per editie.",
    "We sturen geen aparte mailing naar de lijst voor één sponsor.",
  ],
  closingTitle: "Klaar om mee te doen?",
  closingDescription:
    "Stuur een korte mail met de formule die je wilt. We reageren zo snel mogelijk.",
  closingEmail: "info@hobbysalon.be",
} as const;
