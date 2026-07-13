import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { filterContentHubItems } from "./content-hub.ts";

const items = [
  { id: "1", title: "Gehaakt mandje", articleType: "tutorial", domainSlug: "haken", difficultyLevel: "beginner" },
  { id: "2", title: "Beginnen met boetseren", articleType: "guide", domainSlug: "keramiek", difficultyLevel: "intermediate" },
  { id: "3", title: "Haak een schildpad", articleType: "pattern", domainSlug: "haken", difficultyLevel: "advanced" },
];

test("filters content by format and hobby category", () => {
  const result = filterContentHubItems(items, { type: "tutorial", domain: "haken", difficulty: "all", search: "" });
  assert.deepEqual(result.map((item) => item.id), ["1"]);
});

test("matches search terms without ignoring active filters", () => {
  const result = filterContentHubItems(items, { type: "all", domain: "haken", difficulty: "all", search: "schild" });
  assert.deepEqual(result.map((item) => item.id), ["3"]);
});

test("filters articles and patterns by difficulty", () => {
  const result = filterContentHubItems(items, { type: "all", domain: "all", difficulty: "advanced", search: "" });
  assert.deepEqual(result.map((item) => item.id), ["3"]);
});
