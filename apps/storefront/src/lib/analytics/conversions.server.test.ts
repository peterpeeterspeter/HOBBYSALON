import assert from "node:assert/strict";
import test from "node:test";
import { fixture, GENERATION } from "./conversion.test-helpers";
import { CONVERSION_COOKIE, CONSENT_GENERATION_KEY, parseConversionReceipts } from "./conversions";

test("server serializes signed bounded sanitized receipts and keeps valid queued events", async () => {
  const f = fixture(), queue = f.load("conversions.server").queueConversion;
  await queue("listing_published", { listing_type: "handmade", email: "PRIVATE" });
  await queue("sign_up", { method: "email" });
  const receipts = parseConversionReceipts(f.jar.get(CONVERSION_COOKIE)!);
  assert.equal(receipts.length, 2);
  for (const r of receipts) assert.equal(f.load("conversion-security.server").verifyConversion(r, GENERATION), true);
  assert.ok(!f.jar.get(CONVERSION_COOKIE)!.includes("PRIVATE"));
  assert.equal(f.writes[0][2].maxAge, 300); assert.equal(f.writes[0][2].domain, undefined);
});
test("queue fails closed for no grant, legacy grant, invalid generation and missing signing key", async () => {
  for (const choice of ["denied", "pending", ""]) {
    const f = fixture(); f.jar.set("hs_posthog_consent_v1", choice); f.jar.set("hs_analytics_consent", "granted");
    await f.load("conversions.server").queueConversion("sign_up", { method: "email" }); assert.equal(f.writes.length, 0);
  }
  const f = fixture(); f.jar.delete(CONSENT_GENERATION_KEY);
  await f.load("conversions.server").queueConversion("sign_up", { method: "email" }); assert.equal(f.writes.length, 0);
  f.jar.set(CONSENT_GENERATION_KEY, GENERATION); delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await f.load("conversions.server").queueConversion("sign_up", { method: "email" }); assert.equal(f.writes.length, 0);
});
function signed(f: ReturnType<typeof fixture>) {
  return f.load("conversion-security.server").signConversion({ id: crypto.randomUUID(), event: "sign_up", payload: { method: "email" }, generation: GENERATION, expiresAt: Date.now() + 240000 });
}
function request(receipts: any[], origin = "https://www.hobbysalon.be") {
  return new Request("https://www.hobbysalon.be/api/analytics/conversions", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(receipts) });
}
test("API rejects unsigned/forged/tampered/expired receipts before any DB write", async () => {
  const f = fixture(), r = signed(f), post = f.load("api").POST;
  for (const bad of [{ ...r, signature: undefined }, { ...r, signature: "0".repeat(64) }, { ...r, id: crypto.randomUUID() }, { ...r, event: "listing_published", payload: { listing_type: "destash" } }, { ...r, expiresAt: Date.now() - 1 }, { ...r, expiresAt: undefined }]) assert.equal((await post(request([bad]))).status, 204);
  assert.deepEqual(f.operations, []); assert.deepEqual(f.captures, []);
});
test("API durably claims once across concurrent requests and does not retry replay", async () => {
  const f = fixture(), r = signed(f), post = f.load("api").POST;
  await Promise.all([post(request([r, r])), post(request([r]))]);
  await post(request([r]));
  assert.equal(f.captures.length, 1); assert.equal(f.rows.analytics_receipt_claims.length, 1);
  assert.deepEqual(Object.keys(f.rows.analytics_receipt_claims[0]).sort(), ["id", "receipt_id"]);
});
test("API rejects cross-origin, withdrawal, changed generation and missing migration", async () => {
  const f = fixture(), r = signed(f), post = f.load("api").POST;
  await post(request([r], "https://evil.invalid")); assert.equal(f.operations.length, 0);
  f.jar.set("hs_posthog_consent_v1", "denied"); await post(request([r])); assert.equal(f.operations.length, 0);
  f.jar.set("hs_posthog_consent_v1", "granted"); f.jar.set(CONSENT_GENERATION_KEY, "22222222-2222-4222-8222-222222222222");
  await post(request([r])); assert.equal(f.operations.length, 0);
  f.jar.set(CONSENT_GENERATION_KEY, GENERATION); f.setFailure(true);
  await post(request([r])); assert.equal(f.captures.length, 0);
});
test("real dispatcher makes one anonymous capture without URL/session/account/token context", async t => {
  const f = fixture(); process.env.NEXT_PUBLIC_POSTHOG_KEY = "offline-public-project-key"; process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
  const bodies: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, options: any) => { bodies.push(JSON.parse(options.body)); return new Response(null, { status: 200 }); });
  const dispatch = f.load("conversion-dispatch.server").dispatchConversion;
  const r = { ...signed(f), event: "workshop_booking_registered", payload: { workshop_id: GENERATION, actor_role: "organizer", email: "PRIVATE", token: "PRIVATE" } };
  await dispatch(r, "BE"); await dispatch(r, "BE");
  assert.equal(bodies[0].event, "workshop_booking"); assert.equal(bodies[0].properties.actor_role, "organizer");
  assert.notEqual(bodies[0].distinct_id, bodies[1].distinct_id);
  assert.equal(bodies[0].properties.$process_person_profile, false);
  assert.equal(bodies[0].properties.$geoip_disable, true);
  assert.equal(bodies[0].properties.$ip, "0.0.0.0");
  assert.doesNotMatch(JSON.stringify(bodies), /PRIVATE|generation|signature|expiresAt|page_location|session_id|user_id|receipt_id/);
});
