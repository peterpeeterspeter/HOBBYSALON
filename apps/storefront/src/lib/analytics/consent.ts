import { CONVERSION_COOKIE, CONSENT_GENERATION_KEY, validConsentGeneration } from "./conversions";
import { pageParameters } from "./pageview";

export const GA4_ID = "G-KP9BXCEF2Z";
export const CONSENT_KEY = "hs_analytics_consent";
export const CONSENT_CHANGED = "hs:analytics_consent_changed";
export type Consent = "granted" | "denied" | "pending";
export type Gtag = (...args: unknown[]) => void;
const SCRIPT_ID = "hs-google-analytics";
export const DENIED_CONSENT = {
  analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
} as const;

declare global {
  interface Window {
    gtag?: Gtag;
    hsConsentBlocked?: boolean;
    hsGa4Ready?: boolean;
    hsGa4Initialized?: boolean;
    hsGa4Configured?: boolean;
    hsGa4ScriptReady?: boolean;
    hsGa4LastPage?: string;
    "ga-disable-G-KP9BXCEF2Z"?: boolean;
  }
}

function cookieValue(name: string): string | undefined {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
function writeCookie(name: string, value: string, maxAge: number): void {
  // No Domain attribute: BE, NL and each subdomain must make their own choice.
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}
export function readConsent(): Consent {
  if (typeof window === "undefined" || typeof document === "undefined") return "pending";
  if (window.hsConsentBlocked) return "denied";
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    const cookie = cookieValue(CONSENT_KEY);
    if (stored === "denied" || cookie === "denied") return "denied";
    return stored === "granted" && cookie === "granted" ? "granted" : "pending";
  } catch { return "denied"; }
}

/** Rotates on withdrawal/regrant; never sent to Google or used as a person ID. */
export function readConsentGeneration(): string | null {
  try {
    const stored = window.localStorage.getItem(CONSENT_GENERATION_KEY);
    return validConsentGeneration(stored) && cookieValue(CONSENT_GENERATION_KEY) === stored ? stored : null;
  } catch { return null; }
}
function rotateConsentGeneration(): void {
  const generation = crypto.randomUUID();
  window.localStorage.setItem(CONSENT_GENERATION_KEY, generation);
  writeCookie(CONSENT_GENERATION_KEY, generation, 60 * 60 * 24 * 180);
  if (readConsentGeneration() !== generation) throw new Error("Consent generation persistence unavailable");
}

/** Only current host and the known site's parent; never public suffixes or the other market. */
export function cookieDomains(hostname: string): string[] {
  const host = hostname.toLowerCase();
  const domains = ["", host];
  for (const base of ["hobbysalon.be", "hobbysalon.nl"]) {
    if (host === base || host.endsWith(`.${base}`)) domains.push(base);
  }
  return [...new Set(domains)];
}
export function clearAnalyticsCookies(includeReceipt = true): void {
  try {
    const names = document.cookie.split(";").map((part) => part.trim().split("=")[0])
      .filter((name) => /^_ga(?:_[A-Za-z0-9]+)?$|^_gid$|^_gat(?:_[A-Za-z0-9_-]+)?$/.test(name));
    if (includeReceipt) names.push(CONVERSION_COOKIE);
    const parts = window.location.pathname.split("/").filter(Boolean).slice(0, 10);
    const paths = new Set(["/"]);
    for (let i = 1; i <= parts.length; i++) {
      const path = `/${parts.slice(0, i).join("/")}`;
      paths.add(path); paths.add(`${path}/`);
    }
    for (const name of names) for (const path of paths) for (const domain of cookieDomains(window.location.hostname)) {
      document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${path}${domain ? `; Domain=${domain}` : ""}; SameSite=Lax`;
    }
  } catch { /* Cookie failures must not enable collection. */ }
}

function command(...args: unknown[]): void {
  try { window.gtag?.(...args); } catch { /* Optional transport. */ }
}
export function initializeConsent(): void {
  if (typeof window === "undefined") return;
  if (window.hsGa4Initialized) return;
  window.hsGa4Initialized = true;
  window.hsGa4Ready = false;
  window["ga-disable-G-KP9BXCEF2Z"] = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer?.push(arguments); };
  command("consent", "default", DENIED_CONSENT);
  if (readConsent() === "granted" && !readConsentGeneration()) {
    try { rotateConsentGeneration(); } catch { /* Receipts fail closed. */ }
  }
}
/**
 * Stops collection without unloading the tag. In advanced consent mode the
 * Google script stays on the page so a refusal still yields cookieless pings;
 * what stops is our own collection, the granted storage state, and the cookies.
 */
function stopAnalytics(includeReceipt = true): void {
  window.hsGa4Ready = false;
  window.hsGa4LastPage = undefined;
  window["ga-disable-G-KP9BXCEF2Z"] = true;
  command("consent", "update", DENIED_CONSENT);
  clearAnalyticsCookies(includeReceipt);
}

/** A grant only takes effect after both local stores accept and return it. */
export function setConsent(choice: "granted" | "denied"): Consent {
  initializeConsent();
  if (readConsent() === choice) return choice;
  // Close the event gate before storage, including failed persistence/withdrawals.
  window.hsConsentBlocked = true;
  stopAnalytics();
  try {
    rotateConsentGeneration();
    window.localStorage.setItem(CONSENT_KEY, choice);
    writeCookie(CONSENT_KEY, choice, 60 * 60 * 24 * 180);
    if (window.localStorage.getItem(CONSENT_KEY) !== choice || cookieValue(CONSENT_KEY) !== choice) throw new Error("Consent persistence unavailable");
  } catch {
    try { window.localStorage.setItem(CONSENT_KEY, "denied"); } catch { /* Fail closed. */ }
    try { writeCookie(CONSENT_KEY, "denied", 60 * 60 * 24 * 180); } catch { /* Fail closed. */ }
    window.dispatchEvent(new Event(CONSENT_CHANGED));
    return "denied";
  }
  window.hsConsentBlocked = false;
  window.dispatchEvent(new Event(CONSENT_CHANGED));
  return choice;
}

export function analyticsAllowed(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined" && readConsent() === "granted" && window.hsGa4Ready === true && window["ga-disable-G-KP9BXCEF2Z"] === false;
}

/**
 * Advanced consent mode. The Google tag loads on every allowed public route with
 * every consent type denied, so a refusal still sends Google's cookieless pings
 * for behavioural modelling. No cookie is written and no custom event fires
 * until the visitor grants, because hsGa4Ready stays false while denied.
 */
function loadGoogleTag(onReady: () => void): void {
  const activate = () => {
    if (!pageParameters(window.location.href, document.referrer)) { stopAnalytics(); return; }
    // Denied stays denied here; activateGranted is the only path to granted.
    window.hsGa4ScriptReady = true;
    window.dispatchEvent(new Event("hs:ga4_script_ready"));
    if (readConsent() === "granted") onReady();
  };
  if (window.hsGa4Configured) { activate(); return; }
  if (document.getElementById(SCRIPT_ID)) {
    if (window.hsGa4ScriptReady) activate();
    return;
  }
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  script.onload = activate;
  script.onerror = () => { script.remove(); stopAnalytics(); };
  document.head.appendChild(script);
}

/** Google is loaded on allowed public routes. Only a grant enables collection. */
export function syncAnalytics(onReady: () => void): void {
  initializeConsent();
  const page = pageParameters(window.location.href);
  if (!page) {
    // A consented private success may leave a five-minute receipt for the next
    // public page. This is not permission to load Google on the private route.
    stopAnalytics(readConsent() !== "granted");
    return;
  }
  const activate = () => {
    const currentPage = pageParameters(window.location.href, document.referrer);
    if (readConsent() !== "granted" || !currentPage) {
      // Refusal: keep the tag loaded so Google still receives cookieless pings,
      // but never let the app send a custom event.
      window.hsGa4Ready = false;
      window["ga-disable-G-KP9BXCEF2Z"] = true;
      command("consent", "update", DENIED_CONSENT);
      clearAnalyticsCookies(readConsent() !== "granted");
      return;
    }
    window["ga-disable-G-KP9BXCEF2Z"] = false;
    command("consent", "update", { ...DENIED_CONSENT, analytics_storage: "granted" });
    if (!window.hsGa4Configured) {
      // Preserve the original BE/NL linker, before js and config.
      command("set", "linker", { domains: ["hobbysalon.be", "hobbysalon.nl"], accept_incoming: true });
      command("js", new Date());
    }
    command("config", GA4_ID, {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      ignore_referrer: true,
      cookie_domain: window.location.hostname, ...currentPage,
    });
    window.hsGa4Configured = true;
    // Sanitize defaults for enhanced events too, including private-route transitions.
    command("set", currentPage);
    window.hsGa4Ready = true;
    onReady();
    window.dispatchEvent(new Event("hs:ga4_ready"));
  };
  if (window.hsGa4Configured) { activate(); return; }
  // The tag loads regardless of the current choice; activate only collects when granted.
  loadGoogleTag(activate);
}

export function sendPageView(): void {
  try {
    if (!analyticsAllowed()) return;
    const page = pageParameters(window.location.href, document.referrer);
    if (!page) return;
    // Compare actual pathname so different public details still count, never transmit it.
    const routeKey = window.location.pathname;
    if (window.hsGa4LastPage === routeKey) return;
    command("set", page);
    command("event", "page_view", page);
    window.hsGa4LastPage = routeKey;
  } catch { /* Optional analytics never breaks navigation. */ }
}
