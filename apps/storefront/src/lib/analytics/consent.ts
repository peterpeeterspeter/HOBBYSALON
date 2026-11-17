import type { PostHog } from "posthog-js";
import { CONVERSION_COOKIE, CONSENT_GENERATION_KEY, validConsentGeneration } from "./conversions";
import { pageParameters } from "./pageview";
import { posthogConfig } from "./posthog-config";

export const CONSENT_KEY = "hs_posthog_consent_v1";
export const CONSENT_CHANGED = "hs:analytics_consent_changed";
export type Consent = "granted" | "denied" | "pending";

declare global {
  interface Window {
    hsConsentBlocked?: boolean;
    hsPostHog?: PostHog;
    hsPostHogReady?: boolean;
    hsPostHogLastPage?: string;
    hsPostHogLoading?: Promise<void>;
    hsPostHogLoadFailed?: boolean;
    hsPostHogConsent?: boolean;
    hsPostHogStopFailed?: boolean;
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

/** Rotates on withdrawal/regrant; never sent to PostHog or used as a person ID. */
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

function clearPosthogSessionStorage(): void {
  try {
    const storage = window.sessionStorage;
    for (const key of Object.keys(storage)) {
      if (key.startsWith("ph_")) storage.removeItem(key);
    }
  } catch { /* Inaccessible storage must not interrupt SDK opt-out. */ }
}

export function initializeConsent(): void {
  if (typeof window === "undefined") return;
  clearAnalyticsCookies(readConsent() !== "granted");
  if (readConsent() !== "granted") clearPosthogSessionStorage();
  if (readConsent() === "granted" && !readConsentGeneration()) {
    try { rotateConsentGeneration(); } catch { /* Receipts fail closed. */ }
  }
}

function stopAnalytics(includeReceipt = true, resetPage = true): void {
  window.hsPostHogReady = false;
  if (resetPage) window.hsPostHogLastPage = undefined;
  if (window.hsPostHog && window.hsPostHogConsent !== false) {
    // A failed stop must not be treated as a safe opt-out by route callbacks.
    window.hsPostHogConsent = undefined;
    window.hsPostHogStopFailed = true;
    let stopped = true;
    try { window.hsPostHog.opt_out_capturing(); } catch { stopped = false; }
    try { window.hsPostHog.reset(true); } catch { stopped = false; }
    window.hsPostHogStopFailed = !stopped;
    if (stopped) window.hsPostHogConsent = false;
  }
  // SDK reset leaves window/session markers behind after a consented reload.
  clearPosthogSessionStorage();
  clearAnalyticsCookies(includeReceipt);
}

/** A grant only takes effect after both local stores accept and return it. */
export function setConsent(choice: "granted" | "denied"): Consent {
  initializeConsent();
  if (readConsent() === choice) return choice;
  // Close the event gate before storage, including failed persistence/withdrawals.
  window.hsConsentBlocked = true;
  // A consent change is not another arrival on this page.
  stopAnalytics(true, false);
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
  return typeof window !== "undefined" && typeof document !== "undefined"
    && readConsent() === "granted" && window.hsPostHogReady === true;
}

/** Only public routes load the SDK; pending consent uses its cookieless branch. */
export function syncAnalytics(onReady: () => void): void {
  if (typeof window === "undefined") return;
  initializeConsent();
  if (!pageParameters(window.location.href)) {
    stopAnalytics(readConsent() !== "granted");
    return;
  }
  const activate = () => {
    const client = window.hsPostHog;
    if (!client) return;
    if (!pageParameters(window.location.href)) {
      stopAnalytics(readConsent() !== "granted");
      return;
    }
    if (window.hsPostHogStopFailed) { window.hsPostHogReady = false; return; }
    const granted = readConsent() === "granted";
    if (window.hsPostHogConsent !== granted) {
      window.hsPostHogReady = false;
      window.hsPostHogConsent = undefined;
      // Our banner remains pending; opting out selects cookieless measurement.
      try {
        if (granted) client.opt_in_capturing();
        else client.opt_out_capturing();
      } catch { return; }
      window.hsPostHogConsent = granted;
    }
    window.hsPostHogReady = true;
    onReady();
    window.dispatchEvent(new Event("hs:posthog_ready"));
  };
  if (window.hsPostHog) { activate(); return; }
  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token || !process.env.NEXT_PUBLIC_POSTHOG_HOST || window.hsPostHogLoadFailed) return;
  if (!window.hsPostHogLoading) {
    window.hsPostHogLoading = import("posthog-js").then(({ default: posthog }) => {
      if (!pageParameters(window.location.href)) return;
      posthog.init(token, posthogConfig());
      window.hsPostHog = posthog;
    }).catch(() => {
      window.hsPostHogLoadFailed = true;
      window.hsPostHogReady = false;
    }).finally(() => { window.hsPostHogLoading = undefined; });
  }
  void window.hsPostHogLoading.then(activate);
}

export function sendPageView(): void {
  try {
    if (typeof window === "undefined" || !window.hsPostHogReady || !window.hsPostHog) return;
    const page = pageParameters(window.location.href, document.referrer);
    if (!page || window.hsPostHogLastPage === window.location.pathname) return;
    window.hsPostHog.capture("$pageview", { hs_safe: page });
    window.hsPostHogLastPage = window.location.pathname;
  } catch { /* Optional analytics never breaks navigation. */ }
}
