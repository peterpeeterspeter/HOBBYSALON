import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MERCHANT_REGISTER_PILOT,
  PRIJZEN_LISTING_VAT_NOTE,
  PRICING_ROUTE_CARDS,
  SHOP_PAYMENT_PROVIDER_NOTE,
  SHOP_PRICING_BODY,
  SHOP_PRICING_EXAMPLE,
  SUPPLIER_COMMISSION_NOTE,
  SUPPLIER_FAQ,
  SUPPLIER_PAGE,
} from "./public-pricing.ts";

describe("shop pricing copy", () => {
  it("states €0 fixed cost, 10% on total incl. VAT and shipping, shop pays provider fees", () => {
    assert.match(SHOP_PRICING_BODY, /€0 vaste kosten/);
    assert.match(SHOP_PRICING_BODY, /10% commissie op de totale verkoopprijs/);
    assert.match(SHOP_PRICING_BODY, /inclusief btw en verzendkosten/);
    assert.match(
      SHOP_PRICING_BODY,
      /Betaalkosten van de betaalprovider zijn voor de winkel/
    );
    assert.match(SHOP_PRICING_BODY, /Uitbetaling gebeurt dagelijks/);
    assert.match(SHOP_PRICING_BODY, /retour/);
  });

  it("includes the €40 + €5 → €4,50 example and generic provider tariffs", () => {
    assert.equal(
      SHOP_PRICING_EXAMPLE,
      "Voorbeeld: product €40 + verzending €5 = €45 → commissie €4,50 (excl. btw)."
    );
    assert.equal(
      SHOP_PAYMENT_PROVIDER_NOTE,
      "De betaalkosten volgen de tarieven van onze betaalprovider."
    );
    assert.doesNotMatch(SHOP_PAYMENT_PROVIDER_NOTE, /\d+[,.]\d+%|€\d/);
  });

  it("does not say payment fees are charged to the buyer or use 'geen contract'", () => {
    const surfaces = [
      SHOP_PRICING_BODY,
      SUPPLIER_COMMISSION_NOTE,
      SUPPLIER_PAGE.pricingHighlight.body,
      SUPPLIER_PAGE.pricingHighlight.finePrint,
      SUPPLIER_PAGE.closing.body,
      SUPPLIER_PAGE.metaDescription,
      MERCHANT_REGISTER_PILOT.body,
      ...SUPPLIER_FAQ.map((item) => item.answer),
    ].join("\n");

    assert.doesNotMatch(surfaces, /geen contract/i);
    assert.doesNotMatch(surfaces, /jaarcontract/i);
    assert.doesNotMatch(surfaces, /voor de koper/i);
    assert.doesNotMatch(surfaces, /koper betaalt/i);
    assert.match(surfaces, /geen minimumduur/);
  });

  it("surfaces shop pricing on /prijzen supplier card and excl. btw for listings", () => {
    const supplier = PRICING_ROUTE_CARDS.find((card) => card.id === "supplier");
    assert.ok(supplier);
    assert.equal(supplier.description, SHOP_PRICING_BODY);
    assert.ok(supplier.features.includes(SHOP_PRICING_EXAMPLE));
    assert.ok(supplier.features.includes(SHOP_PAYMENT_PROVIDER_NOTE));

    assert.match(PRIJZEN_LISTING_VAT_NOTE, /excl\. btw/);
    assert.match(PRIJZEN_LISTING_VAT_NOTE, /€9,99/);
    assert.match(PRIJZEN_LISTING_VAT_NOTE, /€50/);
    assert.match(PRIJZEN_LISTING_VAT_NOTE, /€69/);

    const workshop = PRICING_ROUTE_CARDS.find((card) => card.id === "workshop");
    const organizer = PRICING_ROUTE_CARDS.find((card) => card.id === "organizer");
    assert.ok(workshop?.features.some((f) => /excl\. btw/.test(f)));
    assert.ok(organizer?.features.every((f) => !/€5[09]/.test(f) || /excl\. btw/.test(f)));
  });
});
