import "server-only";

import { createPlatformClient } from "../client";
import { REGISTRATION_DEFAULT_COUNTRY } from "@/lib/auth/registration-options";

type EnsureMerchantCreatorInput = {
  userId: string;
  sellerId: string;
  displayName: string;
  businessName?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  email?: string | null;
};

type EnsureMerchantCreatorResult = {
  ok: boolean;
  creatorId: string | null;
  errors: string[];
};

function sanitizeOptionalText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function sanitizeCountryCode(value: string | null | undefined): string {
  if (!value) return REGISTRATION_DEFAULT_COUNTRY;
  const cleaned = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cleaned)) return REGISTRATION_DEFAULT_COUNTRY;
  return cleaned;
}

/** Matches platform-products-projection synthetic merchant creator slugs. */
export function merchantCreatorSlugForSeller(sellerId: string): string {
  const normalized = `merchant-${sellerId}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `merchant-${sellerId}`;
}

function withSupplierType(existing: string[] | null | undefined): string[] {
  const types = Array.from(
    new Set(
      (existing ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  if (!types.includes("supplier")) {
    types.push("supplier");
  }
  return types.length > 0 ? types : ["supplier"];
}

/**
 * Ensures an approved merchant has a platform creators row linked to their
 * auth user. Reuses the projection slug `merchant-{sellerId}` when possible
 * so product projection attaches to the same profile.
 */
export async function ensureMerchantCreatorProfile(
  input: EnsureMerchantCreatorInput
): Promise<EnsureMerchantCreatorResult> {
  const supabase = createPlatformClient();
  const errors: string[] = [];
  const displayName =
    sanitizeOptionalText(input.displayName) ||
    sanitizeOptionalText(input.businessName) ||
    "Winkel";
  const businessName =
    sanitizeOptionalText(input.businessName) || displayName;
  const city = sanitizeOptionalText(input.city);
  const postalCode = sanitizeOptionalText(input.postalCode);
  const countryCode = sanitizeCountryCode(input.countryCode);
  const email = sanitizeOptionalText(input.email)?.toLowerCase() ?? null;
  const now = new Date().toISOString();

  const { data: byUser, error: byUserError } = await supabase
    .from("creators")
    .select("id,creator_types")
    .eq("user_id", input.userId)
    .limit(1);

  if (byUserError) {
    return { ok: false, creatorId: null, errors: [byUserError.message] };
  }

  if (byUser?.[0]?.id) {
    const nextTypes = withSupplierType(byUser[0].creator_types as string[] | null);
    const { error: updateError } = await supabase
      .from("creators")
      .update({
        creator_types: nextTypes,
        business_name: businessName,
        city: city ?? undefined,
        postal_code: postalCode ?? undefined,
        country_code: countryCode,
        updated_at: now,
      })
      .eq("id", byUser[0].id);

    if (updateError) {
      errors.push(updateError.message);
    }

    return {
      ok: errors.length === 0,
      creatorId: byUser[0].id,
      errors,
    };
  }

  const preferredSlug = merchantCreatorSlugForSeller(input.sellerId);
  const { data: bySlug, error: bySlugError } = await supabase
    .from("creators")
    .select("id,user_id,creator_types")
    .eq("slug", preferredSlug)
    .limit(1);

  if (bySlugError) {
    return { ok: false, creatorId: null, errors: [bySlugError.message] };
  }

  if (bySlug?.[0]?.id) {
    const existingUserId = bySlug[0].user_id as string | null;
    if (existingUserId && existingUserId !== input.userId) {
      errors.push(
        `Merchant-creator slug ${preferredSlug} is al gekoppeld aan een andere gebruiker.`
      );
      return { ok: false, creatorId: null, errors };
    }

    const { error: linkError } = await supabase
      .from("creators")
      .update({
        user_id: input.userId,
        display_name: displayName,
        business_name: businessName,
        city,
        postal_code: postalCode,
        country_code: countryCode,
        email,
        creator_types: withSupplierType(
          bySlug[0].creator_types as string[] | null
        ),
        accepts_marketplace_orders: true,
        updated_at: now,
      })
      .eq("id", bySlug[0].id);

    if (linkError) {
      return { ok: false, creatorId: null, errors: [linkError.message] };
    }

    return { ok: true, creatorId: bySlug[0].id, errors: [] };
  }

  const { data: created, error: insertError } = await supabase
    .from("creators")
    .insert({
      user_id: input.userId,
      slug: preferredSlug,
      display_name: displayName,
      business_name: businessName,
      city,
      postal_code: postalCode,
      country_code: countryCode,
      email,
      creator_types: ["supplier"],
      is_verified: false,
      is_featured: false,
      accepts_bookings: false,
      accepts_marketplace_orders: true,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    return {
      ok: false,
      creatorId: null,
      errors: [insertError?.message ?? "Merchant-creator kon niet worden aangemaakt."],
    };
  }

  return { ok: true, creatorId: created.id, errors: [] };
}
