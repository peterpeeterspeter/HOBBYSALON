"use client";

/**
 * Anonymous pageview beacon that runs regardless of consent.
 *
 * It carries no identifier and sets no cookie. Its only job is to record that
 * a route template was loaded, split by consent, so the report can state how
 * much traffic the consent gate hides from GA4. Denied visitors send nothing
 * to Google, so without this they simply do not exist in the numbers.
 */

import type { ConsentBucket } from "./consent-bucket";

const ENDPOINT = "/api/analytics/pageview";

/** One send per route per page load, even if the effect re-runs. */
const sent = new Set<string>();

export function countConsentPageview(pathname: string, consent: ConsentBucket): void {
  if (typeof window === "undefined") return;
  const key = `${pathname}:${consent}`;
  if (sent.has(key)) return;
  sent.add(key);

  try {
    const body = JSON.stringify({ path: pathname, consent });
    // sendBeacon survives the navigation that triggered it; fetch keepalive is
    // the fallback where a beacon is unavailable.
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: "text/plain;charset=UTF-8" })
      );
      if (ok) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // Counting is optional; never surface a failure to the visitor.
    });
  } catch {
    // Ignore. A counter must never break the page.
  }
}
