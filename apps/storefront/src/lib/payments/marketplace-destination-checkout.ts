import "server-only";

import Stripe from "stripe";
import { getStripeClient } from "@/lib/payments/stripe-client";

export type MarketplaceDestinationCheckoutInput = {
  /** Connected account id (acct_…) that receives the payout */
  connectedAccountId: string;
  /** Line item name shown on Checkout */
  productName: string;
  /** Amount in the smallest currency unit (e.g. cents) */
  unitAmount: number;
  currency?: string;
  quantity?: number;
  /** Platform commission retained from the charge (smallest currency unit) */
  applicationFeeAmount: number;
  successUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
};

/**
 * Create a Stripe Checkout Session as a marketplace destination charge.
 *
 * Platform is merchant of record; funds (minus application_fee_amount) go to
 * the connected account via transfer_data.destination.
 *
 * Note: Hobbysalon multi-seller carts still use Medusa PaymentIntents +
 * separate Transfers. Use this helper for single-destination flows (or demos)
 * that match the Accounts v2 marketplace blueprint.
 *
 * Env: STRIPE_SECRET_API_KEY (never hardcode keys).
 */
export async function createMarketplaceDestinationCheckoutSession(
  input: MarketplaceDestinationCheckoutInput
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  const currency = (input.currency ?? "eur").toLowerCase();
  const quantity = input.quantity ?? 1;

  if (!input.connectedAccountId.startsWith("acct_")) {
    throw new Error("connectedAccountId must be a Stripe account id (acct_…)");
  }
  if (input.applicationFeeAmount < 0) {
    throw new Error("applicationFeeAmount must be >= 0");
  }
  if (input.unitAmount <= 0) {
    throw new Error("unitAmount must be > 0");
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl ?? input.successUrl,
    line_items: [
      {
        quantity,
        price_data: {
          currency,
          unit_amount: input.unitAmount,
          product_data: {
            name: input.productName,
          },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: input.applicationFeeAmount,
      transfer_data: {
        destination: input.connectedAccountId,
      },
    },
    metadata: input.metadata,
  });
}
