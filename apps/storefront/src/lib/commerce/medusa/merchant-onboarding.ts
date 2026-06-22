import "server-only";

import type { RegistrationInterestType } from "@/lib/auth/registration-options";
import {
  ensureUserRole,
  linkUserToSeller,
  persistUserRegistrationProfile,
} from "@/lib/platform/queries/user-registration";
import {
  formatMerchantProvisionError,
  provisionMerchantSeller,
} from "./merchant-registration";

export type MerchantOnboardingInput = {
  userId: string;
  displayName: string;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  interestTypes?: RegistrationInterestType[];
  supabaseAccessToken?: string | null;
};

function isMerchantAuthError(error?: string): boolean {
  if (!error) {
    return false;
  }

  const normalized = error.toLowerCase();
  return (
    normalized.includes("(401)") ||
    normalized.includes("invalid or expired supabase session") ||
    normalized.includes("missing supabase bearer token")
  );
}

export async function completeMerchantOnboarding(
  input: MerchantOnboardingInput
): Promise<{ ok: boolean; message: string }> {
  const profileResult = await persistUserRegistrationProfile({
    userId: input.userId,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
    interestTypes: input.interestTypes,
  });

  if (!profileResult.ok) {
    console.error("Failed to persist merchant registration profile", {
      userId: input.userId,
      errors: profileResult.errors,
    });
    return {
      ok: false,
      message: "Opslaan van profielgegevens mislukt.",
    };
  }

  const roleResult = await ensureUserRole(input.userId, "merchant");
  if (!roleResult.ok) {
    console.error("Failed to ensure merchant role", {
      userId: input.userId,
      errors: roleResult.errors,
    });
    return {
      ok: false,
      message: "Merchant-rol toekennen mislukt.",
    };
  }

  const merchantInput = {
    displayName: input.displayName,
    businessName: input.displayName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    city: input.city,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
  };

  let merchantResult = await provisionMerchantSeller(merchantInput, {
    supabaseAccessToken: input.supabaseAccessToken,
  });

  if (
    !merchantResult.ok &&
    input.supabaseAccessToken?.trim() &&
    isMerchantAuthError(merchantResult.error)
  ) {
    merchantResult = await provisionMerchantSeller(merchantInput);
  }

  if (!merchantResult.ok || !merchantResult.sellerId) {
    console.error("Failed to provision merchant seller", {
      userId: input.userId,
      error: merchantResult.error,
    });
    return {
      ok: false,
      message: formatMerchantProvisionError(merchantResult.error),
    };
  }

  const sellerLinkResult = await linkUserToSeller(
    input.userId,
    merchantResult.sellerId,
    "merchant"
  );

  if (!sellerLinkResult.ok) {
    console.error("Failed to link user to merchant seller", {
      userId: input.userId,
      sellerId: merchantResult.sellerId,
      errors: sellerLinkResult.errors,
    });
    return {
      ok: false,
      message:
        "Merchant-profiel werd aangemaakt maar koppelen aan je account mislukte.",
    };
  }

  return { ok: true, message: "" };
}
