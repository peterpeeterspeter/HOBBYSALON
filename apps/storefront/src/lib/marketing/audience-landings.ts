/**
 * Page configs for the voor-* audience pages. Facts and prices come from
 * the page copy in public-pricing.ts, so a price lives in one place.
 */
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { AudienceLandingConfig } from "@/components/marketing/audience-landing";
import {
  CONTENT_PAGE,
  MAKERS_PAGE,
  ORGANIZER_PAGE,
  SUPPLIER_PAGE,
  WORKSHOP_PAGE,
} from "@/lib/pricing/public-pricing";

export const MAKER_LANDING: AudienceLandingConfig = {
  eyebrow: "Hobbysalon voor makers",
  headline: ["Verkoop je zelfgemaakte werk.", "Zonder commissie."],
  subheadline: MAKERS_PAGE.heroSubheadline,
  cta: MAKERS_PAGE.primaryCta,
  heroImage: LANDING_IMAGES.domainPottery,
  proof: MAKERS_PAGE.heroProof,
  steps: MAKERS_PAGE.steps,
  showcase: {
    title: MAKERS_PAGE.adTypes.title,
    items: [
      { ...MAKERS_PAGE.adTypes.items[0], image: LANDING_IMAGES.craftsGrid, alt: "Zelfgemaakte creaties op tafel" },
      { ...MAKERS_PAGE.adTypes.items[1], image: LANDING_IMAGES.domainSewing, alt: "Stof en naaimateriaal uit eigen voorraad" },
    ],
    note: MAKERS_PAGE.adTypes.note,
  },
  offer: {
    title: MAKERS_PAGE.offer.title,
    free: { ...MAKERS_PAGE.offer.free, giftIndex: 2 },
    paid: { ...MAKERS_PAGE.offer.paid, link: MAKERS_PAGE.offer.pricesLink },
    highlight: MAKERS_PAGE.offer.commission,
  },
  why: {
    title: MAKERS_PAGE.why.title,
    image: LANDING_IMAGES.community,
    alt: "Bezoekers en makers op een makersmarkt",
    items: MAKERS_PAGE.why.items,
  },
  faq: MAKERS_PAGE.faq,
  closing: MAKERS_PAGE.closing,
};

export const WORKSHOP_LANDING: AudienceLandingConfig = {
  eyebrow: "Hobbysalon voor workshopgevers",
  headline: ["Zet je workshop", "op de kaart"],
  subheadline: WORKSHOP_PAGE.heroSubheadline,
  cta: { label: "Plaats je workshop", href: WORKSHOP_PAGE.primaryCta.href },
  heroImage: LANDING_IMAGES.workshop,
  proof: ["3 workshops gratis tot 1 december", "Geen commissie per deelnemer", "Geen abonnement"],
  steps: {
    title: "Zo werkt het",
    items: [
      {
        title: "Maak je profiel",
        body: "Vertel wie je bent en welke technieken je aanleert.",
      },
      {
        title: "Plaats je workshop",
        body: "Foto's, beschrijving, datum, locatie en prijs. Tot drie sessiedata in één vermelding.",
      },
      {
        title: "Deelnemers schrijven zich bij jou in",
        body: "Via je eigen contactgegevens of je eigen inschrijfsysteem. Wat je vraagt, houd je.",
      },
    ],
  },
  checklist: {
    title: WORKSHOP_PAGE.listing.title,
    items: WORKSHOP_PAGE.listing.items,
    image: LANDING_IMAGES.placeholderWorkshop,
    alt: "Materialen klaar voor een workshop",
  },
  warning: WORKSHOP_PAGE.publishNote,
  offer: {
    title: "Wat kost het?",
    free: {
      label: "Lanceraanbod",
      title: "3 workshops gratis tot 1 december 2026",
      items: ["Die drie blijven ook daarna gratis", "Tot drie sessiedata per vermelding"],
    },
    paid: {
      label: "Daarna",
      title: "€9,99 per extra vermelding",
      items: [
        "Je vermelding blijft 2 maanden zichtbaar",
        "Geen abonnement: geef je één workshop per jaar, dan betaal je één keer",
      ],
      link: WORKSHOP_PAGE.secondaryCta,
    },
    highlight: "Geen commissie per deelnemer. Wat je vraagt, houd je.",
  },
  why: {
    title: WORKSHOP_PAGE.reasons.title,
    image: LANDING_IMAGES.domainCrochet,
    alt: "Haakwerk tijdens een workshop",
    items: WORKSHOP_PAGE.reasons.items,
  },
  faq: [
    {
      question: "Hoe schrijven deelnemers zich in?",
      answer: "Rechtstreeks bij jou: via je eigen contactgegevens of een link naar je eigen inschrijfsysteem.",
    },
    {
      question: "Rekent Hobbysalon commissie?",
      answer: "Nee. Er is geen commissie per deelnemer. Je betaalt alleen per vermelding.",
    },
    {
      question: "Wat kost het na 1 december?",
      answer: "Je 3 gratis workshops blijven gratis. Een extra vermelding kost €9,99 en blijft 2 maanden zichtbaar.",
    },
    {
      question: "Kan ik meerdere data aanbieden?",
      answer: "Ja. Je kunt tot drie sessiedata in dezelfde vermelding zetten.",
    },
    {
      question: "Kan ik de data later nog aanpassen?",
      answer:
        "Nee. De sessiedata worden vastgelegd op het moment van publiceren. Bij een fout maak je de vermelding opnieuw aan. Controleer datums, tijden en locatie dus vooraf.",
    },
    {
      question: "Zien deelnemers welke materialen ze nodig hebben?",
      answer: "Ja. De materialen zijn gekoppeld aan de catalogus, dus deelnemers zien meteen wat ze nodig hebben en waar het te koop is.",
    },
  ],
  closing: {
    title: "Plaats je eerste workshop",
    body: "Tot 1 december plaats je tot 3 workshops gratis, en die blijven gratis.",
  },
};

export const ORGANIZER_LANDING: AudienceLandingConfig = {
  eyebrow: "Hobbysalon voor organisatoren",
  headline: ["Zet je evenement", "gratis in de kalender"],
  subheadline: ORGANIZER_PAGE.heroSubheadline,
  cta: ORGANIZER_PAGE.primaryCta,
  heroImage: LANDING_IMAGES.community,
  proof: ["Gratis kalendervermelding", "Voor hobbybeurzen en makersmarkten", "Later upgraden kan altijd"],
  steps: {
    title: "Zo werkt het",
    items: [
      { title: "Maak je profiel", body: "Als organisator van een hobbybeurs of makersmarkt." },
      { title: "Voeg je evenement toe", body: "Naam, datum, openingsuren, locatie en een link naar je eigen site." },
      { title: "Bezoekers vinden je in de agenda", body: "Mensen die iets creatiefs zoeken om te doen, zien je evenement meteen staan." },
    ],
  },
  features: {
    title: ORGANIZER_PAGE.exhibitors.title,
    body: ORGANIZER_PAGE.exhibitors.body,
    items: [
      { title: "Workshopgevers", body: "Ze geven aan dat ze op jouw evenement staan, met hun workshop erbij." },
      { title: "Materialenwinkels", body: "Bezoekers zien vooraf welke winkels er komen, en wat ze kunnen kopen." },
    ],
  },
  offer: {
    title: "Wat kost het?",
    free: {
      label: "Gratis",
      title: "Een vermelding in de kalender",
      items: ORGANIZER_PAGE.freeListing.items,
      note: ORGANIZER_PAGE.freeListing.note,
    },
    paid: {
      label: "Eventpagina",
      title: "Je eigen pagina met het volledige verhaal",
      items: [
        ...ORGANIZER_PAGE.pricing.items.map((item) => `${item.label}: ${item.value.charAt(0).toLowerCase()}${item.value.slice(1)}`),
        "Programma, standhouders, workshops, foto's, praktische info en updates voor bezoekers",
      ],
      note: ORGANIZER_PAGE.pricing.note,
    },
    highlight: ORGANIZER_PAGE.doubt.body,
  },
  why: {
    title: ORGANIZER_PAGE.audience.title,
    image: LANDING_IMAGES.placeholderEvent,
    alt: "Bezoekers op een hobbybeurs",
    items: [
      { title: "Bezoekers van de hobbybeurzen", body: ORGANIZER_PAGE.audience.body },
      { title: "Je eventpagina groeit mee", body: "Naarmate standhouders zich aansluiten, vult je pagina zich. Vaak is dat net de reden waarom iemand besluit te komen." },
    ],
  },
  faq: [
    { question: "Wat kost een vermelding in de kalender?", answer: "Niets. Elke hobbybeurs en makersmarkt kan gratis in de kalender." },
    {
      question: "Wat is het verschil met een eventpagina?",
      answer:
        "Een vermelding toont naam, datum, locatie, type en een link. Een eventpagina geeft ruimte voor programma, standhouders, workshops, foto's, praktische info en updates.",
    },
    {
      question: "Wat kost een eventpagina?",
      answer: "Tijdens de pilot vanaf €50 per maand voor een hobbybeurs, of vanaf €69 per event voor een makersmarkt.",
    },
    {
      question: "Kunnen mijn standhouders zich aansluiten?",
      answer: "Ja. Workshopgevers en materialenwinkels op Hobbysalon kunnen aangeven dat ze op jouw evenement staan.",
    },
    { question: "Kan ik later nog upgraden?", answer: "Ja. Begin gratis in de kalender en kies later een eventpagina." },
  ],
  closing: {
    title: "Zet je evenement in de kalender",
    body: "Gratis, zonder verplichting. Upgraden kan later altijd.",
  },
};

export const SUPPLIER_LANDING: AudienceLandingConfig = {
  eyebrow: "Hobbysalon voor winkels",
  headline: ["Verkoop je hobbymaterialen", "waar het project begint"],
  subheadline: SUPPLIER_PAGE.heroSubheadline,
  cta: SUPPLIER_PAGE.primaryCta,
  heroImage: LANDING_IMAGES.domainCardMaking,
  proof: ["€0 vaste kosten", "10% commissie alleen bij verkoop", "Geen minimumduur"],
  steps: {
    title: "Zo werkt het",
    items: [
      { title: "Meld je winkel aan", body: "Je winkelprofiel met je verhaal en assortiment, en je locatie als je een fysieke winkel hebt." },
      { title: "Breng je assortiment binnen", body: SUPPLIER_PAGE.onboarding.body },
      { title: "Verkoop en verwerk je orders", body: "Je klant rekent af op Hobbysalon. Jij verwerkt en volgt op vanuit je eigen dashboard." },
    ],
  },
  features: { title: SUPPLIER_PAGE.features.title, items: SUPPLIER_PAGE.features.items },
  offer: {
    title: "Wat kost het?",
    free: {
      label: "Vaste kosten",
      title: "€0 per maand",
      items: ["Geen instapkosten", "Geen listinglimiet", "Geen minimumduur en geen opzegtermijn"],
    },
    paid: {
      label: "Bij verkoop",
      title: SUPPLIER_PAGE.pricingHighlight.subtitle,
      // The €0 part is already in the left card.
      items: [
        SUPPLIER_PAGE.pricingHighlight.body.replace(/^€0 vaste kosten\.\s*/, ""),
        SUPPLIER_PAGE.pricingHighlight.example,
      ],
      note: SUPPLIER_PAGE.pricingHighlight.paymentNote,
      link: SUPPLIER_PAGE.secondaryCta,
    },
    highlight: "Verkoop je niets, dan betaal je niets.",
  },
  why: {
    title: SUPPLIER_PAGE.connected.title,
    image: LANDING_IMAGES.domainDiy,
    alt: "Penselen en materialen klaar voor een project",
    items: [
      { title: "Kopers met een project in gedachten", body: SUPPLIER_PAGE.connected.body },
      { title: SUPPLIER_PAGE.channels.title, body: SUPPLIER_PAGE.channels.body },
      { title: SUPPLIER_PAGE.comingSoon.title, body: SUPPLIER_PAGE.comingSoon.body },
    ],
  },
  faq: [
    { question: "Zijn er vaste kosten?", answer: "Nee. In de basisformule betaal je €0 per maand, zonder instapkosten of minimumduur." },
    { question: "Hoe hoog is de commissie?", answer: "10% op de totale verkoopprijs, alleen wanneer er echt verkocht wordt." },
    { question: "Moet ik mijn catalogus overtypen?", answer: SUPPLIER_PAGE.onboarding.body },
    {
      question: "Ik heb geen webshop. Kan ik toch verkopen?",
      answer: "Ja. Dan is Hobbysalon je online verkoopkanaal, zonder dat je zelf iets hoeft te bouwen of te onderhouden.",
    },
    { question: "Kan ik op elk moment stoppen?", answer: "Ja. Er is geen minimumduur en geen opzegtermijn." },
  ],
  closing: SUPPLIER_PAGE.closing,
};

export const CONTENT_LANDING: AudienceLandingConfig = {
  eyebrow: "Hobbysalon voor contentmakers",
  headline: ["Deel je kennis met lezers", "die er echt iets mee doen"],
  subheadline: CONTENT_PAGE.heroSubheadline,
  cta: CONTENT_PAGE.primaryCta,
  heroImage: LANDING_IMAGES.domainScrapbooking,
  proof: ["Gratis publiceren", "Onder je eigen naam", "Materialen automatisch gekoppeld"],
  steps: {
    title: "Zo werkt het",
    items: [
      { title: "Maak je profiel", body: "Je werk verschijnt onder je eigen naam, met een overzicht waar lezers je kunnen volgen." },
      { title: "Publiceer je tutorial of patroon", body: "Stap voor stap uitleg met foto's, haak- en naaipatronen, projecten en materiaalreviews." },
      { title: "Hobbysalon koppelt de materialen", body: "Je lezer ziet meteen waar het garen, papier of gereedschap te koop is." },
    ],
  },
  checklist: {
    title: CONTENT_PAGE.materials.title,
    items: [
      "Je beschrijft alleen je project",
      "Hobbysalon herkent de materialen in je tutorial",
      "Ze worden gekoppeld aan passende producten uit de catalogus",
    ],
    note: CONTENT_PAGE.materials.note,
    image: LANDING_IMAGES.craftsGrid,
    alt: "Materialen voor een project op tafel",
  },
  offer: {
    title: CONTENT_PAGE.pricing.title,
    free: {
      label: "Gratis",
      title: "Niets, en dat blijft zo",
      items: ["Publiceren", "Je profiel", "De materiaalkoppeling"],
    },
    paid: {
      label: "Binnenkort",
      title: "Verkopen en verdienen",
      items: [CONTENT_PAGE.comingSoon.body],
      note: CONTENT_PAGE.comingSoon.note,
    },
  },
  why: {
    title: CONTENT_PAGE.why.title,
    image: LANDING_IMAGES.domainKnitting,
    alt: "Breiwerk met een patroon",
    items: CONTENT_PAGE.why.items,
  },
  faq: [
    { question: "Kost publiceren iets?", answer: "Nee. Publiceren, je profiel en de materiaalkoppeling zijn gratis en blijven dat." },
    { question: "Onder welke naam verschijnt mijn werk?", answer: "Onder je eigen naam en profiel, met een overzicht van al je werk." },
    {
      question: "Hoe werkt de materiaalkoppeling?",
      answer: "Hobbysalon herkent de materialen in je tutorial en koppelt ze aan passende producten. Jij hoeft daar niets voor te doen.",
    },
    {
      question: "Kan ik er iets aan verdienen?",
      answer: "Binnenkort. Verkoop van digitale patronen en een affiliateprogramma zijn in ontwikkeling. De voorwaarden maken we bekend zodra het live gaat.",
    },
    { question: "Blijft mijn content vindbaar?", answer: "Ja. Wat je publiceert blijft vindbaar, ook over een jaar." },
  ],
  closing: {
    title: "Publiceer je eerste tutorial",
    body: "Gratis, onder je eigen naam, voor lezers die gericht zoeken naar wat jij uitlegt.",
  },
};
