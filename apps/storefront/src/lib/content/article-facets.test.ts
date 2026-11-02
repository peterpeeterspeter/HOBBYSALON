import { test } from "node:test";
import assert from "node:assert/strict";
import { facetsFromMetadata, normalizeFacetValue } from "./article-facets.ts";

test("normalizeFacetValue merges case and spacing", () => {
  assert.equal(normalizeFacetValue("  Haken  Amigurumi "), "haken amigurumi");
  assert.equal(normalizeFacetValue("   "), null);
  assert.equal(normalizeFacetValue("x".repeat(49)), null);
});

test("facetsFromMetadata dedupes labels per facet", () => {
  const facets = facetsFromMetadata({
    content_kind: "full_tutorial",
    crafts: [{ label: "Haken", evidence: "a" }, { label: "haken", evidence: "b" }],
    techniques: [{ label: "Vasten", evidence: "c" }],
    themes: [],
    audience: [{ label: "Beginners", evidence: "d" }],
  } as never);
  assert.deepEqual(facets, {
    content_kind: "full_tutorial",
    crafts: ["haken"],
    techniques: ["vasten"],
    themes: [],
    audience: ["beginners"],
  });
});
