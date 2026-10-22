import {
  MARKETS,
  isMarketCode,
  isNlMarketEnabled,
  type MarketCode,
  type MarketConfig,
} from "./config";

export type MarketResolution = {
  market: MarketConfig;
  /** True only when the host is an allowlisted market host that may own a canonical. */
  trustedHost: boolean;
  preview: boolean;
  /** Residence never selects the site market; surfaced so callers can ignore it. */
  ignoredResidenceCountry: string | null;
};

export type HostHeaderInput = {
  host: string | null;
  /** Accepted so callers can pass it through. It is never used. */
  forwardedHost?: string | null;
  previewMarket?: string | null;
  previewHostAllowlist?: readonly string[];
  residenceCountryCode?: string | null;
  env?: Record<string, string | undefined>;
};

function hostnameWithoutPort(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.includes(",") || trimmed.includes("/") || /\s/.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end <= 1) return null;
    return trimmed.slice(0, end + 1);
  }
  const colon = trimmed.lastIndexOf(":");
  if (colon === -1) return trimmed;
  const port = trimmed.slice(colon + 1);
  if (!/^\d+$/.test(port)) return null;
  return trimmed.slice(0, colon);
}

export function singleHost(value: string | null | undefined): string | null {
  if (!value) return null;
  return hostnameWithoutPort(value);
}

function marketForHost(host: string): MarketConfig | null {
  for (const market of Object.values(MARKETS)) {
    if (market.hosts.includes(host)) return market;
  }
  return null;
}

function beFallback(
  residence: string | null,
  preview: boolean
): MarketResolution {
  return {
    market: MARKETS.BE,
    trustedHost: false,
    preview,
    ignoredResidenceCountry: residence,
  };
}

/**
 * Pure host → market mapping. No module state.
 * ENABLE_NL_MARKET off: an NL host falls back to BE and is not trusted.
 * x-forwarded-host is ignored. Residence never selects the site market.
 */
export function resolveMarketFromHeaders(input: HostHeaderInput): MarketResolution {
  const env = input.env ?? process.env;
  const residence = input.residenceCountryCode?.trim() || null;
  const host = singleHost(input.host);
  const allowlist = new Set(
    (input.previewHostAllowlist ?? []).map((item) => item.trim().toLowerCase())
  );
  const nlEnabled = isNlMarketEnabled(env);

  if (host) {
    const known = marketForHost(host);
    if (known) {
      if (known.marketCode === "NL" && !nlEnabled) {
        return beFallback(residence, true);
      }
      return {
        market: known,
        trustedHost: true,
        preview: false,
        ignoredResidenceCountry: residence,
      };
    }
    if (allowlist.has(host)) {
      const requested = (input.previewMarket ?? "BE").trim().toUpperCase();
      let code: MarketCode = isMarketCode(requested) ? requested : "BE";
      if (code === "NL" && !nlEnabled) code = "BE";
      return {
        market: MARKETS[code],
        trustedHost: false,
        preview: true,
        ignoredResidenceCountry: residence,
      };
    }
  }

  return beFallback(residence, true);
}
