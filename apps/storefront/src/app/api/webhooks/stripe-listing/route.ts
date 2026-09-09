import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, getListingWebhookSecret } from "@/lib/payments/stripe-client";
import { createPlatformClient } from "@/lib/platform/client";

/** Platform-charge listing purchases; never handles Medusa or Connect payments. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getListingWebhookSecret());
  } catch (err) {
    console.error("Stripe listing webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const metadata = session.metadata ?? {};
  const kind = metadata.kind;
  const creatorId = metadata.creator_id;
  if (!kind || !creatorId) {
    console.error("Stripe listing webhook: paid session missing metadata", session.id);
    return NextResponse.json({ error: "Missing payment metadata" }, { status: 500 });
  }

  try {
    // The database commits the marker AND fulfillment together. Never insert or
    // delete a marker here: a lost RPC response may mean the grant committed.
    const { data, error } = await createPlatformClient().rpc("fulfill_listing_checkout", {
      p_session_id: session.id,
      p_creator_id: creatorId,
      p_kind: kind,
      p_metadata: metadata,
      p_session_created_at: session.created ?? null,
    });
    if (error) throw error;
    if (data === "legacy_blocked") {
      // Old markers did not prove delivery. Keep them blocked; see the migration
      // reconciliation procedure. Retrying must never automatically regrant.
      console.error("Stripe listing webhook: manual payment reconciliation required", session.id);
      return NextResponse.json({ error: "Payment requires reconciliation" }, { status: 503 });
    }
    if (data === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (data !== "applied") throw new Error("Unexpected listing fulfillment result");
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe listing webhook: atomic fulfillment failed", session.id, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
