"use server";

import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { getStripeClient } from "@/lib/payments/stripe-client";
import { absoluteUrl } from "@/lib/seo";

function fail(message: string): never {
  redirect("/dashboard/products?error=" + encodeURIComponent(message));
}

function redirectToLogin(): never {
  redirect("/login?next=/dashboard/products");
}

async function requireCreatorForCheckout(): Promise<{ id: string }> {
  const user = await getAuthUser();
  if (!user) {
    redirectToLogin();
  }
  const creator = await getCreatorByUserId(user.id);
  if (!creator) {
    fail("Maak eerst je creator-profiel aan.");
  }
  return creator;
}

/**
 * Stripe Checkout Session for a one-time listing credit pack purchase.
 * Platform charge (own Stripe account) - not Connect, not a Medusa cart.
 * Credits are granted by the webhook after payment actually completes,
 * not here - this only starts the checkout.
 */
export async function createCreditPackCheckoutAction(formData: FormData): Promise<void> {
  const creator = await requireCreatorForCheckout();
  const packCode = formData.get("pack_code")?.toString()?.trim();
  if (!packCode) {
    fail("Ongeldig creditpakket.");
  }

  const supabase = createPlatformClient();
  const { data: pack } = await supabase
    .from("listing_credit_products")
    .select("pack_code, name, credits, price_cents, currency_code")
    .eq("pack_code", packCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!pack) {
    fail("Creditpakket niet gevonden.");
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "bancontact", "ideal"],
    line_items: [
      {
        price_data: {
          currency: pack.currency_code.toLowerCase(),
          unit_amount: pack.price_cents,
          product_data: {
            name: `Hobbysalon listing credits — ${pack.name}`,
            description: `${pack.credits} credits`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: "credit_pack",
      pack_code: pack.pack_code,
      creator_id: creator.id,
      credits: String(pack.credits),
    },
    success_url: absoluteUrl(
      "/dashboard/products?checkout=pending&type=credits"
    ),
    cancel_url: absoluteUrl("/dashboard/products?checkout=cancelled"),
  });

  if (!session.url) {
    fail("Kon geen betaalsessie starten. Probeer het later opnieuw.");
  }

  redirect(session.url);
}

/**
 * Stripe Checkout Session for a commercial plan (workshop/maker/supplier
 * plan). One-time charge per year, not a Stripe Subscription - matches the
 * "vaste jaarprijs" positioning without adding recurring-billing
 * complexity (proration, cancellation) this platform doesn't need yet.
 * The plan is activated by the webhook after payment completes.
 */
export async function createPlanCheckoutAction(formData: FormData): Promise<void> {
  const creator = await requireCreatorForCheckout();
  const planCode = formData.get("plan_code")?.toString()?.trim();
  if (!planCode) {
    fail("Ongeldig abonnement.");
  }

  const supabase = createPlatformClient();
  const { data: plan } = await supabase
    .from("commercial_plans")
    .select("code, segment, name, price_cents, currency_code, billing_period, is_active")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) {
    fail("Abonnement niet gevonden.");
  }
  if (plan.price_cents <= 0) {
    fail("Dit abonnement is gratis en heeft geen betaling nodig.");
  }
  if (plan.segment === "organizer") {
    // Organizer plans attach to a specific event (event_plan_subscriptions),
    // not to the creator generally - that's event-scoped checkout, not
    // built yet. Keep this action to creator-segment plans only.
    fail("Eventpakketten koop je via de eventpagina, niet hier.");
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "bancontact", "ideal"],
    line_items: [
      {
        price_data: {
          currency: plan.currency_code.toLowerCase(),
          unit_amount: plan.price_cents,
          product_data: {
            name: `Hobbysalon ${plan.name}`,
            description:
              plan.billing_period === "yearly"
                ? "Jaarlijks abonnement"
                : plan.billing_period,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: "plan",
      plan_code: plan.code,
      segment: plan.segment,
      creator_id: creator.id,
    },
    success_url: absoluteUrl("/dashboard/products?checkout=pending&type=plan"),
    cancel_url: absoluteUrl("/dashboard/products?checkout=cancelled"),
  });

  if (!session.url) {
    fail("Kon geen betaalsessie starten. Probeer het later opnieuw.");
  }

  redirect(session.url);
}
