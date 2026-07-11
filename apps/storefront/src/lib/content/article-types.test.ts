import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { ARTICLE_TYPE_OPTIONS, isAuthorableArticleType } from "./article-types.ts";

test("allows creators to publish patterns", () => {
  assert.equal(isAuthorableArticleType("pattern"), true);
  assert.deepEqual(
    ARTICLE_TYPE_OPTIONS.find((option) => option.value === "pattern"),
    { value: "pattern", label: "Patroon" }
  );
});
