export const REGISTRATION_DEFAULT_COUNTRY = "BE";

export const REGISTRATION_ALLOWED_INTEREST_TYPES = [
  "workshop",
  "supply",
  "handmade",
  "event",
  "article",
] as const;

export type RegistrationInterestType =
  (typeof REGISTRATION_ALLOWED_INTEREST_TYPES)[number];

export const REGISTRATION_INTEREST_OPTIONS: Array<{
  value: RegistrationInterestType;
  label: string;
  description: string;
}> = [
  {
    value: "workshop",
    label: "Workshops",
    description:
      "Ontdek creatieve workshops en leer iets nieuws bij makers in je buurt.",
  },
  {
    value: "supply",
    label: "Materialen",
    description:
      "Vind wol, stof, klei, papier en andere hobbybenodigdheden.",
  },
  {
    value: "handmade",
    label: "Handmade creaties",
    description: "Ontdek unieke creaties van lokale makers.",
  },
  {
    value: "event",
    label: "Markten & evenementen",
    description:
      "Vind makers markets, hobbybeurzen, creatieve markten en open ateliers.",
  },
  {
    value: "article",
    label: "Tutorials & inspiratie",
    description:
      "Bewaar patronen, projecten, gidsen en creatieve ideeën.",
  },
];

export const REGISTRATION_OFFER_ROLES = [
  "workshopgever",
  "maker",
  "organizer",
  "merchant",
] as const;

export type RegistrationOfferRole =
  (typeof REGISTRATION_OFFER_ROLES)[number];

export const REGISTRATION_OFFER_ROLE_OPTIONS: Array<{
  value: RegistrationOfferRole;
  label: string;
  description: string;
}> = [
  {
    value: "workshopgever",
    label: "Workshopgever",
    description:
      "Maak je eigen profiel, publiceer workshops en ontvang aanvragen van geïnteresseerden.",
  },
  {
    value: "maker",
    label: "Maker",
    description:
      "Toon je creaties en laat hobbyisten ontdekken wat je maakt.",
  },
  {
    value: "organizer",
    label: "Organisator",
    description:
      "Publiceer je markt, beurs of creatief evenement in de Hobbysalon-agenda.",
  },
  {
    value: "merchant",
    label: "Hobbymaterialenverkoper",
    description:
      "Presenteer je winkel en materialen aan een gericht creatief publiek.",
  },
];

/** Preferred hobby domains shown during hobbyist registration. */
export const REGISTRATION_HOBBY_DOMAIN_SLUGS = [
  "diy",
  "pottery",
  "card-making",
  "knitting",
  "scrapbooking",
  "jewelry-making",
  "crochet",
  "sewing",
] as const;

export const REGISTRATION_COUNTRY_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "BE", label: "Belgie" },
  { value: "NL", label: "Nederland" },
];

const OFFER_ROLE_SET = new Set<string>(REGISTRATION_OFFER_ROLES);

export function parseRegistrationOfferRoles(
  values: Array<string | null | undefined>
): RegistrationOfferRole[] {
  const seen = new Set<RegistrationOfferRole>();
  for (const raw of values) {
    const value = raw?.toString().trim().toLowerCase();
    if (!value || !OFFER_ROLE_SET.has(value)) continue;
    seen.add(value as RegistrationOfferRole);
  }
  return REGISTRATION_OFFER_ROLES.filter((role) => seen.has(role));
}

/**
 * Primary offer role for routing, copy, and analytics.
 * Priority: workshopgever → maker → organizer → merchant.
 */
export function resolvePrimaryOfferRole(
  roles: RegistrationOfferRole[]
): RegistrationOfferRole | null {
  if (roles.includes("workshopgever")) return "workshopgever";
  if (roles.includes("maker")) return "maker";
  if (roles.includes("organizer")) return "organizer";
  if (roles.includes("merchant")) return "merchant";
  return null;
}

/**
 * First onboarding path after registration.
 * Paths must stay hash-free (auth next cookie / redirects).
 * Intent is persisted in user_preferences; /onboarding reads from DB.
 */
export function resolveOfferOnboardingPath(
  roles: RegistrationOfferRole[]
): string | null {
  const primary = resolvePrimaryOfferRole(roles);
  if (!primary) return null;
  if (primary === "merchant") return "/register/merchant";
  return "/onboarding";
}

export function getOfferRoleLabel(role: RegistrationOfferRole): string {
  return (
    REGISTRATION_OFFER_ROLE_OPTIONS.find((option) => option.value === role)
      ?.label ?? role
  );
}

export function getOnboardingProfileCopy(role: RegistrationOfferRole): {
  title: string;
  lead: string;
  cta: string;
  photoLabel: string;
} {
  if (role === "workshopgever") {
    return {
      title: "Jouw workshopgeverprofiel",
      lead: "Dit zien bezoekers wanneer ze jouw workshops bekijken.",
      cta: "Workshopgeverprofiel instellen",
      photoLabel: "Foto of logo",
    };
  }
  if (role === "organizer") {
    return {
      title: "Jouw organisatorprofiel",
      lead: "Toon wie achter je markten en evenementen zit.",
      cta: "Organisatorprofiel instellen",
      photoLabel: "Foto of logo",
    };
  }
  if (role === "merchant") {
    return {
      title: "Jouw verkopersprofiel",
      lead: "Presenteer je winkel aan hobbyisten.",
      cta: "Verkopersprofiel instellen",
      photoLabel: "Foto of logo",
    };
  }
  return {
    title: "Jouw makerprofiel",
    lead: "Toon wie je bent en wat je maakt.",
    cta: "Makerprofiel instellen",
    photoLabel: "Foto of logo",
  };
}
