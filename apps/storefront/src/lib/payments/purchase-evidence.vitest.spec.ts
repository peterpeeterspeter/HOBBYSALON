// Offline: real Stripe HMAC verification, synthetic provider bodies, no HTTP/DB.
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseCandidateFromSignedStripeEvent as candidate } from "./purchase-evidence.server";

const stripe = new Stripe("sk_test_offline_fixture");
const context = {
  stripe, webhookSecret: "whsec_offline_fixture", transactionKey: "offline-pseudonym-key-never-production-12345",
  accountScope: "platform_fixture", expectedAccount: null, liveMode: false,
  source: "platform_listing" as const,
};
const session = {
  id: "cs_fixture", object: "checkout.session", livemode: false, mode: "payment",
  payment_status: "paid", payment_intent: "pi_fixture", amount_total: 2499, currency: "eur",
  metadata: { kind: "credit_pack", creator_id: "private-user", arbitrary: "private" },
  customer_details: { email: "private@example.test" }, url: "https://private.test/?secret=hidden",
};
function signed(object = session, type = "checkout.session.completed", eventOverrides = {}, timestamp?: number) {
  const body = JSON.stringify({ id: "evt_fixture", object: "event", livemode: false, type,
    data: { object }, ...eventOverrides });
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: context.webhookSecret, timestamp });
  return { body, signature };
}
function result(object = session, type = "checkout.session.completed") {
  const { body, signature } = signed(object, type);
  return candidate(body, signature, context);
}
const fetch = vi.fn(() => { throw new Error("OFFLINE: network forbidden"); });
beforeEach(() => { fetch.mockClear(); vi.stubGlobal("fetch", fetch); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("payment evidence candidate — not authorized transport", () => {
  it("builds only bounded EUR fields from a signed paid session, with no raw identity", () => {
    const value = result()!;
    expect(value).toEqual({ event: "purchase", payload: {
      currency: "EUR", value: 24.99, transaction_id: expect.stringMatching(/^pay_v1_[a-f0-9]{64}$/),
    } });
    for (const secret of ["cs_fixture", "pi_fixture", "private", "email", "url", "creator_id"])
      expect(JSON.stringify(value)).not.toContain(secret);
    expect(Object.isFrozen(value.payload)).toBe(true);
  });
  it.each(["unpaid", "no_payment_required"])("rejects %s for both completion types", (payment_status) => {
    for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"])
      expect(result({ ...session, payment_status }, type)).toBeNull();
  });
  it.each([0, -1, 1.1, NaN, Infinity, 100_000_001, Number.MAX_SAFE_INTEGER])("rejects invalid cents %s", (amount_total) => {
    expect(result({ ...session, amount_total })).toBeNull();
  });
  it.each([
    { currency: "usd" }, { payment_intent: "" }, { payment_intent: "cs_wrong" },
    { mode: "subscription" }, { livemode: true }, { object: "payment_intent" },
    { metadata: { kind: "unknown" } }, { amount_total: null }, { amount_total: "2499" },
  ])("rejects unsupported/missing evidence %j", (override) => {
    expect(result({ ...session, ...override } as typeof session)).toBeNull();
  });
  it("rejects missing, wrong-secret, expired and tampered-body signatures", () => {
    const { body, signature } = signed();
    expect(candidate(body, null, context)).toBeNull();
    expect(candidate(body, signature, { ...context, webhookSecret: "wrong" })).toBeNull();
    expect(candidate(body.replace('2499', '9999'), signature, context)).toBeNull();
    const expired = signed(session, "checkout.session.completed", {}, 1);
    expect(candidate(expired.body, expired.signature, context)).toBeNull();
  });
  it("rejects a valid signature from the wrong account or environment", () => {
    for (const override of [{ account: "acct_unexpected" }, { livemode: true }]) {
      const { body, signature } = signed(session, "checkout.session.completed", override);
      expect(candidate(body, signature, context)).toBeNull();
    }
  });
  it("does not accept redirect claims, authorized intent, or failed async events", () => {
    for (const type of ["checkout.session.async_payment_failed", "payment_intent.amount_capturable_updated", "checkout_completed"])
      expect(result(session, type)).toBeNull();
    expect(candidate('{"redirect_status":"succeeded"}', null, context)).toBeNull();
  });
  it("uses one transaction key for completion, async success and distinct delivery IDs", () => {
    const first = result()!;
    expect(result(session, "checkout.session.async_payment_succeeded")).toEqual(first);
    const replay = signed(session, "checkout.session.async_payment_succeeded", { id: "evt_retry" });
    expect(candidate(replay.body, replay.signature, context)).toEqual(first);
    expect(result({ ...session, payment_intent: "pi_other" })!.payload.transaction_id).not.toBe(first.payload.transaction_id);
    const { body, signature } = signed();
    expect(candidate(body, signature, { ...context, accountScope: "other_account" })!.payload.transaction_id).not.toBe(first.payload.transaction_id);
    expect(candidate(body, signature, { ...context, transactionKey: "short" })).toBeNull();
  });
  it("accepts only the explicitly bound Connect account for marketplace captures", () => {
    const intent = { id: "pi_fixture", object: "payment_intent", status: "succeeded", livemode: false,
      currency: "eur", amount_received: 2499, amount_capturable: 0 };
    const { body, signature } = signed(intent as unknown as typeof session, "payment_intent.succeeded", { account: "acct_fixture" });
    const captureContext = { ...context, source: "marketplace_capture" as const,
      expectedPaymentIntentId: "pi_fixture", expectedAccount: "acct_fixture" };
    expect(candidate(body, signature, captureContext)?.payload.value).toBe(24.99);
    expect(candidate(body, signature, { ...captureContext, expectedAccount: "acct_other" })).toBeNull();
    expect(candidate(body, signature, { ...captureContext, liveMode: true })).toBeNull();
  });
  it("uses captured amount_received and a trusted intent binding, never authorization amount", () => {
    const intent = { id: "pi_fixture", object: "payment_intent", status: "succeeded", livemode: false,
      currency: "eur", amount: 9999, amount_received: 2499, amount_capturable: 0 };
    const captureContext = { ...context, source: "marketplace_capture" as const, expectedPaymentIntentId: "pi_fixture" };
    const run = (patch = {}, type = "payment_intent.succeeded") => {
      const { body, signature } = signed({ ...intent, ...patch } as unknown as typeof session, type);
      return candidate(body, signature, captureContext);
    };
    expect(run()).toEqual(result()); // same provider payment, same dedup key
    for (const patch of [{ status: "requires_capture" }, { id: "pi_unbound" }, { amount_received: 0 },
      { amount_capturable: 2499 }, { currency: "usd" }]) expect(run(patch)).toBeNull();
    expect(run({}, "payment_intent.amount_capturable_updated")).toBeNull();
  });
});
