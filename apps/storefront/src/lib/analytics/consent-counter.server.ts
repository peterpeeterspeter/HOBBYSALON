import "server-only";
import { readConsentBucket, type ConsentBucket } from "./consent-bucket";
import { publicPage, PUBLIC_HOBBY_DOMAINS } from "./pageview";

/**
 * Aggregate route-visit attempts, split by the consent state at arrival.
 * The denied bucket includes pending choices. These are not unique visitors,
 * an explicit-refusal rate, or an exact denominator for missing GA4 users.
 */

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, string>
  ) => PromiseLike<{ error: unknown }>;
};

const ALLOWED_HOSTS = new Set(["www.hobbysalon.be", "hobbysalon.nl"]);

/** Share the client's fail-closed validation; retain the existing domain roll-up. */
export function counterRoute(rawPath: string): string | null {
  const page = publicPage(rawPath.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/");
  if (!page) return null;
  const domain = page.path.split("/")[1];
  return PUBLIC_HOBBY_DOMAINS.has(domain) ? `/${domain}` : page.path;
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

/** Share of stored route views that arrived with consent, not a visitor acceptance rate. */
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
