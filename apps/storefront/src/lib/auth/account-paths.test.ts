import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getAccountRegistrationHref, getSafeInternalPath, parseOfferRoleParam, resolveLegacyRegisterRedirect } from "./account-paths.ts";

test("keeps a safe return path when selecting an account type", () => {
  assert.equal(getAccountRegistrationHref("member", "/profile"), "/register?next=%2Fprofile");
  assert.equal(
    getAccountRegistrationHref("creator", "/workshop/leren-haken"),
    "/register/creator?next=%2Fworkshop%2Fleren-haken"
  );
  assert.equal(
    getAccountRegistrationHref("workshopgever", "/dashboard/pagina"),
    "/register/creator?focus=workshopgever&next=%2Fdashboard%2Fpagina"
  );
  assert.equal(
    getAccountRegistrationHref("aanbieder", "/agenda"),
    "/register/aanbieden?next=%2Fagenda"
  );
});

test("offer roles without a return path go through /onboarding (no forced next)", () => {
  assert.equal(getAccountRegistrationHref("organizer", null), "/register/creator?focus=organizer");
  assert.equal(getAccountRegistrationHref("maker", null), "/register/creator?focus=maker");
  assert.equal(getAccountRegistrationHref("workshopgever", ""), "/register/creator?focus=workshopgever");
  assert.equal(getAccountRegistrationHref("creator", ""), "/register/creator");
  assert.equal(getAccountRegistrationHref("aanbieder", null), "/register/aanbieden");
});

test("rejects external-looking return paths", () => {
  assert.equal(getSafeInternalPath("/favorites", "/"), "/favorites");
  assert.equal(getSafeInternalPath("//external.example", "/"), "/");
  assert.equal(getSafeInternalPath("https://external.example", "/"), "/");
});

test("falls back to role-appropriate destinations for unsafe or absent paths", () => {
  assert.equal(getAccountRegistrationHref("member", "//external.example"), "/register");
  assert.equal(getAccountRegistrationHref("merchant", null), "/register/merchant?next=%2Fdashboard");
});

test("parseOfferRoleParam accepts Dutch and English aliases", () => {
  assert.equal(parseOfferRoleParam("workshopgever"), "workshopgever");
  assert.equal(parseOfferRoleParam("Maker"), "maker");
  assert.equal(parseOfferRoleParam("creator"), "maker");
  assert.equal(parseOfferRoleParam("organisator"), "organizer");
  assert.equal(parseOfferRoleParam("organizer"), "organizer");
  assert.equal(parseOfferRoleParam("verkoper"), "merchant");
  assert.equal(parseOfferRoleParam("merchant"), "merchant");
  assert.equal(parseOfferRoleParam("onzin"), null);
  assert.equal(parseOfferRoleParam(undefined), null);
});

test("legacy /register campaign params go to the aanbieder path", () => {
  assert.equal(resolveLegacyRegisterRedirect({}), null);
  assert.equal(resolveLegacyRegisterRedirect({ intent: "discover" }), null);
  assert.equal(resolveLegacyRegisterRedirect({ intent: "ontdekken", next: "/agenda" }), null);
  assert.equal(resolveLegacyRegisterRedirect({ intent: "offer" }), "/register/aanbieden");
  assert.equal(
    resolveLegacyRegisterRedirect({ intent: "aanbieden", next: "/agenda" }),
    "/register/aanbieden?next=%2Fagenda"
  );
  assert.equal(
    resolveLegacyRegisterRedirect({ focus: "verkoper" }),
    "/register/merchant?next=%2Fdashboard"
  );
  assert.equal(
    resolveLegacyRegisterRedirect({ focus: "organisator" }),
    "/register/creator?focus=organizer"
  );
  assert.equal(resolveLegacyRegisterRedirect({ focus: "onzin" }), "/register/aanbieden");
});
