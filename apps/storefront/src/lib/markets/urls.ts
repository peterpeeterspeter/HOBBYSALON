import { sanitizeInternalRedirect } from "@/lib/auth/safe-redirect";
import { MARKETS, isNlMarketEnabled, type MarketCode } from "./config";

const HOST_BOUND_PREFIXES = [
  "/cart",
  "/checkout",
  "/account",
  "/dashboard",
  "/beheer",
  "/login",
  "/register",
  "/auth",
  "/onboarding",
  "/api",
  "/profile",
  "/favorites",
] as const;

const QUERY_ALLOWLIST = new Set([
  "q",
  "plaats",
  "stad",
  "city",
  "country",
  "categorie",
  "category",
  "page",
  "sort",
  "type",
  "domain",
]);

export type MarketSwitchTarget = {
  code: MarketCode;
  label: string;
  href: string;
  current: boolean;
  hostBound: boolean;
};

function isHostBound(pathname: string): boolean {
  return HOST_BOUND_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Shared discovery stays. A detail without a regional counterpart falls back to its listing or home. */
export function publicMarketPath(pathname: string): string {
  if (pathname === "/") return "/";
  if (pathname === "/workshops" || pathname.startsWith("/workshops/")) return pathname;
  if (pathname.startsWith("/workshop/")) return "/workshops";
  if (pathname === "/creators" || pathname.startsWith("/creators/")) return pathname;
  if (pathname.startsWith("/creator/")) return "/creators";
  if (pathname === "/materials" || pathname.startsWith("/materials/")) return pathname;
  if (pathname.startsWith("/product/")) return "/materials";
  if (pathname === "/agenda" || pathname.startsWith("/agenda/")) return pathname;
  if (pathname.startsWith("/event/")) return "/agenda";
  if (pathname === "/zoeken") return "/zoeken";
  if (pathname === "/tools" || pathname.startsWith("/tools/")) return pathname;
  return "/";
}

function allowedSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const kept = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (QUERY_ALLOWLIST.has(key)) kept.append(key, value);
  }
  const text = kept.toString();
  return text ? `?${text}` : "";
}

/**
 * Links only. There is no automatic country redirect.
 * Returns an empty list when ENABLE_NL_MARKET is off so the UI stays hidden.
 */
export function marketSwitchTargets(input: {
  currentPath: string;
  currentMarket: MarketCode;
  env?: Record<string, string | undefined>;
}): MarketSwitchTarget[] {
  const env = input.env ?? process.env;
  if (!isNlMarketEnabled(env)) return [];

  const safe = sanitizeInternalRedirect(input.currentPath) ?? "/";
  const parsed = new URL(safe, MARKETS.BE.canonicalOrigin);
  const hostBound = isHostBound(parsed.pathname);
  const destination = hostBound ? "/" : publicMarketPath(parsed.pathname);
  const query = hostBound ? "" : allowedSearch(parsed.search);
  const ownHref = `${parsed.pathname}${allowedSearch(parsed.search)}`;

  return (["BE", "NL"] as const).map((code) => {
    const market = MARKETS[code];
    const current = code === input.currentMarket;
    if (current) {
      return {
        code,
        label: market.countryName,
        href: ownHref,
        current: true,
        hostBound: false,
      };
    }
    return {
      code,
      label: market.countryName,
      href: `${market.canonicalOrigin}${destination}${query}`,
      current: false,
      hostBound,
    };
  });
}
