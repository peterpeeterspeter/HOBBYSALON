import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, getListingWebhookSecret } from "@/lib/payments/stripe-client";
import { createPlatformClient } from "@/lib/platform/client";

/**
 * Webhook for the platform-charge Stripe flow (listing credit packs and
 * commercial plans started in @/app/actions/listing-checkout.ts).
 * Deliberately separate from Medusa's payment webhooks and from the
 * Stripe Connect account.updated webhook (merchant payouts) - this key/
 * secret only ever grants credits or activates a plan, nothing else.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getListingWebhookSecret()
    );
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
    console.error("Stripe listing webhook: missing metadata", {
      sessionId: session.id,
      metadata,
    });
    return NextResponse.json({ received: true });
  }

  const supabase = createPlatformClient();

  // Idempotency: Stripe can deliver the same event more than once. Insert
  // the session id first; a unique-violation means it was already
  // processed, so skip granting a second time.
  const { error: insertError } = await supabase
    .from("stripe_checkout_events")
    .insert({ session_id: session.id, kind, creator_id: creatorId });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error(
      "Stripe listing webhook: failed to record session id",
      insertError
    );
    return NextResponse.json({ received: true });
  }

  try {
    if (kind === "credit_pack") {
      await grantCreditPack(supabase, creatorId, metadata, session.id);
    } else if (kind === "plan") {
      await activatePlan(supabase, creatorId, metadata, session.id);
    } else {
      console.error("Stripe listing webhook: unknown kind", kind);
    }
  } catch (err) {
    console.error("Stripe listing webhook: processing error", err);
  }

  return NextResponse.json({ received: true });
}

async function grantCreditPack(
  supabase: ReturnType<typeof createPlatformClient>,
  creatorId: string,
  metadata: Record<string, string>,
  sessionId: string
): Promise<void> {
  const credits = Number.parseInt(metadata.credits ?? "0", 10);
  const packCode = metadata.pack_code ?? "unknown";

  if (!Number.isFinite(credits) || credits <= 0) {
    console.error("Stripe listing webhook: invalid credits in metadata", metadata);
    return;
  }

  const { error } = await supabase.rpc("apply_listing_credit_delta", {
    p_creator_id: creatorId,
    p_delta: credits,
    p_reason: "purchase",
    p_related_entity_type: null,
    p_related_entity_id: null,
    p_metadata: { pack_code: packCode, stripe_session_id: sessionId },
  });

  if (error) {
    console.error("Stripe listing webhook: credit grant failed", error);
  }
}

async function activatePlan(
  supabase: ReturnType<typeof createPlatformClient>,
  creatorId: string,
  metadata: Record<string, string>,
  sessionId: string
): Promise<void> {
  const planCode = metadata.plan_code;
  if (!planCode) {
    console.error("Stripe listing webhook: missing plan_code", metadata);
    return;
  }

  const { data: plan } = await supabase
    .from("commercial_plans")
    .select("id, segment, billing_period")
    .eq("code", planCode)
    .maybeSingle();

  if (!plan) {
    console.error("Stripe listing webhook: plan not found", planCode);
    return;
  }

  // Expire any other active subscription in the same segment so a creator
  // never ends up with two simultaneously-active plans there.
  type ActiveSubRow = { id: string; plan_id: string };
  type PlanRow = { id: string; segment: string };

  const { data: activeSubs } = (await supabase
    .from("creator_plan_subscriptions")
    .select("id, plan_id")
    .eq("creator_id", creatorId)
    .eq("status", "active")) as { data: ActiveSubRow[] | null };

  if (activeSubs && activeSubs.length > 0) {
    const planIds = [...new Set(activeSubs.map((sub: ActiveSubRow) => sub.plan_id))];
    const { data: activePlans } = (await supabase
      .from("commercial_plans")
      .select("id, segment")
      .in("id", planIds)) as { data: PlanRow[] | null };

    const sameSegmentPlanIds = new Set(
      (activePlans ?? [])
        .filter((p: PlanRow) => p.segment === plan.segment)
        .map((p: PlanRow) => p.id)
    );
    const subIdsToExpire = activeSubs
      .filter((sub: ActiveSubRow) => sameSegmentPlanIds.has(sub.plan_id))
      .map((sub: ActiveSubRow) => sub.id);

    if (subIdsToExpire.length > 0) {
      await supabase
        .from("creator_plan_subscriptions")
        .update({ status: "expired", ends_at: new Date().toISOString() })
        .in("id", subIdsToExpire);
    }
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  if (plan.billing_period === "monthly") {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }

  const { error } = await supabase.from("creator_plan_subscriptions").insert({
    creator_id: creatorId,
    plan_id: plan.id,
    status: "active",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    external_payment_id: sessionId,
  });

  if (error) {
    console.error("Stripe listing webhook: plan subscription insert failed", error);
  }
}
