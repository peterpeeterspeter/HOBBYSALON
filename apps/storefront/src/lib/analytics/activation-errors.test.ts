import assert from "node:assert/strict";
import test from "node:test";
import { analyticsAllowed, CONSENT_CHANGED, CONSENT_KEY, readConsent, readConsentGeneration, sendPageView, setConsent, syncAnalytics } from "./consent";
import { CONVERSION_COOKIE } from "./conversions";
import { sendPosthogEvent } from "./posthog";
import { browser, environment } from "./posthog.test-helpers";

for (const consent of ["granted", "denied"] as const) {
  test(`failed SDK transition to ${consent} closes readiness without throwing`, (t) => {
    const f = browser(t, { consent, ready: true });
    f.window.hsPostHogConsent = consent !== "granted";
    const method = consent === "granted" ? "opt_in_capturing" : "opt_out_capturing";
    t.mock.method(f.sdk, method, () => { throw new Error("SDK unavailable"); });
    let notified = false;
    assert.doesNotThrow(() => syncAnalytics(() => { notified = true; }));
    assert.equal(f.window.hsPostHogReady, false);
    assert.equal(notified, false);
    assert.ok(!f.events.some((event) => event.type === "hs:posthog_ready"));
  });
}

test("failed SDK activation after dynamic import does not reject an unobserved promise", async (t) => {
  const f = browser(t, { consent: "granted", installed: false });
  environment(t, { NEXT_PUBLIC_POSTHOG_KEY: "phc_test_only", NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com" });
  t.mock.method(f.sdk, "opt_in_capturing", () => { throw new Error("SDK unavailable"); });
  t.mock.module("posthog-js", { defaultExport: f.sdk });
  let notified = false;
  syncAnalytics(() => { notified = true; });
  await f.window.hsPostHogLoading;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.window.hsPostHogReady, false);
  assert.equal(notified, false);
});

for (const failures of [["opt_out_capturing"], ["reset"], ["opt_out_capturing", "reset"]] as const) {
  test(`failed withdrawal (${failures.join(" + ")}) blocks consent callback, public navigation and unsafe regrant`, (t) => {
    const f = browser(t, { consent: "granted" });
    syncAnalytics(sendPageView);
    const generation = readConsentGeneration();
    f.cookies.set(CONVERSION_COOKIE, "receipt-from-previous-grant");
    f.cookies.set("auth", "retain");
    const optOut = t.mock.method(f.sdk, "opt_out_capturing", () => {
      if (failures.some((method) => method === "opt_out_capturing")) throw new Error("fixture opt-out failure");
    });
    const reset = t.mock.method(f.sdk, "reset", () => {
      if (failures.some((method) => method === "reset")) throw new Error("fixture reset failure");
    });
    let consentCallbacks = 0, readyCallbacks = 0;
    const ready = () => { readyCallbacks++; sendPageView(); };
    f.window.addEventListener(CONSENT_CHANGED, () => { consentCallbacks++; syncAnalytics(ready); });
    const readyEventsBefore = f.events.filter((event) => event.type === "hs:posthog_ready").length;
    const state = () => ({
      ready: f.window.hsPostHogReady, cached: f.window.hsPostHogConsent,
      allowed: analyticsAllowed(), captures: f.calls.length, readyCallbacks,
      readyEvents: f.events.filter((event) => event.type === "hs:posthog_ready").length - readyEventsBefore,
    });

    assert.equal(setConsent("denied"), "denied");
    assert.equal(consentCallbacks, 1, "real CONSENT_CHANGED dispatch reaches the sync callback");
    assert.equal(optOut.mock.callCount(), 1, "withdrawal reached opt-out even when it throws");
    assert.equal(reset.mock.callCount(), 1, "withdrawal still reached reset");
    assert.deepEqual(reset.mock.calls[0].arguments, [true]);
    assert.equal(f.values.get(CONSENT_KEY), "denied");
    assert.equal(f.cookies.get(CONSENT_KEY), "denied");
    assert.equal(readConsent(), "denied");
    assert.notEqual(readConsentGeneration(), generation);
    assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
    assert.equal(f.cookies.get("auth"), "retain");
    const afterCallback = state();

    f.window.location = new URL("https://hobbysalon.nl/artikelen");
    syncAnalytics(ready);
    sendPageView();
    sendPosthogEvent("sign_up", { method: "email" });
    const afterNavigation = state();
    assert.equal(optOut.mock.callCount(), 1, "public navigation does not automatically retry a failed stop");
    assert.equal(reset.mock.callCount(), 1);

    assert.equal(setConsent("granted"), "granted", "SDK failure must not override the visitor's choice");
    assert.equal(consentCallbacks, 2);
    f.window.location = new URL("https://hobbysalon.nl/creators");
    syncAnalytics(ready);
    sendPageView();
    sendPosthogEvent("sign_up", { method: "email" });
    const afterUnsafeRegrant = state();
    const closed = { ready: false, cached: undefined, allowed: false, captures: 1, readyCallbacks: 0, readyEvents: 0 };
    assert.deepEqual({ afterCallback, afterNavigation, afterUnsafeRegrant }, {
      afterCallback: closed, afterNavigation: closed, afterUnsafeRegrant: closed,
    });
    assert.equal(optOut.mock.callCount(), 2, "an explicit changed choice may attempt stop once more");
    assert.equal(reset.mock.callCount(), 2);
  });

  test(`explicit safe regrant recovers after failed withdrawal (${failures.join(" + ")})`, (t) => {
    const f = browser(t, { consent: "granted" });
    syncAnalytics(sendPageView);
    const initialGeneration = readConsentGeneration();
    const mocks = failures.map((method) => t.mock.method(f.sdk, method, () => { throw new Error(`fixture ${method} failure`); }));
    f.window.addEventListener(CONSENT_CHANGED, () => syncAnalytics(sendPageView));
    setConsent("denied");
    const deniedGeneration = readConsentGeneration();
    const readyAfterFailure = f.window.hsPostHogReady;
    const cachedAfterFailure = f.window.hsPostHogConsent;
    for (const mock of mocks) mock.mock.restore();
    const lifecycleBefore = f.lifecycle.length;
    assert.equal(setConsent("granted"), "granted");
    assert.deepEqual(f.lifecycle.slice(lifecycleBefore), ["opt_out", "reset:true", "opt_in"]);
    assert.equal(f.window.hsPostHogConsent, true);
    assert.equal(analyticsAllowed(), true);
    assert.equal(new Set([initialGeneration, deniedGeneration, readConsentGeneration()]).size, 3);
    assert.equal(f.views().length, 1, "regrant does not replay the current arrival");
    f.window.location = new URL("https://hobbysalon.nl/artikelen");
    syncAnalytics(sendPageView);
    sendPageView();
    sendPosthogEvent("sign_up", { method: "email" });
    assert.deepEqual(f.calls.map(([event]) => event), ["$pageview", "$pageview", "sign_up"]);
    assert.deepEqual({ readyAfterFailure, cachedAfterFailure }, { readyAfterFailure: false, cachedAfterFailure: undefined });
  });
}

for (const original of ["granted", "denied"] as const) {
  test(`failed activation cannot reuse stale ${original} SDK consent when the desired state changes back`, (t) => {
    const f = browser(t, { consent: original });
    syncAnalytics(sendPageView);
    const changed = original === "granted" ? "denied" : "granted";
    const failing = original === "granted" ? "opt_out_capturing" : "opt_in_capturing";
    const restoring = original === "granted" ? "opt_in_capturing" : "opt_out_capturing";
    const transition = t.mock.method(f.sdk, failing, () => { throw new Error("fixture partially applied transition"); });
    const restore = t.mock.method(f.sdk, restoring, () => { throw new Error("fixture restoration failure"); });
    f.values.set(CONSENT_KEY, changed);
    f.cookies.set(CONSENT_KEY, changed);
    syncAnalytics(sendPageView);
    assert.equal(transition.mock.callCount(), 1, "first failing transition reached");
    assert.equal(f.window.hsPostHogReady, false);
    f.values.set(CONSENT_KEY, original);
    f.cookies.set(CONSENT_KEY, original);
    f.window.location = new URL("https://hobbysalon.nl/artikelen");
    syncAnalytics(sendPageView);
    sendPageView();
    sendPosthogEvent("sign_up", { method: "email" });
    assert.deepEqual({
      restoreAttempts: restore.mock.callCount(), ready: f.window.hsPostHogReady,
      cached: f.window.hsPostHogConsent, captures: f.calls.length,
    }, { restoreAttempts: 1, ready: false, cached: undefined, captures: 1 });
    restore.mock.restore();
    syncAnalytics(sendPageView);
    assert.equal(f.window.hsPostHogReady, true, "a successful explicit sync establishes safe SDK status");
    assert.equal(f.window.hsPostHogConsent, original === "granted");
    assert.equal(f.views().length, 2);
  });
}
