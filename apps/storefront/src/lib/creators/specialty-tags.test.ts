import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSpecialtyTagsInput,
  parseSpecialtyTagsInput,
} from "./specialty-tags";

test("parseSpecialtyTagsInput splits and dedupes", () => {
  assert.deepEqual(parseSpecialtyTagsInput("Vilten, glas-in-lood; Vilten"), [
    "Vilten",
    "glas-in-lood",
  ]);
});

test("parseSpecialtyTagsInput caps at 8 tags", () => {
  const input = Array.from({ length: 12 }, (_, i) => `tag${i}`).join(", ");
  assert.equal(parseSpecialtyTagsInput(input).length, 8);
});

test("formatSpecialtyTagsInput joins tags", () => {
  assert.equal(formatSpecialtyTagsInput(["A", "B"]), "A, B");
  assert.equal(formatSpecialtyTagsInput(null), "");
});
