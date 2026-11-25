import { readConsent } from "./consent";
import { pageParameters } from "./pageview";

/** The historical "Hobbysalon" GA4 property, so trends continue from before November 2026. */
export const GA4_ID = "G-KP9BXCEF2Z";
export const GOOGLE_TAG_SCRIPT_ID = "hs-google-tag";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: Gtag;
    hsGoogleTagLoaded?: boolean;
    hsGoogleLastPage?: string;
  }
}

function storage(): "granted" | "denied" {
  return readConsent() === "granted" ? "granted" : "denied";
}

/**
 * Consent Mode v2, advanced: the tag loads on public routes for every visitor.
 * Without a grant it sets no cookies and sends cookieless pings that GA4 uses
 * for behavioural modelling. Advertising storage is always denied.
 * Never set ga-disable here: that also blocks the pings Google needs to model.
 */
export function loadGoogleTag(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.hsGoogleTagLoaded || !pageParameters(window.location.href)) return;
  window.hsGoogleTagLoaded = true;
  try {
    window.dataLayer = window.dataLayer ?? [];
    // gtag.js reads the Arguments object, not an array; keep the classic shape.
    // eslint-disable-next-line prefer-rest-params
    window.gtag = window.gtag ?? function gtag() { window.dataLayer!.push(arguments); };
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: storage(),
      functionality_storage: "denied",
      personalization_storage: "denied",
      security_storage: "granted",
    });
    window.gtag("set", "ads_data_redaction", true);
    window.gtag("set", "url_passthrough", false);
    window.gtag("set", "linker", { domains: ["hobbysalon.be", "hobbysalon.nl"] });
    window.gtag("js", new Date());
    // Route views are sent by sendGooglePageView with allowlisted page data only.
    window.gtag("config", GA4_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement("script");
    script.id = GOOGLE_TAG_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(script);
  } catch { /* Optional analytics never breaks the page. */ }
}

/** Mirror the banner choice. A withdrawal keeps the tag, so cookieless pings continue. */
export function updateGoogleConsent(): void {
  try {
    window.gtag?.("consent", "update", { analytics_storage: storage() });
  } catch { /* Optional analytics never breaks the page. */ }
}

export function sendGooglePageView(): void {
  try {
    if (typeof window === "undefined" || !window.gtag) return;
    const page = pageParameters(window.location.href, document.referrer);
    if (!page || window.hsGoogleLastPage === window.location.pathname) return;
    window.gtag("event", "page_view", { ...page, send_to: GA4_ID });
    window.hsGoogleLastPage = window.location.pathname;
  } catch { /* Optional analytics never breaks navigation. */ }
}

/** Conversions keep the existing rule: only after a grant, with already-validated parameters. */
export function sendGoogleEvent(event: string, parameters: Record<string, string | number | boolean>): void {
  try {
    if (readConsent() !== "granted") return;
    window.gtag?.("event", event, { ...parameters, send_to: GA4_ID });
  } catch { /* Optional analytics never breaks forms. */ }
}
