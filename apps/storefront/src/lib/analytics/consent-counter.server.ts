import "server-only";
import { readConsentBucket, type ConsentBucket } from "./consent-bucket";

/**
 * Anonymous consented/denied pageview counts for the routes GA4 cannot fully see.
 *
 * GA4 drops denied visitors entirely and the reporting API has no consent
 * dimension, so a GA4-only report cannot say how much traffic is missing. This
 * writes one increment per pageview into an aggregate table with no visitor
 * identifiers at all.
 */

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, string>
  ) => PromiseLike<{ error: unknown }>;
};

const ALLOWED_HOSTS = new Set(["www.hobbysalon.be", "hobbysalon.nl"]);

/** Route templates only. A dynamic slug can carry a person's name. */
const STATIC_ROUTES = new Set([
  "/", "/landing", "/workshops", "/agenda", "/creators", "/artikelen",
  "/patronen", "/gratis-haakpatronen", "/materials", "/tools", "/zoeken",
  "/cart", "/checkout", "/checkout/success", "/nieuwsbrief", "/enquete",
  "/over-ons", "/partners", "/prijzen", "/privacy", "/adverteren",
  "/voor-hobbyisten", "/voor-makers", "/voor-workshopgevers", "/voor-winkels",
  "/voor-contentmakers", "/voor-organisatoren",
]);

const DETAIL_ROUTES = new Set([
  "workshop", "event", "agenda", "creator", "artikel", "project", "product",
  "tools", "nieuwsbrief",
]);

const DOMAINS = new Set([
  "crochet", "knitting", "card-making", "sewing", "jewelry", "scrapbooking",
  "painting", "pottery", "diy",
]);

/** Same fail-closed shape as the client allowlist: unknown routes return null. */
export function counterRoute(rawPath: string): string | null {
  let path = rawPath.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  if (path === "") path = "/";
  if (STATIC_ROUTES.has(path)) return path;

  const parts = path.split("/").slice(1);
  if (
    parts.length === 2 &&
    DETAIL_ROUTES.has(parts[0]) &&
    /^[a-z0-9][a-z0-9-]{0,159}$/.test(parts[1])
  ) {
    // Redact the slug. The table never learns which article or creator.
    return `/${parts[0]}/detail`;
  }
  if (DOMAINS.has(parts[0]) && parts.length <= 2) return `/${parts[0]}`;
  return null;
}

export function counterHost(rawHost: string): string | null {
  const host = rawHost.split(":", 1)[0].toLowerCase().replace(/^www\.hobbysalon\.nl$/, "hobbysalon.nl");
  return ALLOWED_HOSTS.has(host) ? host : null;
}

export type CountPageviewInput = {
  path: string;
  host: string;
  consent: ConsentBucket;
  day?: string;
};

/**
 * Fire-and-forget by design. A failed count must never break a page render,
 * so this swallows every error and returns whether the write landed.
 */
export async function countPageview(
  client: RpcClient,
  input: CountPageviewInput
): Promise<boolean> {
  const route = counterRoute(input.path);
  const host = counterHost(input.host);
  if (!route || !host) return false;

  const day = input.day ?? new Date().toISOString().slice(0, 10);
  try {
    const { error } = await client.rpc("increment_pageview", {
      p_day: day,
      p_host: host,
      p_route: route,
      p_consent: input.consent,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * The ratio the report needs. Denied visitors are counted here and nowhere
 * else, so this is the only honest denominator available.
 */
export function consentRatio(rows: readonly { consent: string; views: number }[]): {
  granted: number;
  denied: number;
  total: number;
  grantedShare: number | null;
} {
  let granted = 0;
  let denied = 0;
  for (const row of rows) {
    if (row.consent === "granted") granted += row.views;
    else if (row.consent === "denied") denied += row.views;
  }
  const total = granted + denied;
  return {
    granted,
    denied,
    total,
    // null, not 0: a day with no data is unknown, not "0% consented".
    grantedShare: total === 0 ? null : granted / total,
  };
}

export { readConsentBucket };
