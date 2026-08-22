import assert from "node:assert/strict";
import test from "node:test";
import {
  isInstructionsSectionHeading,
  isMaterialsSectionHeading,
  isStopSectionHeading,
  normalizeSectionHeading,
} from "./article-section-headings";

test("normalizes emoji and accents on headings", () => {
  assert.equal(normalizeSectionHeading("🛒 Materialenlijst"), "materialenlijst");
  assert.equal(normalizeSectionHeading("Benodigdheden"), "benodigdheden");
});

test("materials aliases", () => {
  assert.equal(isMaterialsSectionHeading("Materialenlijst"), true);
  assert.equal(isMaterialsSectionHeading("Benodigdheden"), true);
  assert.equal(isMaterialsSectionHeading("Dit heb je nodig"), true);
  assert.equal(isMaterialsSectionHeading("What you need"), true);
  assert.equal(isMaterialsSectionHeading("Het lijf haken"), false);
});

test("instructions aliases", () => {
  assert.equal(isInstructionsSectionHeading("Stap voor stap"), true);
  assert.equal(isInstructionsSectionHeading("Instructies"), true);
  assert.equal(isInstructionsSectionHeading("Werkwijze"), true);
  assert.equal(isInstructionsSectionHeading("Benodigdheden"), false);
});

test("stop aliases", () => {
  assert.equal(isStopSectionHeading("Bron"), true);
  assert.equal(isStopSectionHeading("Tips"), true);
  assert.equal(isStopSectionHeading("Afwerking"), false);
});
