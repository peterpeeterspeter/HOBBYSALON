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

  // Pinned apiVersion string picked without access to the installed
  // `stripe` package's types in this sandbox (no node_modules here) - the
  // first `yarn build`/`tsc` after `yarn install` will fail loudly with a
  // literal-type mismatch if this doesn't match the installed SDK version.
  // Fix by copying the value TypeScript suggests.
  return new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
  });
}

export function getListingWebhookSecret(): string {
  const secret = process.env.STRIPE_LISTING_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing Stripe env: STRIPE_LISTING_WEBHOOK_SECRET");
  }
  return secret;
}
