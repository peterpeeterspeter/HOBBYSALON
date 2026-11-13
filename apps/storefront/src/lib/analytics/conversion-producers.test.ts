import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { confirmLeadMagnetOptIn, queueCreatedListing } from "./conversion-producers.server.ts";

const AT = "2026-10-23T09:00:00.000Z";
const EARLIER = "2026-10-22T09:00:00.000Z";
type Row = Record<string, unknown>;
function queueRecorder() {
  const calls: Array<{ event: string; payload: Record<string, string> }> = [];
  return { calls, queue: async (event: string, payload: Record<string, string>) => { calls.push({ event, payload }); } };
}

// Only the real awaited PostgREST {data,error} contracts are mocked. Updates
// execute atomically at maybeSingle(), including filters and returning fields.
function table(rows: Row[], error: unknown = null, serializeTimestamp = false) {
  const operations: Array<{ patch: Row; filters: string[]; selection: string }> = [];
  function update(patch: Row) {
    const predicates: Array<(row: Row) => boolean> = [];
    const operation = { patch, filters: [] as string[], selection: "" };
    operations.push(operation);
    const query = {
      eq(column: string, value: unknown) {
        predicates.push((row) => row[column] === value);
        operation.filters.push(`${column}=eq.${String(value)}`);
        return query;
      },
      is(column: string, value: unknown) {
        assert.equal(value, null);
        predicates.push((row) => row[column] == null);
        operation.filters.push(`${column}=is.null`);
        return query;
      },
      not(column: string, operator: string, value: unknown) {
        assert.equal(operator, "is"); assert.equal(value, null);
        predicates.push((row) => row[column] != null);
        operation.filters.push(`${column}=not.is.null`);
        return query;
      },
      select(selection: string) { operation.selection = selection; return query; },
      async maybeSingle() {
        if (error) return { data: null, error };
        const found = rows.filter((row) => predicates.every((predicate) => predicate(row)));
        assert.ok(found.length <= 1, "fixture respects unique key");
        if (!found[0]) return { data: null, error: null };
        Object.assign(found[0], patch);
        if (serializeTimestamp && typeof found[0].confirmed_at === "string") {
          found[0].confirmed_at = found[0].confirmed_at.replace(".000Z", "+00:00");
        }
        return {
          data: Object.fromEntries(operation.selection.split(",").map((key) => [key.trim(), found[0][key.trim()]])),
          error: null,
        };
      },
    };
    return query;
  }
  return {
    operations, update,
    client: { from(name: string) { assert.equal(name, "newsletter_opt_in_events"); return { update }; } },
  };
}
const activeListing = (type = "handmade") => ({ id: "fixture-listing", product_type: type, is_active: true, status: "active" });
const pending = () => ({ id: "fixture-opt-in", email: "fixture@example.invalid", lead_magnet_id: "fixture-campaign", source_path: "/fixture", status: "pending", confirmed_at: null });

for (const listingType of ["handmade", "destash"]) {
  test(`successful active ${listingType} INSERT queues one bounded receipt`, async () => {
    const { calls, queue } = queueRecorder();
    await queueCreatedListing({ data: activeListing(listingType), error: null }, queue);
    assert.deepEqual(calls, [{ event: "listing_published", payload: { listing_type: listingType } }]);
  });

}

test("INSERT failure, missing returned row, draft or non-maker never queues", async () => {
  const { calls, queue } = queueRecorder();
  for (const result of [
    { data: null, error: null },
    { data: activeListing(), error: { message: "fixture failure" } },
    { data: { ...activeListing(), id: "" }, error: null },
    { data: { ...activeListing(), is_active: false }, error: null },
    { data: { ...activeListing(), status: "draft" }, error: null },
    ...["supply", "event_listing", "workshop_ticket"].map((type) => ({ data: activeListing(type), error: null })),
  ]) await queueCreatedListing(result, queue);
  assert.deepEqual(calls, []);
});


test("verified first pending transition queues before optional email delivery; replay/concurrency queues once", async () => {
  const db = table([pending()]);
  const { calls, queue } = queueRecorder();
  const confirm = () => confirmLeadMagnetOptIn(
    db.client as unknown as Parameters<typeof confirmLeadMagnetOptIn>[0], "fixture@example.invalid", "fixture-campaign", AT, queue
  );
  const results = await Promise.all([confirm(), confirm()]);
  assert.equal(results.filter((result) => result.data).length, 1);
  assert.deepEqual(calls, [{ event: "newsletter_signup", payload: { signup_source: "lead_magnet_form", opt_in_method: "double" } }]);
  assert.equal(results.find((result) => result.data)?.data?.confirmed_at, AT);
  await confirm();
  assert.equal(calls.length, 1);
  assert.ok(db.operations[0].filters.includes("status=eq.pending"));
  assert.ok(db.operations[0].filters.includes("confirmed_at=is.null"));
});

test("PostgreSQL timestamptz offset spelling still proves the first confirmation", async () => {
  const db = table([pending()], null, true);
  const { calls, queue } = queueRecorder();
  const result = await confirmLeadMagnetOptIn(
    db.client as unknown as Parameters<typeof confirmLeadMagnetOptIn>[0], "fixture@example.invalid", "fixture-campaign", AT, queue
  );
  assert.equal(result.data?.confirmed_at, "2026-10-23T09:00:00+00:00");
  assert.equal(calls.length, 1);
});

test("resend/reconfirm preserves first timestamp, returns delivery event, no second conversion", async () => {
  const row = { ...pending(), confirmed_at: EARLIER };
  const db = table([row]);
  const { calls, queue } = queueRecorder();
  const result = await confirmLeadMagnetOptIn(
    db.client as unknown as Parameters<typeof confirmLeadMagnetOptIn>[0], "fixture@example.invalid", "fixture-campaign", AT, queue
  );
  assert.equal(result.data?.confirmed_at, EARLIER);
  assert.equal(row.status, "confirmed");
  assert.deepEqual(calls, []);
  assert.deepEqual(db.operations[1].patch, { status: "confirmed" });
});

test("confirmation DB error / missing / confirmed / unsubscribed / wrong campaign produce no conversion", async () => {
  for (const db of [
    table([pending()], { message: "fixture failure" }), table([]),
    table([{ ...pending(), status: "confirmed", confirmed_at: EARLIER }]),
    table([{ ...pending(), status: "unsubscribed" }]),
    table([{ ...pending(), lead_magnet_id: "other-campaign" }]),
  ]) {
    const { calls, queue } = queueRecorder();
    await confirmLeadMagnetOptIn(
      db.client as unknown as Parameters<typeof confirmLeadMagnetOptIn>[0], "fixture@example.invalid", "fixture-campaign", AT, queue
    );
    assert.deepEqual(calls, []);
  }
});

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
test("real route/actions wire boundaries; no request/download/auth or Medusa projection receipt", () => {
  const dashboard = source("../../app/actions/dashboard.ts");
  const create = dashboard.slice(dashboard.indexOf("export async function createProductAction"), dashboard.indexOf("export async function updateProductAction"));
  assert.match(create, /\.select\("id, product_type, is_active, status"\)\s*\.single\(\)/);
  assert.ok(create.indexOf("if (error || !createdProduct)") < create.indexOf("await queueCreatedListing("));
  assert.match(create, /await queueCreatedListing\(\{ data: createdProduct, error \}, queueConversion\)/);
  const update = dashboard.slice(dashboard.indexOf("export async function updateProductAction"), dashboard.indexOf("export async function unpublishProductAction"));
  // An update is not a publication transition: it must never emit a conversion
  // event. It also must not select back the row for analytics, because credits
  // are consumed earlier and an analytics-only conditional write could charge a
  // losing save. Both guarantees are asserted below.
  assert.doesNotMatch(update, /saveListingPublication|queueConversion\(|queueCreatedListing\(/);
  const medusa = update.slice(update.indexOf("if (medusaProductId)"), update.indexOf('const slug = await ensureUniqueSlug'));
  assert.doesNotMatch(medusa, /queueConversion|saveListingPublication|queueCreatedListing/);
  const route = source("../../app/(public)/nieuwsbrief/bevestigen/route.ts");
  assert.ok(route.indexOf("if (!payload)") < route.indexOf("await confirmLeadMagnetOptIn("));
  assert.ok(route.indexOf("if (leadMagnetError || !leadMagnet)") < route.indexOf("await confirmLeadMagnetOptIn("));
  assert.ok(route.indexOf("await confirmLeadMagnetOptIn(") < route.indexOf("await syncConfirmedAcumbamailSubscriber("));
  assert.match(route, /supabase, payload.email, leadMagnet.id, new Date\(\).toISOString\(\), queueConversion/);
  const newsletter = source("../../app/actions/newsletter.ts");
  // Subscribe is a pending opt-in, not a confirmed signup: it must never emit a
  // conversion event. Asserting on `confirmed_at: null` specifically would pin an
  // implementation detail; the real guarantee is the absence of a conversion.
  assert.doesNotMatch(newsletter, /queueConversion|newsletter_signup/);
  assert.doesNotMatch(source("../../app/(public)/nieuwsbrief/download/[code]/route.ts"), /queueConversion|newsletter_signup/);
  assert.doesNotMatch(source("../../app/actions/auth.ts"), /queueConversion|sign_up/);
  // Auth signUp returns User/Session but no authoritative newly-created marker.
  // Empty identities alone excludes only obfuscated confirmed duplicates, not
  // resend/signup of an existing unconfirmed account. Keep this fail-closed.
  const authSession = source("../auth/session.ts");
  assert.match(authSession, /supabase.auth.signUp\(/);
  assert.match(authSession, /user: data.user \?\? null,\s*session: data.session \?\? null,\s*error: error\?\.message \?\? null/);
});
