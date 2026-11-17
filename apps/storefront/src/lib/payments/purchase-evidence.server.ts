import "server-only";
import { createHmac } from "node:crypto";
import type Stripe from "stripe";

export type PurchaseCandidate = Readonly<{
  event: "purchase";
  payload: Readonly<{ currency: "EUR"; value: number; transaction_id: string }>;
}>;

type EvidenceContext = {
  stripe: Pick<Stripe, "webhooks">;
  webhookSecret: string;
  /** Separate server-only pseudonym key; never a browser input or public key. */
  transactionKey: string;
  /** Stable deployment/account namespace, not a user or order identifier. */
  accountScope: string;
  /** null for a platform event; exact connected account for Connect ingress. */
  expectedAccount: string | null;
  liveMode: boolean;
} & (
  | { source: "platform_listing" }
  | { source: "marketplace_capture"; expectedPaymentIntentId: string }
);

/**
 * INTERNAL evidence normalization, NOT analytics authorization or delivery.
 * Verifies the actual Stripe body/signature. Marketplace intent binding must be
 * resolved from trusted server cart/payment state, never a query/form field.
 * No collector, cookies, consent inference, database writes, or SDK capture.
 * A caller still needs current consent/new approved policy and durable dedup.
 * Do not use on durably queued events: signature tolerance applies at ingress.
 */
export function purchaseCandidateFromSignedStripeEvent(
  rawBody: string,
  signature: string | null,
  context: EvidenceContext,
): PurchaseCandidate | null {
  if (!signature || !context.webhookSecret || context.transactionKey.length < 32 ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(context.accountScope)) return null;
  try {
    const event = context.stripe.webhooks.constructEvent(rawBody, signature, context.webhookSecret);
    if (event.livemode !== context.liveMode || (event.account ?? null) !== context.expectedAccount) return null;
    let intentId: string;
    let cents: number | null;
    let currency: string | null;
    if (context.source === "platform_listing") {
      if (context.expectedAccount !== null ||
          !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return null;
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.object !== "checkout.session" || session.mode !== "payment" ||
          session.payment_status !== "paid" || session.livemode !== context.liveMode ||
          !["credit_pack", "plan", "workshop_listing"].includes(session.metadata?.kind ?? "")) return null;
      // No fallback to session/event/order IDs: the same payment must keep one key.
      intentId = typeof session.payment_intent === "string"
        ? session.payment_intent : session.payment_intent?.id ?? "";
      cents = session.amount_total;
      currency = session.currency;
    } else {
      if (event.type !== "payment_intent.succeeded") return null;
      const intent = event.data.object as Stripe.PaymentIntent;
      if (intent.object !== "payment_intent" || intent.status !== "succeeded" ||
          intent.livemode !== context.liveMode || intent.id !== context.expectedPaymentIntentId ||
          intent.amount_capturable !== 0) return null;
      intentId = intent.id;
      cents = intent.amount_received; // Never requested/authorized amount.
      currency = intent.currency;
    }
    if (!/^pi_[a-zA-Z0-9]+$/.test(intentId) || currency !== "eur" ||
        typeof cents !== "number" || !Number.isSafeInteger(cents) || cents <= 0 || cents > 100_000_000) return null;
    // Stable across delivery event IDs, sessions, retries and the two adapters.
    // This is pseudonymous, not anonymous; authorization is still mandatory.
    const transaction_id = "pay_v1_" + createHmac("sha256", context.transactionKey)
      .update(JSON.stringify(["hobbysalon.purchase.v1", context.accountScope,
        context.expectedAccount, context.liveMode, intentId])).digest("hex");
    return Object.freeze({ event: "purchase", payload: Object.freeze({
      currency: "EUR", value: cents / 100, transaction_id,
    }) });
  } catch {
    return null; // malformed/forged/stale signatures never become evidence
  }
}
