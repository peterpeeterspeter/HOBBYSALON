import {
  REGISTRATION_OFFER_ROLE_OPTIONS,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";
import {
  hasPendingRoleRequest,
  type PrivilegedRole,
} from "@/lib/auth/role-request-status";
import type { UserAccountRole } from "@/lib/platform/queries/user-registration";

export type RoleUpgradeCandidate = {
  role: RegistrationOfferRole;
  label: string;
  description: string;
  /** Creator offer roles use a server action; merchant uses a link. */
  kind: "creator_onboarding" | "merchant";
};

type ListMissingOfferUpgradesInput = {
  roles: UserAccountRole[];
  creatorTypes?: string[] | null;
  hasCreatorProfile: boolean;
  pendingRoleRequests: Array<{ role: PrivilegedRole; status: string }>;
  /**
   * When the user already has a creator profile, creator-type roles are managed
   * via Account checkboxes — only merchant remains as an upgrade CTA.
   */
  merchantOnly?: boolean;
};

function hasCreatorType(
  creatorTypes: string[] | null | undefined,
  type: string
): boolean {
  return (creatorTypes ?? []).some(
    (value) => value.toLowerCase() === type.toLowerCase()
  );
}

export function isOfferRoleCovered(
  role: RegistrationOfferRole,
  input: Omit<ListMissingOfferUpgradesInput, "merchantOnly">
): boolean {
  const { roles, creatorTypes, hasCreatorProfile, pendingRoleRequests } = input;

  if (role === "maker") {
    return (
      hasCreatorProfile ||
      roles.includes("creator") ||
      hasCreatorType(creatorTypes, "maker")
    );
  }

  if (role === "workshopgever") {
    return (
      roles.includes("workshop_host") ||
      hasCreatorType(creatorTypes, "workshopgever") ||
      hasPendingRoleRequest(pendingRoleRequests, "workshop_host")
    );
  }

  if (role === "organizer") {
    return (
      roles.includes("organizer") ||
      hasCreatorType(creatorTypes, "organizer") ||
      hasPendingRoleRequest(pendingRoleRequests, "organizer")
    );
  }

  // merchant
  return (
    roles.includes("merchant") ||
    hasPendingRoleRequest(pendingRoleRequests, "merchant")
  );
}

/** Map saved creator_types back to registration offer roles for intent sync. */
export function creatorTypesToOfferRoles(
  creatorTypes: string[] | null | undefined
): RegistrationOfferRole[] {
  const roles = new Set<RegistrationOfferRole>();
  for (const raw of creatorTypes ?? []) {
    const type = raw.toLowerCase();
    if (type === "workshopgever") roles.add("workshopgever");
    else if (type === "organizer") roles.add("organizer");
    else if (type === "maker" || type === "supplier" || type === "content_creator") {
      roles.add("maker");
    }
  }
  return Array.from(roles);
}

export function listMissingOfferUpgrades(
  input: ListMissingOfferUpgradesInput
): RoleUpgradeCandidate[] {
  const merchantOnly = input.merchantOnly ?? input.hasCreatorProfile;

  return REGISTRATION_OFFER_ROLE_OPTIONS.filter((option) => {
    if (merchantOnly && option.value !== "merchant") return false;
    return !isOfferRoleCovered(option.value, input);
  }).map((option) => ({
    role: option.value,
    label: option.label,
    description: option.description,
    kind: option.value === "merchant" ? "merchant" : "creator_onboarding",
  }));
}
