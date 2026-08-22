import assert from "node:assert/strict";
import test from "node:test";
import {
  creatorTypesToOfferRoles,
  isOfferRoleCovered,
  listMissingOfferUpgrades,
} from "./role-upgrades";

test("hobbyist sees all four offer upgrades", () => {
  const upgrades = listMissingOfferUpgrades({
    roles: ["user"],
    hasCreatorProfile: false,
    pendingRoleRequests: [],
  });
  assert.deepEqual(
    upgrades.map((item) => item.role),
    ["workshopgever", "maker", "organizer", "merchant"]
  );
});

test("creator with maker type only sees merchant upgrade", () => {
  const upgrades = listMissingOfferUpgrades({
    roles: ["user", "creator"],
    creatorTypes: ["maker"],
    hasCreatorProfile: true,
    pendingRoleRequests: [],
  });
  assert.deepEqual(
    upgrades.map((item) => item.role),
    ["merchant"]
  );
});

test("pending merchant request hides merchant upgrade", () => {
  const upgrades = listMissingOfferUpgrades({
    roles: ["user", "creator"],
    creatorTypes: ["maker"],
    hasCreatorProfile: true,
    pendingRoleRequests: [{ role: "merchant", status: "pending" }],
  });
  assert.deepEqual(upgrades, []);
});

test("without merchantOnly hobbyist workshop host role covers workshopgever", () => {
  assert.equal(
    isOfferRoleCovered("workshopgever", {
      roles: ["user", "workshop_host"],
      hasCreatorProfile: false,
      pendingRoleRequests: [],
    }),
    true
  );
  assert.equal(
    isOfferRoleCovered("maker", {
      roles: ["user"],
      hasCreatorProfile: false,
      pendingRoleRequests: [],
    }),
    false
  );
});

test("creatorTypesToOfferRoles maps types including supplier as maker", () => {
  assert.deepEqual(
    creatorTypesToOfferRoles(["workshopgever", "supplier", "organizer"]),
    ["workshopgever", "maker", "organizer"]
  );
});

test("full list without merchantOnly still filters covered creator roles", () => {
  const upgrades = listMissingOfferUpgrades({
    roles: ["user"],
    creatorTypes: ["workshopgever"],
    hasCreatorProfile: false,
    pendingRoleRequests: [],
    merchantOnly: false,
  });
  assert.deepEqual(
    upgrades.map((item) => item.role),
    ["maker", "organizer", "merchant"]
  );
});
