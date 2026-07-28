import assert from "node:assert/strict";
import test from "node:test";
import {
  productMatchesOfferFilter,
  resolveCategoryChipIds,
  resolveMaterialsOffer,
} from "./materials-catalog-helpers";

test("supply with Medusa is Webshop checkout", () => {
  const offer = resolveMaterialsOffer({
    product_type: "supply",
    medusa_product_id: "prod_123",
  });
  assert.equal(offer.badge, "Webshop");
  assert.equal(offer.interactionMode, "checkout");
  assert.equal(offer.offerKey, "webshop");
});

test("handmade without Medusa is inquire_maker", () => {
  const offer = resolveMaterialsOffer({
    product_type: "handmade",
    medusa_product_id: null,
  });
  assert.equal(offer.badge, "Maker");
  assert.equal(offer.interactionMode, "inquire_maker");
  assert.equal(offer.ctaLabel, "Vraag de maker");
});

test("legacy handmade with Medusa keeps checkout", () => {
  const offer = resolveMaterialsOffer({
    product_type: "handmade",
    medusa_product_id: "prod_legacy",
  });
  assert.equal(offer.badge, "Maker");
  assert.equal(offer.interactionMode, "checkout");
  assert.equal(offer.ctaLabel, "Bekijk product");
});

test("destash without Medusa is view_listing", () => {
  const offer = resolveMaterialsOffer({
    product_type: "destash",
    medusa_product_id: null,
  });
  assert.equal(offer.badge, "Tweedehands");
  assert.equal(offer.interactionMode, "view_listing");
  assert.equal(offer.ctaLabel, "Bekijk advertentie");
});

test("destash with Medusa keeps checkout", () => {
  const offer = resolveMaterialsOffer({
    product_type: "destash",
    medusa_product_id: "prod_d",
  });
  assert.equal(offer.badge, "Tweedehands");
  assert.equal(offer.interactionMode, "checkout");
});

test("workshop_kit is Workshoppakket view_kit", () => {
  const offer = resolveMaterialsOffer({
    product_type: "workshop_kit",
    medusa_product_id: null,
  });
  assert.equal(offer.badge, "Workshoppakket");
  assert.equal(offer.interactionMode, "view_kit");
  assert.equal(offer.ctaLabel, "Bekijk pakket");
});

test("productMatchesOfferFilter uses offerKey", () => {
  assert.equal(
    productMatchesOfferFilter(
      { product_type: "handmade", medusa_product_id: null },
      "maker"
    ),
    true
  );
  assert.equal(
    productMatchesOfferFilter(
      { product_type: "supply", medusa_product_id: "x" },
      "maker"
    ),
    false
  );
});

test("resolveCategoryChipIds keeps selected sticky", () => {
  assert.deepEqual(
    resolveCategoryChipIds({
      categoryIdsWithSupply: ["c2"],
      selectedCategoryId: "c1",
      allCategoryIdsOrdered: ["c1", "c2", "c3"],
    }),
    ["c1", "c2"]
  );
});
