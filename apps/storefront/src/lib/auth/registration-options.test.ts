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

test("resolveOfferOnboardingPath prefers workshopgever then maker", () => {
  assert.equal(
    resolveOfferOnboardingPath(["merchant", "maker"]),
    "/register/creator?focus=maker"
  );
  assert.equal(
    resolveOfferOnboardingPath(["merchant", "workshopgever", "maker"]),
    "/register/creator?focus=workshopgever"
  );
  assert.equal(
    resolveOfferOnboardingPath(["merchant"]),
    "/register/merchant"
  );
  assert.equal(resolveOfferOnboardingPath([]), null);
});
