import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { selectHomeRecommendationResult } from "./home-recommendation-selection.ts";

test("keeps the cached generic recommendations when the request-specific lookup is unavailable", () => {
  const generic = { source: "cold_start", projects: ["generic-project"] };

  assert.strictEqual(selectHomeRecommendationResult(generic, null), generic);
});

test("uses the request-specific recommendations when they are available", () => {
  const generic = { source: "cold_start", projects: ["generic-project"] };
  const requestSpecific = { source: "personalized", projects: ["personal-project"] };

  assert.strictEqual(
    selectHomeRecommendationResult(generic, requestSpecific),
    requestSpecific,
  );
});
