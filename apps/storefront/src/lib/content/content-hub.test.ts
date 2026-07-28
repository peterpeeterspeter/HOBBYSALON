import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { filterContentHubItems } from "./content-hub.ts";

const items = [
  {
    id: "1",
    title: "Gehaakt mandje",
    searchText: "Gehaakt mandje Leer haken haken Stap voor stap",
    articleType: "tutorial",
    domainSlug: "haken",
    domainSlugs: ["haken"],
    difficultyLevel: "beginner",
  },
  {
    id: "2",
    title: "Beginnen met boetseren",
    searchText: "Beginnen met boetseren Tips voor klei keramiek Technieken & uitleg",
    articleType: "guide",
    domainSlug: "keramiek",
    domainSlugs: ["keramiek"],
    difficultyLevel: "intermediate",
  },
  {
    id: "3",
    title: "Haak een schildpad",
    searchText: "Haak een schildpad Patroon haken Patronen",
    articleType: "pattern",
    domainSlug: "haken",
    domainSlugs: ["haken", "amigurumi"],
    difficultyLevel: "advanced",
  },
];

test("filters content by format and hobby category", () => {
  const result = filterContentHubItems(items, {
    type: "tutorial",
    domain: "haken",
    difficulty: "all",
    search: "",
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["1"]
  );
});

test("matches search terms without ignoring active filters", () => {
  const result = filterContentHubItems(items, {
    type: "all",
    domain: "haken",
    difficulty: "all",
    search: "schild",
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["3"]
  );
});

test("filters articles and patterns by difficulty", () => {
  const result = filterContentHubItems(items, {
    type: "all",
    domain: "all",
    difficulty: "advanced",
    search: "",
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["3"]
  );
});

test("matches domain via secondary domainSlugs link", () => {
  const result = filterContentHubItems(items, {
    type: "all",
    domain: "amigurumi",
    difficulty: "all",
    search: "",
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["3"]
  );
});

test("searches excerpt and domain names via searchText", () => {
  const result = filterContentHubItems(items, {
    type: "all",
    domain: "all",
    difficulty: "all",
    search: "keramiek",
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["2"]
  );
});
