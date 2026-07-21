import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getAccountRegistrationHref, getSafeInternalPath } from "./account-paths.ts";

test("keeps a safe return path when selecting an account type", () => {
  assert.equal(getAccountRegistrationHref("member", "/profile"), "/register?next=%2Fprofile");
  assert.equal(
    getAccountRegistrationHref("creator", "/workshop/leren-haken"),
    "/register/creator?next=%2Fworkshop%2Fleren-haken"
  );
  assert.equal(
    getAccountRegistrationHref("workshopgever", "/dashboard/creator"),
    "/register/creator?focus=workshopgever&next=%2Fdashboard%2Fcreator"
  );
  assert.equal(
    getAccountRegistrationHref("organizer", null),
    "/register/creator?focus=organizer&next=%2Fdashboard%2Fcreator"
  );
});

test("rejects external-looking return paths", () => {
  assert.equal(getSafeInternalPath("/favorites", "/"), "/favorites");
  assert.equal(getSafeInternalPath("//external.example", "/"), "/");
  assert.equal(getSafeInternalPath("https://external.example", "/"), "/");
});

test("falls back to role-appropriate destinations for unsafe or absent paths", () => {
  assert.equal(getAccountRegistrationHref("member", "//external.example"), "/register");
  assert.equal(getAccountRegistrationHref("creator", ""), "/register/creator?next=%2Fdashboard%2Fcreator");
  assert.equal(getAccountRegistrationHref("merchant", null), "/register/merchant?next=%2Fdashboard%2Fmaterials");
});
