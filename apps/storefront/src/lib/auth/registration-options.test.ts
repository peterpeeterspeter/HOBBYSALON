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

test("resolveOfferOnboardingPath sends creators to maker profile setup", () => {
  assert.equal(
    resolveOfferOnboardingPath(["merchant", "maker"]),
    "/profile?tab=profiel#maker-pagina"
  );
  assert.equal(
    resolveOfferOnboardingPath(["workshopgever"]),
    "/profile?tab=profiel#maker-pagina"
  );
  assert.equal(
    resolveOfferOnboardingPath(["merchant"]),
    "/register/merchant"
  );
  assert.equal(resolveOfferOnboardingPath([]), null);
});
