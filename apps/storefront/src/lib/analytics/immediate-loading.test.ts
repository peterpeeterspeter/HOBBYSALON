import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { analyticsAllowed, DENIED_CONSENT, readConsent, sendPageView, setConsent, syncAnalytics } from "./consent";

type Script = { id: string; src: string; onload: () => void; remove: () => void };
function browser(t: TestContext, host: string) {
  const values = new Map<string, string>();
  const cookies = new Map<string, string>();
  const scripts = new Map<string, Script>();
  const target = new EventTarget();
  const window = {
    location: new URL(`https://${host}/workshops?email=private#token`),
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
    dispatchEvent: target.dispatchEvent.bind(target),
    dataLayer: [] as IArguments[],
  };
  const document = {
    referrer: "https://source.example/private?token=secret",
    getElementById: (id: string) => scripts.get(id),
    createElement: () => {
      const script = { remove: () => scripts.delete(script.id) } as Script;
      return script;
    },
    head: { appendChild: (script: Script) => scripts.set(script.id, script) },
  };
  Object.defineProperty(document, "cookie", {
    get: () => [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
    set: (raw: string) => {
      const [key, value] = raw.split(";")[0].split("=");
      if (raw.includes("Max-Age=0")) cookies.delete(key);
      else cookies.set(key, value);
    },
  });
  for (const [key, value] of Object.entries({ window, document })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
  }
  const calls = () => window.dataLayer.map((args) => Array.from(args));
  return {
    window, cookies, values, scripts, calls,
    views: () => calls().filter((args) => args[0] === "event" && args[1] === "page_view"),
    ready: () => scripts.get("hs-google-analytics")!.onload(),
  };
}

for (const host of ["www.hobbysalon.be", "hobbysalon.nl"]) {
  test(`${host}: loads immediately with denied storage and a sanitized pageview`, (t) => {
    const f = browser(t, host);
    f.cookies.set("_ga", "old-cookie");
    syncAnalytics(sendPageView);
    assert.equal(f.scripts.size, 1);
    assert.equal(f.cookies.has("_ga"), false, "cleanup must not wait for the download");
    assert.equal(readConsent(), "pending");
    assert.deepEqual(f.calls()[0], ["consent", "default", DENIED_CONSENT]);
    assert.equal(f.views().length, 0);
    f.ready();
    assert.equal(analyticsAllowed(), false, "custom/conversion events still require a grant");
    assert.equal(f.cookies.has("_ga"), false);
    assert.equal(f.views().length, 1);
    assert.deepEqual(f.views()[0][2], {
      page_location: `https://${host}/workshops`,
      page_title: "Workshops | Hobbysalon",
      page_referrer: "https://source.example",
    });
    assert.ok(f.calls().filter((c) => c[0] === "consent").every((c) => (c[2] as typeof DENIED_CONSENT).analytics_storage === "denied"));
    assert.ok(!JSON.stringify(f.calls()).includes("private"));
  });

  test(`${host}: stored refusal still loads, never grants cookies`, (t) => {
    const f = browser(t, host);
    f.values.set("hs_analytics_consent", "denied");
    f.cookies.set("hs_analytics_consent", "denied");
    syncAnalytics(sendPageView);
    assert.equal(f.scripts.size, 1);
    f.ready();
    assert.equal(readConsent(), "denied");
    assert.equal(analyticsAllowed(), false);
    assert.equal(f.views().length, 1);
  });

  test(`${host}: refusal, grant, withdrawal and regrant never duplicate the arrival`, (t) => {
    const f = browser(t, host);
    syncAnalytics(sendPageView);
    assert.equal(f.scripts.size, 1);
    f.ready();
    for (const choice of ["denied", "granted", "denied", "granted"] as const) {
      setConsent(choice);
      syncAnalytics(sendPageView);
      assert.equal(analyticsAllowed(), choice === "granted");
      assert.equal(f.views().length, 1);
      assert.equal(f.scripts.size, 1);
    }
    syncAnalytics(sendPageView);
    assert.equal(f.views().length, 1, "effect replay does not add a view");
  });

  test(`${host}: cookieless A-B-A and public-private-public arrivals count correctly`, (t) => {
    const f = browser(t, host);
    syncAnalytics(sendPageView);
    assert.equal(f.scripts.size, 1);
    f.ready();
    for (const path of ["/artikelen", "/workshops", "/dashboard/private-person", "/workshops"]) {
      f.window.location = new URL(`https://${host}${path}`);
      syncAnalytics(sendPageView);
    }
    assert.equal(f.views().length, 4);
    assert.ok(!JSON.stringify(f.views()).includes("private-person"));
  });

  test(`${host}: withdrawal during script loading cannot restore cookie permission`, (t) => {
    const f = browser(t, host);
    setConsent("granted");
    syncAnalytics(sendPageView);
    setConsent("denied");
    f.ready();
    assert.equal(readConsent(), "denied");
    assert.equal(analyticsAllowed(), false);
    assert.equal(f.views().length, 1);
    const update = f.calls().filter((c) => c[0] === "consent" && c[1] === "update").at(-1);
    assert.deepEqual(update?.[2], DENIED_CONSENT);
  });
}
