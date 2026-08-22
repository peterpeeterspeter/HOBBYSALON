import "server-only";

import { createPlatformClient } from "../client";
import {
  REGISTRATION_ALLOWED_INTEREST_TYPES,
  REGISTRATION_DEFAULT_COUNTRY,
  REGISTRATION_OFFER_ROLES,
  resolvePrimaryOfferRole,
  type RegistrationInterestType,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";

const ALLOWED_INTEREST_SET = new Set<string>(REGISTRATION_ALLOWED_INTEREST_TYPES);
const OFFER_ROLE_SET = new Set<string>(REGISTRATION_OFFER_ROLES);

type PersistUserRegistrationInput = {
  userId: string;
  postalCode?: string | null;
  countryCode?: string | null;
  interestTypes?: string[];
  preferredDomainIds?: string[];
  offerRoles?: RegistrationOfferRole[];
  primaryOfferRole?: RegistrationOfferRole | null;
  marketingOptIn?: boolean;
  marketingConsentSource?: string | null;
  /** When true, marks hobbyist onboarding done. Offer users stay incomplete until /onboarding finishes. */
  onboardingCompleted?: boolean;
};

type CompatibilityMigrationInput = {
  userId: string;
  email?: string | null;
  legacyCity?: string | null;
  legacyCountryCode?: string | null;
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
  city: string | null;
  postalCode: string | null;
  countryCode: string;
  interestTypes: RegistrationInterestType[];
  preferredDomainIds: string[];
  offerRoles: RegistrationOfferRole[];
  primaryOfferRole: RegistrationOfferRole | null;
  marketingOptIn: boolean;
  marketingOptedInAt: string | null;
  marketingOptedOutAt: string | null;
  marketingConsentSource: string | null;
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
  pendingRoleRequests: Array<{
    id: string;
    role: Extract<UserAccountRole, "merchant" | "workshop_host" | "organizer">;
    status: "pending" | "rejected";
    createdAt: string;
  }>;
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

function sanitizeCountryCodeOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cleaned)) return null;
  return cleaned;
}

function sanitizeCity(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 80);
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizePreferredDomainIds(
  values: string[] | null | undefined
): string[] {
  if (!values || values.length === 0) return [];
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => UUID_RE.test(value))
    )
  );
}

function sanitizeOfferRoles(
  values: string[] | null | undefined
): RegistrationOfferRole[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<RegistrationOfferRole>();
  for (const raw of values) {
    const value = raw.trim().toLowerCase();
    if (!OFFER_ROLE_SET.has(value)) continue;
    seen.add(value as RegistrationOfferRole);
  }
  return REGISTRATION_OFFER_ROLES.filter((role) => seen.has(role));
}

export async function persistUserRegistrationProfile(
  input: PersistUserRegistrationInput
): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const errors: string[] = [];

  const postalCode = sanitizePostalCode(input.postalCode);
  const countryCode = sanitizeCountryCode(input.countryCode);
  const interestTypes = sanitizeInterestTypes(input.interestTypes);
  const preferredDomainIds = sanitizePreferredDomainIds(
    input.preferredDomainIds
  );
  const offerRoles = sanitizeOfferRoles(input.offerRoles);
  const primaryOfferRole =
    input.primaryOfferRole !== undefined
      ? input.primaryOfferRole
      : resolvePrimaryOfferRole(offerRoles);

  const nowIso = new Date().toISOString();
  const marketingOptIn = !!input.marketingOptIn;
  const onboardingCompleted =
    input.onboardingCompleted !== undefined
      ? input.onboardingCompleted
      : offerRoles.length === 0;

  const preferencePayload: Record<string, unknown> = {
    user_id: input.userId,
    postal_code: postalCode,
    country_code: countryCode,
    interest_types: interestTypes,
    offer_roles: offerRoles,
    primary_offer_role: primaryOfferRole,
    marketing_opt_in: marketingOptIn,
    onboarding_completed: onboardingCompleted,
  };

  if (input.preferredDomainIds !== undefined) {
    preferencePayload.preferred_domain_ids = preferredDomainIds;
  }

  if (marketingOptIn) {
    preferencePayload.marketing_opted_in_at = nowIso;
    preferencePayload.marketing_consent_source =
      input.marketingConsentSource?.trim() || "register";
  }

  const [preferenceResult, roleResult] = await Promise.all([
    supabase.from("user_preferences").upsert(preferencePayload, {
      onConflict: "user_id",
    }),
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

export async function updateUserOfferIntent(input: {
  userId: string;
  offerRoles: RegistrationOfferRole[];
  primaryOfferRole?: RegistrationOfferRole | null;
}): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const offerRoles = sanitizeOfferRoles(input.offerRoles);
  const primaryOfferRole =
    input.primaryOfferRole !== undefined
      ? input.primaryOfferRole
      : resolvePrimaryOfferRole(offerRoles);

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: input.userId,
      offer_roles: offerRoles,
      primary_offer_role: primaryOfferRole,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, errors: [error.message] };
  }
  return { ok: true, errors: [] };
}

export async function setOnboardingCompleted(
  userId: string,
  completed = true
): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      onboarding_completed: completed,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, errors: [error.message] };
  }
  return { ok: true, errors: [] };
}

export async function setMarketingOptIn(input: {
  userId: string;
  optIn: boolean;
  source?: string | null;
}): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    marketing_opt_in: input.optIn,
  };

  if (input.optIn) {
    payload.marketing_opted_in_at = nowIso;
    payload.marketing_consent_source = input.source?.trim() || "account";
  } else {
    payload.marketing_opted_out_at = nowIso;
  }

  const { error } = await supabase
    .from("user_preferences")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return { ok: false, errors: [error.message] };
  }
  return { ok: true, errors: [] };
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

export async function removeUserRoles(
  userId: string,
  roles: UserAccountRole[]
): Promise<PersistResult> {
  if (roles.length === 0) {
    return { ok: true, errors: [] };
  }

  const supabase = createPlatformClient();
  const { error } = await supabase
    .from("user_account_roles")
    .delete()
    .eq("user_id", userId)
    .in("role", roles);

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

async function isStaleAuthUser(userId: string): Promise<boolean> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  return !!error || !data.user;
}

export async function linkUserToSeller(
  userId: string,
  sellerId: string,
  sellerType: UserSellerType
): Promise<PersistResult> {
  const supabase = createPlatformClient();

  const { data: existingForUser, error: existingForUserError } = await supabase
    .from("user_seller_links")
    .select("id, seller_id")
    .eq("user_id", userId)
    .eq("seller_type", sellerType)
    .maybeSingle();

  if (existingForUserError) {
    return {
      ok: false,
      errors: [existingForUserError.message],
    };
  }

  if (existingForUser?.seller_id === sellerId) {
    return {
      ok: true,
      errors: [],
    };
  }

  const { data: existingForSeller, error: existingForSellerError } =
    await supabase
      .from("user_seller_links")
      .select("id, user_id")
      .eq("seller_id", sellerId)
      .maybeSingle();

  if (existingForSellerError) {
    return {
      ok: false,
      errors: [existingForSellerError.message],
    };
  }

  if (existingForSeller && existingForSeller.user_id !== userId) {
    const staleOwner = await isStaleAuthUser(existingForSeller.user_id);
    if (staleOwner) {
      const { error: deleteStaleError } = await supabase
        .from("user_seller_links")
        .delete()
        .eq("id", existingForSeller.id);

      if (deleteStaleError) {
        return {
          ok: false,
          errors: [deleteStaleError.message],
        };
      }
    } else {
      return {
        ok: false,
        errors: [
          "Deze winkel is al gekoppeld aan een ander account met hetzelfde e-mailadres.",
        ],
      };
    }
  }

  if (existingForUser) {
    const { error: deleteUserLinkError } = await supabase
      .from("user_seller_links")
      .delete()
      .eq("id", existingForUser.id);

    if (deleteUserLinkError) {
      return {
        ok: false,
        errors: [deleteUserLinkError.message],
      };
    }
  }

  const { error } = await supabase.from("user_seller_links").insert({
    user_id: userId,
    seller_id: sellerId,
    seller_type: sellerType,
  });

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

async function getNewsletterInterestTypesByEmail(
  email: string
): Promise<RegistrationInterestType[]> {
  const supabase = createPlatformClient();
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (!subscriber?.id) {
    return [];
  }

  const { data: segments } = await supabase
    .from("survey_segments")
    .select("interest_type")
    .eq("subscriber_id", subscriber.id)
    .limit(50);

  return sanitizeInterestTypes(
    (segments ?? []).map((segment) => segment.interest_type as string)
  );
}

export async function runRegistrationCompatibilityMigration(
  input: CompatibilityMigrationInput
): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const errors: string[] = [];

  const legacyCity = sanitizeCity(input.legacyCity);
  const legacyCountryCode = sanitizeCountryCodeOrNull(input.legacyCountryCode);

  const [preferenceResult, roleResult] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("city,country_code,interest_types,onboarding_completed")
      .eq("user_id", input.userId)
      .maybeSingle(),
    supabase.from("user_account_roles").upsert(
      {
        user_id: input.userId,
        role: "user",
      },
      { onConflict: "user_id,role" }
    ),
  ]);

  if (roleResult.error) {
    errors.push(roleResult.error.message);
  }

  const existingPreference = preferenceResult.data;
  const existingCity = sanitizeCity(existingPreference?.city);
  const existingCountry = sanitizeCountryCodeOrNull(existingPreference?.country_code);
  const existingInterests = sanitizeInterestTypes(
    existingPreference?.interest_types as string[] | null | undefined
  );

  const newsletterInterestTypes = input.email
    ? await getNewsletterInterestTypesByEmail(input.email)
    : [];

  const mergedInterests = Array.from(
    new Set<RegistrationInterestType>([
      ...existingInterests,
      ...newsletterInterestTypes,
    ])
  );
  const nextCity = existingCity ?? legacyCity;
  const nextCountry =
    existingCountry ??
    (legacyCountryCode && !existingCountry ? legacyCountryCode : null) ??
    REGISTRATION_DEFAULT_COUNTRY;
  const nextOnboardingCompleted =
    existingPreference?.onboarding_completed ??
    !!(legacyCity || legacyCountryCode || mergedInterests.length > 0);
  const hasMigrationSignal =
    !!legacyCity || !!legacyCountryCode || mergedInterests.length > 0;

  const shouldUpsertPreference =
    (!!existingPreference &&
      ((!!legacyCity && !existingCity) ||
        (!!legacyCountryCode &&
          (!existingCountry || existingCountry === REGISTRATION_DEFAULT_COUNTRY)) ||
        mergedInterests.length > existingInterests.length)) ||
    (!existingPreference && hasMigrationSignal);

  if (shouldUpsertPreference) {
    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: input.userId,
        city: nextCity,
        country_code: nextCountry,
        interest_types: mergedInterests,
        onboarding_completed: nextOnboardingCompleted,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      errors.push(error.message);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export async function getUserRegistrationContext(
  userId: string
): Promise<UserRegistrationContext> {
  const supabase = createPlatformClient();

  const [rolesResult, preferenceResult, sellerLinksResult, creatorResult, roleRequestsResult] =
    await Promise.all([
      supabase.from("user_account_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_preferences")
        .select(
          "city,postal_code,country_code,interest_types,preferred_domain_ids,offer_roles,primary_offer_role,marketing_opt_in,marketing_opted_in_at,marketing_opted_out_at,marketing_consent_source,onboarding_completed"
        )
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
      supabase
        .from("role_requests")
        .select("id, role, status, created_at")
        .eq("user_id", userId)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false }),
    ]);

  const roles = rolesResult.data
    ? Array.from(new Set(rolesResult.data.map((row) => row.role as UserAccountRole)))
    : [];

  const preference = preferenceResult.data
    ? {
        city: sanitizeCity(preferenceResult.data.city),
        postalCode: preferenceResult.data.postal_code ?? null,
        countryCode:
          sanitizeCountryCode(preferenceResult.data.country_code) ??
          REGISTRATION_DEFAULT_COUNTRY,
        interestTypes: sanitizeInterestTypes(
          preferenceResult.data.interest_types as string[] | null | undefined
        ),
        preferredDomainIds: sanitizePreferredDomainIds(
          preferenceResult.data.preferred_domain_ids as
            | string[]
            | null
            | undefined
        ),
        offerRoles: sanitizeOfferRoles(
          preferenceResult.data.offer_roles as string[] | null | undefined
        ),
        primaryOfferRole: (() => {
          const raw = preferenceResult.data.primary_offer_role;
          if (typeof raw !== "string") return null;
          const cleaned = raw.trim().toLowerCase();
          return OFFER_ROLE_SET.has(cleaned)
            ? (cleaned as RegistrationOfferRole)
            : null;
        })(),
        marketingOptIn: !!preferenceResult.data.marketing_opt_in,
        marketingOptedInAt:
          typeof preferenceResult.data.marketing_opted_in_at === "string"
            ? preferenceResult.data.marketing_opted_in_at
            : null,
        marketingOptedOutAt:
          typeof preferenceResult.data.marketing_opted_out_at === "string"
            ? preferenceResult.data.marketing_opted_out_at
            : null,
        marketingConsentSource:
          typeof preferenceResult.data.marketing_consent_source === "string"
            ? preferenceResult.data.marketing_consent_source
            : null,
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
    pendingRoleRequests:
      roleRequestsResult.data?.map((row) => ({
        id: row.id,
        role: row.role as Extract<
          UserAccountRole,
          "merchant" | "workshop_host" | "organizer"
        >,
        status: row.status as "pending" | "rejected",
        createdAt: row.created_at,
      })) ?? [],
  };
}
