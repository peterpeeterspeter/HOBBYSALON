import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readStoredAnalyticsEvents, trackEvent } from "./track";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function browser(t: TestContext, consent: string | null = "granted") {
  const calls: unknown[][] = [];
  const events: CustomEvent[] = [];
  const requests: Array<{ url: unknown; init: RequestInit | undefined }> = [];
  const localStorage = storage();
  if (consent !== null) localStorage.setItem("hs_analytics_consent", consent);
  const fakeWindow = {
    localStorage,
    sessionStorage: storage(),
    location: new URL("https://hobbysalon.be/workshops?email=private%40example.test#token"),
    dataLayer: [] as unknown[],
    gtag: (...args: unknown[]) => { calls.push(args); },
    dispatchEvent: (event: CustomEvent) => { events.push(event); return true; },
  };
  for (const [key, value] of Object.entries({
    window: fakeWindow,
    document: {
      referrer: "https://source.example/articles?token=secret#private",
      title: "Private Person's account",
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    requests.push({ url, init });
    return new Response(null, { status: 204 });
  });
  return { window: fakeWindow, calls, events, requests };
}

function withoutWindow(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Reflect.deleteProperty(globalThis, "window");
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); });
}

test("trackEvent sends exactly one direct gtag event while preserving internal log, passport and custom event", (t) => {
  const fixture = browser(t);
  trackEvent("newsletter_signup", { signup_source: "newsletter_form", user_id: "internal-user" });
  assert.equal(fixture.calls.length, 1, "custom dataLayer objects are not gtag event commands");
  assert.deepEqual(fixture.calls[0].slice(0, 2), ["event", "newsletter_signup"]);
  assert.deepEqual(fixture.calls[0][2], {
    signup_source: "newsletter_form",
    page_location: "https://hobbysalon.be/workshops",
    page_referrer: "https://source.example/articles",
  });
  assert.deepEqual(fixture.window.dataLayer, []);
  const [stored] = readStoredAnalyticsEvents();
  assert.equal(stored.user_id, "internal-user");
  assert.equal(stored.actor_id, "internal-user");
  assert.equal(stored.schema_valid, true);
  assert.equal(fixture.events.length, 1);
  assert.equal(fixture.events[0].type, "hs:analytics_event");
  assert.deepEqual(fixture.events[0].detail, stored);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].url, "/api/analytics/events");
  assert.equal(JSON.parse(fixture.requests[0].init?.body as string).user_id, "internal-user");
});

test("gtag may enqueue only argument commands, never internal event objects", (t) => {
  const fixture = browser(t);
  fixture.window.gtag = function () {
    fixture.calls.push(Array.from(arguments));
    fixture.window.dataLayer.push(arguments);
  };
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  assert.equal(fixture.window.dataLayer.length, 1);
  assert.deepEqual(Array.from(fixture.window.dataLayer[0] as IArguments).slice(0, 2), ["event", "newsletter_signup"]);
  assert.equal((fixture.window.dataLayer[0] as Record<string, unknown>).event, undefined);
});

for (const consent of [null, "denied", "pending", "true", "GRANTED"]) {
  test(`no Google transport or dataLayer push with consent ${String(consent)}`, (t) => {
    const fixture = browser(t, consent);
    trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
    assert.deepEqual(fixture.calls, []);
    assert.deepEqual(fixture.window.dataLayer, []);
    assert.equal(fixture.events.length, 1, "internal analytics remain available independently");
    assert.equal(readStoredAnalyticsEvents().length, 1);
  });
}

test("events before grant or gtag readiness are discarded, not replayed", (t) => {
  const fixture = browser(t, null);
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  fixture.window.localStorage.setItem("hs_analytics_consent", "granted");
  const gtag = fixture.window.gtag;
  Reflect.deleteProperty(fixture.window, "gtag");
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  fixture.window.gtag = gtag;
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.window.dataLayer, []);
});

test("trackEvent maps each inquiry once while retaining the original internal event", (t) => {
  const fixture = browser(t);
  const id = "98c88340-1111-4222-8333-123456789abc";
  trackEvent("workshop_booking_request_submitted", { workshop_id: id, creator_id: "internal-creator", user_id: "internal-user" });
  trackEvent("product_inquiry_submitted", { product_id: id, creator_id: "internal-creator", user_id: "internal-user" });
  assert.deepEqual(fixture.calls, [
    ["event", "generate_lead", { workshop_id: id, lead_type: "workshop", page_location: "https://hobbysalon.be/workshops", page_referrer: "https://source.example/articles" }],
    ["event", "generate_lead", { product_id: id, lead_type: "product", page_location: "https://hobbysalon.be/workshops", page_referrer: "https://source.example/articles" }],
  ]);
  assert.deepEqual(readStoredAnalyticsEvents().map((event) => event.event), ["workshop_booking_request_submitted", "product_inquiry_submitted"]);
  assert.equal(fixture.events.length, 2);
  assert.equal(fixture.requests.length, 2);
  assert.deepEqual(fixture.window.dataLayer, []);
});

test("unknown events are kept internally but never sent to Google", (t) => {
  const fixture = browser(t);
  trackEvent("custom_internal_event", { query: "private@example.test", user_id: "internal-user" });
  assert.deepEqual(fixture.calls, []);
  assert.deepEqual(fixture.window.dataLayer, []);
  assert.equal(readStoredAnalyticsEvents()[0].event, "custom_internal_event");
  assert.equal(fixture.events.length, 1);
  assert.equal(fixture.requests.length, 1);
});

test("no window is a safe no-op", (t) => {
  withoutWindow(t);
  assert.doesNotThrow(() => trackEvent("newsletter_signup"));
  assert.deepEqual(readStoredAnalyticsEvents(), []);
});

for (const boundary of ["storage getter", "storage read", "gtag missing", "gtag nonfunction", "gtag getter", "gtag throw"]) {
  test(`unavailable ${boundary} never interrupts tracking`, (t) => {
    const fixture = browser(t);
    const unavailable = () => { throw new Error("unavailable"); };
    if (boundary === "storage getter") Object.defineProperty(fixture.window, "localStorage", { get: unavailable });
    if (boundary === "storage read") fixture.window.localStorage.getItem = unavailable;
    if (boundary === "gtag missing") Reflect.deleteProperty(fixture.window, "gtag");
    if (boundary === "gtag nonfunction") Object.defineProperty(fixture.window, "gtag", { value: "not a function" });
    if (boundary === "gtag getter") Object.defineProperty(fixture.window, "gtag", { get: unavailable });
    if (boundary === "gtag throw") fixture.window.gtag = unavailable;
    assert.doesNotThrow(() => trackEvent("newsletter_signup", { signup_source: "newsletter_form" }));
    assert.deepEqual(fixture.calls, []);
    assert.deepEqual(fixture.window.dataLayer, []);
    assert.equal(fixture.events.length, 1);
  });
}

for (const [event, required] of [
  ["sign_up", ["method"]],
  ["listing_published", ["listing_type"]],
  ["newsletter_signup_requested", ["signup_source"]],
  ["product_inquiry_submitted", ["product_id", "creator_id"]],
] as const) {
  test(`new event ${event} retains required-field validation in the internal log`, (t) => {
    const fixture = browser(t);
    trackEvent(event);
    const [stored] = readStoredAnalyticsEvents();
    assert.deepEqual(stored.required_fields_missing, required);
    assert.equal(stored.schema_valid, false);
    assert.equal(stored.funnel_stage, "engagement");
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(fixture.window.dataLayer, []);
  });
}
