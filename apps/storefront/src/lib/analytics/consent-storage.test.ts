import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_KEY, initializeConsent, setConsent, syncAnalytics, sendPageView } from "./consent";
import { browser } from "./posthog.test-helpers";

function storage(values: Record<string, string>) {
  const data = { ...values };
  return Object.defineProperties(data, {
    getItem: { value: (key: string) => data[key] ?? null },
    setItem: { value: (key: string, value: string) => { data[key] = value; } },
    removeItem: { value: (key: string) => { delete data[key]; } },
  });
}

test("withdrawal removes SDK session identifiers without removing unrelated state", (t) => {
  const f = browser(t, { consent: "granted" });
  syncAnalytics(sendPageView);
  const session = storage({
    ph_test_primary_window_exists: "true",
    ph_test_window_id: "previous-window",
    ph_test_session_registered_properties: "{}",
    cart: "retain",
    hs_analytics_session_v1: "retain-first-party-session",
  });
  Object.defineProperty(f.window, "sessionStorage", { configurable: true, value: session });
  assert.equal(setConsent("denied"), "denied");
  assert.deepEqual(Object.keys(session).sort(), ["cart", "hs_analytics_session_v1"]);
  assert.equal(f.values.get(CONSENT_KEY), "denied");
  assert.equal(f.cookies.get(CONSENT_KEY), "denied");
});

test("pending initialization clears leftover SDK session state without loading the SDK", (t) => {
  const f = browser(t, { installed: false });
  const session = storage({ ph_test_window_id: "erase", cart: "retain" });
  Object.defineProperty(f.window, "sessionStorage", { configurable: true, value: session });
  initializeConsent();
  assert.deepEqual(Object.keys(session), ["cart"]);
  assert.equal(f.window.hsPostHog, undefined);
});

test("inaccessible session storage cannot interrupt withdrawal", (t) => {
  const f = browser(t, { consent: "granted" });
  syncAnalytics(sendPageView);
  Object.defineProperty(f.window, "sessionStorage", { configurable: true, get: () => { throw new Error("storage unavailable"); } });
  assert.equal(setConsent("denied"), "denied");
  assert.equal(f.window.hsPostHogReady, false);
  assert.equal(f.values.get(CONSENT_KEY), "denied");
  assert.equal(f.cookies.get(CONSENT_KEY), "denied");
});
