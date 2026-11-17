"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_CHANGED, readConsent, sendPageView, syncAnalytics } from "@/lib/analytics/consent";
import { consumeConversionReceipt } from "@/lib/analytics/receipt";
import { countConsentPageview } from "@/lib/analytics/consent-counter";

/**
 * Root client island: initial and pathname-change views, never query/hash changes.
 *
 * PostHog pageviews are cookieless until a grant. The first-party tally records consent at arrival;
 * changing that choice is not another route visit.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const ready = () => { sendPageView(); consumeConversionReceipt(); };
    const sync = () => { syncAnalytics(ready); };
    // The existing denied bucket includes both refusal and no choice yet.
    const bucket = readConsent() === "granted" ? "granted" : "denied";
    countConsentPageview(pathname, bucket);
    sync();
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => window.removeEventListener(CONSENT_CHANGED, sync);
  }, [pathname]);
  return null;
}
