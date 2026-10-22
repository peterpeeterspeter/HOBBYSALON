import {
  MARKETS,
  isNlMarketEnabled,
  ogLocaleFromLocale,
  type MarketCode,
} from "./config";
import type { MarketResolution } from "./resolve";

export type MarketSeoDecision = {
  index: boolean;
  follow: boolean;
  /** Reciprocal nl-BE / nl-NL only when NL is launched (flag + live + index). */
  publishHreflang: boolean;
  /** Never an unknown host. Falls back to the Belgian origin when untrusted. */
  canonicalOrigin: string;
  htmlLang: string;
  ogLocale: string;
  marketCode: MarketCode;
};

/** NL sitemap / hreflang / indexing only after an explicit config + flag launch. */
export function isNlSeoPublished(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (
    isNlMarketEnabled(env) &&
    MARKETS.NL.indexing === "index" &&
    MARKETS.NL.rollout === "live"
  );
}

/**
 * Belgian pages keep indexing while ENABLE_NL_MARKET is off.
 * NL never indexes or publishes hreflang until the flag is on outside
 * production and MarketConfig.NL is switched to live + index.
 * An untrusted host never becomes a canonical origin.
 */
export function marketSeoDecision(
  resolution: MarketResolution,
  env: Record<string, string | undefined> = process.env
): MarketSeoDecision {
  const market = resolution.market;
  const trusted = resolution.trustedHost && !resolution.preview;

  const beIndexes =
    trusted &&
    market.marketCode === "BE" &&
    market.indexing === "index" &&
    market.rollout === "live";

  const nlIndexes =
    trusted &&
    market.marketCode === "NL" &&
    isNlSeoPublished(env);

  const index = beIndexes || nlIndexes;
  const publishHreflang = isNlSeoPublished(env) && trusted;

  return {
    index,
    follow: true,
    publishHreflang,
    canonicalOrigin: resolution.trustedHost
      ? market.canonicalOrigin
      : MARKETS.BE.canonicalOrigin,
    htmlLang: market.defaultLocale,
    ogLocale: ogLocaleFromLocale(market.defaultLocale),
    marketCode: market.marketCode,
  };
}
