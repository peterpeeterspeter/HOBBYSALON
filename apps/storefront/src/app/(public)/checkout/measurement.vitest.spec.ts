// OFFLINE: real page/action/redirect and analytics code; synthetic cart, auth,
// cookie, UI and SDK boundaries. No mounted browser, payment provider or database.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cart: vi.fn(), complete: vi.fn(), user: vi.fn(), verify: vi.fn(),
  cookieGet: vi.fn(), cookieDelete: vi.fn(), shipping: vi.fn(), refresh: vi.fn(),
  capture: vi.fn(), fetch: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/commerce/medusa/cart", () => ({
  CART_COOKIE_NAME: "cart_fixture", getCartForCheckout: mocks.cart,
  completeCart: mocks.complete, getShippingOptions: vi.fn(),
  updateCart: vi.fn(), addShippingMethod: vi.fn(), initiatePaymentSession: vi.fn(),
  getPaymentClientSecret: vi.fn(), getPaymentProviders: vi.fn(),
}));
vi.mock("@/lib/commerce/medusa/shipping", () => ({ cartShippingSummary: mocks.shipping, refreshShippingQuote: mocks.refresh }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: mocks.user }));
vi.mock("@/lib/commerce/medusa/orders", () => ({ verifyCheckoutSuccessOrder: mocks.verify }));
vi.mock("@/components/checkout/CheckoutPaymentForm", () => ({ CheckoutPaymentForm: () => null }));
vi.mock("@/components/checkout/CheckoutAddressForm", () => ({ CheckoutAddressForm: () => null }));
vi.mock("@/components/checkout/CheckoutShippingStep", () => ({ CheckoutShippingStep: () => null }));

import CheckoutPage from "./page";
import SuccessPage from "./success/page";
import { GET } from "./complete/route";
import { checkoutComplete } from "@/app/actions/checkout";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { sendPosthogEvent } from "@/lib/analytics/posthog";

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}

function browser(consent = "granted", path = "/checkout?token=private#secret", ready = true) {
  vi.stubGlobal("window", {
    location: new URL(`https://hobbysalon.be${path}`),
    localStorage: { getItem: () => consent },
    hsPostHogReady: ready, hsPostHog: { capture: mocks.capture },
  });
  vi.stubGlobal("document", { cookie: `hs_posthog_consent_v1=${consent}`, referrer: "", title: "Private title" });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetch.mockImplementation(() => { throw new Error("OFFLINE: network forbidden"); });
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.cookieGet.mockReturnValue({ value: "cart_fixture" });
  mocks.cart.mockResolvedValue({
    total: 24.99, currency_code: "eur", email: "private@example.test",
    items: [{ quantity: 2, unit_price: 12.495, metadata: { bundle_id: "private-bundle", bundle_label: "Private label" } }],
  });
  mocks.complete.mockResolvedValue({ success: true, order_set: { id: "ordset_fixture" } });
  mocks.user.mockResolvedValue({ id: "private-user", email: "private@example.test" });
  mocks.verify.mockResolvedValue({ verified: true, order: null });
});
afterEach(() => {
  expect(mocks.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("checkout measurement — offline mocked boundaries", () => {
  it.each([[24.99, 2499], [12.34, 1234], [0, 0]])("carries EUR %s through explicit cents to begin_checkout without identity", async (major, cents) => {
    const cart = await mocks.cart();
    mocks.cart.mockResolvedValue({ ...cart, total: major });
    const tree = await CheckoutPage({ searchParams: Promise.resolve({}) });
    const trackers = elements(tree).filter((element) => element.type === TrackOnMount);
    expect(trackers).toHaveLength(1);
    expect(trackers[0].props).toEqual({ event: "checkout_started", payload: {
      currency_code: "eur", total_amount: cents, total_amount_unit: "cents", item_count: 2,
    } });
    browser();
    sendPosthogEvent(String(trackers[0].props.event), trackers[0].props.payload as Record<string, unknown>);
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith("begin_checkout", { hs_safe: {
      item_count: 2, currency: "EUR", value: major,
      page_location: "https://hobbysalon.be/checkout", page_title: "Afrekenen | Hobbysalon", page_referrer: "",
    } });
  });

  it.each(["pending", "denied"])("does not forward checkout payload without consent: %s", async (consent) => {
    const tree = await CheckoutPage({ searchParams: Promise.resolve({}) });
    const tracker = elements(tree).find((element) => element.type === TrackOnMount)!;
    browser(consent);
    sendPosthogEvent("checkout_started", tracker.props.payload as Record<string, unknown>);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("does not invent payment events on repeated or forged success-page arrivals", async () => {
    for (const verified of [true, true, false]) {
      mocks.verify.mockResolvedValue({ verified, order: null });
      const tree = await SuccessPage({ searchParams: Promise.resolve({
        order: "ordset_fixture", bundle_count: "999", bundle_value: "99999999", bundle_id: "forged-bundle",
      }) });
      expect(elements(tree).filter((element) => element.type === TrackOnMount)).toEqual([]);
      expect(tree.props.description).not.toContain("Bundelcontext");
      expect(tree.props.description).not.toContain("999");
      expect(tree.props.description).not.toContain("forged-bundle");
    }
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("completed cart response still has business bundle data but puts no financial claims in return URL", async () => {
    const result = await checkoutComplete({ redirect: false });
    expect(result).toMatchObject({ success: true, orderSetId: "ordset_fixture", bundleCount: 1, bundleValue: 2499 });
    expect(mocks.complete).toHaveBeenCalledWith("cart_fixture");
    expect(mocks.cookieDelete).toHaveBeenCalledWith("cart_fixture");
    await expect(checkoutComplete({ redirect: true })).rejects.toThrow("REDIRECT:/checkout/success?order=ordset_fixture");
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("return status is not proof: failed server completion cannot reach success", async () => {
    mocks.complete.mockResolvedValue({ success: false, error: "not completed" });
    const response = await GET(new NextRequest("https://hobbysalon.be/checkout/complete?redirect_status=succeeded&bundle_value=99999"));
    expect(response.headers.get("location")).toBe("https://hobbysalon.be/checkout?payment_error=1");
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("successful return retains only server order reference, never provider secrets or bundle amounts", async () => {
    const response = await GET(new NextRequest("https://hobbysalon.be/checkout/complete?redirect_status=succeeded&payment_intent_client_secret=private&bundle_value=99999"));
    expect(response.headers.get("location")).toBe("https://hobbysalon.be/checkout/success?order=ordset_fixture");
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it.each(["", "failed", "canceled", "processing"])("does not complete a cart on unsupported return status %s", async (status) => {
    const response = await GET(new NextRequest(`https://hobbysalon.be/checkout/complete?redirect_status=${status}`));
    expect(response.headers.get("location")).toBe("https://hobbysalon.be/checkout?payment_error=1");
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("platform return-only event stays bounded to kind and never carries revenue", () => {
    browser("granted", "/checkout/success?amount=99999&token=private");
    sendPosthogEvent("platform_charge_returned", {
      charge_kind: "credit_pack", amount: 99999, value: 99999, currency: "EUR",
      email: "private@example.test", token: "private", order_id: "ordset_fixture",
    });
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith("platform_charge_returned", { hs_safe: {
      charge_kind: "credit_pack", page_location: "https://hobbysalon.be/checkout/success",
      page_title: "Bestelling ontvangen | Hobbysalon", page_referrer: "",
    } });
  });

  it("does not circumvent the dashboard privacy boundary for platform returns", () => {
    browser("granted", "/dashboard/aanbod?checkout=pending&type=credits");
    sendPosthogEvent("platform_charge_returned", { charge_kind: "credit_pack" });
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
