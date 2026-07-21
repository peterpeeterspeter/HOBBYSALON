import assert from "node:assert/strict";
import test from "node:test";
import {
  creatorTypeToPrivilegedRole,
  creatorTypesRequiringApproval,
  hasPendingRoleRequest,
} from "./role-request-status";

test("maps creator types to privileged roles", () => {
  assert.equal(creatorTypeToPrivilegedRole("workshopgever"), "workshop_host");
  assert.equal(creatorTypeToPrivilegedRole("organizer"), "organizer");
  assert.equal(creatorTypeToPrivilegedRole("maker"), null);
});

test("collects privileged roles from creator types", () => {
  assert.deepEqual(
    creatorTypesRequiringApproval(["maker", "workshopgever", "organizer"]),
    ["workshop_host", "organizer"]
  );
});

test("detects pending role requests", () => {
  assert.equal(
    hasPendingRoleRequest(
      [{ role: "merchant", status: "pending" }],
      "merchant"
    ),
    true
  );
  assert.equal(
    hasPendingRoleRequest(
      [{ role: "merchant", status: "rejected" }],
      "merchant"
    ),
    false
  );
});
