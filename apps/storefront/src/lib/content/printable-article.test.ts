import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { isPrintableArticleType } from "./printable-article.ts";

test("marks tutorials, guides, and patterns as printable", () => {
  assert.equal(isPrintableArticleType("tutorial"), true);
  assert.equal(isPrintableArticleType("guide"), true);
  assert.equal(isPrintableArticleType("pattern"), true);
});

test("keeps non-instructional and missing article types out of print", () => {
  assert.equal(isPrintableArticleType("inspiration"), false);
  assert.equal(isPrintableArticleType("interview"), false);
  assert.equal(isPrintableArticleType(null), false);
  assert.equal(isPrintableArticleType(undefined), false);
});
