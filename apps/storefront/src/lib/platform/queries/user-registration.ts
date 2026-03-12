import "server-only";

import { createPlatformClient } from "../client";
import {
  REGISTRATION_ALLOWED_INTEREST_TYPES,
  REGISTRATION_DEFAULT_COUNTRY,
  type RegistrationInterestType,
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

export type UserPreferenceSnapshot = {
  postalCode: string | null;
  countryCode: string;
  interestTypes: RegistrationInterestType[];
  onboardingCompleted: boolean;
};

export type UserRegistrationContext = {
  roles: UserAccountRole[];
  preference: UserPreferenceSnapshot | null;
  sellerLinks: Array<{
    sellerId: string;
    sellerType: UserSellerType;
  }>;
  hasCreatorProfile: boolean;
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

function sanitizeInterestTypes(
  values: string[] | null | undefined
): RegistrationInterestType[] {
  if (!values || values.length === 0) return [];
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter(
          (value): value is RegistrationInterestType =>
            ALLOWED_INTEREST_SET.has(value)
        )
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
    { onConflict: "user_id,seller_type" }
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

export async function getUserAccountRoles(userId: string): Promise<UserAccountRole[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("user_account_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !data) {
    return [];
  }

  return Array.from(new Set(data.map((row) => row.role as UserAccountRole)));
}

export async function getUserRegistrationContext(
  userId: string
): Promise<UserRegistrationContext> {
  const supabase = createPlatformClient();

  const [rolesResult, preferenceResult, sellerLinksResult, creatorResult] =
    await Promise.all([
      supabase.from("user_account_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_preferences")
        .select("postal_code,country_code,interest_types,onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_seller_links")
        .select("seller_id,seller_type")
        .eq("user_id", userId),
      supabase
        .from("creators")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", userId),
    ]);

  const roles = rolesResult.data
    ? Array.from(new Set(rolesResult.data.map((row) => row.role as UserAccountRole)))
    : [];

  const preference = preferenceResult.data
    ? {
        postalCode: preferenceResult.data.postal_code ?? null,
        countryCode:
          sanitizeCountryCode(preferenceResult.data.country_code) ??
          REGISTRATION_DEFAULT_COUNTRY,
        interestTypes: sanitizeInterestTypes(
          preferenceResult.data.interest_types as string[] | null | undefined
        ),
        onboardingCompleted: !!preferenceResult.data.onboarding_completed,
      }
    : null;

  const sellerLinks =
    sellerLinksResult.data?.map((row) => ({
      sellerId: row.seller_id,
      sellerType: row.seller_type as UserSellerType,
    })) ?? [];

  return {
    roles,
    preference,
    sellerLinks,
    hasCreatorProfile: (creatorResult.count ?? 0) > 0,
  };
}
