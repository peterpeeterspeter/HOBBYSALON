import {
  MARKETS,
  isNlMarketEnabled,
  ogLocaleFromLocale,
  type MarketCode,
} from "./config";
import type { MarketResolution } from "./resolve";

export type MarketSeoDecision = {
  index: boolean;
  publishHreflang: false;
  /** Never an unknown host. Falls back to the Belgian origin when untrusted. */
  canonicalOrigin: string;
  htmlLang: string;
  ogLocale: string;
  marketCode: MarketCode;
};

/**
 * Existing Belgian pages keep using seo.ts. This policy is for future market
 * wiring only. While ENABLE_NL_MARKET is off, NL never indexes and never
 * publishes hreflang. An untrusted host never becomes a canonical origin.
 */
export function marketSeoDecision(
  resolution: MarketResolution,
  env: Record<string, string | undefined> = process.env
): MarketSeoDecision {
  const nlEnabled = isNlMarketEnabled(env);
  const market = resolution.market;
  const isNl = market.marketCode === "NL";

  const index =
    nlEnabled &&
    resolution.trustedHost &&
    !resolution.preview &&
    market.indexing === "index" &&
    market.rollout === "live" &&
    !isNl;

  return {
    index,
    publishHreflang: false,
    canonicalOrigin: resolution.trustedHost
      ? market.canonicalOrigin
      : MARKETS.BE.canonicalOrigin,
    htmlLang: market.defaultLocale,
    ogLocale: ogLocaleFromLocale(market.defaultLocale),
    marketCode: market.marketCode,
  };
}
