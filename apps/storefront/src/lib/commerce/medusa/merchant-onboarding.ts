import "server-only";

import type { RegistrationInterestType } from "@/lib/auth/registration-options";
import { persistUserRegistrationProfile } from "@/lib/platform/queries/user-registration";
import {
  createRoleRequest,
  ROLE_REQUEST_PENDING_MESSAGE,
} from "@/lib/platform/queries/role-requests";

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

export async function completeMerchantOnboarding(
  input: MerchantOnboardingInput
): Promise<{ ok: boolean; message: string; pendingApproval: boolean }> {
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
      pendingApproval: false,
    };
  }

  const requestResult = await createRoleRequest(input.userId, "merchant", {
    displayName: input.displayName,
    businessName: input.displayName,
    contactName: input.contactName ?? undefined,
    email: input.email,
    phone: input.phone ?? undefined,
    city: input.city ?? undefined,
    postalCode: input.postalCode ?? undefined,
    countryCode: input.countryCode ?? undefined,
    source: "merchant_onboarding",
  });

  if (!requestResult.ok) {
    console.error("Failed to create merchant role request", {
      userId: input.userId,
      errors: requestResult.errors,
    });
    return {
      ok: false,
      message: "Merchant-aanvraag indienen mislukt.",
      pendingApproval: false,
    };
  }

  return {
    ok: true,
    message: ROLE_REQUEST_PENDING_MESSAGE,
    pendingApproval: true,
  };
}
