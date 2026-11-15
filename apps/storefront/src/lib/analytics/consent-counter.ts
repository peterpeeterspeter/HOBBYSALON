"use client";

/** Counts route visits, not people; the consent bucket is captured at arrival. */

import type { ConsentBucket } from "./consent-bucket";
import { publicPage } from "./pageview";

const ENDPOINT = "/api/analytics/pageview";

// Suppress effect replays, but count A → B → A as three visits.
let lastPathname: string | undefined;

export function countConsentPageview(pathname: string, consent: ConsentBucket): void {
  if (typeof window === "undefined") return;
  const routeKey = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (lastPathname === routeKey) return;
  lastPathname = routeKey;
  const page = publicPage(routeKey);
  if (!page) return;

  try {
    const body = JSON.stringify({ path: page.path, consent });
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
