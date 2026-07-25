import "server-only";
import Stripe from "stripe";

/**
 * Platform-level Stripe client for listing fee checkout (credit packs,
 * commercial plans). Deliberately separate from Medusa's cart/PaymentIntent
 * flow and from Stripe Connect (merchant payouts) - this key charges the
 * platform's own Stripe account for listing fees, nothing else.
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_API_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing Stripe env: STRIPE_SECRET_API_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });
}

export function getListingWebhookSecret(): string {
  const secret = process.env.STRIPE_LISTING_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing Stripe env: STRIPE_LISTING_WEBHOOK_SECRET");
  }
  return secret;
}
