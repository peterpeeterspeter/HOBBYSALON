/**
 * Shared navigation config for Header and Footer.
 * Domains are injected at runtime from the platform DB.
 */

export const STATIC_LINKS = {
  discover: [
    { href: "/tools", label: "Tools" },
    { href: "/materials", label: "Materialen" },
    { href: "/gratis-haakpatronen", label: "Gratis haakpatronen" },
    { href: "/agenda", label: "Agenda" },
    { href: "/workshops", label: "Workshops" },
    { href: "/creators", label: "Creators" },
  ],
  shop: [
    { href: "/cart", label: "Winkelwagen" },
    // Domains injected as { href: `/${slug}`, label: name }
  ],
  account: [
    { href: "/profile", label: "Profiel" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/login", label: "Inloggen" },
  ],
} as const;

export const FOOTER_SECTIONS = {
  ontdek: [
    { href: "/", label: "Home" },
    { href: "/gratis-haakpatronen", label: "Gratis haakpatronen" },
    { href: "/agenda", label: "Agenda" },
    { href: "/workshops", label: "Workshops" },
    { href: "/creators", label: "Creators" },
    { href: "/favorites", label: "Favorieten" },
  ],
  shop: [
    // Domains injected
  ],
  info: [
    { href: "/landing", label: "Over Hobbysalon" },
    { href: "/register", label: "Account aanmaken" },
  ],
} as const;
