export type AccountRegistrationType =
  | "member"
  | "creator"
  | "maker"
  | "merchant"
  | "workshopgever"
  | "organizer";

const DEFAULT_DESTINATIONS: Record<AccountRegistrationType, string | null> = {
  member: null,
  creator: "/profile?tab=profiel",
  maker: "/profile?tab=profiel",
  merchant: "/dashboard",
  workshopgever: "/profile?tab=profiel",
  organizer: "/profile?tab=profiel",
};

const REGISTRATION_PATHS: Record<AccountRegistrationType, string> = {
  member: "/register",
  creator: "/register/creator",
  maker: "/register/creator?focus=maker",
  merchant: "/register/merchant",
  workshopgever: "/register/creator?focus=workshopgever",
  organizer: "/register/creator?focus=organizer",
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
  const basePath = REGISTRATION_PATHS[type];

  if (!destination) return basePath;

  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}next=${encodeURIComponent(destination)}`;
}
