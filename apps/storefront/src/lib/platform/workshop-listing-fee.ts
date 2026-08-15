import "server-only";

import { createPlatformClient } from "@/lib/platform/client";
import {
  WORKSHOP_LAUNCH_COPY,
  canGrantWorkshopLaunchFreeSlot,
  type WorkshopListingFeeStatus,
} from "@/lib/pricing/workshop-launch-offer";

export type WorkshopListingFeeDecision = {
  /** Whether the workshop may be set is_active=true now */
  canActivate: boolean;
  listing_fee_status: WorkshopListingFeeStatus;
  listing_expires_at: string | null;
  error?: string;
  /** True when user must pay to activate (no free slot) */
  needsPayment?: boolean;
};

/**
 * Count workshops that already consume a launch-free slot for this creator.
 */
export async function countLaunchFreeWorkshops(
  creatorId: string,
  excludeWorkshopId?: string
): Promise<number> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("workshops")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("listing_fee_status", "launch_free");

  if (excludeWorkshopId) {
    query = query.neq("id", excludeWorkshopId);
  }

  const { count } = await query;
  return count ?? 0;
}

/**
 * Resolve listing fee fields when saving a workshop.
 * Drafts stay unpaid. Activating grants launch_free if a slot remains,
 * otherwise blocks with needsPayment (caller keeps is_active false or shows CTA).
 */
export async function resolveWorkshopListingFeeOnSave(input: {
  creatorId: string;
  wantsActive: boolean;
  excludeWorkshopId?: string;
  /** Existing fee status when updating an already-entitled listing */
  existingStatus?: WorkshopListingFeeStatus | string | null;
  existingExpiresAt?: string | null;
}): Promise<WorkshopListingFeeDecision> {
  if (!input.wantsActive) {
    // Keep existing entitlement if they deactivate a free/paid listing.
    if (
      input.existingStatus === "launch_free" ||
      input.existingStatus === "paid"
    ) {
      return {
        canActivate: false,
        listing_fee_status: input.existingStatus,
        listing_expires_at:
          input.existingStatus === "paid"
            ? input.existingExpiresAt ?? null
            : null,
      };
    }
    return {
      canActivate: false,
      listing_fee_status: "unpaid",
      listing_expires_at: null,
    };
  }

  // Already entitled and still valid → keep publishing.
  if (input.existingStatus === "launch_free") {
    return {
      canActivate: true,
      listing_fee_status: "launch_free",
      listing_expires_at: null,
    };
  }

  if (input.existingStatus === "paid" && input.existingExpiresAt) {
    const expires = new Date(input.existingExpiresAt).getTime();
    if (!Number.isNaN(expires) && expires > Date.now()) {
      return {
        canActivate: true,
        listing_fee_status: "paid",
        listing_expires_at: input.existingExpiresAt,
      };
    }
  }

  const launchFreeCount = await countLaunchFreeWorkshops(
    input.creatorId,
    input.excludeWorkshopId
  );

  if (canGrantWorkshopLaunchFreeSlot(launchFreeCount)) {
    return {
      canActivate: true,
      listing_fee_status: "launch_free",
      listing_expires_at: null,
    };
  }

  return {
    canActivate: false,
    listing_fee_status: "unpaid",
    listing_expires_at: null,
    needsPayment: true,
    error: WORKSHOP_LAUNCH_COPY.needPaymentMessage,
  };
}

export async function getWorkshopLaunchDashboardStats(creatorId: string): Promise<{
  launchFreeUsed: number;
  launchWindowOpen: boolean;
  canGrantFree: boolean;
}> {
  const { canGrantWorkshopLaunchFreeSlot, isWorkshopLaunchWindowOpen } =
    await import("@/lib/pricing/workshop-launch-offer");
  const launchFreeUsed = await countLaunchFreeWorkshops(creatorId);
  const launchWindowOpen = isWorkshopLaunchWindowOpen();
  return {
    launchFreeUsed,
    launchWindowOpen,
    canGrantFree: canGrantWorkshopLaunchFreeSlot(launchFreeUsed),
  };
}
