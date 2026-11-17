import assert from "node:assert/strict";
import test from "node:test";
import { analyticsAllowed, CONSENT_CHANGED, CONSENT_KEY, cookieDomains, initializeConsent, readConsent, readConsentGeneration, sendPageView, setConsent, syncAnalytics } from "./consent";
import { CONSENT_GENERATION_KEY, CONVERSION_COOKIE } from "./conversions";
import { sendPosthogEvent } from "./posthog";
import { browser, environment, safeProperties } from "./posthog.test-helpers";

for (const consent of [undefined, "denied"]) {
  test(`${consent ?? "pending"}: public pageviews use opt-out while custom events stay blocked`, (t) => {
    const f = browser(t, { consent });
    syncAnalytics(sendPageView);
    assert.equal(readConsent(), consent ?? "pending");
    assert.equal(analyticsAllowed(), false);
    assert.deepEqual(f.lifecycle, ["opt_out"]);
    sendPosthogEvent("sign_up", { method: "email" });
    sendPageView();
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0], ["$pageview", { hs_safe: {
      page_location: "https://hobbysalon.nl/workshops", page_title: "Workshops | Hobbysalon", page_referrer: "https://source.example",
    } }]);
    assert.ok(!f.events.some((event) => event.type === CONSENT_CHANGED), "loading must not choose consent for the visitor");
    assert.ok(f.events.some((event) => event.type === "hs:posthog_ready"));
  });
}

test("old Google grants are never inherited by PostHog", (t) => {
  const f = browser(t);
  assert.equal(CONSENT_KEY, "hs_posthog_consent_v1");
  f.values.set("hs_analytics_consent", "granted");
  f.cookies.set("hs_analytics_consent", "granted");
  initializeConsent();
  syncAnalytics(sendPageView);
  assert.equal(readConsent(), "pending");
  assert.equal(readConsentGeneration(), null);
  assert.equal(analyticsAllowed(), false);
  assert.deepEqual(f.lifecycle, ["opt_out"]);
  assert.equal(f.values.has(CONSENT_KEY), false);
  sendPosthogEvent("sign_up", { method: "email" });
  assert.deepEqual(f.calls.map(([event]) => event), ["$pageview"]);
});

test("grant persists both host-only stores and a matching generation before enabling custom events", (t) => {
  const f = browser(t);
  assert.equal(setConsent("granted"), "granted");
  assert.equal(f.values.get(CONSENT_KEY), "granted");
  assert.equal(f.cookies.get(CONSENT_KEY), "granted");
  assert.match(readConsentGeneration()!, /^[0-9a-f-]{36}$/);
  assert.equal(f.cookies.get(CONSENT_GENERATION_KEY), f.values.get(CONSENT_GENERATION_KEY));
  assert.equal(analyticsAllowed(), false, "consent is not transport readiness");
  const grants = f.cookieWrites.filter((raw) => raw.startsWith(`${CONSENT_KEY}=granted`));
  assert.equal(grants.length, 1);
  assert.match(grants[0], /Path=\/; Max-Age=15552000; SameSite=Lax; Secure$/);
  assert.doesNotMatch(grants[0], /Domain=/);
  syncAnalytics(sendPageView);
  assert.equal(analyticsAllowed(), true);
  assert.equal(f.lifecycle.at(-1), "opt_in");
  sendPageView();
  assert.equal(f.views().length, 1);
  assert.equal(safeProperties(f.views()[0]).page_referrer, "https://source.example");
});

test("withdrawal resets SDK identity, removes analytics and receipt cookies, preserves functional data", (t) => {
  const f = browser(t, { consent: "granted" });
  syncAnalytics(sendPageView);
  const before = readConsentGeneration();
  for (const name of ["_ga", "_ga_KP9BXCEF2Z", "_gid", "_gat_test", CONVERSION_COOKIE]) f.cookies.set(name, "erase");
  f.cookies.set("auth", "retain");
  f.values.set("hs_analytics_events_v1", "retain-first-party-log");
  assert.equal(setConsent("denied"), "denied");
  assert.equal(analyticsAllowed(), false);
  assert.notEqual(readConsentGeneration(), before);
  assert.deepEqual(f.lifecycle.slice(-2), ["opt_out", "reset:true"]);
  for (const name of ["_ga", "_ga_KP9BXCEF2Z", "_gid", "_gat_test", CONVERSION_COOKIE]) assert.equal(f.cookies.has(name), false);
  assert.equal(f.cookies.get("auth"), "retain");
  assert.equal(f.values.get("hs_analytics_events_v1"), "retain-first-party-log");
  sendPosthogEvent("sign_up", { method: "email" });
  sendPageView();
  syncAnalytics(sendPageView);
  assert.deepEqual(f.calls.map(([event]) => event), ["$pageview"], "withdrawal is not another arrival");
});

test("same grant preserves generation and receipt without SDK reset or duplicate view", (t) => {
  const f = browser(t, { consent: "granted" });
  syncAnalytics(sendPageView);
  f.cookies.set(CONVERSION_COOKIE, "retain-receipt");
  const generation = readConsentGeneration();
  const lifecycle = [...f.lifecycle];
  const events = f.events.length;
  assert.equal(setConsent("granted"), "granted");
  syncAnalytics(sendPageView);
  assert.equal(readConsentGeneration(), generation);
  assert.equal(f.cookies.get(CONVERSION_COOKIE), "retain-receipt");
  assert.deepEqual(f.lifecycle, lifecycle);
  assert.equal(f.events.slice(events).filter((event) => event.type === CONSENT_CHANGED).length, 0);
  assert.equal(f.views().length, 1);
});

test("regrant rotates generation and enables future events without replaying the arrival", (t) => {
  const f = browser(t, { consent: "granted" });
  syncAnalytics(sendPageView);
  const first = readConsentGeneration();
  setConsent("denied");
  const denied = readConsentGeneration();
  sendPosthogEvent("sign_up", { method: "email" });
  setConsent("granted");
  const last = readConsentGeneration();
  assert.equal(new Set([first, denied, last]).size, 3);
  syncAnalytics(sendPageView);
  sendPosthogEvent("sign_up", { method: "email" });
  assert.equal(analyticsAllowed(), true);
  assert.deepEqual(f.calls.map(([event]) => event), ["$pageview", "sign_up"]);
  assert.equal(f.initializations.length, 0, "existing SDK is reused");
});

for (const [stored, cookie, expected] of [
  ["granted", undefined, "pending"], [undefined, "granted", "pending"],
  ["granted", "denied", "denied"], ["denied", "granted", "denied"],
  ["GRANTED", "granted", "pending"], ["true", "granted", "pending"],
] as const) {
  test(`disagreeing consent stores fail closed: ${stored}/${cookie}`, (t) => {
    const f = browser(t, { ready: true });
    if (stored) f.values.set(CONSENT_KEY, stored);
    if (cookie) f.cookies.set(CONSENT_KEY, cookie);
    assert.equal(readConsent(), expected);
    assert.equal(analyticsAllowed(), false);
  });
}

for (const failure of ["storage getter", "storage read", "storage write", "cookie read", "cookie write", "cookie ignored", "generation ignored"]) {
  test(`persistence failure stays denied: ${failure}`, (t) => {
    const f = browser(t);
    const unavailable = () => { throw new Error("fixture storage unavailable"); };
    if (failure === "storage getter") Object.defineProperty(f.window, "localStorage", { get: unavailable });
    if (failure === "storage read") f.window.localStorage.getItem = unavailable;
    if (failure === "storage write") f.window.localStorage.setItem = unavailable;
    if (failure === "cookie read") Object.defineProperty(f.document, "cookie", { get: unavailable });
    if (failure === "cookie write") Object.defineProperty(f.document, "cookie", { set: unavailable });
    if (failure === "cookie ignored") Object.defineProperty(f.document, "cookie", { set: () => {} });
    if (failure === "generation ignored") f.window.localStorage.setItem = (key, value) => { if (key !== CONSENT_GENERATION_KEY) f.values.set(key, value); };
    assert.equal(setConsent("granted"), "denied");
    assert.equal(readConsent(), "denied");
    assert.equal(analyticsAllowed(), false);
    syncAnalytics(sendPageView);
    sendPosthogEvent("sign_up", { method: "email" });
    assert.deepEqual(f.calls.map(([event]) => event), ["$pageview"]);
    assert.ok(!f.lifecycle.includes("opt_in"));
    assert.ok(f.events.some((event) => event.type === CONSENT_CHANGED));
  });
}

test("private routes stop an installed SDK and public return records a new arrival", (t) => {
  const f = browser(t, { consent: "granted" });
  syncAnalytics(sendPageView);
  f.window.location = new URL("https://hobbysalon.nl/dashboard?token=private");
  syncAnalytics(sendPageView);
  assert.equal(analyticsAllowed(), false);
  assert.equal(f.views().length, 1);
  assert.deepEqual(f.lifecycle.slice(-2), ["opt_out", "reset:true"]);
  f.window.location = new URL("https://hobbysalon.nl/workshops");
  syncAnalytics(sendPageView);
  assert.equal(analyticsAllowed(), true);
  assert.equal(f.views().length, 2);
  assert.ok(!JSON.stringify(f.calls).includes("private"));
});

test("missing configuration or a failed load cannot invent readiness", (t) => {
  const f = browser(t, { installed: false, consent: "granted" });
  environment(t, { NEXT_PUBLIC_POSTHOG_KEY: undefined, NEXT_PUBLIC_POSTHOG_HOST: undefined });
  syncAnalytics(sendPageView);
  assert.equal(f.window.hsPostHogLoading, undefined);
  assert.equal(analyticsAllowed(), false);
  assert.deepEqual(f.calls, []);
});

test("failed capture is swallowed and does not mark an arrival as delivered", (t) => {
  const f = browser(t, { ready: true });
  const capture = f.sdk.capture;
  f.sdk.capture = () => { throw new Error("fixture SDK failure"); };
  assert.doesNotThrow(sendPageView);
  assert.equal(f.window.hsPostHogLastPage, undefined);
  f.sdk.capture = capture;
  sendPageView();
  sendPageView();
  assert.equal(f.views().length, 1);
});

test("cookie domain expiry is limited to the current host and known parent", () => {
  assert.deepEqual(cookieDomains("www.hobbysalon.be"), ["", "www.hobbysalon.be", "hobbysalon.be"]);
  assert.deepEqual(cookieDomains("hobbysalon.nl"), ["", "hobbysalon.nl"]);
  assert.deepEqual(cookieDomains("foo.example"), ["", "foo.example"]);
  assert.deepEqual(cookieDomains("hobbysalon.be.evil.example"), ["", "hobbysalon.be.evil.example"]);
});

for (const method of ["opt_out_capturing", "reset"] as const) {
  test(`SDK ${method} failure must not abort consent withdrawal persistence`, (t) => {
    const f = browser(t, { consent: "granted" });
    syncAnalytics(sendPageView);
    const generation = readConsentGeneration();
    f.cookies.set(CONVERSION_COOKIE, "receipt-from-previous-grant");
    f.sdk[method] = () => { throw new Error(`fixture ${method} failure`); };
    let exception: unknown;
    try { setConsent("denied"); } catch (error) { exception = error; }
    const actual = {
      exception: exception instanceof Error ? exception.message : exception,
      stored: f.values.get(CONSENT_KEY), cookie: f.cookies.get(CONSENT_KEY),
      ready: analyticsAllowed(), receiptRemoved: !f.cookies.has(CONVERSION_COOKIE),
      generationRotated: readConsentGeneration() !== generation,
      consentChanged: f.events.some((event) => event.type === CONSENT_CHANGED),
    };
    // A fresh document has no in-memory fail-closed flag; withdrawal must survive it.
    f.window.hsConsentBlocked = undefined;
    assert.deepEqual({ ...actual, consentAfterReload: readConsent() }, {
      exception: undefined, stored: "denied", cookie: "denied", ready: false,
      receiptRemoved: true, generationRotated: true, consentChanged: true, consentAfterReload: "denied",
    });
  });
}
