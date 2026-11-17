// OFFLINE: real Stripe signature verification and Next route. RPC results are
// mocked, not evidence that a live database has applied the atomic migration.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/platform/client", () => ({ createPlatformClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/payments/stripe-client", async () => {
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe("sk_test_offline_fixture");
  return { getStripeClient: () => stripe, getListingWebhookSecret: () => "whsec_offline_fixture" };
});
import { POST } from "./route";
const stripe = new Stripe("sk_test_offline_fixture");

function request(type: string, paymentStatus = "paid", signatureSecret = "whsec_offline_fixture") {
  const payload = JSON.stringify({
    id: "evt_fixture", object: "event", type, created: 2000000000,
    data: { object: {
      id: "cs_fixture", object: "checkout.session", payment_status: paymentStatus,
      mode: "payment", created: 2000000000, currency: "eur", amount_total: 2499,
      metadata: { kind: "credit_pack", creator_id: "00000000-0000-4000-8000-000000000001", credits: "10", pack_code: "starter" },
    } },
  });
  return new NextRequest("http://localhost/api/webhooks/stripe-listing", {
    method: "POST", body: payload,
    headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: signatureSecret }) },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: "applied", error: null });
  mocks.fetch.mockImplementation(() => { throw new Error("OFFLINE: HTTP forbidden"); });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(mocks.fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("signed platform payment confirmation — mocked atomic RPC", () => {
  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("accepts only signed paid session for %s", async (type) => {
    expect((await POST(request(type))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("fulfill_listing_checkout", {
      p_session_id: "cs_fixture", p_creator_id: "00000000-0000-4000-8000-000000000001",
      p_kind: "credit_pack", p_metadata: {
        kind: "credit_pack", creator_id: "00000000-0000-4000-8000-000000000001", credits: "10", pack_code: "starter",
      }, p_session_created_at: 2000000000,
    });
  });

  it.each(["unpaid", "no_payment_required"])("does not fulfill either completion event with payment status %s", async (status) => {
    for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"])
      expect((await POST(request(type, status))).status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("handles unpaid completion followed by delayed success and replay using the same durable session key", async () => {
    expect((await POST(request("checkout.session.completed", "unpaid"))).status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: "applied", error: null })
      .mockResolvedValueOnce({ data: "duplicate", error: null });
    expect(await (await POST(request("checkout.session.async_payment_succeeded"))).json()).toEqual({ received: true });
    expect(await (await POST(request("checkout.session.async_payment_succeeded"))).json()).toEqual({ received: true, duplicate: true });
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_session_id)).toEqual(["cs_fixture", "cs_fixture"]);
  });

  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("rejects %s signed with another secret", async (type) => {
    expect((await POST(request(type, "paid", "whsec_wrong_fixture"))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["checkout.session.async_payment_failed", "checkout.session.expired", "payment_intent.succeeded"])("does not fulfill unrelated/failed event %s", async (type) => {
    expect((await POST(request(type))).status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects missing, expired and tampered raw-body signatures before fulfillment", async () => {
    const original = request("checkout.session.async_payment_succeeded");
    const body = await original.text();
    const signature = original.headers.get("stripe-signature")!;
    const expired = stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_offline_fixture", timestamp: 1 });
    for (const [payload, header] of [[body, ""], [body, expired], [body.replace('2499', '9999'), signature]]) {
      const response = await POST(new NextRequest("http://localhost/api/webhooks/stripe-listing", {
        method: "POST", body: payload, headers: header ? { "stripe-signature": header } : {},
      }));
      expect(response.status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("completion and a later async event keep the same session dedup key despite distinct event IDs", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "applied", error: null })
      .mockResolvedValueOnce({ data: "duplicate", error: null });
    expect((await POST(request("checkout.session.completed"))).status).toBe(200);
    const delayed = request("checkout.session.async_payment_succeeded");
    const body = (await delayed.text()).replace('evt_fixture', 'evt_later_delivery');
    const response = await POST(new NextRequest("http://localhost/api/webhooks/stripe-listing", {
      method: "POST", body, headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_offline_fixture" }) },
    }));
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_session_id)).toEqual(["cs_fixture", "cs_fixture"]);
  });

  it("does not acknowledge a delayed paid event when atomic fulfillment fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
    expect((await POST(request("checkout.session.async_payment_succeeded"))).status).toBe(500);
  });
});
