import { test } from "node:test";
import assert from "node:assert/strict";
import { freeMakerListingAllowance, normalizeReferralCode } from "./referral-rules.ts";

test("normalizeReferralCode accepts only the code alphabet", () => {
  assert.equal(normalizeReferralCode(" abcd2345 "), "ABCD2345");
  assert.equal(normalizeReferralCode("ABCD1234"), null); // 1 is not in the alphabet
  assert.equal(normalizeReferralCode("ABC"), null);
  assert.equal(normalizeReferralCode(null), null);
  assert.equal(normalizeReferralCode("ABCD2345; drop"), null);
});

test("freeMakerListingAllowance adds the bonus to the base of 3", () => {
  assert.equal(freeMakerListingAllowance(0), 3);
  assert.equal(freeMakerListingAllowance(6), 9);
  assert.equal(freeMakerListingAllowance(-2), 3);
});
