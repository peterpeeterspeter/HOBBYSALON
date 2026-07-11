export type AccountRegistrationType = "member" | "creator" | "merchant";

const DEFAULT_DESTINATIONS: Record<AccountRegistrationType, string | null> = {
  member: null,
  creator: "/dashboard/creator",
  merchant: "/dashboard/materials",
};

const REGISTRATION_PATHS: Record<AccountRegistrationType, string> = {
  member: "/register",
  creator: "/register/creator",
  merchant: "/register/merchant",
};

function safePath(path: string | null | undefined): string | null {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
}

export function getSafeInternalPath(
  path: string | null | undefined,
  fallback: string
): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export function getAccountRegistrationHref(
  type: AccountRegistrationType,
  nextPath?: string | null
): string {
  const destination = safePath(nextPath) ?? DEFAULT_DESTINATIONS[type];
  if (!destination) return REGISTRATION_PATHS[type];
  return `${REGISTRATION_PATHS[type]}?next=${encodeURIComponent(destination)}`;
}
