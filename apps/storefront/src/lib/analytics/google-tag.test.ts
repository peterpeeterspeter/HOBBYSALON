import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { GA4_ID, loadGoogleTag, sendGoogleEvent, sendGooglePageView, updateGoogleConsent } from "./google-tag";

function browser(t: TestContext, options: { path?: string; consent?: string } = {}) {
  const values = new Map<string, string>();
  const cookies = new Map<string, string>();
  if (options.consent) {
    values.set("hs_posthog_consent_v1", options.consent);
    cookies.set("hs_posthog_consent_v1", options.consent);
  }
  const scripts: Array<Record<string, unknown>> = [];
  const window: Record<string, unknown> = {
    location: new URL(`https://www.hobbysalon.be${options.path ?? "/workshops?email=private"}`),
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: () => {}, removeItem: () => {} },
  };
  const document = {
    referrer: "",
    get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(_value: string) { /* not needed */ },
    createElement: () => ({}) as Record<string, unknown>,
    head: { appendChild: (node: Record<string, unknown>) => { scripts.push(node); } },
  };
  Object.assign(globalThis, { window, document });
  t.after(() => { delete (globalThis as Record<string, unknown>).window; delete (globalThis as Record<string, unknown>).document; });
  const calls = () => ((window.dataLayer ?? []) as IArguments[]).map((entry) => Array.from(entry));
  return { window, scripts, calls };
}

test("loads for pending visitors with every storage denied and no ga-disable", (t) => {
  const f = browser(t);
  loadGoogleTag();
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
  const consent = f.calls().find((c) => c[0] === "consent" && c[1] === "default")!;
  assert.equal((consent[2] as Record<string, string>).analytics_storage, "denied");
  assert.equal((consent[2] as Record<string, string>).ad_storage, "denied");
  assert.equal(f.window[`ga-disable-${GA4_ID}`], undefined);
  const config = f.calls().find((c) => c[0] === "config")!;
  assert.equal((config[2] as Record<string, unknown>).send_page_view, false);
});

test("a stored grant starts with analytics storage granted, ads still denied", (t) => {
  const f = browser(t, { consent: "granted" });
  loadGoogleTag();
  const consent = f.calls().find((c) => c[0] === "consent")![2] as Record<string, string>;
  assert.equal(consent.analytics_storage, "granted");
  assert.equal(consent.ad_user_data, "denied");
});

test("page views use the route template and never the raw URL", (t) => {
  const f = browser(t, { path: "/workshop/jan-peeters-haken?email=private" });
  loadGoogleTag();
  sendGooglePageView();
  sendGooglePageView();
  const views = f.calls().filter((c) => c[0] === "event" && c[1] === "page_view");
  assert.equal(views.length, 1);
  assert.equal((views[0][2] as Record<string, string>).page_location, "https://www.hobbysalon.be/workshop/detail");
  assert.ok(!JSON.stringify(f.calls()).includes("private"));
  assert.ok(!JSON.stringify(f.calls()).includes("jan-peeters"));
});

test("private routes do not load the tag", (t) => {
  const f = browser(t, { path: "/account/orders" });
  loadGoogleTag();
  assert.equal(f.scripts.length, 0);
});

test("consent updates are mirrored and events need a grant", (t) => {
  const f = browser(t);
  loadGoogleTag();
  sendGoogleEvent("sign_up", { method: "email" });
  assert.equal(f.calls().filter((c) => c[0] === "event").length, 0);
  updateGoogleConsent();
  const update = f.calls().find((c) => c[0] === "consent" && c[1] === "update")!;
  assert.equal((update[2] as Record<string, string>).analytics_storage, "denied");
});
