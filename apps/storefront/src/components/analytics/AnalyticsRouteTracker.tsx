"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_CHANGED, readConsent, sendPageView, syncAnalytics } from "@/lib/analytics/consent";
import { consumeConversionReceipt } from "@/lib/analytics/receipt";
import { countConsentPageview } from "@/lib/analytics/consent-counter";

/**
 * Root client island: initial and pathname-change views, never query/hash changes.
 *
 * Two counters run side by side. `sendPageView` is the Google one and only fires
 * for granted consent. The anonymous tally runs either way, so denied traffic
 * has a denominator instead of vanishing.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const ready = () => { sendPageView(); consumeConversionReceipt(); };
    const sync = () => { syncAnalytics(ready); tally(); };
    const tally = () => {
      const bucket = readConsent() === "granted" ? "granted" : "denied";
      countConsentPageview(pathname, bucket);
    };
    sync();
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => window.removeEventListener(CONSENT_CHANGED, sync);
  }, [pathname]);
  return null;
}
