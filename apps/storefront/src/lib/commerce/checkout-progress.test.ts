import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getCheckoutStep } from "./checkout-progress.ts";

test("derives the next required checkout step", () => {
  assert.equal(getCheckoutStep({ hasAddress: false, hasShipping: false }), "address");
  assert.equal(getCheckoutStep({ hasAddress: true, hasShipping: false }), "shipping");
  assert.equal(getCheckoutStep({ hasAddress: true, hasShipping: true }), "payment");
});
