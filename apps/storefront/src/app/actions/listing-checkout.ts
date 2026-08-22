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
  let session: { url: string | null };
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      // No explicit payment_method_types: let Stripe show whatever is
      // actually enabled for this account/currency in the Dashboard.
      // Hardcoding a list here previously included "ideal", which this
      // account doesn't have enabled - Stripe rejected the request and
      // the unhandled error crashed the whole page.
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
  } catch (err) {
    console.error("Stripe checkout session creation failed (credit pack):", err);
    fail("Kon geen betaalsessie starten. Probeer het later opnieuw.");
  }

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
  let session: { url: string | null };
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
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
      success_url: absoluteUrl(
        "/dashboard/products?checkout=pending&type=plan"
      ),
      cancel_url: absoluteUrl("/dashboard/products?checkout=cancelled"),
    });
  } catch (err) {
    console.error("Stripe checkout session creation failed (plan):", err);
    fail("Kon geen betaalsessie starten. Probeer het later opnieuw.");
  }

  if (!session.url) {
    fail("Kon geen betaalsessie starten. Probeer het later opnieuw.");
  }

  redirect(session.url);
}

/**
 * One-time €9,99 checkout for a single workshop listing (2 months visibility).
 * Activates the workshop via the listing webhook after payment.
 */
export async function createWorkshopListingCheckoutAction(
  formData: FormData
): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/workshops");
  }

  const creator = await getCreatorByUserId(user.id);
  if (!creator) {
    redirect(
      "/dashboard/workshops?error=" +
        encodeURIComponent("Maak eerst je creator-profiel aan.")
    );
  }

  const workshopId = formData.get("workshop_id")?.toString()?.trim();
  if (!workshopId) {
    redirect(
      "/dashboard/workshops?error=" + encodeURIComponent("Ongeldige workshop.")
    );
  }

  const supabase = createPlatformClient();
  const { data: workshopRow } = await supabase
    .from("workshops")
    .select("id, title, listing_fee_status, listing_expires_at")
    .eq("id", workshopId)
    .eq("creator_id", creator.id)
    .maybeSingle();

  if (!workshopRow) {
    redirect(
      "/dashboard/workshops?error=" +
        encodeURIComponent("Workshop niet gevonden.")
    );
  }

  const workshop = workshopRow;

  if (workshop.listing_fee_status === "launch_free") {
    redirect(
      "/dashboard/workshops?error=" +
        encodeURIComponent("Deze workshop valt onder het gratis lanceraanbod.")
    );
  }

  if (
    workshop.listing_fee_status === "paid" &&
    workshop.listing_expires_at &&
    new Date(workshop.listing_expires_at).getTime() > Date.now()
  ) {
    redirect(
      "/dashboard/workshops?error=" +
        encodeURIComponent("Deze vermelding is al betaald en nog zichtbaar.")
    );
  }

  const {
    WORKSHOP_LISTING_FEE_CENTS,
    WORKSHOP_LISTING_FEE_CURRENCY,
    WORKSHOP_PAID_VISIBILITY_MONTHS,
  } = await import("@/lib/pricing/workshop-launch-offer");

  const stripe = getStripeClient();
  let sessionUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: WORKSHOP_LISTING_FEE_CURRENCY.toLowerCase(),
            unit_amount: WORKSHOP_LISTING_FEE_CENTS,
            product_data: {
              name: `Workshopvermelding — ${workshop.title}`,
              description: `${WORKSHOP_PAID_VISIBILITY_MONTHS} maanden zichtbaar op Hobbysalon`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: "workshop_listing",
        workshop_id: workshop.id,
        creator_id: creator.id,
      },
      success_url: absoluteUrl(
        "/dashboard/workshops?checkout=pending&type=workshop_listing"
      ),
      cancel_url: absoluteUrl("/dashboard/workshops?checkout=cancelled"),
    });
    sessionUrl = session.url;
  } catch (err) {
    console.error(
      "Stripe checkout session creation failed (workshop listing):",
      err
    );
    redirect(
      "/dashboard/workshops?error=" +
        encodeURIComponent(
          "Kon geen betaalsessie starten. Probeer het later opnieuw."
        )
    );
  }

  if (!sessionUrl) {
    redirect(
      "/dashboard/workshops?error=" +
        encodeURIComponent(
          "Kon geen betaalsessie starten. Probeer het later opnieuw."
        )
    );
  }

  redirect(sessionUrl);
}
