import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node test runner needs extension
import {
  pickSelectedVariantPrice,
  resolveProductEligibility,
} from "./product-eligibility.ts";

test("supply with medusa is purchasable", () => {
  assert.equal(
    resolveProductEligibility({
      product_type: "supply",
      medusa_product_id: "prod_1",
      has_priced_variant: true,
    }),
    "purchasable"
  );
});

test("handmade without medusa is inquiry_only", () => {
  assert.equal(
    resolveProductEligibility({
      product_type: "handmade",
      medusa_product_id: null,
    }),
    "inquiry_only"
  );
});

test("supply without priced variant is unavailable", () => {
  assert.equal(
    resolveProductEligibility({
      product_type: "supply",
      medusa_product_id: "prod_1",
      has_priced_variant: false,
    }),
    "unavailable"
  );
});

test("selected variant price wins over first variant", () => {
  const price = pickSelectedVariantPrice({
    selectedVariantId: "v2",
    variants: [
      {
        id: "v1",
        calculated_price: { calculated_amount: 10, currency_code: "EUR" },
      },
      {
        id: "v2",
        calculated_price: { calculated_amount: 25.5, currency_code: "EUR" },
      },
    ],
  });
  assert.deepEqual(price, { amount: 25.5, currency_code: "EUR" });
});
