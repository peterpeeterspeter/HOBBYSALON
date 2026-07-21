import "server-only";

import { createPlatformClient } from "../client";
import {
  REGISTRATION_DEFAULT_COUNTRY,
  type RegistrationInterestType,
} from "@/lib/auth/registration-options";
import { persistUserRegistrationProfile } from "./user-registration";
import { syncPrivilegedRolesFromCreatorTypes } from "./role-requests";

const ALLOWED_CREATOR_TYPES = new Set<string>([
  "maker",
  "workshopgever",
  "supplier",
  "content_creator",
  "organizer",
]);

const DEFAULT_CREATOR_TYPE = "maker";

type PersistCreatorRegistrationInput = {
  userId: string;
  displayName: string;
  businessName?: string | null;
  preferredSlug?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  interestTypes?: RegistrationInterestType[];
  creatorTypes?: string[];
};

type PersistResult = {
  ok: boolean;
  errors: string[];
  slug: string | null;
};

function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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

function sanitizeCreatorTypes(values: string[] | null | undefined): string[] {
  const normalized = Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter((value) => ALLOWED_CREATOR_TYPES.has(value))
    )
  );

  return normalized.length > 0 ? normalized : [DEFAULT_CREATOR_TYPE];
}

async function ensureUniqueCreatorSlug(
  preferred: string,
  userId: string
): Promise<string> {
  const supabase = createPlatformClient();
  const base = toSlug(preferred) || `creator-${Date.now()}`;

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase
      .from("creators")
      .select("id,user_id")
      .eq("slug", candidate)
      .limit(1);

    if (error || !data || data.length === 0) {
      return candidate;
    }

    if (data[0]?.user_id === userId) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

export async function persistCreatorRegistrationProfile(
  input: PersistCreatorRegistrationInput
): Promise<PersistResult> {
  const supabase = createPlatformClient();
  const errors: string[] = [];

  const baseProfile = await persistUserRegistrationProfile({
    userId: input.userId,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
    interestTypes: input.interestTypes,
  });

  if (!baseProfile.ok) {
    errors.push(...baseProfile.errors);
  }

  const creatorTypes = sanitizeCreatorTypes(input.creatorTypes);
  const displayName = sanitizeOptionalText(input.displayName);

  if (!displayName) {
    return {
      ok: false,
      errors: [...errors, "Display name is required."],
      slug: null,
    };
  }

  const roleSet = new Set<string>(["creator"]);

  for (const role of roleSet) {
    const { error } = await supabase
      .from("user_account_roles")
      .upsert({ user_id: input.userId, role }, { onConflict: "user_id,role" });
    if (error) {
      errors.push(error.message);
    }
  }

  const privilegedSyncError = await syncPrivilegedRolesFromCreatorTypes(
    input.userId,
    creatorTypes,
    { source: "creator_registration" }
  );
  if (privilegedSyncError) {
    errors.push(privilegedSyncError);
  }

  const slug = await ensureUniqueCreatorSlug(
    input.preferredSlug?.trim() || displayName,
    input.userId
  );

  const payload = {
    user_id: input.userId,
    slug,
    display_name: displayName,
    business_name: sanitizeOptionalText(input.businessName),
    city: sanitizeOptionalText(input.city),
    postal_code: sanitizeOptionalText(input.postalCode),
    country_code: sanitizeCountryCode(input.countryCode),
    creator_types: creatorTypes,
  };

  const { data: existingRows, error: existingError } = await supabase
    .from("creators")
    .select("id")
    .eq("user_id", input.userId)
    .limit(1);

  if (existingError) {
    errors.push(existingError.message);
    return {
      ok: false,
      errors,
      slug: null,
    };
  }

  if (existingRows && existingRows.length > 0) {
    const { error } = await supabase
      .from("creators")
      .update(payload)
      .eq("id", existingRows[0].id)
      .eq("user_id", input.userId);
    if (error) {
      errors.push(error.message);
    }
  } else {
    const { error } = await supabase.from("creators").insert(payload);
    if (error) {
      errors.push(error.message);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    slug,
  };
}
