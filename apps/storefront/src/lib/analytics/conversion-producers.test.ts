import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fixture, GENERATION } from "./conversion.test-helpers";
import { CONSENT_GENERATION_KEY } from "./conversions";
const listing = { id: "11111111-1111-4111-8111-111111111111", product_type: "handmade", is_active: true, status: "active" };
const user = { id: listing.id, identities: [{ provider: "email" }], email_confirmed_at: "2026-01-01" };
const source = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
function setup() {
  const f = fixture(), p = f.load("conversion-producers.server"), calls: any[] = [];
  const queue = async (...args: any[]) => { calls.push(args); };
  return { ...f, p, calls, queue };
}
test("active listing claimed once across concurrent edits and republishing; drafts/errors ignored", async () => {
  const f = setup();
  assert.equal(f.p.queueCreatedListing, undefined);
  for (const row of [{ ...listing, is_active: false }, { ...listing, status: "draft" }, { ...listing, product_type: "supply" }]) await f.p.queueListingPublication(f.client, { data: row }, f.queue);
  await f.p.queueListingPublication(f.client, { data: listing, error: {} }, f.queue);
  assert.equal(f.calls.length, 0);
  await Promise.all([1, 2, 3].map(() => f.p.queueListingPublication(f.client, { data: listing }, f.queue)));
  assert.deepEqual(f.calls, [["listing_published", { listing_type: "handmade" }]]);
});
test("no analytics candidate or claim writes without consent or after withdrawal", async () => {
  for (const choice of ["pending", "denied", ""]) {
    const f = setup(); f.jar.set("hs_posthog_consent_v1", choice);
    await f.p.rememberEmailRegistration(f.client, user);
    await f.p.queueConfirmedRegistration(f.client, user, f.queue);
    await f.p.queueListingPublication(f.client, { data: listing }, f.queue);
    await f.p.queueConfirmedWorkshop(f.client, { data: { ...listing, workshop_id: listing.id, status: "confirmed" } }, f.queue);
    assert.deepEqual(f.operations, []); assert.deepEqual(f.calls, []);
  }
});
test("signup requires registration candidate, email confirmation, same consent generation; login is not signup", async () => {
  const f = setup();
  await f.p.queueConfirmedRegistration(f.client, user, f.queue); // login: no candidate
  assert.equal(f.calls.length, 0);
  await f.p.rememberEmailRegistration(f.client, { ...user, identities: [] });
  assert.equal(f.rows.analytics_signup_candidates.length, 0);
  await f.p.rememberEmailRegistration(f.client, user);
  await f.p.queueConfirmedRegistration(f.client, { ...user, email_confirmed_at: null }, f.queue);
  f.jar.set(CONSENT_GENERATION_KEY, "22222222-2222-4222-8222-222222222222");
  await f.p.queueConfirmedRegistration(f.client, user, f.queue);
  assert.equal(f.calls.length, 0);
  f.jar.set(CONSENT_GENERATION_KEY, GENERATION);
  await Promise.all([1, 2].map(() => f.p.queueConfirmedRegistration(f.client, user, f.queue)));
  assert.deepEqual(f.calls, [["sign_up", { method: "email" }]]);
});
test("missing env/migration and failed queue are no-op, no retries", async () => {
  const f = setup(); delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await f.p.rememberEmailRegistration(f.client, user); assert.deepEqual(f.operations, []);
  process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-test-only-secret";
  f.setFailure(true); await f.p.queueListingPublication(f.client, { data: listing }, f.queue); assert.equal(f.calls.length, 0);
  f.setFailure(false);
  let attempts = 0;
  const broken = async () => { attempts++; throw new Error("offline"); };
  await f.p.queueListingPublication(f.client, { data: listing }, broken);
  await f.p.queueListingPublication(f.client, { data: listing }, broken);
  assert.equal(attempts, 1);
});
test("organizer confirmation has explicit actor, never attendee identity", async () => {
  const f = setup();
  const row = { id: listing.id, workshop_id: listing.id, status: "pending", email: "PRIVATE" };
  await f.p.queueConfirmedWorkshop(f.client, { data: row }, f.queue);
  row.status = "confirmed";
  await f.p.queueConfirmedWorkshop(f.client, { data: row }, f.queue);
  await f.p.queueConfirmedWorkshop(f.client, { data: row }, f.queue);
  assert.deepEqual(f.calls, [["workshop_booking_registered", { workshop_id: listing.id, actor_role: "organizer" }]]);
});
test("newsletter resend never resets confirmation; concurrent confirm/reconfirm deliver but convert once", async () => {
  const f = setup(), at = "2026-01-01T00:00:00.000Z";
  await f.p.requestLeadMagnetOptIn(f.client, "private@example.invalid", "campaign", "/fixture");
  const confirm = () => f.p.confirmLeadMagnetOptIn(f.client, "private@example.invalid", "campaign", at, f.queue);
  await Promise.all([confirm(), confirm()]);
  await f.p.requestLeadMagnetOptIn(f.client, "private@example.invalid", "campaign", "/resend");
  assert.equal(f.rows.newsletter_opt_in_events[0].status, "confirmed");
  assert.equal((await confirm()).data.confirmed_at, at);
  f.rows.newsletter_opt_in_events[0].status = "unsubscribed";
  await f.p.requestLeadMagnetOptIn(f.client, "private@example.invalid", "campaign", "/resubscribe");
  await confirm();
  assert.equal(f.rows.newsletter_opt_in_events[0].confirmed_at, at);
  assert.deepEqual(f.calls, [["newsletter_signup", { signup_source: "lead_magnet_form", opt_in_method: "double" }]]);
  assert.ok(!JSON.stringify(f.calls).includes("private"));
});
test("real action wiring keeps login/recovery/download separate, confirmation precedes mail", () => {
  const auth = source("../../app/actions/auth.ts");
  const login = auth.slice(auth.indexOf("export async function loginAction"), auth.indexOf("export async function registerAction"));
  assert.doesNotMatch(login, /rememberEmailRegistration|queueConfirmedRegistration/);
  assert.equal((auth.match(/await rememberEmailRegistration/g) ?? []).length, 2);
  assert.match(source("../../app/api/auth/confirm/route.ts"), /queueConfirmedRegistration/);
  assert.doesNotMatch(source("../../app/actions/newsletter.ts"), /queueConversion|newsletter_signup/);
  assert.doesNotMatch(source("../../app/(public)/nieuwsbrief/download/[code]/route.ts"), /queueConversion|newsletter_signup/);
  const route = source("../../app/(public)/nieuwsbrief/bevestigen/route.ts");
  assert.ok(route.indexOf("if (!payload)") < route.indexOf("await confirmLeadMagnetOptIn("));
  assert.ok(route.indexOf("await confirmLeadMagnetOptIn(") < route.indexOf("await syncConfirmedAcumbamailSubscriber("));
  assert.match(route, /Referrer-Policy/); assert.match(route, /nieuwsbrief\/resultaat/);
  const dashboard = source("../../app/actions/dashboard.ts");
  assert.doesNotMatch(dashboard, /queueCreatedListing/); assert.match(dashboard, /queueListingPublication/);
});
