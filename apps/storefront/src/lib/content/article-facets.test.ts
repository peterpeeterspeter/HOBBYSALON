import { test } from "node:test";
import assert from "node:assert/strict";
import { audienceBucket, canonicalizeCorpus, facetsFromMetadata, facetStem, normalizeFacetValue } from "./article-facets.ts";

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

test("facetStem joins Dutch plural and inflection forms", () => {
  assert.equal(facetStem("stokjes"), facetStem("stokje"));
  assert.equal(facetStem("bloemen"), facetStem("bloem"));
  assert.equal(facetStem("vasten"), facetStem("vaste"));
  assert.notEqual(facetStem("haken"), facetStem("breien"));
});

test("audienceBucket maps free text to fixed levels", () => {
  assert.equal(audienceBucket("Beginners die recht breien"), "beginners");
  assert.equal(audienceBucket("gevorderde beginner"), "gevorderde beginners");
  assert.equal(audienceBucket("ervaren hakers"), "gevorderden");
  assert.equal(audienceBucket("kinderen vanaf 6 jaar"), "kinderen");
  assert.equal(audienceBucket("volwassenen"), null);
});

test("canonicalizeCorpus picks the most frequent form", () => {
  const base = { content_kind: null, crafts: [], themes: [], audience: [] };
  const out = canonicalizeCorpus([
    { ...base, techniques: ["stokje"] },
    { ...base, techniques: ["stokje"] },
    { ...base, techniques: ["stokjes", "vasten"] },
  ]);
  assert.deepEqual(out[2].techniques, ["stokje", "vasten"]);
});
