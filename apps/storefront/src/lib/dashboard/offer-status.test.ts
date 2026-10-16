import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReplyMailto,
  resolveCreationStatus,
  resolveEventStatus,
  resolveWorkshopStatus,
  sortInbox,
  type InboxItem,
} from "./offer-status.ts";

const now = new Date("2026-10-04T12:00:00Z");

test("workshop status: one plain label per situation", () => {
  assert.equal(
    resolveWorkshopStatus({ is_active: false, canPublish: true, now }),
    "draft"
  );
  assert.equal(
    resolveWorkshopStatus({ is_active: false, canPublish: false, now }),
    "review"
  );
  assert.equal(
    resolveWorkshopStatus({ is_active: true, canPublish: false, now }),
    "review"
  );
  assert.equal(
    resolveWorkshopStatus({
      is_active: true,
      canPublish: true,
      listing_fee_status: "launch_free",
      now,
    }),
    "visible"
  );
  assert.equal(
    resolveWorkshopStatus({
      is_active: true,
      canPublish: true,
      listing_fee_status: "paid",
      listing_expires_at: "2026-12-01T00:00:00Z",
      now,
    }),
    "visible"
  );
  assert.equal(
    resolveWorkshopStatus({
      is_active: true,
      canPublish: true,
      listing_fee_status: "paid",
      listing_expires_at: "2026-09-01T00:00:00Z",
      now,
    }),
    "expired"
  );
  assert.equal(
    resolveWorkshopStatus({
      is_active: true,
      canPublish: true,
      listing_fee_status: "unpaid",
      now,
    }),
    "payment"
  );
});

test("event and creation status", () => {
  assert.equal(resolveEventStatus({ is_active: true, canPublish: true }), "visible");
  assert.equal(resolveEventStatus({ is_active: false, canPublish: true }), "draft");
  assert.equal(resolveEventStatus({ is_active: true, canPublish: false }), "review");
  assert.equal(resolveCreationStatus({ is_active: true }), "visible");
  assert.equal(resolveCreationStatus({ is_active: false }), "draft");
});

const item = (over: Partial<InboxItem>): InboxItem => ({
  id: "x",
  source: "creatie",
  name: "Marleen Claes",
  email: "marleen@example.be",
  message: null,
  subject: "Gehaakte mand",
  createdAt: "2026-10-01T10:00:00Z",
  isNew: false,
  manageHref: "/dashboard/products",
  ...over,
});

test("inbox: new requests first, then newest", () => {
  const sorted = sortInbox([
    item({ id: "old-handled", createdAt: "2026-09-01T10:00:00Z" }),
    item({ id: "new-older", isNew: true, createdAt: "2026-09-20T10:00:00Z" }),
    item({ id: "recent-handled", createdAt: "2026-10-03T10:00:00Z" }),
    item({ id: "new-newest", isNew: true, createdAt: "2026-10-02T10:00:00Z" }),
  ]).map((entry: InboxItem) => entry.id);
  assert.deepEqual(sorted, ["new-newest", "new-older", "recent-handled", "old-handled"]);
});

test("reply mailto greets by first name and quotes the subject", () => {
  const href = buildReplyMailto(item({}));
  assert.ok(href.startsWith("mailto:marleen%40example.be?subject=Re%3A%20Gehaakte%20mand"));
  assert.ok(decodeURIComponent(href).includes("Dag Marleen,"));
});
