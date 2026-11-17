import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { consumeConversionReceipt } from "./receipt";
import { setConsent, syncAnalytics, sendPageView, readConsentGeneration } from "./consent";
import { CONVERSION_COOKIE, CONSENT_GENERATION_KEY } from "./conversions";
import { browser as createBrowser, safeProperties } from "./posthog.test-helpers";

function browser(t: TestContext, path = "/workshops") {
  const f = createBrowser(t, { consent: "granted", ready: true, path });
  const generation = "11111111-1111-4111-8111-111111111111";
  f.cookies.set(CONSENT_GENERATION_KEY, generation);
  f.values.set(CONSENT_GENERATION_KEY, generation);
  const put = (id: string, event = "listing_published", payload: Record<string, string> = { listing_type: "handmade" }, epoch = f.values.get(CONSENT_GENERATION_KEY)) =>
    f.cookies.set(CONVERSION_COOKIE, encodeURIComponent(JSON.stringify({ id, event, payload, generation: epoch })));
  return { ...f, put };
}

test("public ready consumer deletes before dispatch and emits the sanitized receipt exactly once", (t) => {
  const f = browser(t);
  const capture = f.sdk.capture;
  f.sdk.capture = (...args) => {
    assert.equal(f.cookies.has(CONVERSION_COOKIE), false, "delete must happen before capture");
    capture(...args);
  };
  f.put("receipt_test_public");
  consumeConversionReceipt();
  consumeConversionReceipt();
  assert.deepEqual(f.calls, [["listing_published", { hs_safe: {
    listing_type: "handmade", page_location: "https://hobbysalon.nl/workshops", page_title: "Workshops | Hobbysalon", page_referrer: "https://source.example",
  } }]]);
  f.put("receipt_test_public");
  consumeConversionReceipt();
  assert.equal(f.calls.length, 1);
  assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
});

test("private route retains a consented receipt until public SDK activation consumes it", (t) => {
  const f = browser(t, "/dashboard?token=private");
  f.put("receipt_test_private");
  f.cookies.set("_ga", "erase");
  syncAnalytics(sendPageView);
  consumeConversionReceipt();
  assert.equal(f.window.hsPostHogReady, false);
  assert.equal(f.cookies.has("_ga"), false);
  assert.equal(f.cookies.has(CONVERSION_COOKIE), true);
  assert.deepEqual(f.calls, []);
  f.window.location = new URL("https://hobbysalon.nl/workshops");
  syncAnalytics(() => { sendPageView(); consumeConversionReceipt(); });
  assert.deepEqual(f.calls.map(([event]) => event), ["$pageview", "listing_published"]);
  assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
  assert.equal(f.initializations.length, 0, "installed SDK is reused rather than replaced");
});

test("not ready never consumes; withdrawal deletes receipt and regrant cannot replay", (t) => {
  const f = browser(t);
  f.put("receipt_test_withdrawal");
  f.window.hsPostHogReady = false;
  consumeConversionReceipt();
  assert.equal(f.calls.length, 0);
  assert.equal(f.cookies.has(CONVERSION_COOKIE), true);
  setConsent("denied");
  assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
  setConsent("granted");
  syncAnalytics(consumeConversionReceipt);
  assert.equal(f.window.hsPostHogReady, true);
  assert.deepEqual(f.calls, []);
});

test("malformed and unsupported receipts are discarded without a conversion", (t) => {
  const f = browser(t);
  for (const raw of ["%bad", encodeURIComponent("{}"), encodeURIComponent(JSON.stringify({ id: "receipt_test_bad", event: "purchase", payload: {} }))]) {
    f.cookies.set(CONVERSION_COOKIE, raw);
    consumeConversionReceipt();
    assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
  }
  assert.equal(f.calls.length, 0);
});

test("double opt-in receipt sends only allowlisted newsletter fields", (t) => {
  const f = browser(t);
  f.put("receipt_test_double", "newsletter_signup", { signup_source: "lead_magnet_form", opt_in_method: "double", email: "private" });
  consumeConversionReceipt();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], "newsletter_signup");
  assert.deepEqual(safeProperties(f.calls[0]), {
    signup_source: "lead_magnet_form", opt_in_method: "double", page_location: "https://hobbysalon.nl/workshops", page_title: "Workshops | Hobbysalon", page_referrer: "https://source.example",
  });
});

test("route tracker invokes receipt only from transport readiness", () => {
  const source = readFileSync(new URL("../../components/analytics/AnalyticsRouteTracker.tsx", import.meta.url), "utf8");
  assert.match(source, /const ready = \(\) => \{ sendPageView\(\); consumeConversionReceipt\(\); \}/);
  assert.match(source, /syncAnalytics\(ready\)/);
});

test("late response from an earlier grant cannot replay after withdrawal and regrant", (t) => {
  const f = browser(t);
  const oldGeneration = readConsentGeneration()!;
  setConsent("denied");
  setConsent("granted");
  syncAnalytics(consumeConversionReceipt);
  assert.notEqual(readConsentGeneration(), oldGeneration);
  f.put("receipt_test_late", "listing_published", { listing_type: "handmade" }, oldGeneration);
  consumeConversionReceipt();
  assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
  assert.deepEqual(f.calls, []);
  f.put("receipt_test_current");
  consumeConversionReceipt();
  assert.deepEqual(f.calls.map(([event]) => event), ["listing_published"], "new generation still works");
});

for (const failure of ["missing generation", "mismatching generation", "generation read throws", "cookie deletion ignored", "cookie deletion throws", "SDK capture throws"]) {
  test(`receipt fails safely when ${failure}`, (t) => {
    const f = browser(t);
    f.put(`receipt_test_${failure.replaceAll(" ", "_")}`);
    if (failure === "missing generation") f.values.delete(CONSENT_GENERATION_KEY);
    if (failure === "mismatching generation") f.values.set(CONSENT_GENERATION_KEY, "22222222-2222-4222-8222-222222222222");
    if (failure === "generation read throws") {
      const get = f.window.localStorage.getItem;
      f.window.localStorage.getItem = (key) => { if (key === CONSENT_GENERATION_KEY) throw new Error("fixture generation failure"); return get(key); };
    }
    if (failure === "cookie deletion ignored") Object.defineProperty(f.document, "cookie", { set: () => {} });
    if (failure === "cookie deletion throws") Object.defineProperty(f.document, "cookie", { set: () => { throw new Error("fixture cookie failure"); } });
    if (failure === "SDK capture throws") f.sdk.capture = () => { throw new Error("fixture capture failure"); };
    assert.doesNotThrow(consumeConversionReceipt);
    assert.doesNotThrow(consumeConversionReceipt);
    assert.deepEqual(f.calls, []);
    assert.equal(f.cookies.has(CONVERSION_COOKIE), failure.startsWith("cookie deletion"));
  });
}
