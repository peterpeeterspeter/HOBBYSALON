import { MARKETS } from "./config";
import { marketSeoDecision } from "./seo-policy";
import type { MarketResolution } from "./resolve";

/**
 * Public storefront origin for redirects, auth emails, and confirm links.
 * Trusted market host → that market's canonical origin; otherwise BE / env fallback.
 * Both .be and .nl keep sharing the same Supabase + Medusa backends.
 */
export function publicOriginFromResolution(
  resolution: MarketResolution,
  env: Record<string, string | undefined> = process.env
): string {
  const seo = marketSeoDecision(resolution, env);
  return stripTrailingSlash(seo.canonicalOrigin);
}

export function fallbackPublicOrigin(
  env: Record<string, string | undefined> = process.env
): string {
  return stripTrailingSlash(
    env.NEXT_PUBLIC_SITE_URL?.trim() || MARKETS.BE.canonicalOrigin
  );
}

export function authConfirmUrlForOrigin(origin: string): string {
  return new URL("/auth/confirm", stripTrailingSlash(origin)).toString();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}
