import "server-only";
import { sanitizeInternalRedirect } from "./safe-redirect";

import {
  getUserRegistrationContext,
  type UserAccountRole,
} from "@/lib/platform/queries/user-registration";

const CREATOR_DASHBOARD_ROLES = new Set<UserAccountRole>([
  "creator",
  "workshop_host",
  "organizer",
]);

export function sanitizeNextPath(
  requestedPath: string | null | undefined,
  fallbackPath: string
): string {
  return sanitizeInternalRedirect(requestedPath) ??
    (fallbackPath === "" ? "" : sanitizeInternalRedirect(fallbackPath) ?? "/profile");
}

export async function resolvePostAuthRedirectPath(options: {
  userId: string | null | undefined;
  requestedNextPath: string | null | undefined;
  defaultPath: string;
}): Promise<string> {
  const safeRequested = sanitizeNextPath(options.requestedNextPath, "");
  if (safeRequested) {
    return safeRequested;
  }

  const safeDefault = sanitizeNextPath(options.defaultPath, "/profile");

  if (!options.userId) {
    return safeDefault;
  }

  const context = await getUserRegistrationContext(options.userId);
  const hasMerchantRole = context.roles.includes("merchant");
  const hasMerchantLink = context.sellerLinks.some(
    (link) => link.sellerType === "merchant"
  );

  // Approved merchants land on the creator dashboard. Verkopersportaal is a
  // deliberate handoff from /dashboard/verkoper, not an automatic login target.
  if (hasMerchantRole || hasMerchantLink) {
    return "/dashboard";
  }

  const primaryOffer = context.preference?.primaryOfferRole;
  const offerRoles = context.preference?.offerRoles ?? [];
  const needsOfferOnboarding =
    !context.preference?.onboardingCompleted &&
    (primaryOffer || offerRoles.length > 0) &&
    primaryOffer !== "merchant";

  if (needsOfferOnboarding) {
    return "/onboarding";
  }

  if (primaryOffer === "merchant" && !hasMerchantRole && !hasMerchantLink) {
    return "/register/merchant";
  }

  const hasCreatorRole = context.roles.some((role) =>
    CREATOR_DASHBOARD_ROLES.has(role)
  );
  const hasCreatorLink = context.sellerLinks.some(
    (link) => link.sellerType === "creator"
  );

  if (hasCreatorRole || hasCreatorLink || context.hasCreatorProfile) {
    return "/profile";
  }

  return safeDefault;
}
