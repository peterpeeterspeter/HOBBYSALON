/**
 * Shared navigation config for Header and Footer.
 * Domains are injected at runtime from the platform DB.
 */

/** Logged-in account zone: hobby profile vs aanbiedersdashboard. */
export const ACCOUNT_NAV = {
  profile: { href: "/profile", label: "Mijn profiel" },
  pro: { href: "/dashboard", label: "Aanbiedersdashboard" },
  backToHobby: { href: "/profile", label: "Terug naar Hobbysalon" },
} as const;

export const STATIC_LINKS = {
  main: [
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Agenda" },
    { href: "/materials", label: "Materialen" },
    { href: "/creators", label: "Makers" },
  ],
  inspiratie: [
    { href: "/tools", label: "Tools" },
    { href: "/artikelen", label: "Artikelen" },
    { href: "/patronen", label: "Patronen" },
  ],
  account: [
    ACCOUNT_NAV.profile,
    ACCOUNT_NAV.pro,
    { href: "/register", label: "Registreer" },
    { href: "/login", label: "Inloggen" },
  ],
} as const;

export const FOOTER_SECTIONS = {
  ontdekken: [
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Evenementen" },
    { href: "/materials", label: "Materialen" },
    { href: "/creators", label: "Makers" },
    { href: "/patronen", label: "Patronen" },
    { href: "/tools", label: "Tools" },
  ],
  meedoen: [
    { href: "/voor-hobbyisten", label: "Iets moois maken" },
    { href: "/voor-makers", label: "Maker worden" },
    { href: "/voor-workshopgevers", label: "Workshop geven" },
    { href: "/voor-winkels", label: "Verkopen" },
    { href: "/voor-organisatoren", label: "Event organiseren" },
  ],
  info: [
    { href: "/landing", label: "Over ons" },
    { href: "/landing", label: "Contact" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Algemene voorwaarden" },
  ],
  zakelijk: [{ href: "/partners", label: "Zakelijk samenwerken" }],
} as const;
