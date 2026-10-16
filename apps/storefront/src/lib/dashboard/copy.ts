/**
 * Single source of truth for dashboard wording. One name per thing, one label
 * per action. Do not introduce synonyms in pages (no "plaatsingen",
 * "creaties", "maker shop", "creator-profiel" side by side).
 */
export const DASHBOARD_COPY = {
  areaName: "Mijn aanbod",
  nav: {
    today: "Vandaag",
    offer: "Mijn aanbod",
    page: "Mijn pagina",
    shop: "Winkel",
    settings: "Instellingen",
    admin: "Beheer",
  },
  things: {
    creation: "creatie",
    creations: "Creaties",
    workshop: "workshop",
    workshops: "Workshops",
    event: "event",
    events: "Events",
    page: "maker-pagina",
    requests: "Aanvragen",
  },
  actions: {
    add: "Toevoegen",
    save: "Opslaan",
    edit: "Bewerken",
    view: "Bekijken",
    reply: "Antwoorden",
    delete: "Verwijderen",
    markHandled: "Behandeld",
    back: "Terug",
  },
  status: {
    visible: "Zichtbaar",
    draft: "Concept",
    review: "Wacht op goedkeuring",
    payment: "Wacht op betaling",
    expired: "Verlopen",
  },
  confirmDelete: (what: string) =>
    `Weet je zeker dat je ${what} wilt verwijderen? Dit kan je niet ongedaan maken.`,
} as const;

export type OfferStatus = keyof typeof DASHBOARD_COPY.status;
