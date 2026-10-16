import assert from "node:assert/strict";
import test from "node:test";
import {
  inferCountryFromPostalCode,
  parseRegistrationOfferRoles,
  resolveOfferOnboardingPath,
} from "./registration-options";

test("inferCountryFromPostalCode: NL only with letters, else BE", () => {
  assert.equal(inferCountryFromPostalCode("2800"), "BE");
  assert.equal(inferCountryFromPostalCode("1012 AB"), "NL");
  assert.equal(inferCountryFromPostalCode("1012ab"), "NL");
  assert.equal(inferCountryFromPostalCode(" 1012  ab "), "NL");
  assert.equal(inferCountryFromPostalCode("0123AB"), "BE");
  assert.equal(inferCountryFromPostalCode(""), "BE");
  assert.equal(inferCountryFromPostalCode(null), "BE");
});

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
