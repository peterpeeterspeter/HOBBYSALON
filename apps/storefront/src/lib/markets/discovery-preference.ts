/**
 * Soft market preference vs hard country filter for discovery listings.
 *
 * Site market → preferred ranking (local physical first; other countries stay).
 * Explicit URL/dialog country → hard filter (only that country).
 */

export type DiscoveryLocatable = {
  country_code?: string | null;
  /** Workshops: in_person | online | hybrid. Online/hybrid are never "local physical". */
  format_type?: string | null;
};

export function normalizeCountryCode(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/** Physical, in-market listing. Online/hybrid and missing country never count as local. */
export function isPhysicalLocalListing(
  item: DiscoveryLocatable,
  preferredCountryCode: string | null | undefined
): boolean {
  const preferred = normalizeCountryCode(preferredCountryCode);
  if (!preferred) return false;

  const format = item.format_type?.trim().toLowerCase() ?? "";
  if (format === "online" || format === "hybrid") return false;

  const country = normalizeCountryCode(item.country_code);
  if (!country) return false;
  return country === preferred;
}

export function matchesHardCountryFilter(
  item: DiscoveryLocatable,
  countryCode: string | null | undefined
): boolean {
  const hard = normalizeCountryCode(countryCode);
  if (!hard) return true;
  return normalizeCountryCode(item.country_code) === hard;
}

export function applyHardCountryFilter<T extends DiscoveryLocatable>(
  items: readonly T[],
  countryCode: string | null | undefined
): T[] {
  const hard = normalizeCountryCode(countryCode);
  if (!hard) return [...items];
  return items.filter((item) => matchesHardCountryFilter(item, hard));
}

/**
 * Stable partition: local physical first, then the rest (other countries,
 * unknown country, online/hybrid). Relative order within each group is kept.
 */
export function rankByPreferredCountry<T extends DiscoveryLocatable>(
  items: readonly T[],
  preferredCountryCode: string | null | undefined
): {
  ranked: T[];
  localCount: number;
  totalCount: number;
} {
  const preferred = normalizeCountryCode(preferredCountryCode);
  if (!preferred) {
    return {
      ranked: [...items],
      localCount: 0,
      totalCount: items.length,
    };
  }

  const local: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (isPhysicalLocalListing(item, preferred)) {
      local.push(item);
    } else {
      rest.push(item);
    }
  }

  return {
    ranked: [...local, ...rest],
    localCount: local.length,
    totalCount: items.length,
  };
}

/** Prefer local rows, then fill from the rest up to `limit` (after `offset`). */
export function takePreferLocalThenRest<T extends DiscoveryLocatable>(
  items: readonly T[],
  preferredCountryCode: string | null | undefined,
  limit: number,
  offset = 0
): {
  page: T[];
  localCount: number;
  totalCount: number;
} {
  const { ranked, localCount, totalCount } = rankByPreferredCountry(
    items,
    preferredCountryCode
  );
  const start = Math.max(0, offset);
  const page =
    typeof limit === "number" && limit > 0
      ? ranked.slice(start, start + limit)
      : start > 0
        ? ranked.slice(start)
        : ranked;
  return { page, localCount, totalCount };
}

/** Merge local-first results with filler, de-duplicated by id, capped at limit. */
export function mergeLocalThenFill<T extends { id: string }>(
  local: readonly T[],
  filler: readonly T[],
  limit: number
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of local) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) return out;
  }
  for (const item of filler) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) return out;
  }
  return out;
}

export const HOME_BE_HERO_TITLE = "Zin om iets moois te maken?";
export const HOME_BE_HERO_INTRO =
  "Vind een creatief uitje, workshop, maker of project in België en Nederland.";
export const HOME_NL_HERO_TITLE =
  "Ontdek creatieve workshops, hobbywinkels en materialen in Nederland";
export const HOME_NL_HERO_INTRO =
  "Vind een creatief uitje, workshop, maker of project in Nederland — Belgisch aanbod blijft ook vindbaar.";

export function homeHeroCopy(marketCode: "BE" | "NL"): {
  title: string;
  intro: string;
} {
  if (marketCode === "NL") {
    return { title: HOME_NL_HERO_TITLE, intro: HOME_NL_HERO_INTRO };
  }
  return { title: HOME_BE_HERO_TITLE, intro: HOME_BE_HERO_INTRO };
}

/** Cache key parts for home-page; marketCode must also be a callback argument. */
export const HOME_PAGE_CACHE_KEY = "home-page-data-v9";

export function homePageCacheArgs(marketCode: "BE" | "NL"): {
  key: string;
  marketCode: "BE" | "NL";
} {
  return { key: HOME_PAGE_CACHE_KEY, marketCode };
}
