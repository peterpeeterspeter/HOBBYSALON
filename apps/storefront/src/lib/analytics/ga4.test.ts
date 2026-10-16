import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { sendGa4Event } from "./ga4";

const UUID = "98c88340-1111-4222-8333-123456789abc";
const PAGE = "https://hobbysalon.be/workshops";
const REFERRER = "https://source.example/articles";

function browser(t: TestContext) {
  const calls: unknown[][] = [];
  const values = new Map([["hs_analytics_consent", "granted"]]);
  const fakeWindow = {
    location: new URL(`${PAGE}?email=private%40example.test#token`),
    localStorage: { getItem: (key: string) => values.get(key) ?? null },
    gtag: (...args: unknown[]) => { calls.push(args); },
  };
  const fakeDocument = { referrer: `${REFERRER}?secret=private#token`, title: "Private Person" };
  for (const [key, value] of Object.entries({ window: fakeWindow, document: fakeDocument })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.mock.method(globalThis, "fetch", async () => {
    assert.fail("GA4 transport must not make HTTP calls");
  });
  return { window: fakeWindow, document: fakeDocument, values, calls };
}

function params(call: unknown[]) {
  return call[2] as Record<string, unknown>;
}

function expected(payload: Record<string, unknown> = {}) {
  return { ...payload, page_location: PAGE, page_referrer: REFERRER };
}

test("only explicit safe parameters cross the bridge, not internal metadata or PII", (t) => {
  const fixture = browser(t);
  const payload = {
    project_id: UUID, difficulty_level: "beginner",
    user_id: "internal-user", creator_id: UUID, actor_id: "actor", visitor_id: "visitor", session_id: "session",
    event_id: "internal-event", event_version: 1, timestamp: "2026-01-01", source: "storefront", funnel_stage: "discovery",
    email: "private@example.test", name: "Private Person", address: "Private Street", query: "free text", message: "private",
    project_slug: "private-person", bundle_label: "Private name", product_name: "Private name",
    href: "https://example.test?token=secret", url: "https://example.test?token=secret", referrer: "raw referrer",
    token: "secret", path_full: "/?email=secret", route: "/private@example.test", page_title: "Private Person",
    page_location: "https://malicious.example?token=private", page_referrer: "https://malicious.example?token=private",
    entity_keys: ["user_id"], nested: { email: "private@example.test" }, quantity: 3,
  };
  sendGa4Event("project_view", payload);
  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(fixture.calls[0], ["event", "project_view", expected({ project_id: UUID, difficulty_level: "beginner" })]);
  assert.equal(payload.page_title, "Private Person", "input is not mutated");
});

test("location and referrer are rebuilt from origin plus pathname with no credentials, query or hash", (t) => {
  const fixture = browser(t);
  fixture.document.referrer = "https://login:password@source.example/articles?email=private#token";
  sendGa4Event("home_search_submitted", { query: "private@example.test" });
  assert.deepEqual(params(fixture.calls[0]), expected());
});

for (const referrer of ["", "not a URL", "javascript:secret", "data:text/plain,private", "//source.example/path"]) {
  test(`invalid or non-HTTP referrer is omitted: ${referrer}`, (t) => {
    const fixture = browser(t);
    fixture.document.referrer = referrer;
    sendGa4Event("home_search_submitted");
    assert.deepEqual(params(fixture.calls[0]), { page_location: PAGE });
  });
}

test("missing document does not prevent a bounded event", (t) => {
  const fixture = browser(t);
  Reflect.deleteProperty(globalThis, "document");
  sendGa4Event("home_search_submitted");
  assert.deepEqual(params(fixture.calls[0]), { page_location: PAGE });
});

for (const [event, payload, ga4Event, safe] of [
  ["workshop_booking_request_submitted", { workshop_id: UUID, creator_id: UUID, lead_type: "spoofed" }, "generate_lead", { workshop_id: UUID, lead_type: "workshop" }],
  ["product_inquiry_submitted", { product_id: UUID, creator_id: UUID, lead_type: "spoofed" }, "generate_lead", { product_id: UUID, lead_type: "product" }],
  ["sign_up", { method: "email", email: "private@example.test" }, "sign_up", { method: "email" }],
  ["listing_published", { listing_type: "handmade", product_id: UUID }, "listing_published", { listing_type: "handmade", product_id: UUID }],
  ["listing_published", { listing_type: "destash" }, "listing_published", { listing_type: "destash" }],
  ["newsletter_signup", { signup_source: "footer_form", opt_in_method: "single", lead_magnet_code: "haak-gids" }, "newsletter_signup", { signup_source: "footer_form", opt_in_method: "single", lead_magnet_code: "haak-gids" }],
  ["newsletter_signup", { signup_source: "lead_magnet_form", opt_in_method: "double" }, "newsletter_signup", { signup_source: "lead_magnet_form", opt_in_method: "double" }],
  ["newsletter_signup_requested", { signup_source: "newsletter_form", lead_magnet_code: "haak-gids", opt_in_method: "single" }, "newsletter_signup_requested", { signup_source: "newsletter_form", lead_magnet_code: "haak-gids" }],
  ["checkout_completed", { order_id: "order_private", item_count: 2 }, "checkout_completed", { item_count: 2 }],
] as const) {
  test(`${event} maps once to ${ga4Event} with only its allowed parameters ${JSON.stringify(safe)}`, (t) => {
    const fixture = browser(t);
    sendGa4Event(event, payload);
    assert.deepEqual(fixture.calls, [["event", ga4Event, expected(safe)]]);
  });
}

for (const event of ["", "unknown_event", "purchase", "generate_lead", "user_private@example.test", "constructor", "toString", "__proto__"]) {
  test(`unknown event fails closed: ${event}`, (t) => {
    const fixture = browser(t);
    sendGa4Event(event, { quantity: 2 });
    assert.deepEqual(fixture.calls, []);
  });
}

for (const event of ["project_view", "home_recommendations_viewed", "home_search_submitted", "home_route_clicked", "home_event_clicked", "home_journey_clicked", "home_provider_clicked", "bundle_add", "add_to_cart", "checkout_started", "checkout_completed", "tool_calculated", "tool_materials_clicked"]) {
  test(`existing event is allowed exactly once: ${event}`, (t) => {
    const fixture = browser(t);
    sendGa4Event(event);
    assert.deepEqual(fixture.calls, [["event", event, expected()]]);
  });
}

test("controlled enums and bounded slug codes are preserved", (t) => {
  const fixture = browser(t);
  sendGa4Event("tool_calculated", { tool_slug: "workshop-break-even", formula_id: "workshop_breakeven", query: "private" });
  sendGa4Event("home_recommendations_viewed", { recommendation_source: "hobby_passport", item_count: 4 });
  sendGa4Event("project_view", { difficulty_level: "advanced", project_id: UUID });
  assert.deepEqual(params(fixture.calls[0]), expected({ tool_slug: "workshop-break-even", formula_id: "workshop_breakeven" }));
  assert.deepEqual(params(fixture.calls[1]), expected({ recommendation_source: "hobby_passport", item_count: 4 }));
  assert.deepEqual(params(fixture.calls[2]), expected({ difficulty_level: "advanced", project_id: UUID }));
});

for (const value of [null, true, {}, [], 42, "", "free text", "private@example.test", "https://example.test", "x?token=private", "encoded%40private", "a".repeat(65)]) {
  test(`unsafe string parameter value is omitted: ${JSON.stringify(value)}`, (t) => {
    const fixture = browser(t);
    sendGa4Event("tool_calculated", { tool_slug: value, formula_id: value });
    sendGa4Event("newsletter_signup", { signup_source: value, opt_in_method: value, lead_magnet_code: value });
    sendGa4Event("project_view", { project_id: value, difficulty_level: value });
    sendGa4Event("listing_published", { listing_type: value });
    sendGa4Event("sign_up", { method: value });
    assert.equal(fixture.calls.length, 5);
    for (const call of fixture.calls) assert.deepEqual(params(call), expected());
  });
}

test("arbitrary slug-shaped values do not bypass fixed enums or UUID validation", (t) => {
  const fixture = browser(t);
  sendGa4Event("project_view", { project_id: "private-name", difficulty_level: "private-name" });
  sendGa4Event("listing_published", { listing_type: "supply" });
  sendGa4Event("sign_up", { method: "private-name" });
  sendGa4Event("newsletter_signup", { signup_source: "private-name", opt_in_method: "private-name" });
  for (const call of fixture.calls) assert.deepEqual(params(call), expected());
});

for (const value of [NaN, Infinity, -Infinity, -1, 0.5, 10001, "3", null, true, {}, []]) {
  test(`invalid quantity and item_count are omitted: ${String(value)}`, (t) => {
    const fixture = browser(t);
    sendGa4Event("add_to_cart", { quantity: value });
    sendGa4Event("bundle_add", { item_count: value });
    for (const call of fixture.calls) assert.deepEqual(params(call), expected());
  });
}

test("bounded scalar counts include zero and the maximum", (t) => {
  const fixture = browser(t);
  sendGa4Event("add_to_cart", { quantity: 1 });
  sendGa4Event("bundle_add", { item_count: 0 });
  sendGa4Event("checkout_started", { item_count: 10000 });
  assert.deepEqual(params(fixture.calls[0]), expected({ quantity: 1 }));
  assert.deepEqual(params(fixture.calls[1]), expected({ item_count: 0 }));
  assert.deepEqual(params(fixture.calls[2]), expected({ item_count: 10000 }));
});

test("bridge reads consent on each call and never replays dropped events", (t) => {
  const fixture = browser(t);
  fixture.values.delete("hs_analytics_consent");
  sendGa4Event("sign_up", { method: "email" });
  fixture.values.set("hs_analytics_consent", "granted");
  sendGa4Event("sign_up", { method: "email" });
  fixture.values.set("hs_analytics_consent", "denied");
  sendGa4Event("sign_up", { method: "email" });
  assert.deepEqual(fixture.calls, [["event", "sign_up", expected({ method: "email" })]]);
});

test("bridge safely ignores malformed payloads and throwing property access", (t) => {
  const fixture = browser(t);
  const hostile = Object.defineProperty({}, "method", { get: () => { throw new Error("private"); } });
  assert.doesNotThrow(() => sendGa4Event("sign_up", hostile));
  assert.deepEqual(fixture.calls, []);
  for (const payload of [null, [], 5, "private"]) {
    assert.doesNotThrow(() => sendGa4Event("sign_up", payload as unknown as Record<string, unknown>));
  }
  assert.deepEqual(fixture.calls, []);
});
