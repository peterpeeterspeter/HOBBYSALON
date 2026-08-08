/**
 * Shared navigation config for Header and Footer.
 * Domains are injected at runtime from the platform DB.
 *
 * Single source for account-zone links — do not duplicate these labels elsewhere.
 */

/** Logged-in account zone: hobby profile vs aanbod. */
export const ACCOUNT_NAV = {
  profile: { href: "/profile", label: "Mijn Hobbysalon" },
  /** Offer users only — use via helpers that check offer intent/creator. */
  aanbod: { href: "/dashboard", label: "Mijn aanbod" },
  /** Setup entry when offer intent exists but no creator profile yet. */
  aanbodSetup: { href: "/onboarding", label: "Mijn aanbod instellen" },
  /** Soft entry for hobbyists who have not started offer onboarding yet. */
  aanbodStart: { href: "/profile#rollen-upgraden", label: "Aanbod starten" },
  /** @deprecated Use aanbod — kept for gradual migration of imports */
  pro: { href: "/dashboard", label: "Mijn aanbod" },
  backToHobby: { href: "/profile", label: "Terug naar Hobbysalon" },
} as const;

export function resolveAanbodNav(input: {
  hasCreatorProfile: boolean;
  hasOfferIntent: boolean;
  /**
   * Approved merchant (or pending merchant with seller portal access).
   * Merchants can use /dashboard without a creator profile.
   */
  hasMerchantAccess?: boolean;
}): { href: string; label: string } {
  if (input.hasCreatorProfile || input.hasMerchantAccess) {
    return ACCOUNT_NAV.aanbod;
  }
  if (input.hasOfferIntent) {
    return ACCOUNT_NAV.aanbodSetup;
  }
  return ACCOUNT_NAV.aanbodStart;
}

export const STATIC_LINKS = {
  main: [
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Agenda" },
    { href: "/materials", label: "Materialen" },
    { href: "/creators", label: "Makersmarkt" },
  ],
  inspiratie: [
    { href: "/artikelen", label: "Artikelen & tutorials" },
    { href: "/patronen", label: "Patronen" },
    { href: "/tools", label: "Hobbytools" },
  ],
  account: [
    ACCOUNT_NAV.profile,
    ACCOUNT_NAV.aanbod,
    { href: "/register", label: "Registreer" },
    { href: "/login", label: "Inloggen" },
  ],
} as const;

export const FOOTER_SECTIONS = {
  ontdekken: [
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Evenementen" },
    { href: "/materials", label: "Materialen" },
    { href: "/creators", label: "Makersmarkt" },
    { href: "/patronen", label: "Patronen" },
    { href: "/tools", label: "Tools" },
  ],
  meedoen: [
    { href: "/voor-hobbyisten", label: "Iets moois maken" },
    { href: "/voor-contentmakers", label: "Content delen" },
    { href: "/voor-makers", label: "Maker worden" },
    { href: "/voor-workshopgevers", label: "Workshop geven" },
    { href: "/voor-winkels", label: "Verkopen" },
    { href: "/voor-organisatoren", label: "Event organiseren" },
    { href: "/prijzen", label: "Prijzen" },
  ],
  info: [
    { href: "/landing", label: "Over ons" },
    { href: "/landing", label: "Contact" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Algemene voorwaarden" },
  ],
  zakelijk: [
    { href: "/partners", label: "Zakelijk samenwerken" },
    { href: "/prijzen", label: "Prijzen en formules" },
  ],
} as const;
