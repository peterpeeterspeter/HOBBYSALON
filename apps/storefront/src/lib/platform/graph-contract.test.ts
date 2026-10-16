import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import {
  isPublicGraphRelation,
  relationForApprovedSuggestion,
} from "./graph-contract.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { scoreGraphMatch, selectGraphSuggestions } from "./graph-match.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { pickStrongestJourney } from "../services/home-journey-rank.ts";

test("approval of a generic product suggestion is a recommendation, not a requirement", () => {
  assert.equal(relationForApprovedSuggestion("product", "related"), "related_product");
  assert.equal(relationForApprovedSuggestion("product", "required_material"), "required_material");
  assert.equal(relationForApprovedSuggestion("workshop", "related"), "related_workshop");
  assert.equal(relationForApprovedSuggestion("event"), "related_event");
  assert.equal(relationForApprovedSuggestion("product", "next_step"), null);
});

test("pending and dismissed suggestions are not public edges", () => {
  assert.equal(isPublicGraphRelation("suggested_auto"), false);
  assert.equal(isPublicGraphRelation("dismissed_suggestion"), false);
  assert.equal(isPublicGraphRelation("related_product"), true);
  assert.equal(isPublicGraphRelation("required_material"), true);
});

test("shared domain alone never qualifies a catalog suggestion", () => {
  const domainOnly = scoreGraphMatch("domain-1", ["mand"], {
    title: "Kralenpakket",
    domainId: "domain-1",
  });
  assert.equal(domainOnly, 0);

  const selected = selectGraphSuggestions(
    "domain-1",
    "Katoenen koord haken",
    [
      {
        targetType: "product",
        targetId: "cord",
        title: "Katoenen koord 6 mm",
        domainId: "other",
      },
      {
        targetType: "product",
        targetId: "beads",
        title: "Kralenpakket",
        domainId: "domain-1",
      },
      {
        targetType: "workshop",
        targetId: "class",
        title: "Katoenen koord workshop",
        domainId: "domain-1",
      },
    ]
  );
  assert.deepEqual(
    selected.map((row) => row.candidate.targetId),
    ["class", "cord"]
  );
});

test("dismissed targets are not suggested again", () => {
  const selected = selectGraphSuggestions(
    null,
    "Katoenen koord",
    [
      {
        targetType: "product",
        targetId: "cord",
        title: "Katoenen koord",
        domainId: null,
      },
    ],
    new Set(["product:cord"])
  );
  assert.deepEqual(selected, []);
});

test("journey ranking prefers the more complete candidate", () => {
  const picked = pickStrongestJourney([
    { item: "first", resolvedCount: 2, materialCount: 1 },
    { item: "stronger", resolvedCount: 3, materialCount: 1 },
  ]);
  assert.equal(picked, "stronger");
});
