/**
 * Creators directory helpers: intent filters, offer sentences, photos, chips, place coverage.
 */

import { sanitizeAgendaSearchQuery } from "@/lib/agenda/agenda-helpers";

export { sanitizeAgendaSearchQuery };

export type CreatorIntent =
  | "workshops"
  | "handmade"
  | "materials"
  | "markets";

export const CREATOR_INTENT_CHIPS: Array<{
  intent: CreatorIntent;
  label: string;
}> = [
  { intent: "workshops", label: "Geeft workshops" },
  { intent: "handmade", label: "Handgemaakte creaties" },
  { intent: "materials", label: "Materialen" },
  { intent: "markets", label: "Op een hobbymarkt" },
];

export type CreatorIntentFilter =
  | { kind: "type"; creatorType: string }
  | { kind: "markets" };

/** Map visitor intent (+ legacy creator_type) to query filter. */
export function resolveCreatorIntentFilter(
  intent: string | null | undefined,
  legacyCreatorType?: string | null
): CreatorIntentFilter | null {
  const value = (intent ?? "").trim().toLowerCase();
  if (value === "workshops") {
    return { kind: "type", creatorType: "workshopgever" };
  }
  if (value === "handmade") {
    return { kind: "type", creatorType: "maker" };
  }
  if (value === "materials") {
    return { kind: "type", creatorType: "supplier" };
  }
  if (value === "markets") {
    return { kind: "markets" };
  }

  const legacy = (legacyCreatorType ?? "").trim().toLowerCase();
  if (
    legacy === "workshopgever" ||
    legacy === "maker" ||
    legacy === "supplier" ||
    legacy === "content_creator" ||
    legacy === "organizer"
  ) {
    return { kind: "type", creatorType: legacy };
  }
  return null;
}

/**
 * One human sentence, max ~2 intents. No badge stack.
 */
export function formatCreatorOfferSentence(
  creatorTypes: string[] | null | undefined,
  openToMarkets?: boolean | null
): string {
  const types = new Set((creatorTypes ?? []).map((t) => t.toLowerCase()));
  const parts: string[] = [];

  if (types.has("workshopgever")) {
    parts.push("geeft workshops");
  }
  if (types.has("maker")) {
    parts.push("maakt handgemaakte creaties");
  }
  if (types.has("supplier") && parts.length < 2) {
    parts.push("verkoopt materialen");
  }
  if (openToMarkets && parts.length < 2) {
    parts.push("staat op hobbymarkten");
  }
  if (types.has("organizer") && parts.length < 2) {
    parts.push("organiseert events");
  }
  if (types.has("content_creator") && parts.length < 2) {
    parts.push("deelt creatieve content");
  }

  if (parts.length === 0) {
    return "Creatieve maker op Hobbysalon";
  }
  if (parts.length === 1) {
    const p = parts[0]!;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }
  const [a, b] = parts;
  return `${a!.charAt(0).toUpperCase()}${a!.slice(1)} en ${b}`;
}

/** Prefer atelier banner, then avatar. */
export function resolveCreatorCardPhoto(creator: {
  banner_url?: string | null;
  avatar_url?: string | null;
}): string | null {
  const banner = creator.banner_url?.trim();
  if (banner) return banner;
  const avatar = creator.avatar_url?.trim();
  if (avatar) return avatar;
  return null;
}

export function formatCreatorSpecialtyLine(options: {
  domainNames: string[];
  specialtyTags?: string[] | null;
  city?: string | null;
  bio?: string | null;
}): string {
  const tags = (options.specialtyTags ?? []).map((t) => t.trim()).filter(Boolean);
  const domains = options.domainNames.filter(Boolean);
  const specialty =
    tags.length > 0
      ? tags.slice(0, 2).join(" · ")
      : domains.length > 0
        ? domains.slice(0, 2).join(" · ")
        : options.bio?.trim()
          ? options.bio.trim().slice(0, 60)
          : "";
  const city = options.city?.trim();
  if (specialty && city) return `${specialty} · ${city}`;
  if (specialty) return specialty;
  if (city) return city;
  return "";
}

export function resolveHobbyChipDomainIds(options: {
  domainIdsWithCreators: string[];
  selectedDomainId?: string | null;
  allDomainIdsOrdered: string[];
}): string[] {
  const present = new Set(options.domainIdsWithCreators.filter(Boolean));
  if (options.selectedDomainId) {
    present.add(options.selectedDomainId);
  }
  return options.allDomainIdsOrdered.filter((id) => present.has(id));
}

/** Place filter only when enough creators have a city. */
export function hasReliableCreatorPlaceCoverage(
  creators: Array<{ city?: string | null }>,
  threshold = 0.3
): boolean {
  if (creators.length === 0) return false;
  const withCity = creators.filter((c) => Boolean(c.city?.trim())).length;
  return withCity / creators.length >= threshold;
}

export function creatorMatchesSearch(
  creator: {
    display_name: string;
    business_name?: string | null;
    bio?: string | null;
    city?: string | null;
  },
  domainNames: string[],
  q: string
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    creator.display_name,
    creator.business_name ?? "",
    creator.bio ?? "",
    creator.city ?? "",
    ...domainNames,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}
