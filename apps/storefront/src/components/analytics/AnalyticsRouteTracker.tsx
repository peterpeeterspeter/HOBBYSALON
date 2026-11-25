"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_CHANGED, readConsent, sendPageView, syncAnalytics } from "@/lib/analytics/consent";
import { consumeConversionReceipt } from "@/lib/analytics/receipt";
import { countConsentPageview } from "@/lib/analytics/consent-counter";
import { loadGoogleTag, sendGooglePageView, updateGoogleConsent } from "@/lib/analytics/google-tag";

/**
 * Root client island: initial and pathname-change views, never query/hash changes.
 *
 * PostHog pageviews are cookieless until a grant. The first-party tally records consent at arrival;
 * changing that choice is not another route visit.
 * The Google tag runs in Consent Mode v2 advanced: cookieless pings until a grant.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const ready = () => { sendPageView(); };
    const sync = () => { syncAnalytics(ready); consumeConversionReceipt(); };
    // The existing denied bucket includes both refusal and no choice yet.
    const bucket = readConsent() === "granted" ? "granted" : "denied";
    countConsentPageview(pathname, bucket);
    loadGoogleTag();
    sendGooglePageView();
    sync();
    const onConsent = () => { updateGoogleConsent(); sync(); };
    window.addEventListener(CONSENT_CHANGED, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGED, onConsent);
  }, [pathname]);
  return null;
}
