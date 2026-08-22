import "server-only";

import {
  getOnboardingProfileCopy,
  resolveOfferOnboardingPath,
  resolvePrimaryOfferRole,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";
import type { UserRegistrationContext } from "@/lib/platform/queries/user-registration";

export type OnboardingStep = "profile" | "first_listing" | "success" | "done";

export function resolveOnboardingRole(
  context: UserRegistrationContext,
  bootstrapRole?: string | null
): RegistrationOfferRole | null {
  const fromDb =
    context.preference?.primaryOfferRole ??
    resolvePrimaryOfferRole(context.preference?.offerRoles ?? []);
  if (fromDb) return fromDb;

  if (!bootstrapRole) return null;
  const cleaned = bootstrapRole.trim().toLowerCase();
  if (
    cleaned === "workshopgever" ||
    cleaned === "maker" ||
    cleaned === "organizer" ||
    cleaned === "merchant"
  ) {
    return cleaned;
  }
  return null;
}

/** Where to create the first listing after the profile step — real dashboard forms, no thin duplicate. */
export function getFirstListingPath(role: RegistrationOfferRole): string {
  return getPublishPath(role);
}

export function getPublishPath(role: RegistrationOfferRole): string {
  if (role === "workshopgever") return "/dashboard/workshops";
  if (role === "organizer") return "/dashboard/events";
  if (role === "maker") return "/dashboard/products";
  return "/dashboard/verkoper";
}

export function getRoleStatusLabel(input: {
  role: RegistrationOfferRole;
  hasCreatorProfile: boolean;
  hasApprovedRole: boolean;
  hasPendingRequest: boolean;
  hasDraftListing: boolean;
  hasPublishedListing: boolean;
}): string {
  if (input.hasPublishedListing) return "Actief";
  if (input.hasApprovedRole) return "Goedgekeurd";
  if (input.hasPendingRequest || input.hasDraftListing) return "In beoordeling";
  if (input.hasCreatorProfile) return "Concept";
  return "Nog te starten";
}

export function getConfirmReadyCopy(role: RegistrationOfferRole | null): {
  title: string;
  lead: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
} {
  if (!role) {
    return {
      title: "Je account is klaar",
      lead: "Ontdek workshops, makers en inspiratie op Hobbysalon.",
      primaryHref: "/profile",
      primaryLabel: "Naar Mijn Hobbysalon",
      secondaryHref: "/",
      secondaryLabel: "Begin met ontdekken",
    };
  }

  if (role === "merchant") {
    return {
      title: "Je account is klaar",
      lead: "Nog één stap om materialen aan te bieden.",
      primaryHref: "/register/merchant",
      primaryLabel: "Verkopersprofiel instellen",
      secondaryHref: "/profile",
      secondaryLabel: "Dit later doen",
    };
  }

  const copy = getOnboardingProfileCopy(role);
  return {
    title: "Je account is klaar",
    lead: `Nog één stap om je ${copy.title.toLowerCase().replace("jouw ", "")} af te ronden.`,
    primaryHref: resolveOfferOnboardingPath([role]) ?? "/onboarding",
    primaryLabel: copy.cta,
    secondaryHref: "/profile",
    secondaryLabel: "Dit later doen",
  };
}
