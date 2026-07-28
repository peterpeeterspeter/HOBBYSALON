/**
 * Canonical marketing copy for commercial plans.
 * Source of truth for public pricing strings on /voor-* and /partners.
 * Aligned with apps/storefront/scripts/seed-commercial-plans.sql.
 * Do not invent tiers that are missing from the seed (e.g. Workshop Tracked).
 */

export type MarketingPlanCard = {
  code: string;
  title: string;
  price: string;
  features: string[];
  featured?: boolean;
};

export const WORKSHOP_COMMISSION_NOTE =
  "Vaste jaarprijs — geen commissie per deelnemer.";

export const WORKSHOP_PLANS: MarketingPlanCard[] = [
  {
    code: "workshop_essential",
    title: "Workshop Essential",
    price: "€190 excl. btw / jaar",
    features: [
      "Hobbysalon-docentprofiel",
      "Tot 5 actieve workshops",
      "Aanvragen via Hobbysalon",
      "Foto's en praktische info",
      "Categorieplaatsing",
      "Basiszichtbaarheid",
      "Geen commissie per deelnemer",
    ],
  },
  {
    code: "workshop_premium",
    title: "Workshop Premium",
    price: "€690 excl. btw / jaar",
    featured: true,
    features: [
      "Alles van Essential",
      "Onbeperkte actieve workshops",
      "Externe boekingslink tonen",
      "Hogere ranking",
      "Uitgelichte rotatie",
      "Video toevoegen",
      "Extra promotiekansen",
      "Premium badge",
      "Geen commissie per deelnemer",
    ],
  },
];

export const WORKSHOP_PLAN_FAQ = {
  externalBooking:
    "Ja, binnen Workshop Premium. Bij Essential werken we met de aanvraagflow via Hobbysalon.",
  bookingSystem:
    "Nee. Deelnemers sturen een aanvraag via Hobbysalon. Jij regelt daarna zelf de inschrijving (mail, eigen website of betaling ter plaatse). Met Premium kun je een externe boekingslink tonen.",
};

export const SUPPLIER_COMMISSION_NOTE =
  "Op materialen geldt 10% commissie. Verzendkosten en afrekenkosten worden apart verwerkt.";

export const SUPPLIER_PLANS: MarketingPlanCard[] = [
  {
    code: "supplier_basic",
    title: "Winkel Basis",
    price: "€0 / jaar",
    features: [
      "Geen vaste abonnementskost",
      "10% commissie per verkoop",
      "Winkelprofiel",
      "Producten verkopen via Hobbysalon checkout",
      "Verzendkosten apart",
      "Afrekenkosten apart",
      "Basis categorieplaatsing",
    ],
  },
  {
    code: "supplier_premium",
    title: "Winkel Premium",
    price: "€490 excl. btw / jaar",
    featured: true,
    features: [
      "10% commissie per verkoop",
      "Meer productzichtbaarheid",
      "Uitgelichte winkel",
      "Externe links toegestaan waar van toepassing",
      "Promotiekansen",
      "Analytics",
    ],
  },
];

export const ORGANIZER_PLANS: MarketingPlanCard[] = [
  {
    code: "organizer_event_basic",
    title: "Event Basis",
    price: "vanaf €49 excl. btw / event",
    features: [
      "Eventpagina",
      "Basis agenda-vermelding",
      "Locatie, datum en thema's",
      "Aanvraagflow via Hobbysalon",
    ],
  },
  {
    code: "organizer_event_premium",
    title: "Event Premium",
    price: "vanaf €249 excl. btw / event",
    featured: true,
    features: [
      "Alles van Event Basis",
      "Uitgelichte eventplaatsing",
      "Hogere ranking",
      "Externe ticketlink tonen",
      "Premium eventbadge",
    ],
  },
];

export const ORGANIZER_PLAN_FAQ = {
  tickets:
    "Nog niet als standaard. Interne ticketing kan later volgen. Met Event Premium kun je een externe ticketlink tonen.",
  standhouders:
    "Ja. Bezoekers en geïnteresseerde standhouders kunnen via Hobbysalon een aanvraag sturen.",
};

/** Homepage campaign CTA: agenda feels “alive” enough to lead with events. */
export const HOME_EVENT_CAMPAIGN_MIN_EVENTS = 4;
export const HOME_EVENT_CAMPAIGN_MIN_REGIONS = 2;

export function isHomeEventCampaignReady(events: {
  city?: string | null;
  country_code?: string | null;
}[]): boolean {
  if (events.length < HOME_EVENT_CAMPAIGN_MIN_EVENTS) return false;
  const regions = new Set(
    events
      .map((event) => {
        const city = event.city?.trim().toLowerCase();
        const country = event.country_code?.trim().toUpperCase();
        if (city) return `city:${city}`;
        if (country) return `country:${country}`;
        return null;
      })
      .filter((value): value is string => Boolean(value))
  );
  return regions.size >= HOME_EVENT_CAMPAIGN_MIN_REGIONS;
}
