export type AccountRegistrationType =
  | "member"
  | "aanbieder"
  | "creator"
  | "maker"
  | "merchant"
  | "workshopgever"
  | "organizer";

// Offer roles get no forced destination: registerAction then routes them
// through /onboarding (profile, then first listing). Merchants go to /dashboard.
const DEFAULT_DESTINATIONS: Record<AccountRegistrationType, string | null> = {
  member: null,
  aanbieder: null,
  creator: null,
  maker: null,
  workshopgever: null,
  organizer: null,
  merchant: "/dashboard",
};

const REGISTRATION_PATHS: Record<AccountRegistrationType, string> = {
  member: "/register",
  aanbieder: "/register/aanbieden",
  creator: "/register/creator",
  maker: "/register/creator?focus=maker",
  merchant: "/register/merchant",
  workshopgever: "/register/creator?focus=workshopgever",
  organizer: "/register/creator?focus=organizer",
};

export type OfferRoleParam = "workshopgever" | "maker" | "organizer" | "merchant";

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

/** Maps ?focus= values (Dutch or English) to an offer role. */
export function parseOfferRoleParam(
  value: string | null | undefined
): OfferRoleParam | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (v === "workshopgever") return "workshopgever";
  if (v === "maker" || v === "creator") return "maker";
  if (v === "organizer" || v === "organisator") return "organizer";
  if (v === "merchant" || v === "verkoper") return "merchant";
  return null;
}

/**
 * Old campaign links: /register?intent=offer&focus=…
 * Returns where to send them, or null to show the plain hobbyist form.
 */
export function resolveLegacyRegisterRedirect(input: {
  intent?: string;
  focus?: string;
  next?: string | null;
}): string | null {
  const role = parseOfferRoleParam(input.focus);
  if (role) return getAccountRegistrationHref(role, input.next);
  const intent = input.intent?.trim().toLowerCase();
  if (intent === "offer" || intent === "aanbieden" || input.focus) {
    return getAccountRegistrationHref("aanbieder", input.next);
  }
  return null;
}
