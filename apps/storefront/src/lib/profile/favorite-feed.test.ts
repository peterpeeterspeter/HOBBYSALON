import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getFavoriteFeedMeta } from "./favorite-feed-meta.ts";

test("recognizes saved patterns as startable project ideas", () => {
  assert.deepEqual(getFavoriteFeedMeta("article", "pattern"), {
    label: "Patroon",
    canStartProject: true,
  });
});

test("keeps saved materials as feed items without a project start action", () => {
  assert.deepEqual(getFavoriteFeedMeta("product", null), {
    label: "Materiaal",
    canStartProject: false,
  });
});
