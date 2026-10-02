import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  set: vi.fn(),
  revalidate: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
  createLineItem: vi.fn(),
  listProducts: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => ({ value: mocks.jar.get(name) }),
  set: mocks.set,
}) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/commerce/medusa/client", () => ({ sdk: { store: {
  region: { list: async () => ({ regions: [{ id: "region", name: "Europe" }] }) },
  cart: { create: mocks.create, retrieve: mocks.retrieve, createLineItem: mocks.createLineItem },
  product: { list: mocks.listProducts },
} } }));

import { addBundleToCartAction, addToCartAction } from "./cart";
import { addToCart, CART_COOKIE_NAME } from "@/lib/commerce/medusa/cart";

const stockError = { response: { status: 400, data: {
  type: "not_allowed", code: "insufficient_inventory", message: "Insufficient inventory",
} } };
const missingError = { status: 404, message: "Cart was not found" };
const items = [{ variant_id: "first" }, { variant_id: "second" }];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.jar.clear();
  mocks.jar.set(CART_COOKIE_NAME, "old-cart");
  mocks.set.mockImplementation((name: string, value: string) => mocks.jar.set(name, value));
  mocks.create.mockResolvedValue({ cart: { id: "new-cart" } });
  mocks.retrieve.mockResolvedValue({ cart: { id: "old-cart", completed_at: null, items: [] } });
  mocks.createLineItem.mockResolvedValue({});
  mocks.listProducts.mockResolvedValue({
    products: [{
      id: "prod",
      seller: { id: "seller_1" },
      variants: [{ id: "variant" }, { id: "first" }, { id: "second" }],
    }],
    count: 1,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("actual cart actions with mocked SDK and cookies", () => {
  it("stock failure preserves existing cookie and never creates a cart", async () => {
    mocks.createLineItem.mockRejectedValue(stockError);
    expect(await addToCartAction("variant")).toMatchObject({ success: false, message: "Dit product is tijdelijk niet op voorraad." });
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("old-cart");
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    { status: 400, message: "Invalid quantity" },
    { status: 404, message: "Variant was not found" },
    { status: 500, message: "Internal server error" },
    { status: 408, message: "Request timed out" },
    { status: 429, message: "Too many requests" },
    { response: { status: 404, data: { type: "not_found", message: "Product was not found" } } },
    new TypeError("fetch failed"),
  ])("does not reset on validation, missing variant, server or transport errors: %j", async (error) => {
    mocks.createLineItem.mockRejectedValue(error);
    expect((await addToCartAction("variant")).success).toBe(false);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([stockError, { status: 503, message: "Service unavailable" }, new TypeError("fetch failed")])("failed replacement retry leaves old cookie intact: %j", async (error) => {
    mocks.createLineItem.mockRejectedValueOnce(missingError).mockRejectedValueOnce(error);
    mocks.retrieve.mockRejectedValue(missingError);
    expect((await addToCartAction("variant")).success).toBe(false);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("old-cart");
  });

  it.each(["missing", "completed"])("confirmed %s cart recovers and publishes cookie only after successful add", async (state) => {
    mocks.createLineItem.mockRejectedValueOnce(state === "missing" ? missingError : { status: 400, message: "Cart is already completed" });
    if (state === "missing") mocks.retrieve.mockRejectedValue(missingError);
    else mocks.retrieve.mockResolvedValue({ cart: { id: "old-cart", completed_at: "2026-01-01" } });
    mocks.createLineItem.mockImplementationOnce(async (cartId: string) => {
      expect(cartId).toBe("new-cart");
      expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("old-cart");
      expect(mocks.set).not.toHaveBeenCalled();
      return {};
    });
    expect(await addToCartAction("variant", 2)).toEqual({ success: true });
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("new-cart");
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).toHaveBeenCalledWith("/cart");
  });

  it("a failed cart-state check cannot establish staleness", async () => {
    mocks.createLineItem.mockRejectedValue(missingError);
    mocks.retrieve.mockRejectedValue(new TypeError("fetch failed"));
    expect((await addToCartAction("variant")).success).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("failure to create a replacement preserves the original cart and error", async () => {
    mocks.createLineItem.mockRejectedValue(missingError);
    mocks.retrieve.mockRejectedValue(missingError);
    mocks.create.mockRejectedValue(new TypeError("fetch failed"));
    expect(await addToCartAction("variant")).toEqual({ success: false, message: "Toevoegen mislukt" });
    expect(mocks.createLineItem).toHaveBeenCalledTimes(1);
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("old-cart");
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("a repeated stale response retries only once", async () => {
    mocks.createLineItem.mockRejectedValue(missingError);
    mocks.retrieve.mockRejectedValue(missingError);
    expect((await addToCartAction("variant")).success).toBe(false);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.createLineItem).toHaveBeenCalledTimes(2);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it.each(["missing", "completed"])("returns structured confirmed %s errors", async (state) => {
    mocks.createLineItem.mockRejectedValue(missingError);
    if (state === "missing") mocks.retrieve.mockRejectedValue(missingError);
    else mocks.retrieve.mockResolvedValue({ cart: { id: "old-cart", completed_at: "2026-01-01" } });
    expect(await addToCart("old-cart", "variant")).toMatchObject({ success: false, error: {
      kind: state === "missing" ? "cart_not_found" : "cart_completed", status: 404,
    } });
    expect(mocks.retrieve).toHaveBeenCalledWith("old-cart", { fields: "id,completed_at" });
  });

  it("generic product 404 is not a structured stale-cart error", async () => {
    mocks.createLineItem.mockRejectedValue({ status: 404, type: "not_found", message: "Product was not found" });
    expect(await addToCart("old-cart", "variant")).toMatchObject({ success: false, error: {
      kind: "unknown", type: "not_found", status: 404,
    } });
  });

  it("successful existing-cart adds neither create nor overwrite a cart", async () => {
    expect(await addToCartAction("variant", 3)).toEqual({ success: true });
    expect(mocks.createLineItem).toHaveBeenCalledWith("old-cart", { variant_id: "variant", quantity: 3 }, expect.any(Object));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it.each([stockError, missingError])("bundle failure after partial progress never resets or replays items: %j", async (error) => {
    mocks.createLineItem.mockResolvedValueOnce({}).mockRejectedValueOnce(error);
    mocks.retrieve.mockRejectedValue(missingError);
    expect(await addBundleToCartAction("bundle", items)).toMatchObject({ success: false, added_count: 1, failed_count: 1 });
    expect(mocks.createLineItem).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("old-cart");
  });

  it("mixed bundle failures with no progress cannot reset a cart", async () => {
    mocks.createLineItem.mockRejectedValueOnce(missingError).mockRejectedValueOnce(stockError);
    mocks.retrieve.mockRejectedValue(missingError);
    expect((await addBundleToCartAction("bundle", items)).success).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("replacement bundle partial progress remains accessible", async () => {
    mocks.createLineItem.mockRejectedValueOnce(missingError).mockRejectedValueOnce(missingError)
      .mockResolvedValueOnce({}).mockRejectedValueOnce(stockError);
    mocks.retrieve.mockRejectedValue(missingError);
    expect(await addBundleToCartAction("bundle", items)).toMatchObject({ success: false, added_count: 1, failed_count: 1 });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("new-cart");
  });

  it("fully successful replacement bundle publishes only after its adds succeed", async () => {
    mocks.createLineItem.mockRejectedValueOnce(missingError).mockRejectedValueOnce(missingError)
      .mockImplementation(async () => {
        expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("old-cart");
        expect(mocks.set).not.toHaveBeenCalled();
        return {};
      });
    mocks.retrieve.mockRejectedValue(missingError);
    expect(await addBundleToCartAction("bundle", items)).toEqual({ success: true, added_count: 2, failed_count: 0 });
    expect(mocks.createLineItem).toHaveBeenCalledTimes(4);
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("new-cart");
  });

  it("replacement bundle with zero successful adds retains the original cookie", async () => {
    mocks.createLineItem.mockRejectedValueOnce(missingError).mockRejectedValueOnce(missingError).mockRejectedValue(stockError);
    mocks.retrieve.mockRejectedValue(missingError);
    expect((await addBundleToCartAction("bundle", items)).success).toBe(false);
    expect(mocks.jar.get(CART_COOKIE_NAME)).toBe("old-cart");
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("preserves backend error type, code and status alongside the localized error", async () => {
    mocks.createLineItem.mockRejectedValue(stockError);
    expect(await addToCart("old-cart", "variant")).toMatchObject({ success: false, error: {
      kind: "inventory", type: "not_allowed", code: "insufficient_inventory", status: 400,
    } });
  });
});
