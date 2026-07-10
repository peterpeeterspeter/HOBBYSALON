import "server-only";

import type { Creator } from "@/types/platform";
import { createPlatformClient } from "@/lib/platform/client";
import { linkUserToSeller } from "@/lib/platform/queries/user-registration";
import { provisionCreatorSeller } from "./creator-registration";

export async function resolveSellerIdForCreatorOps(
  userId: string
): Promise<string | null> {
  const supabase = createPlatformClient();
  const { data: links, error } = await supabase
    .from("user_seller_links")
    .select("seller_id, seller_type")
    .eq("user_id", userId);

  if (error) {
    return null;
  }

  const creatorLink = links?.find((link) => link.seller_type === "creator");
  if (creatorLink?.seller_id) {
    return creatorLink.seller_id;
  }

  const merchantLink = links?.find((link) => link.seller_type === "merchant");
  if (merchantLink?.seller_id) {
    return merchantLink.seller_id;
  }

  return null;
}

export async function ensureCreatorSellerLinked(
  userId: string,
  userEmail: string,
  creator: Creator
): Promise<{ ok: boolean; sellerId: string | null; error?: string }> {
  const linkedSellerId = await resolveSellerIdForCreatorOps(userId);
  if (linkedSellerId) {
    return { ok: true, sellerId: linkedSellerId };
  }

  const email = userEmail.trim() || creator.email?.trim();
  if (!email) {
    return {
      ok: false,
      sellerId: null,
      error: "E-mailadres ontbreekt voor creator seller provisioning.",
    };
  }

  const provisionResult = await provisionCreatorSeller({
    displayName: creator.display_name,
    businessName: creator.business_name,
    contactName: creator.display_name,
    email,
    phone: creator.phone,
    city: creator.city,
    countryCode: creator.country_code ?? "BE",
  });

  if (!provisionResult.ok || !provisionResult.sellerId) {
    return {
      ok: false,
      sellerId: null,
      error:
        provisionResult.error ??
        "Creator seller kon niet worden aangemaakt in Medusa.",
    };
  }

  const linkResult = await linkUserToSeller(
    userId,
    provisionResult.sellerId,
    provisionResult.linkAsSellerType ?? "creator"
  );

  if (!linkResult.ok) {
    return {
      ok: false,
      sellerId: null,
      error:
        linkResult.errors.join(", ") ||
        "Creator seller kon niet aan je account gekoppeld worden.",
    };
  }

  return { ok: true, sellerId: provisionResult.sellerId };
}
