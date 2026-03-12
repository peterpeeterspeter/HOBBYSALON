import "server-only";

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
  const candidate = requestedPath?.trim();
  if (!candidate) return fallbackPath;

  const isInternalPath =
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\n") &&
    !candidate.includes("\r");

  return isInternalPath ? candidate : fallbackPath;
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

  const safeDefault = sanitizeNextPath(options.defaultPath, "/dashboard");

  if (!options.userId) {
    return safeDefault;
  }

  const context = await getUserRegistrationContext(options.userId);
  const hasMerchantRole = context.roles.includes("merchant");
  const hasMerchantLink = context.sellerLinks.some(
    (link) => link.sellerType === "merchant"
  );

  if (hasMerchantRole || hasMerchantLink) {
    if (!hasMerchantLink) {
      return `/register/merchant?next=${encodeURIComponent("/dashboard/materials")}`;
    }
    return "/dashboard/materials";
  }

  const hasCreatorRole = context.roles.some((role) =>
    CREATOR_DASHBOARD_ROLES.has(role)
  );
  const hasCreatorLink = context.sellerLinks.some(
    (link) => link.sellerType === "creator"
  );

  if (hasCreatorRole || hasCreatorLink || context.hasCreatorProfile) {
    return "/dashboard/creator";
  }

  return safeDefault;
}
