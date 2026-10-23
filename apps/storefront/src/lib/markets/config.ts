export const MARKET_CODES = ["BE", "NL"] as const;

export type MarketCode = (typeof MARKET_CODES)[number];

/**
 * Country and language stay separate. A market can later carry more than one
 * locale (for example fr-BE on BE). fr-FR and de-DE are separate marketCodes.
 */
export type MarketConfig = {
  marketCode: MarketCode;
  countryName: string;
  currency: "EUR";
  hosts: readonly string[];
  canonicalOrigin: string;
  defaultLocale: string;
  supportedLocales: readonly string[];
  indexing: "index" | "noindex";
  rollout: "live" | "preparing";
};

export const MARKETS: Record<MarketCode, MarketConfig> = {
  BE: {
    marketCode: "BE",
    countryName: "België",
    currency: "EUR",
    hosts: ["hobbysalon.be", "www.hobbysalon.be"],
    canonicalOrigin: "https://www.hobbysalon.be",
    defaultLocale: "nl-BE",
    supportedLocales: ["nl-BE"],
    indexing: "index",
    rollout: "live",
  },
  NL: {
    marketCode: "NL",
    countryName: "Nederland",
    currency: "EUR",
    hosts: ["hobbysalon.nl", "www.hobbysalon.nl"],
    canonicalOrigin: "https://hobbysalon.nl",
    defaultLocale: "nl-NL",
    supportedLocales: ["nl-NL"],
    indexing: "noindex",
    rollout: "preparing",
  },
};

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"] as const;

export function isMarketCode(value: string): value is MarketCode {
  return (MARKET_CODES as readonly string[]).includes(value);
}

export function ogLocaleFromLocale(locale: string): string {
  return locale.replace("-", "_");
}

/**
 * ENABLE_NL_MARKET gates the NL market switch and host resolution.
 * Only the exact value "true" turns it on.
 * In Vercel production it stays off unless ALLOW_NL_MARKET_IN_PRODUCTION is
 * also exactly "true" (separate, explicit launch approval). Indexing still
 * requires MarketConfig.NL rollout=live and indexing=index.
 */
export function isNlMarketEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.ENABLE_NL_MARKET !== "true") return false;
  if (env.VERCEL_ENV === "production") {
    return env.ALLOW_NL_MARKET_IN_PRODUCTION === "true";
  }
  return true;
}

export function previewHostAllowlist(
  env: Record<string, string | undefined> = process.env
): string[] {
  const configured = (env.MARKET_PREVIEW_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...LOCAL_HOSTS, ...configured];
}
