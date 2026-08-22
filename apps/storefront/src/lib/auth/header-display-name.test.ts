import assert from "node:assert/strict";
import test from "node:test";
import { resolveHeaderDisplayName } from "./header-display-name";

test("resolveHeaderDisplayName prefers full_name first token", () => {
  assert.equal(
    resolveHeaderDisplayName({
      fullName: "Peter Peeters",
      email: "other@example.com",
    }),
    "Peter"
  );
});

test("resolveHeaderDisplayName normalizes email local part", () => {
  assert.equal(
    resolveHeaderDisplayName({ email: "peter.peeters@example.com" }),
    "Peter"
  );
});

test("resolveHeaderDisplayName returns null for unusable values", () => {
  assert.equal(resolveHeaderDisplayName({ email: "12@example.com" }), null);
  assert.equal(resolveHeaderDisplayName({ fullName: "A" }), null);
  assert.equal(resolveHeaderDisplayName({}), null);
});
