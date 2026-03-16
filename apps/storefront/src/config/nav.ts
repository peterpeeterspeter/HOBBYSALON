/**
 * Shared navigation config for Header and Footer.
 * Domains are injected at runtime from the platform DB.
 */

export const STATIC_LINKS = {
  main: [
    { href: "/materials", label: "Hobbymaterialen" },
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Agenda" },
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
  ontdek: [
    { href: "/", label: "Home" },
    { href: "/materials", label: "Hobbymaterialen" },
    { href: "/workshops", label: "Workshops" },
    { href: "/agenda", label: "Agenda" },
    { href: "/tools", label: "Tools" },
    { href: "/gratis-haakpatronen", label: "Patronen" },
    { href: "/favorites", label: "Favorieten" },
  ],
  info: [
    { href: "/landing", label: "Over Hobbysalon" },
    { href: "/register", label: "Account aanmaken" },
  ],
} as const;
