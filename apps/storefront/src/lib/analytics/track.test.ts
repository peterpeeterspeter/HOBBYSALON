import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readStoredAnalyticsEvents, trackEvent } from "./track";
import { safeProperties } from "./posthog.test-helpers";

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
  if (consent !== null) localStorage.setItem("hs_posthog_consent_v1", consent);
  const fakeWindow = {
    hsPostHogReady: true,
    localStorage,
    sessionStorage: storage(),
    location: new URL("https://hobbysalon.be/workshops?email=private%40example.test#token"),
    dataLayer: [] as unknown[],
    hsPostHog: { capture: (...args: unknown[]) => { calls.push(args); } },
    dispatchEvent: (event: CustomEvent) => { events.push(event); return true; },
  };
  const document = {
    cookie: consent === null ? "" : `hs_posthog_consent_v1=${consent}`,
    referrer: "https://source.example/articles?token=secret#private", title: "Private Person's account",
  };
  for (const [key, value] of Object.entries({ window: fakeWindow, document })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
  }
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    requests.push({ url, init });
    return new Response(null, { status: 204 });
  });
  return { window: fakeWindow, document, calls, events, requests };
}

const page = {
  page_location: "https://hobbysalon.be/workshops", page_referrer: "https://source.example", page_title: "Workshops | Hobbysalon",
};

test("trackEvent captures once while preserving first-party log, passport and custom event", (t) => {
  const f = browser(t);
  trackEvent("newsletter_signup", { signup_source: "newsletter_form", user_id: "internal-user" });
  assert.deepEqual(f.calls, [["newsletter_signup", { hs_safe: { signup_source: "newsletter_form", ...page } }]]);
  assert.deepEqual(f.window.dataLayer, []);
  const storedEvents = readStoredAnalyticsEvents();
  assert.equal(storedEvents.length, 1);
  const [stored] = storedEvents;
  assert.equal(stored.user_id, "internal-user");
  assert.equal(stored.actor_id, "internal-user");
  assert.equal(stored.schema_valid, true);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, "hs:analytics_event");
  assert.deepEqual(f.events[0].detail, stored);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, "/api/analytics/events");
  assert.equal(JSON.parse(f.requests[0].init?.body as string).user_id, "internal-user");
  assert.equal(f.requests[0].init?.credentials, "same-origin");
});

test("legacy Google queue and function are never used by the PostHog bridge", (t) => {
  const f = browser(t);
  const sentinel = { event: "existing-legacy-data" };
  f.window.dataLayer.push(sentinel);
  Object.defineProperty(f.window, "gtag", { get: () => assert.fail("legacy Google transport was accessed") });
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  assert.deepEqual(f.window.dataLayer, [sentinel]);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(safeProperties(f.calls[0]), { signup_source: "newsletter_form", ...page });
});

for (const consent of [null, "denied", "pending", "true", "GRANTED"]) {
  test(`no PostHog custom events with consent ${String(consent)}, first-party tracking remains`, (t) => {
    const f = browser(t, consent);
    trackEvent("newsletter_signup", { signup_source: "newsletter_form", user_id: "internal-user" });
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.window.dataLayer, []);
    assert.equal(f.events.length, 1);
    assert.equal(readStoredAnalyticsEvents().length, 1);
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].url, "/api/analytics/events");
  });
}

test("events before grant, SDK installation or readiness are discarded rather than replayed", (t) => {
  const f = browser(t, null);
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  f.window.localStorage.setItem("hs_posthog_consent_v1", "granted");
  f.document.cookie = "hs_posthog_consent_v1=granted";
  const sdk = f.window.hsPostHog;
  Reflect.deleteProperty(f.window, "hsPostHog");
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  f.window.hsPostHog = sdk;
  f.window.hsPostHogReady = false;
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  f.window.hsPostHogReady = true;
  trackEvent("newsletter_signup", { signup_source: "newsletter_form" });
  assert.equal(f.calls.length, 1);
  assert.equal(readStoredAnalyticsEvents().length, 4);
  assert.deepEqual(f.window.dataLayer, []);
});

test("trackEvent maps inquiries once while retaining original first-party event names", (t) => {
  const f = browser(t);
  const id = "98c88340-1111-4222-8333-123456789abc";
  trackEvent("workshop_booking_request_submitted", { workshop_id: id, creator_id: "internal-creator", user_id: "internal-user" });
  trackEvent("product_inquiry_submitted", { product_id: id, creator_id: "internal-creator", user_id: "internal-user" });
  assert.deepEqual(f.calls, [
    ["generate_lead", { hs_safe: { workshop_id: id, lead_type: "workshop", ...page } }],
    ["generate_lead", { hs_safe: { product_id: id, lead_type: "product", ...page } }],
  ]);
  assert.deepEqual(readStoredAnalyticsEvents().map((event) => event.event), ["workshop_booking_request_submitted", "product_inquiry_submitted"]);
  assert.equal(f.events.length, 2);
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.window.dataLayer, []);
});

test("unknown events stay first-party and are never sent to PostHog", (t) => {
  const f = browser(t);
  trackEvent("custom_internal_event", { query: "private@example.test", user_id: "internal-user" });
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.window.dataLayer, []);
  assert.equal(readStoredAnalyticsEvents()[0].event, "custom_internal_event");
  assert.equal(f.events.length, 1);
  assert.equal(f.requests.length, 1);
});

test("external:false preserves all first-party behavior without sending to PostHog", (t) => {
  const f = browser(t);
  trackEvent("newsletter_signup", { signup_source: "newsletter_form", user_id: "internal-user" }, { external: false });
  assert.deepEqual(f.calls, []);
  assert.equal(readStoredAnalyticsEvents().length, 1);
  assert.equal(f.events.length, 1);
  assert.equal(f.requests.length, 1);
});

test("no window is a safe no-op", (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Reflect.deleteProperty(globalThis, "window");
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); });
  assert.doesNotThrow(() => trackEvent("newsletter_signup"));
  assert.deepEqual(readStoredAnalyticsEvents(), []);
});

for (const boundary of ["storage getter", "storage read", "storage write", "SDK missing", "SDK getter", "capture missing", "capture nonfunction", "capture getter", "capture throw"]) {
  test(`unavailable ${boundary} never interrupts first-party tracking`, (t) => {
    const f = browser(t);
    const unavailable = () => { throw new Error("unavailable"); };
    if (boundary === "storage getter") Object.defineProperty(f.window, "localStorage", { get: unavailable });
    if (boundary === "storage read") f.window.localStorage.getItem = unavailable;
    if (boundary === "storage write") f.window.localStorage.setItem = unavailable;
    if (boundary === "SDK missing") Reflect.deleteProperty(f.window, "hsPostHog");
    if (boundary === "SDK getter") Object.defineProperty(f.window, "hsPostHog", { get: unavailable });
    if (boundary === "capture missing") Reflect.deleteProperty(f.window.hsPostHog, "capture");
    if (boundary === "capture nonfunction") Object.defineProperty(f.window.hsPostHog, "capture", { value: "not a function" });
    if (boundary === "capture getter") Object.defineProperty(f.window.hsPostHog, "capture", { get: unavailable });
    if (boundary === "capture throw") f.window.hsPostHog.capture = unavailable;
    assert.doesNotThrow(() => trackEvent("newsletter_signup", { signup_source: "newsletter_form", user_id: "internal-user" }));
    assert.equal(f.calls.length, boundary === "storage write" ? 1 : 0, "readable existing consent remains valid despite first-party log write errors");
    assert.deepEqual(f.window.dataLayer, []);
    assert.equal(f.events.length, 1);
    assert.equal(f.requests.length, 1);
    if (!boundary.startsWith("storage")) assert.equal(readStoredAnalyticsEvents().length, 1);
  });
}

for (const [event, required] of [
  ["sign_up", ["method"]], ["listing_published", ["listing_type"]],
  ["newsletter_signup_requested", ["signup_source"]], ["product_inquiry_submitted", ["product_id", "creator_id"]],
] as const) {
  test(`${event} retains required-field validation in first-party logs`, (t) => {
    const f = browser(t);
    trackEvent(event);
    const [stored] = readStoredAnalyticsEvents();
    assert.deepEqual(stored.required_fields_missing, required);
    assert.equal(stored.schema_valid, false);
    assert.equal(stored.funnel_stage, "engagement");
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.window.dataLayer, []);
  });
}
