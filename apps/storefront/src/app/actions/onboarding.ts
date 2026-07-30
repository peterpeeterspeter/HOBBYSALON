"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import {
  parseRegistrationOfferRoles,
  resolvePrimaryOfferRole,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";
import {
  ensureUserRole,
  setOnboardingCompleted,
  updateUserOfferIntent,
} from "@/lib/platform/queries/user-registration";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { resolveProductImageUrl } from "@/lib/storage/upload-image";
import { syncPrivilegedRolesFromCreatorTypes } from "@/lib/platform/queries/role-requests";
import { getFirstListingPath } from "@/lib/onboarding/offer-onboarding";

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function parseOptionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseRequiredString(formData: FormData, key: string): string {
  const value = parseOptionalString(formData, key);
  if (!value) {
    throw new Error(`Veld ${key} is verplicht.`);
  }
  return value;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuidValues(formData: FormData, key: string): string[] {
  return Array.from(
    new Set(
      formData
        .getAll(key)
        .map((value) => value.toString().trim().toLowerCase())
        .filter((value) => UUID_RE.test(value))
    )
  );
}

async function ensureUniqueSlug(
  table: "creators",
  preferred: string,
  excludeId?: string
): Promise<string> {
  const base = preferred
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "maker";

  const supabase = createPlatformClient();
  let candidate = base;
  let attempt = 0;

  while (attempt < 20) {
    let query = supabase.from(table).select("id").eq("slug", candidate).limit(1);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt + 1}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

function offerRoleToCreatorTypes(role: RegistrationOfferRole): string[] {
  if (role === "workshopgever") return ["workshopgever"];
  if (role === "organizer") return ["organizer"];
  if (role === "maker") return ["maker"];
  return ["maker"];
}

function mergeCreatorTypes(
  existing: string[] | null | undefined,
  role: RegistrationOfferRole
): string[] {
  const next = new Set((existing ?? []).map((value) => value.toLowerCase()));
  for (const type of offerRoleToCreatorTypes(role)) {
    next.add(type);
  }
  return Array.from(next);
}

export async function skipOfferOnboardingAction(): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }
  await setOnboardingCompleted(user.id, true);
  redirect("/profile");
}

/** Logged-in hobbyist starts maker / workshopgever / organizer upgrade → /onboarding. */
export async function startOfferRoleUpgradeAction(
  formData: FormData
): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const existing = await getCreatorByUserId(user.id);
  if (existing) {
    redirect("/dashboard#account");
  }

  const roleRaw = parseOptionalString(formData, "offer_role");
  const roles = parseRegistrationOfferRoles(roleRaw ? [roleRaw] : []);
  const role = resolvePrimaryOfferRole(roles);
  if (!role || role === "merchant") {
    fail("/profile#rollen-upgraden", "Kies een geldige aanbiedersrol.");
  }

  const { getUserRegistrationContext } = await import(
    "@/lib/platform/queries/user-registration"
  );
  const context = await getUserRegistrationContext(user.id);
  const mergedOfferRoles = Array.from(
    new Set([...(context.preference?.offerRoles ?? []), role])
  );

  await updateUserOfferIntent({
    userId: user.id,
    offerRoles: mergedOfferRoles,
    primaryOfferRole: role,
  });

  // Incomplete offer onboarding so /onboarding is not skipped.
  await setOnboardingCompleted(user.id, false);

  revalidatePath("/onboarding");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect(`/onboarding?role=${encodeURIComponent(role)}`);
}

export async function saveOnboardingProfileAction(
  formData: FormData
): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      fail("/login?next=/onboarding", "Meld je eerst aan.");
    }

    const roleRaw = parseOptionalString(formData, "offer_role");
    const roles = parseRegistrationOfferRoles(roleRaw ? [roleRaw] : []);
    const role = resolvePrimaryOfferRole(roles);
    if (!role || role === "merchant") {
      fail("/onboarding", "Ongeldige aanbiedersrol.");
    }

    const displayName = parseOptionalString(formData, "display_name");
    const businessName = parseOptionalString(formData, "business_name");
    const nameForProfile = businessName || displayName;
    if (!nameForProfile) {
      fail("/onboarding", "Vul een naam of bedrijfsnaam in.");
    }

    const city = parseRequiredString(formData, "city");
    const bio = parseRequiredString(formData, "bio");
    const email =
      parseOptionalString(formData, "email") ?? user.email ?? null;
    if (!email) {
      fail("/onboarding", "Contact e-mail is verplicht.");
    }

    const domainIds = parseUuidValues(formData, "domain_ids");
    if (domainIds.length === 0) {
      fail("/onboarding", "Kies minstens één hobby of categorie.");
    }

    const { getUserRegistrationContext } = await import(
      "@/lib/platform/queries/user-registration"
    );
    const context = await getUserRegistrationContext(user.id);
    const mergedOfferRoles = Array.from(
      new Set([...(context.preference?.offerRoles ?? []), role])
    );

    await updateUserOfferIntent({
      userId: user.id,
      offerRoles: mergedOfferRoles,
      primaryOfferRole: context.preference?.primaryOfferRole ?? role,
    });

    const existing = await getCreatorByUserId(user.id);
    const creatorTypes = mergeCreatorTypes(existing?.creator_types, role);
    const slugSource = nameForProfile;
    const avatarUrl = await resolveProductImageUrl(formData, {
      fileField: "avatar_file",
      urlField: "avatar_file_uploaded_url",
      existingUrl: existing?.avatar_url,
      pathPrefix: `creators/${user.id}/avatar`,
    });

    const payload = {
      user_id: user.id,
      display_name: displayName || businessName || nameForProfile,
      business_name: businessName,
      email,
      bio,
      avatar_url: avatarUrl,
      city,
      country_code: parseOptionalString(formData, "country_code") ?? "BE",
      creator_types: creatorTypes,
      open_to_markets: false,
    };

    const supabase = createPlatformClient();
    let creatorId = existing?.id ?? null;

    if (existing) {
      const slug =
        existing.slug ||
        (await ensureUniqueSlug("creators", slugSource, existing.id));
      const { error } = await supabase
        .from("creators")
        .update({ ...payload, slug })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) {
        fail("/onboarding", "Opslaan van profiel mislukt.");
      }
    } else {
      const slug = await ensureUniqueSlug("creators", slugSource);
      const { data, error } = await supabase
        .from("creators")
        .insert({ ...payload, slug })
        .select("id")
        .limit(1);
      if (error || !data?.[0]?.id) {
        fail("/onboarding", "Aanmaken van profiel mislukt.");
      }
      creatorId = data[0].id as string;
    }

    if (creatorId) {
      await supabase.from("creator_domains").delete().eq("creator_id", creatorId);
      if (domainIds.length > 0) {
        const { error: domainError } = await supabase.from("creator_domains").insert(
          domainIds.map((domain_id) => ({
            creator_id: creatorId,
            domain_id,
          }))
        );
        if (domainError) {
          fail("/onboarding", "Opslaan van hobby-categorieën mislukt.");
        }
      }
    }

    await ensureUserRole(user.id, "creator");
    await syncPrivilegedRolesFromCreatorTypes(user.id, creatorTypes, {
      displayName: payload.display_name,
      businessName: businessName ?? undefined,
      email,
      city,
      countryCode: payload.country_code,
      source: "onboarding",
    });

    revalidatePath("/onboarding");
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    await setOnboardingCompleted(user.id, true);
    const listingPath = getFirstListingPath(role);
    const listingHint =
      role === "workshopgever"
        ? "Profiel opgeslagen. Maak nu je eerste workshop aan."
        : role === "organizer"
          ? "Profiel opgeslagen. Maak nu je eerste evenement aan."
          : "Profiel opgeslagen. Voeg nu je eerste creatie toe.";
    ok(listingPath, listingHint);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/onboarding",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function completeOfferOnboardingAction(): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }
  await setOnboardingCompleted(user.id, true);
  redirect("/dashboard");
}
