import "server-only";

import { createPlatformClient } from "../client";
import {
  REGISTRATION_ALLOWED_INTEREST_TYPES,
  REGISTRATION_DEFAULT_COUNTRY,
} from "@/lib/auth/registration-options";

const ALLOWED_INTEREST_SET = new Set<string>(REGISTRATION_ALLOWED_INTEREST_TYPES);

type PersistUserRegistrationInput = {
  userId: string;
  postalCode?: string | null;
  countryCode?: string | null;
  interestTypes?: string[];
};

export type UserAccountRole =
  | "user"
  | "creator"
  | "merchant"
  | "workshop_host"
  | "organizer";

export type UserSellerType = "creator" | "merchant";

type PersistResult = {
  ok: boolean;
  errors: string[];
};

function sanitizePostalCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, 16);
}

function sanitizeCountryCode(value: string | null | undefined): string {
  if (!value) return REGISTRATION_DEFAULT_COUNTRY;
  const cleaned = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cleaned)) return REGISTRATION_DEFAULT_COUNTRY;
  return cleaned;
}

function sanitizeInterestTypes(values: string[] | null | undefined): string[] {
  if (!values || values.length === 0) return [];
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => ALLOWED_INTEREST_SET.has(value))
    )
  );
}

export async function persistUserRegistrationProfile(
  input: PersistUserRegistrationInput
): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const errors: string[] = [];

  const postalCode = sanitizePostalCode(input.postalCode);
  const countryCode = sanitizeCountryCode(input.countryCode);
  const interestTypes = sanitizeInterestTypes(input.interestTypes);

  const [preferenceResult, roleResult] = await Promise.all([
    supabase.from("user_preferences").upsert(
      {
        user_id: input.userId,
        postal_code: postalCode,
        country_code: countryCode,
        interest_types: interestTypes,
        onboarding_completed: true,
      },
      { onConflict: "user_id" }
    ),
    supabase.from("user_account_roles").upsert(
      {
        user_id: input.userId,
        role: "user",
      },
      { onConflict: "user_id,role" }
    ),
  ]);

  if (preferenceResult.error) {
    errors.push(preferenceResult.error.message);
  }

  if (roleResult.error) {
    errors.push(roleResult.error.message);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export async function ensureUserRole(
  userId: string,
  role: UserAccountRole
): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const { error } = await supabase
    .from("user_account_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

  if (error) {
    return {
      ok: false,
      errors: [error.message],
    };
  }

  return {
    ok: true,
    errors: [],
  };
}

export async function linkUserToSeller(
  userId: string,
  sellerId: string,
  sellerType: UserSellerType
): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const { error } = await supabase.from("user_seller_links").upsert(
    {
      user_id: userId,
      seller_id: sellerId,
      seller_type: sellerType,
    },
    { onConflict: "seller_id" }
  );

  if (error) {
    return {
      ok: false,
      errors: [error.message],
    };
  }

  return {
    ok: true,
    errors: [],
  };
}
