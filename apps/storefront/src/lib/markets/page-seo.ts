import type { Metadata } from "next";
import { MARKETS } from "./config";
import { isPrivatePath, isRegionalLandingPath } from "./publication-paths";
import type { MarketSeoDecision } from "./seo-policy";
import { absoluteUrl, buildPageMetadata, type BuildPageMetadataInput } from "../seo";

export const PRIVATE_PAGE_METADATA: Metadata = {
  robots: { index: false, follow: false },
  alternates: null,
};

/** Root / public-layout default, NOT a page publication decision.
 * NL must inherit noindex until a real regional page explicitly replaces robots.
 * Do not put a root canonical or hreflang here: these would cascade to children.
 */
export function marketDefaultRobots(decision: MarketSeoDecision): Metadata["robots"] {
  return { index: decision.marketCode === "BE" && decision.index, follow: true };
}

export function regionalHreflangLanguages(path: string): Record<string, string> {
  return {
    "nl-BE": absoluteUrl(path, MARKETS.BE.canonicalOrigin),
    "nl-NL": absoluteUrl(path, MARKETS.NL.canonicalOrigin),
    "x-default": absoluteUrl(path, MARKETS.BE.canonicalOrigin),
  };
}

/** Host publication only: never infer eligibility from visitor/entity/checkout country. */
export function buildMarketPageMetadata(
  input: BuildPageMetadataInput,
  decision: MarketSeoDecision
): Metadata {
  const privatePage = isPrivatePath(input.path);
  const regional = isRegionalLandingPath(input.path);
  const requestedRobots = typeof input.robots === "object" && input.robots !== null
    ? input.robots : undefined;
  const requestedNoindex = requestedRobots?.index === false ||
    (typeof input.robots === "string" && /\bnoindex\b/i.test(input.robots));
  const index = !privatePage && !requestedNoindex && decision.index &&
    (decision.marketCode === "BE" || regional);
  const metadata = buildPageMetadata({
    ...input,
    origin: decision.canonicalOrigin,
    locale: decision.ogLocale,
    robots: {
      ...(requestedRobots ?? {}),
      index,
      follow: privatePage ? false : decision.follow,
    },
    // Both targets are approved canonical publications; never invent entity pairs.
    languages: index && regional && decision.publishHreflang
      ? regionalHreflangLanguages(input.path) : undefined,
  });
  if (privatePage) metadata.alternates = null;
  return metadata;
}
