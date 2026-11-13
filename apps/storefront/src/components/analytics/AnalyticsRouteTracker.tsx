"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_CHANGED, sendPageView, syncAnalytics } from "@/lib/analytics/consent";
import { consumeConversionReceipt } from "@/lib/analytics/receipt";

/** Root client island: initial and pathname-change views, never query/hash changes. */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const ready = () => { sendPageView(); consumeConversionReceipt(); };
    const sync = () => syncAnalytics(ready);
    sync();
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => window.removeEventListener(CONSENT_CHANGED, sync);
  }, [pathname]);
  return null;
}
