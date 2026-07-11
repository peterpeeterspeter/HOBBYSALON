import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getDiscoveryResultLabel } from "./discovery-copy.ts";

test("uses a clear singular and plural result label", () => {
  assert.equal(getDiscoveryResultLabel(1, "workshop"), "1 workshop gevonden");
  assert.equal(getDiscoveryResultLabel(12, "workshop"), "12 workshops gevonden");
});

test("uses event grammar for agenda results", () => {
  assert.equal(getDiscoveryResultLabel(0, "event"), "Geen evenementen gevonden");
  assert.equal(getDiscoveryResultLabel(2, "event"), "2 evenementen gevonden");
});
