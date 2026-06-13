/**
 * Shared navigation config for Header and Footer.
 * Domains are injected at runtime from the platform DB.
 */

export const STATIC_LINKS = {
  main: [
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Agenda" },
    { href: "/materials", label: "Materialen" },
    { href: "/creators", label: "Creators" },
  ],
  inspiratie: [
    { href: "/tools", label: "Tools" },
    { href: "/crochet/artikels", label: "Artikelen" },
    { href: "/gratis-haakpatronen", label: "Patronen" },
  ],
  account: [
    { href: "/profile", label: "Profiel" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/register", label: "Registreer" },
    { href: "/login", label: "Inloggen" },
  ],
} as const;

export const FOOTER_SECTIONS = {
  ontdekken: [
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Evenementen" },
    { href: "/materials", label: "Materialen" },
    { href: "/creators", label: "Creators" },
    { href: "/gratis-haakpatronen", label: "Patronen" },
    { href: "/tools", label: "Tools" },
  ],
  meedoen: [
    { href: "/register", label: "Creator worden" },
    { href: "/register", label: "Workshop geven" },
    { href: "/register", label: "Verkopen" },
  ],
  info: [
    { href: "/landing", label: "Over ons" },
    { href: "/landing", label: "Contact" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Algemene voorwaarden" },
  ],
} as const;
