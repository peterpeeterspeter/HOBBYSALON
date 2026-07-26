import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_CREDIT_COSTS,
  LISTING_CREDIT_COSTS,
  getEventCreditCost,
  // @ts-expect-error Node's TypeScript test runner requires the extension.
} from "./listing-credit-costs.ts";

test("event cost scales with the event tier", () => {
  // A hobbybeurs reaches a paying B2B audience; a pop-up does not. If
  // these ever collapse to the same number the pricing model is broken.
  assert.ok(
    getEventCreditCost("hobby_fair") > getEventCreditCost("handmade_market")
  );
  assert.ok(
    getEventCreditCost("handmade_market") > getEventCreditCost("pop_up")
  );
});

test("unknown event types fall back to the mid tier, never to free", () => {
  // The events dashboard renders this for whatever value a select emits,
  // so an unmapped type must not silently price a listing at 0.
  const fallback = getEventCreditCost("something_new");
  assert.equal(fallback, EVENT_CREDIT_COSTS.handmade_market);
  assert.ok(fallback > 0);
  assert.equal(getEventCreditCost(""), EVENT_CREDIT_COSTS.handmade_market);
});

test("every configured event type has a positive cost", () => {
  for (const [eventType, cost] of Object.entries(EVENT_CREDIT_COSTS)) {
    assert.ok(
      Number.isInteger(cost) && cost > 0,
      `${eventType} must cost a positive whole number of credits, got ${cost}`
    );
  }
});

test("every listing action has a positive cost", () => {
  for (const [action, cost] of Object.entries(LISTING_CREDIT_COSTS)) {
    assert.ok(
      Number.isInteger(cost) && cost > 0,
      `${action} must cost a positive whole number of credits, got ${cost}`
    );
  }
});

test("exhibitor outreach is priced as a premium action", () => {
  // It emails every opt-in maker at once, so it must never be cheaper
  // than publishing a single listing.
  assert.ok(
    LISTING_CREDIT_COSTS.exhibitorOutreach >
      LISTING_CREDIT_COSTS.handmadeListing
  );
});
