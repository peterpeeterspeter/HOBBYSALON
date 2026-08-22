import "server-only";

import { linkUserToSeller } from "@/lib/platform/queries/user-registration";
import { createPlatformClient } from "@/lib/platform/client";
import { ensureMerchantCreatorProfile } from "@/lib/platform/queries/merchant-creator";
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

async function ensureLinkedMerchantCreator(input: {
  userId: string;
  sellerId: string;
  email: string;
  displayName: string;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const creatorResult = await ensureMerchantCreatorProfile({
    userId: input.userId,
    sellerId: input.sellerId,
    displayName: input.displayName,
    businessName: input.displayName,
    city: input.city,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
    email: input.email,
  });

  if (!creatorResult.ok) {
    return {
      ok: false,
      error:
        creatorResult.errors[0] ??
        "Merchant-creator-profiel kon niet worden aangemaakt.",
    };
  }

  return { ok: true };
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
  const email = input.email.trim().toLowerCase();
  const displayName =
    input.displayName.trim() || (email ? email.split("@")[0] : "") || "Winkel";

  const existing = await resolveMerchantSellerId(input.userId);
  if (existing) {
    const creatorEnsure = await ensureLinkedMerchantCreator({
      userId: input.userId,
      sellerId: existing,
      email: email || `${input.userId}@users.invalid`,
      displayName,
      city: input.city,
      postalCode: input.postalCode,
      countryCode: input.countryCode,
    });
    if (!creatorEnsure.ok) {
      return { ok: false, sellerId: existing, error: creatorEnsure.error };
    }
    return { ok: true, sellerId: existing };
  }

  if (!email) {
    return {
      ok: false,
      sellerId: null,
      error: "E-mailadres ontbreekt voor merchant-koppeling.",
    };
  }

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

  const creatorEnsure = await ensureLinkedMerchantCreator({
    userId: input.userId,
    sellerId: provisionResult.sellerId,
    email,
    displayName,
    city: input.city,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
  });

  if (!creatorEnsure.ok) {
    return {
      ok: false,
      sellerId: provisionResult.sellerId,
      error: creatorEnsure.error,
    };
  }

  return { ok: true, sellerId: provisionResult.sellerId };
}
