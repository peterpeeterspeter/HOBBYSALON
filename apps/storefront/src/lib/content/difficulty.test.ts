import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { compareDifficulty, getDifficultyMeta } from "./difficulty.ts";

test("returns Dutch metadata for an editorial difficulty level", () => {
  assert.deepEqual(getDifficultyMeta("beginner"), {
    level: "beginner",
    label: "Beginner",
    order: 1,
  });
});

test("keeps untagged and unknown article difficulty absent", () => {
  assert.equal(getDifficultyMeta(null), null);
  assert.equal(getDifficultyMeta("unknown"), null);
});

test("orders canonical difficulty levels from approachable to advanced", () => {
  assert.equal(compareDifficulty("beginner", "advanced"), -1);
  assert.equal(compareDifficulty("advanced", "intermediate"), 1);
  assert.equal(compareDifficulty("beginner", "beginner"), 0);
});
