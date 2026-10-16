import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { INTERESTS_PROMPT_COOKIE, shouldShowInterestsPrompt } from "./interests-prompt.ts";

test("shows the prompt to a fresh hobbyist without interests", () => {
  assert.equal(
    shouldShowInterestsPrompt({ interestCount: 0, hasCreatorProfile: false, hasOfferIntent: false, dismissed: false }),
    true
  );
});

test("hides once interests exist, after dismissal, or for aanbieders", () => {
  const base = { interestCount: 0, hasCreatorProfile: false, hasOfferIntent: false, dismissed: false };
  assert.equal(shouldShowInterestsPrompt({ ...base, interestCount: 2 }), false);
  assert.equal(shouldShowInterestsPrompt({ ...base, dismissed: true }), false);
  assert.equal(shouldShowInterestsPrompt({ ...base, hasCreatorProfile: true }), false);
  assert.equal(shouldShowInterestsPrompt({ ...base, hasOfferIntent: true }), false);
});

test("cookie name is stable", () => {
  assert.equal(INTERESTS_PROMPT_COOKIE, "hs_interests_prompt");
});
