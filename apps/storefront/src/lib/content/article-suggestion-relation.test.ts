import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveArticleSuggestionRelation } from "./article-suggestion-relation.ts";

const productRoles = [
  "required_material", "required_tool", "optional_material", "related_product",
];

for (const relation of [undefined, null, "", "  ", "related", " related "]) {
  test(`resolves product default/legacy role ${JSON.stringify(relation)} to related_product`, () => {
    assert.equal(resolveArticleSuggestionRelation("product", relation), "related_product");
  });
}

for (const role of productRoles) {
  test(`preserves explicit product role ${role}`, () => {
    assert.equal(resolveArticleSuggestionRelation("product", role), role);
    assert.equal(resolveArticleSuggestionRelation("product", ` ${role} `), role);
  });
}

for (const target of ["workshop", "event"]) {
  test(`defaults ${target} suggestions to related`, () => {
    for (const relation of [undefined, null, "", "  ", "related", " related "]) {
      assert.equal(resolveArticleSuggestionRelation(target, relation), "related");
    }
  });
  for (const role of productRoles) {
    test(`rejects product role ${role} on ${target}`, () => {
      assert.throws(() => resolveArticleSuggestionRelation(target, role), {
        message: "Ongeldig relatietype voor deze suggestie.",
      });
    });
  }
}

for (const relation of ["suggested_auto", "mentions", "related_article", "next_step", "__proto__", "constructor", "RELATED_PRODUCT", 1, {}, ["related"], false]) {
  test(`rejects unrecognized/non-string relation ${JSON.stringify(relation)}`, () => {
    for (const target of ["product", "workshop", "event"]) {
      assert.throws(() => resolveArticleSuggestionRelation(target, relation), {
        message: "Ongeldig relatietype voor deze suggestie.",
      });
    }
  });
}

for (const target of ["article", "project", "creator", "unknown", "PRODUCT", " product ", "__proto__", undefined, null, 1, {}]) {
  test(`rejects unsupported target ${JSON.stringify(target)} even with valid product role`, () => {
    assert.throws(() => resolveArticleSuggestionRelation(target, "required_tool"), {
      message: "Ongeldig doeltype voor deze suggestie.",
    });
  });
}
