import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRegistrationOfferRoles,
  resolveOfferOnboardingPath,
} from "./registration-options";

test("parseRegistrationOfferRoles keeps known roles in stable order", () => {
  assert.deepEqual(
    parseRegistrationOfferRoles(["merchant", "maker", "bogus", "workshopgever"]),
    ["workshopgever", "maker", "merchant"]
  );
});

test("resolveOfferOnboardingPath routes creators to /onboarding and merchants separately", () => {
  assert.equal(
    resolveOfferOnboardingPath(["merchant", "maker"]),
    "/onboarding"
  );
  assert.equal(
    resolveOfferOnboardingPath(["merchant", "workshopgever", "maker"]),
    "/onboarding"
  );
  assert.equal(
    resolveOfferOnboardingPath(["merchant"]),
    "/register/merchant"
  );
  assert.equal(resolveOfferOnboardingPath([]), null);
});
