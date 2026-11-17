import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { consumeConversionReceipt } from "./receipt";
import { setConsent, readConsentGeneration } from "./consent";
import { CONVERSION_COOKIE, CONSENT_GENERATION_KEY } from "./conversions";
import { browser as createBrowser } from "./posthog.test-helpers";
function browser(t: TestContext, path = "/dashboard?token=PRIVATE") {
  const f = createBrowser(t, { consent: "granted", ready: false, path });
  const generation = "11111111-1111-4111-8111-111111111111";
  f.cookies.set(CONSENT_GENERATION_KEY, generation); f.values.set(CONSENT_GENERATION_KEY, generation);
  const requests: any[] = [];
  t.mock.method(globalThis, "fetch", async (url: any, options: any) => {
    assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
    requests.push({ url, ...options }); return new Response(null, { status: 204 });
  });
  const put = (extra: any = {}) => f.cookies.set(CONVERSION_COOKIE, encodeURIComponent(JSON.stringify({
    id: crypto.randomUUID(), event: "listing_published", payload: { listing_type: "handmade", email: "PRIVATE" },
    generation: readConsentGeneration(), signature: "a".repeat(64), expiresAt: Date.now() + 300000, ...extra,
  })));
  return { ...f, put, requests };
}
test("consumer works on private route without SDK and deletes before single sanitized POST", t => {
  const f = browser(t); const id = crypto.randomUUID(); f.put({ id });
  consumeConversionReceipt(); consumeConversionReceipt(); f.put({ id }); consumeConversionReceipt();
  assert.equal(f.requests.length, 1); assert.deepEqual(f.calls, []);
  assert.equal(f.requests[0].url, "/api/analytics/conversions");
  assert.equal(f.requests[0].referrerPolicy, "no-referrer"); assert.equal(f.requests[0].credentials, "same-origin");
  assert.doesNotMatch(f.requests[0].body, /PRIVATE|page_location|session_id|email/);
});
test("withdrawal aborts inflight request and late old-generation receipt cannot replay", t => {
  const f = browser(t), old = readConsentGeneration(); f.put(); consumeConversionReceipt();
  setConsent("denied"); assert.equal(f.requests[0].signal.aborted, true);
  f.put(); consumeConversionReceipt(); assert.equal(f.requests.length, 1);
  setConsent("granted"); f.put({ generation: old }); consumeConversionReceipt(); assert.equal(f.requests.length, 1);
});
test("malformed unsigned expired and mismatched receipts are discarded", t => {
  const f = browser(t);
  for (const extra of [{ signature: undefined }, { expiresAt: undefined }, { expiresAt: Date.now() - 1 }, { generation: "bad" }, { event: "purchase" }]) {
    f.put(extra); consumeConversionReceipt(); assert.equal(f.cookies.has(CONVERSION_COOKIE), false);
  }
  f.cookies.set(CONVERSION_COOKIE, "%bad"); consumeConversionReceipt(); assert.equal(f.requests.length, 0);
});
for (const failure of ["missing generation", "generation read throws", "cookie deletion ignored", "cookie deletion throws"]) {
  test(`consumer fails closed: ${failure}`, t => {
    const f = browser(t); f.put();
    if (failure === "missing generation") f.values.delete(CONSENT_GENERATION_KEY);
    if (failure === "generation read throws") f.window.localStorage.getItem = () => { throw new Error("offline"); };
    if (failure === "cookie deletion ignored") Object.defineProperty(f.document, "cookie", { set: () => {} });
    if (failure === "cookie deletion throws") Object.defineProperty(f.document, "cookie", { set: () => { throw new Error("offline"); } });
    assert.doesNotThrow(consumeConversionReceipt); assert.equal(f.requests.length, 0);
  });
}
test("tracker invokes receipts independent of SDK readiness", () => {
  const source = readFileSync(new URL("../../components/analytics/AnalyticsRouteTracker.tsx", import.meta.url), "utf8");
  assert.match(source, /syncAnalytics\(ready\); consumeConversionReceipt\(\)/);
});
