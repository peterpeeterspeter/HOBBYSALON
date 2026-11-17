import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_CHANGED } from "./consent";
import { waitForMountMeasurement } from "./mount";
import { browser } from "./posthog.test-helpers";

test("consented mount waits for PostHog readiness once and sends the captured safe payload", (t) => {
  const f = browser(t, { consent: "granted" });
  let done = 0;
  const payload = { item_count: 2, email: "private" };
  waitForMountMeasurement("checkout_started", payload, () => { done++; });
  payload.item_count = 9;
  assert.equal(f.calls.length, 0);
  f.window.dispatchEvent(new Event("hs:ga4_ready"));
  assert.equal(f.calls.length, 0, "legacy readiness events do not activate PostHog");
  f.ready();
  f.ready();
  assert.equal(done, 1);
  assert.deepEqual(f.calls, [["begin_checkout", { hs_safe: {
    item_count: 2, page_location: "https://hobbysalon.nl/workshops", page_title: "Workshops | Hobbysalon", page_referrer: "https://source.example",
  } }]]);
});

for (const consent of [undefined, "denied"]) {
  test(`${consent ?? "pending"} mount is discarded and never replayed after grant`, (t) => {
    const f = browser(t, { consent });
    let done = 0;
    waitForMountMeasurement("project_view", {}, () => { done++; });
    assert.equal(done, 1);
    f.values.set("hs_posthog_consent_v1", "granted");
    f.cookies.set("hs_posthog_consent_v1", "granted");
    f.window.dispatchEvent(new Event(CONSENT_CHANGED));
    f.ready();
    assert.equal(done, 1);
    assert.equal(f.calls.length, 0);
  });
}

test("withdrawal cancels a pending consented mount permanently", (t) => {
  const f = browser(t, { consent: "granted" });
  let done = 0;
  waitForMountMeasurement("project_view", {}, () => { done++; });
  f.values.set("hs_posthog_consent_v1", "denied");
  f.window.dispatchEvent(new Event(CONSENT_CHANGED));
  assert.equal(done, 1);
  f.values.set("hs_posthog_consent_v1", "granted");
  f.ready();
  assert.equal(done, 1);
  assert.equal(f.calls.length, 0);
});

test("unmount cleanup cancels pending delivery", (t) => {
  const f = browser(t, { consent: "granted" });
  let done = 0;
  const cancel = waitForMountMeasurement("project_view", {}, () => { done++; });
  cancel();
  f.ready();
  assert.equal(done, 0);
  assert.equal(f.calls.length, 0);
});

test("ready transport measures a consented mount immediately and only once", (t) => {
  const f = browser(t, { consent: "granted", ready: true });
  let done = 0;
  waitForMountMeasurement("project_view", {}, () => { done++; });
  assert.equal(done, 1);
  assert.equal(f.calls.length, 1);
  f.ready();
  assert.equal(f.calls.length, 1);
});

test("private-route mounts are never deferred for a later public route", (t) => {
  const f = browser(t, { consent: "granted", path: "/dashboard?token=private" });
  let done = 0;
  waitForMountMeasurement("project_view", {}, () => { done++; });
  assert.equal(done, 1);
  f.window.location = new URL("https://hobbysalon.nl/workshops");
  f.ready();
  assert.equal(f.calls.length, 0);
});

test("readiness on a different route cancels stale mount delivery", (t) => {
  const f = browser(t, { consent: "granted" });
  waitForMountMeasurement("project_view", {}, () => {});
  f.window.location = new URL("https://hobbysalon.nl/artikelen");
  f.ready();
  f.window.location = new URL("https://hobbysalon.nl/workshops");
  f.ready();
  assert.equal(f.calls.length, 0);
});

test("query-only changes do not discard a pending mount on the same route", (t) => {
  const f = browser(t, { consent: "granted" });
  waitForMountMeasurement("project_view", {}, () => {});
  f.window.location = new URL("https://hobbysalon.nl/workshops?other=private#secret");
  f.ready();
  assert.equal(f.calls.length, 1);
  assert.ok(!JSON.stringify(f.calls).includes("private"));
});
