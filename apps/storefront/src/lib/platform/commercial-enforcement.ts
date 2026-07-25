import "server-only";

import type { Creator } from "@/types/platform";
import {
  canUseExternalBookingLink,
  getCreatorCommercialEntitlements,
  getHandmadeListingAllowance,
  getWorkshopListingLimit,
  isCommercialGatingEnabled,
} from "./commercial-entitlements";
import {
  countActiveWorkshopsForCreator,
  getActivePlanForCreator,
} from "./queries/commercial-plans";
import {
  canCreateHandmadeListing,
  consumeCredits,
  countActiveHandmadeProducts,
  LISTING_CREDIT_COSTS,
} from "./listing-credits";
import { createVisibilityBoost, grantPlanVisibilityBoost } from "./ranking";

export async function enforceCreatorSocialUrls(
  creatorId: string,
  creatorTypes: string[],
  input: {
    website_url?: string | null;
    instagram_url?: string | null;
    facebook_url?: string | null;
  }
): Promise<{
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
}> {
  if (!isCommercialGatingEnabled()) {
    return {
      website_url: input.website_url ?? null,
      instagram_url: input.instagram_url ?? null,
      facebook_url: input.facebook_url ?? null,
    };
  }

  if (!creatorId) {
    return { website_url: null, instagram_url: null, facebook_url: null };
  }

  const entitlements = await getCreatorCommercialEntitlements(creatorId, creatorTypes);
  const allowed = entitlements.segments.some(
    (segment) => segment.externalLinksAllowed
  );

  if (allowed) {
    return {
      website_url: input.website_url ?? null,
      instagram_url: input.instagram_url ?? null,
      facebook_url: input.facebook_url ?? null,
    };
  }

  return {
    website_url: null,
    instagram_url: null,
    facebook_url: null,
  };
}

export async function enforceWorkshopBookingFields(
  creatorId: string,
  creatorTypes: string[],
  input: {
    booking_mode: string;
    booking_url?: string | null;
    is_active?: boolean;
    excludeWorkshopId?: string;
  }
): Promise<{ booking_mode: string; booking_url: string | null; error?: string }> {
  let bookingMode = input.booking_mode;
  let bookingUrl = input.booking_url ?? null;

  if (bookingMode === "internal_booking") {
    bookingMode = "request";
    bookingUrl = null;
  }

  if (!isCommercialGatingEnabled()) {
    return { booking_mode: bookingMode, booking_url: bookingUrl };
  }

  const entitlements = await getCreatorCommercialEntitlements(creatorId, creatorTypes);

  if (bookingMode === "external_link" || bookingUrl) {
    if (!canUseExternalBookingLink(entitlements)) {
      bookingMode = "request";
      bookingUrl = null;
    }
  }

  if (input.is_active) {
    const limit = getWorkshopListingLimit(entitlements);
    if (limit != null) {
      const supabase = (await import("./client")).createPlatformClient();
      let query = supabase
        .from("workshops")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("is_active", true);
      if (input.excludeWorkshopId) {
        query = query.neq("id", input.excludeWorkshopId);
      }
      const { count } = await query;
      const activeCount = count ?? 0;
      if (activeCount >= limit) {
        return {
          booking_mode: bookingMode,
          booking_url: bookingUrl,
          error: `Je hebt het maximum van ${limit} actieve workshops bereikt. Upgrade naar Premium voor meer.`,
        };
      }
    }
  }

  return { booking_mode: bookingMode, booking_url: bookingUrl };
}

export async function enforceEventTicketingFields(
  organizerCreatorId: string,
  creatorTypes: string[],
  eventEntitlementsExternalAllowed: boolean | null,
  input: {
    ticketing_mode: string;
    ticket_url?: string | null;
  }
): Promise<{ ticketing_mode: string; ticket_url: string | null }> {
  let ticketingMode = input.ticketing_mode;
  let ticketUrl = input.ticket_url ?? null;

  if (ticketingMode === "internal_ticket") {
    ticketingMode = "none";
    ticketUrl = null;
  }

  if (!isCommercialGatingEnabled()) {
    return { ticketing_mode: ticketingMode, ticket_url: ticketUrl };
  }

  const allowed =
    eventEntitlementsExternalAllowed ??
    (await getCreatorCommercialEntitlements(organizerCreatorId, creatorTypes))
      .segments.some((segment) => segment.externalLinksAllowed);

  if ((ticketingMode === "external_link" || ticketUrl) && !allowed) {
    ticketingMode = "none";
    ticketUrl = null;
  }

  return { ticketing_mode: ticketingMode, ticket_url: ticketUrl };
}

export async function enforceHandmadePublishCredits(
  creatorId: string,
  creatorTypes: string[],
  isActive: boolean,
  wasActive: boolean,
  productType: "handmade" | "destash" = "handmade"
): Promise<{ ok: boolean; error?: string }> {
  if (!isActive || wasActive || !isCommercialGatingEnabled()) {
    return { ok: true };
  }

  const entitlements = await getCreatorCommercialEntitlements(creatorId, creatorTypes);
  const allowance = getHandmadeListingAllowance(entitlements);
  const activeCount = await countActiveHandmadeProducts(creatorId);
  const check = await canCreateHandmadeListing(
    creatorId,
    allowance.usesCredits,
    allowance.includedFree,
    activeCount
  );

  if (!check.allowed) {
    return { ok: false, error: check.reason };
  }

  if (allowance.usesCredits) {
    const result = await consumeCredits(
      creatorId,
      LISTING_CREDIT_COSTS.handmadeListing,
      "listing_create",
      undefined,
      { product_type: productType }
    );
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
  }

  return { ok: true };
}

export async function attachDefaultEventPlan(eventId: string): Promise<void> {
  const supabase = (await import("./client")).createPlatformClient();
  const { data: plan } = await supabase
    .from("commercial_plans")
    .select("id")
    .eq("code", "organizer_event_basic")
    .maybeSingle();

  if (!plan?.id) return;

  await supabase.from("event_plan_subscriptions").insert({
    event_id: eventId,
    plan_id: plan.id,
    status: "active",
  });
}

export async function grantPremiumPlanBoosts(
  creator: Pick<Creator, "id" | "creator_types">,
  planCode: string
): Promise<void> {
  if (!planCode.includes("premium")) return;

  if (creator.creator_types.includes("workshopgever")) {
    await grantPlanVisibilityBoost({
      entityType: "creator",
      entityId: creator.id,
      planCode,
      durationDays: 365,
    });
  }
}

export async function purchaseSpotlightBoostAction(input: {
  creatorId: string;
  entityType: "creator" | "product" | "workshop" | "event";
  entityId: string;
  boostType?: "spotlight" | "homepage";
}): Promise<{ ok: boolean; error?: string }> {
  const cost =
    input.boostType === "homepage"
      ? LISTING_CREDIT_COSTS.homepageSpotlight
      : LISTING_CREDIT_COSTS.spotlight7Days;

  const consumed = await consumeCredits(
    input.creatorId,
    cost,
    "spotlight",
    { type: input.entityType, id: input.entityId },
    { boost_type: input.boostType ?? "spotlight" }
  );

  if (!consumed.ok) return consumed;

  const endsAt = new Date(
    Date.now() + (input.boostType === "homepage" ? 14 : 7) * 86400000
  ).toISOString();

  await createVisibilityBoost({
    entityType: input.entityType,
    entityId: input.entityId,
    boostType: input.boostType === "homepage" ? "homepage" : "spotlight",
    source: "credits",
    boostScore: input.boostType === "homepage" ? 150 : 50,
    endsAt,
  });

  return { ok: true };
}

export async function getDashboardCommercialContext(creatorId: string, creatorTypes: string[]) {
  const entitlements = await getCreatorCommercialEntitlements(creatorId, creatorTypes);
  const workshopPlan = await getActivePlanForCreator(creatorId, "workshop");
  const activeWorkshopCount = await countActiveWorkshopsForCreator(creatorId);
  const workshopLimit = getWorkshopListingLimit(entitlements);
  const creditBalance = (await import("./listing-credits")).getCreditBalance(creatorId);

  return {
    entitlements,
    workshopPlan,
    activeWorkshopCount,
    workshopLimit,
    creditBalance: await creditBalance,
    allowExternalLinks: entitlements.segments.some((s) => s.externalLinksAllowed),
    allowExternalBooking: canUseExternalBookingLink(entitlements),
  };
}
