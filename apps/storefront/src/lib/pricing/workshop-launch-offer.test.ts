import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { WORKSHOP_FREE_LISTING_CAP, WORKSHOP_LAUNCH_ENDS_AT, WORKSHOP_LISTING_FEE_CENTS, WORKSHOP_PAID_VISIBILITY_MONTHS, canGrantWorkshopLaunchFreeSlot, isWorkshopLaunchWindowOpen, isWorkshopListingPubliclyVisible, paidWorkshopListingExpiresAt } from "./workshop-launch-offer.ts";

test("launch window is open before 1 October 2026 Brussels", () => {
  assert.equal(isWorkshopLaunchWindowOpen(new Date("2026-09-30T23:59:59+02:00")), true);
  assert.equal(isWorkshopLaunchWindowOpen(new Date("2026-10-01T00:00:00+02:00")), false);
  // 00:00 UTC on 1 Oct is already after Brussels midnight (22:00 UTC previous day).
  assert.equal(isWorkshopLaunchWindowOpen(new Date("2026-10-01T00:00:00+00:00")), false);
});

test("free slots only during launch and under the cap of 3", () => {
  const during = new Date("2026-08-15T12:00:00+02:00");
  const after = new Date("2026-10-02T12:00:00+02:00");
  assert.equal(canGrantWorkshopLaunchFreeSlot(0, during), true);
  assert.equal(canGrantWorkshopLaunchFreeSlot(2, during), true);
  assert.equal(canGrantWorkshopLaunchFreeSlot(3, during), false);
  assert.equal(canGrantWorkshopLaunchFreeSlot(0, after), false);
  assert.equal(WORKSHOP_FREE_LISTING_CAP, 3);
});

test("paid listing expires after two months", () => {
  const from = new Date("2026-10-15T10:00:00.000Z");
  const expires = paidWorkshopListingExpiresAt(from);
  assert.equal(WORKSHOP_PAID_VISIBILITY_MONTHS, 2);
  assert.equal(WORKSHOP_LISTING_FEE_CENTS, 999);
  assert.equal(expires.toISOString(), "2026-12-15T10:00:00.000Z");
});

test("public visibility rules for launch_free, paid, unpaid", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  assert.equal(
    isWorkshopListingPubliclyVisible({
      is_active: true,
      listing_fee_status: "launch_free",
      listing_expires_at: null,
      now,
    }),
    true
  );
  assert.equal(
    isWorkshopListingPubliclyVisible({
      is_active: true,
      listing_fee_status: "paid",
      listing_expires_at: "2026-12-01T00:00:00.000Z",
      now,
    }),
    true
  );
  assert.equal(
    isWorkshopListingPubliclyVisible({
      is_active: true,
      listing_fee_status: "paid",
      listing_expires_at: "2026-10-01T00:00:00.000Z",
      now,
    }),
    false
  );
  assert.equal(
    isWorkshopListingPubliclyVisible({
      is_active: true,
      listing_fee_status: "unpaid",
      listing_expires_at: null,
      now,
    }),
    false
  );
  assert.equal(
    isWorkshopListingPubliclyVisible({
      is_active: false,
      listing_fee_status: "launch_free",
      listing_expires_at: null,
      now,
    }),
    false
  );
});

test("launch end constant matches plan cutoff", () => {
  assert.equal(WORKSHOP_LAUNCH_ENDS_AT.toISOString(), "2026-09-30T22:00:00.000Z");
});
