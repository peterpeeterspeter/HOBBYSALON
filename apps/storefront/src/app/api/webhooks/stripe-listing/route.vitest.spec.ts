import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/payments/stripe-client", () => ({
  getStripeClient: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
  getListingWebhookSecret: () => "test-secret",
}));
vi.mock("@/lib/platform/client", () => ({ createPlatformClient: mocks.createClient }));

import { POST } from "./route";

const creatorId = "00000000-0000-4000-8000-000000000001";
const metadata = { kind: "credit_pack", creator_id: creatorId, credits: "10", pack_code: "starter" };
function event(overrides = {}) {
  return { type: "checkout.session.completed", data: { object: {
    id: "cs_test_payment", created: 2000000000, payment_status: "paid", metadata, ...overrides,
  } } };
}
function request(signature = "test-signature") {
  return new NextRequest("http://localhost/api/webhooks/stripe-listing", {
    method: "POST", body: "signed-raw-body",
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.constructEvent.mockReturnValue(event());
  mocks.rpc.mockResolvedValue({ data: "applied", error: null });
  // Represents an old marker left behind by a crash before fulfillment.
  mocks.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }) });
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc, from: mocks.from });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listing payment atomic webhook", () => {
  it.each([
    metadata,
    { kind: "plan", creator_id: creatorId, plan_code: "maker_monthly" },
    { kind: "workshop_listing", creator_id: creatorId, workshop_id: "00000000-0000-4000-8000-000000000002" },
  ])("fulfills $kind through exactly one atomic RPC, never direct writes", async (purchase) => {
    mocks.constructEvent.mockReturnValue(event({ metadata: purchase }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("fulfill_listing_checkout", {
      p_session_id: "cs_test_payment", p_creator_id: creatorId,
      p_kind: purchase.kind, p_metadata: purchase, p_session_created_at: 2000000000,
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.constructEvent).toHaveBeenCalledWith("signed-raw-body", "test-signature", "test-secret");
  });

  it("acknowledges only an atomically completed duplicate", async () => {
    mocks.rpc.mockResolvedValue({ data: "duplicate", error: null });
    expect(await (await POST(request())).json()).toEqual({ received: true, duplicate: true });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("blocks ambiguous legacy markers and requests reconciliation, not regrant", async () => {
    mocks.rpc.mockResolvedValue({ data: "legacy_blocked", error: null });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Payment requires reconciliation" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(["23505", "08006", "P0001"])("does not mistake RPC failure %s for success or delete markers", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "database failure" } });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("handles lost commit responses without compensating deletes; retry can be duplicate", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("connection lost after commit"))
      .mockResolvedValueOnce({ data: "duplicate", error: null });
    expect((await POST(request())).status).toBe(500);
    expect(await (await POST(request())).json()).toEqual({ received: true, duplicate: true });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([null, "unexpected"])("fails closed on unrecognized RPC result %s", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect((await POST(request())).status).toBe(500);
  });

  it("does not silently acknowledge paid sessions missing routing metadata", async () => {
    mocks.constructEvent.mockReturnValue(event({ metadata: {} }));
    expect((await POST(request())).status).toBe(500);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("ignores unpaid sessions and unrelated events", async () => {
    mocks.constructEvent.mockReturnValueOnce(event({ payment_status: "unpaid" }))
      .mockReturnValueOnce({ type: "payment_intent.succeeded" });
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects missing and invalid signatures without touching the database", async () => {
    expect((await POST(request(""))).status).toBe(400);
    mocks.constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
