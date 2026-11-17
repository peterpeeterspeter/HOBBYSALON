import assert from "node:assert/strict";
import test from "node:test";
import { posthogConfig, sanitizePosthogEvent } from "./posthog-config";
import { browser } from "./posthog.test-helpers";

test("SDK configuration disables automatic capture and third-party feature loading", () => {
  const config = posthogConfig();
  assert.equal(config.cookieless_mode, "on_reject");
  assert.equal(config.opt_out_capturing_by_default, true);
  assert.equal(config.opt_out_persistence_by_default, true);
  assert.equal(config.capture_pageview, false);
  assert.equal(config.capture_pageleave, false);
  assert.equal(config.autocapture, false);
  assert.equal(config.capture_dead_clicks, false);
  assert.equal(config.capture_exceptions, false);
  assert.equal(config.capture_heatmaps, false);
  assert.equal(config.capture_performance, false);
  assert.equal(config.person_profiles, "never");
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.disable_surveys, true);
  assert.equal(config.disable_product_tours, true);
  assert.equal(config.disable_conversations, true);
  assert.equal(config.advanced_disable_flags, true);
  assert.equal(config.disable_external_dependency_loading, true);
  assert.equal(config.cross_subdomain_cookie, false);
  assert.equal(config.save_campaign_params, false);
  assert.equal(config.save_referrer, false);
  assert.equal(config.request_batching, false);
  assert.equal(config.ip, false);
  assert.equal(config.before_send, sanitizePosthogEvent);
});

function enriched(event: string, safe: unknown = {}) {
  return {
    event,
    properties: {
      hs_safe: safe,
      token: "phc_unit_test_only", distinct_id: "sdk-transport-id", $lib: "web", $lib_version: "test-version",
      $device_id: "device-id", $session_id: "session-id", $window_id: "window-id",
      $current_url: "https://hobbysalon.nl/?email=private", $pathname: "/private-person", $host: "untrusted.invalid",
      $referrer: "https://source.example/private?token=private", $initial_referrer: "https://source.example/private",
      $initial_current_url: "https://hobbysalon.nl/?email=private", $set: { email: "private" }, $set_once: { name: "private" },
      utm_source: "private", $ip: "192.0.2.1", $browser: "private", $geoip_city_name: "private",
      email: "private", user_id: "private", hs_analytics_generation: "private", $process_person_profile: true,
    },
  } as unknown as NonNullable<Parameters<typeof sanitizePosthogEvent>[0]>;
}

const transport = { token: "phc_unit_test_only", distinct_id: "sdk-transport-id", $lib: "web", $lib_version: "test-version" };
const page = {
  page_location: "https://hobbysalon.nl/workshops", page_title: "Workshops | Hobbysalon", page_referrer: "https://source.example",
  $current_url: "https://hobbysalon.nl/workshops", $pathname: "/workshops", $host: "hobbysalon.nl", $referrer: "https://source.example", $process_person_profile: false,
};

for (const consent of [undefined, "denied", "granted"]) {
  test(`${consent ?? "pending"}: before_send strips SDK-enriched PII and keeps only permitted transport identity`, (t) => {
    browser(t, { consent });
    const input = enriched("$pageview");
    input.properties.$raw_user_agent = "unit-test-user-agent";
    if (consent !== "granted") input.properties.distinct_id = "$posthog_cookieless";
    const output = sanitizePosthogEvent(input);
    assert.equal(output?.event, "$pageview");
    assert.deepEqual(output?.properties, {
      ...transport,
      ...(consent === "granted"
        ? { $device_id: "device-id", $session_id: "session-id", $window_id: "window-id" }
        : { distinct_id: "$posthog_cookieless", $raw_user_agent: "unit-test-user-agent" }),
      ...page,
    });
    assert.equal(input.properties.email, "private", "SDK input is not mutated");
    assert.ok(!JSON.stringify(output).includes("private"));
  });
}

test("granted before_send keeps approved custom parameters while rebuilding page context", (t) => {
  browser(t, { consent: "granted" });
  const output = sanitizePosthogEvent(enriched("sign_up", { method: "email", page_location: "https://untrusted.invalid/?private", page_title: "private" }));
  assert.deepEqual(output?.properties, {
    ...transport, $device_id: "device-id", $session_id: "session-id", $window_id: "window-id", method: "email", ...page,
  });
});

test("withdrawal rechecks consent at before_send and suppresses queued custom events", (t) => {
  const f = browser(t, { consent: "granted" });
  const event = enriched("sign_up", { method: "email" });
  assert.ok(sanitizePosthogEvent(event));
  f.values.set("hs_posthog_consent_v1", "denied");
  assert.equal(sanitizePosthogEvent(event), null);
  assert.ok(sanitizePosthogEvent(enriched("$pageview")), "public cookieless views remain eligible");
});

for (const safe of [undefined, null, "private", 42, true]) {
  test(`SDK events without an approved object envelope are dropped: ${String(safe)}`, (t) => {
    browser(t, { consent: "granted" });
    const event = enriched("$autocapture", safe);
    if (safe === undefined) delete event.properties.hs_safe;
    assert.equal(sanitizePosthogEvent(event), null);
  });
}

test("private route reached after capture blocks even an earlier approved envelope", (t) => {
  const f = browser(t, { consent: "granted" });
  const event = enriched("$pageview", { page_location: "https://hobbysalon.nl/workshops" });
  f.window.location = new URL("https://hobbysalon.nl/dashboard?token=private");
  assert.equal(sanitizePosthogEvent(event), null);
});

test("null event and missing browser are safe no-ops", (t) => {
  browser(t);
  assert.equal(sanitizePosthogEvent(null), null);
  Reflect.deleteProperty(globalThis, "window");
  assert.equal(sanitizePosthogEvent(enriched("$pageview")), null);
});
