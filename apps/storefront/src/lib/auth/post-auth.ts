import "server-only";

import {
  getUserAccountRoles,
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

  const roles = await getUserAccountRoles(options.userId);
  if (roles.includes("merchant")) {
    return "/dashboard/materials";
  }

  if (roles.some((role) => CREATOR_DASHBOARD_ROLES.has(role))) {
    return "/dashboard/creator";
  }

  return safeDefault;
}
