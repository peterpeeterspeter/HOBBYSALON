import { describe, expect, it } from "vitest";
import {
  assertCartReadyForPayment,
  isCommercePaymentsEnabled,
  normalizeCheckoutCountryCode,
} from "./payment-gate";

describe("normalizeCheckoutCountryCode", () => {
  it("accepts be and nl", () => {
    expect(normalizeCheckoutCountryCode("BE")).toEqual({
      ok: true,
      country_code: "be",
    });
    expect(normalizeCheckoutCountryCode("nl")).toEqual({
      ok: true,
      country_code: "nl",
    });
  });

  it("rejects other countries", () => {
    expect(normalizeCheckoutCountryCode("de").ok).toBe(false);
    expect(normalizeCheckoutCountryCode("").ok).toBe(false);
  });
});

describe("assertCartReadyForPayment", () => {
  const base = {
    items: [{ id: "li_1" }],
    email: "buyer@example.com",
    shipping_address: { address_1: "Straat 1", country_code: "be" },
    shipping_methods: [{ id: "sm_1" }],
  };

  it("passes a ready cart", () => {
    expect(assertCartReadyForPayment(base)).toEqual({ ok: true });
  });

  it("requires shipping before pay", () => {
    const result = assertCartReadyForPayment({
      ...base,
      shipping_methods: [],
    });
    expect(result.ok).toBe(false);
  });

  it("requires allowed country", () => {
    const result = assertCartReadyForPayment({
      ...base,
      shipping_address: { address_1: "X", country_code: "fr" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("isCommercePaymentsEnabled", () => {
  it("defaults to enabled when unset", () => {
    const prev = process.env.COMMERCE_PAYMENTS_ENABLED;
    delete process.env.COMMERCE_PAYMENTS_ENABLED;
    expect(isCommercePaymentsEnabled()).toBe(true);
    if (prev === undefined) delete process.env.COMMERCE_PAYMENTS_ENABLED;
    else process.env.COMMERCE_PAYMENTS_ENABLED = prev;
  });

  it("honours explicit off", () => {
    const prev = process.env.COMMERCE_PAYMENTS_ENABLED;
    process.env.COMMERCE_PAYMENTS_ENABLED = "false";
    expect(isCommercePaymentsEnabled()).toBe(false);
    if (prev === undefined) delete process.env.COMMERCE_PAYMENTS_ENABLED;
    else process.env.COMMERCE_PAYMENTS_ENABLED = prev;
  });
});
