import "server-only";

import { linkUserToSeller } from "@/lib/platform/queries/user-registration";
import { createPlatformClient } from "@/lib/platform/client";
import {
  formatMerchantProvisionError,
  provisionMerchantSeller,
} from "./merchant-registration";

export async function resolveMerchantSellerId(
  userId: string
): Promise<string | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("user_seller_links")
    .select("seller_id")
    .eq("user_id", userId)
    .eq("seller_type", "merchant")
    .maybeSingle();

  if (error || !data?.seller_id) {
    return null;
  }

  return data.seller_id;
}

/**
 * Ensures a merchant Medusa seller exists and is linked for this user.
 * Safe when the user already has a creator seller on the same email.
 */
export async function ensureMerchantSellerLinked(input: {
  userId: string;
  email: string;
  displayName: string;
  contactName?: string | null;
  phone?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  supabaseAccessToken?: string | null;
}): Promise<{ ok: boolean; sellerId: string | null; error?: string }> {
  const existing = await resolveMerchantSellerId(input.userId);
  if (existing) {
    return { ok: true, sellerId: existing };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return {
      ok: false,
      sellerId: null,
      error: "E-mailadres ontbreekt voor merchant-koppeling.",
    };
  }

  const displayName = input.displayName.trim() || email.split("@")[0] || "Winkel";

  const provisionResult = await provisionMerchantSeller(
    {
      displayName,
      businessName: displayName,
      contactName: input.contactName,
      email,
      phone: input.phone,
      city: input.city,
      postalCode: input.postalCode,
      countryCode: input.countryCode,
    },
    { supabaseAccessToken: input.supabaseAccessToken }
  );

  if (!provisionResult.ok || !provisionResult.sellerId) {
    return {
      ok: false,
      sellerId: null,
      error: formatMerchantProvisionError(provisionResult.error),
    };
  }

  const linkResult = await linkUserToSeller(
    input.userId,
    provisionResult.sellerId,
    "merchant"
  );

  if (!linkResult.ok) {
    return {
      ok: false,
      sellerId: null,
      error:
        linkResult.errors[0] ??
        "Merchant-winkel kon niet aan je account gekoppeld worden.",
    };
  }

  return { ok: true, sellerId: provisionResult.sellerId };
}
