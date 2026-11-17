import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { analyticsAllowed, readConsent, sendPageView, setConsent, syncAnalytics } from "./consent";
import { sendPosthogEvent } from "./posthog";
import { browser, environment, safeProperties } from "./posthog.test-helpers";

function loadingBrowser(t: TestContext, host = "hobbysalon.nl") {
  const f = browser(t, { host, installed: false });
  environment(t, { NEXT_PUBLIC_POSTHOG_KEY: "phc_unit_test_only", NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid" });
  // Execute consent.ts's real dynamic-import path, replacing only the SDK boundary.
  t.mock.module("posthog-js", { defaultExport: f.sdk });
  const finish = async () => {
    const loading = f.window.hsPostHogLoading;
    assert.ok(loading, "syncAnalytics must start or reuse the SDK import");
    await loading;
    await Promise.resolve();
  };
  return { ...f, finish };
}

for (const host of ["www.hobbysalon.be", "hobbysalon.nl"]) {
  test(`${host}: loads immediately in cookieless mode with one sanitized pageview`, async (t) => {
    const f = loadingBrowser(t, host);
    f.cookies.set("_ga", "old-cookie");
    syncAnalytics(sendPageView);
    assert.equal(f.cookies.has("_ga"), false, "cleanup must not wait for the import");
    assert.equal(readConsent(), "pending");
    assert.equal(f.views().length, 0);
    await f.finish();
    assert.equal(f.initializations.length, 1);
    assert.equal(f.initializations[0].token, "phc_unit_test_only");
    assert.equal(f.initializations[0].config.api_host, "https://posthog.invalid");
    assert.equal(f.initializations[0].config.cookieless_mode, "on_reject");
    assert.equal(f.initializations[0].config.opt_out_capturing_by_default, true);
    assert.equal(f.initializations[0].config.opt_out_persistence_by_default, true);
    assert.equal(analyticsAllowed(), false);
    assert.equal(readConsent(), "pending");
    assert.deepEqual(f.lifecycle, ["opt_out"]);
    assert.equal(f.views().length, 1);
    assert.deepEqual(safeProperties(f.views()[0]), {
      page_location: `https://${host}/workshops`, page_title: "Workshops | Hobbysalon", page_referrer: "https://source.example",
    });
    assert.ok(!JSON.stringify(f.calls).includes("private"));
    assert.equal(f.window.hsPostHogLoading, undefined);
  });

  test(`${host}: stored refusal loads SDK but never opts in`, async (t) => {
    const f = loadingBrowser(t, host);
    f.values.set("hs_posthog_consent_v1", "denied");
    f.cookies.set("hs_posthog_consent_v1", "denied");
    syncAnalytics(sendPageView);
    await f.finish();
    assert.equal(readConsent(), "denied");
    assert.equal(analyticsAllowed(), false);
    assert.deepEqual(f.lifecycle, ["opt_out"]);
    assert.equal(f.views().length, 1);
  });

  test(`${host}: refusal, grant, withdrawal and regrant never duplicate arrival or initialization`, async (t) => {
    const f = loadingBrowser(t, host);
    syncAnalytics(sendPageView);
    await f.finish();
    for (const choice of ["denied", "granted", "denied", "granted"] as const) {
      setConsent(choice);
      syncAnalytics(sendPageView);
      assert.equal(analyticsAllowed(), choice === "granted");
      assert.equal(f.views().length, 1);
      assert.equal(f.initializations.length, 1);
    }
    syncAnalytics(sendPageView);
    assert.equal(f.views().length, 1, "effect replay does not add a view");
  });

  test(`${host}: cookieless A-B-A and public-private-public arrivals count correctly`, async (t) => {
    const f = loadingBrowser(t, host);
    syncAnalytics(sendPageView);
    await f.finish();
    for (const path of ["/artikelen", "/workshops", "/dashboard/private-person", "/workshops"]) {
      f.window.location = new URL(`https://${host}${path}`);
      syncAnalytics(sendPageView);
    }
    assert.deepEqual(f.views().map((call) => safeProperties(call).page_location), [
      `https://${host}/workshops`, `https://${host}/artikelen`, `https://${host}/workshops`, `https://${host}/workshops`,
    ]);
    assert.equal(f.initializations.length, 1);
    assert.equal(analyticsAllowed(), false);
  });

  test(`${host}: withdrawal during import cannot restore consent and regrant reuses SDK`, async (t) => {
    const f = loadingBrowser(t, host);
    setConsent("granted");
    syncAnalytics(sendPageView);
    assert.equal(analyticsAllowed(), false);
    setConsent("denied");
    await f.finish();
    assert.equal(readConsent(), "denied");
    assert.equal(analyticsAllowed(), false);
    assert.deepEqual(f.lifecycle, ["opt_out"]);
    assert.equal(f.views().length, 1);
    sendPosthogEvent("sign_up", { method: "email" });
    setConsent("granted");
    syncAnalytics(sendPageView);
    assert.equal(analyticsAllowed(), true);
    assert.equal(f.initializations.length, 1);
    assert.deepEqual(f.calls.map(([event]) => event), ["$pageview"]);
  });
}

test("private initial routes never start the SDK import", (t) => {
  const f = loadingBrowser(t);
  f.window.location = new URL("https://hobbysalon.nl/dashboard?token=private");
  syncAnalytics(sendPageView);
  assert.equal(f.window.hsPostHogLoading, undefined);
  assert.equal(f.initializations.length, 0);
  assert.equal(f.window.hsPostHogReady, false);
  assert.deepEqual(f.calls, []);
});

test("import finishing on a private route skips init; returning public can load and activate", async (t) => {
  const f = loadingBrowser(t);
  setConsent("granted");
  syncAnalytics(sendPageView);
  f.window.location = new URL("https://hobbysalon.nl/dashboard?token=private");
  await f.finish();
  assert.equal(f.initializations.length, 0);
  assert.equal(f.window.hsPostHog, undefined);
  assert.equal(f.window.hsPostHogLoading, undefined);
  assert.equal(analyticsAllowed(), false);
  assert.deepEqual(f.calls, []);
  f.window.location = new URL("https://hobbysalon.nl/artikelen");
  syncAnalytics(sendPageView);
  await f.finish();
  assert.equal(f.initializations.length, 1);
  assert.equal(analyticsAllowed(), true);
  assert.equal(f.views().length, 1);
  assert.equal(safeProperties(f.views()[0]).page_location, "https://hobbysalon.nl/artikelen");
});

test("concurrent readiness callbacks share one import and do not duplicate arrival", async (t) => {
  const f = loadingBrowser(t);
  syncAnalytics(sendPageView);
  const loading = f.window.hsPostHogLoading;
  syncAnalytics(sendPageView);
  syncAnalytics(sendPageView);
  assert.equal(f.window.hsPostHogLoading, loading);
  f.window.location = new URL("https://hobbysalon.nl/artikelen?secret=private");
  await f.finish();
  assert.equal(f.initializations.length, 1);
  assert.equal(f.views().length, 1);
  assert.equal(safeProperties(f.views()[0]).page_location, "https://hobbysalon.nl/artikelen");
});

test("SDK initialization errors fail closed without callbacks or an automatic retry loop", async (t) => {
  const f = loadingBrowser(t);
  let attempts = 0;
  f.sdk.init = () => { attempts++; throw new Error("fixture SDK init failed"); };
  let ready = 0;
  syncAnalytics(() => { ready++; sendPageView(); });
  await f.finish();
  assert.equal(attempts, 1);
  assert.equal(f.window.hsPostHogLoadFailed, true);
  assert.equal(f.window.hsPostHogLoading, undefined);
  assert.equal(f.window.hsPostHogReady, false);
  assert.equal(f.window.hsPostHog, undefined);
  syncAnalytics(sendPageView);
  assert.equal(f.window.hsPostHogLoading, undefined);
  assert.equal(attempts, 1);
  assert.equal(ready, 0);
  assert.deepEqual(f.calls, []);
});
