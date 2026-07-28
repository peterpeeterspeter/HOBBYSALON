import { createPlatformClient } from "../client";
import type { Workshop } from "@/types/platform";
import {
  computeRankingScore,
  getActiveBoostScoresForEntities,
} from "../ranking";
import { brusselsDayRangeToUtcIso } from "../workshop-taxonomy";
import {
  pickNextSessionByWorkshop,
  sanitizeAgendaSearchQuery,
  workshopPassesPlaceAndFormat,
  type WorkshopNextSession,
} from "@/lib/workshops/workshop-discovery-helpers";

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function getWorkshopLocalityScore(
  workshop: Workshop,
  preferredCity: string | null,
  preferredCountryCode: string | null
): number {
  let score = 0;
  const workshopCity = normalizeLocationValue(workshop.city);
  const workshopCountry = normalizeLocationValue(workshop.country_code);

  if (preferredCity && workshopCity) {
    if (workshopCity === preferredCity) {
      score += 100;
    } else if (
      workshopCity.includes(preferredCity) ||
      preferredCity.includes(workshopCity)
    ) {
      score += 60;
    }
  }

  if (preferredCountryCode && workshopCountry === preferredCountryCode) {
    score += 25;
  }
  if (workshop.is_featured) {
    score += 8;
  }

  return score;
}

async function sortWorkshopsWithBoosts(workshops: Workshop[]): Promise<Workshop[]> {
  if (workshops.length === 0) return workshops;
  const boostScores = await getActiveBoostScoresForEntities(
    "workshop",
    workshops.map((workshop) => workshop.id)
  );

  return [...workshops].sort((a, b) => {
    const scoreA = computeRankingScore({
      isFeatured: a.is_featured,
      boostScore: boostScores.get(a.id),
    });
    const scoreB = computeRankingScore({
      isFeatured: b.is_featured,
      boostScore: boostScores.get(b.id),
    });
    return scoreB - scoreA;
  });
}

function sortWorkshopsByLocalPreference(
  workshops: Workshop[],
  preferredCity: string | null | undefined,
  preferredCountryCode: string | null | undefined
): Workshop[] {
  const normalizedCity = normalizeLocationValue(preferredCity);
  const normalizedCountry = normalizeLocationValue(preferredCountryCode);
  if (!normalizedCity && !normalizedCountry) return workshops;

  return [...workshops].sort((a, b) => {
    const scoreDelta =
      getWorkshopLocalityScore(b, normalizedCity, normalizedCountry) -
      getWorkshopLocalityScore(a, normalizedCity, normalizedCountry);
    if (scoreDelta !== 0) return scoreDelta;
    return Number(b.is_featured) - Number(a.is_featured);
  });
}

export async function getWorkshopBySlug(slug: string): Promise<Workshop | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Workshop;
}

export async function getWorkshopById(id: string): Promise<Workshop | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Workshop;
}

export async function listWorkshopsByDomain(
  domainId: string,
  options?: {
    city?: string;
    country_code?: string;
    preferred_city?: string;
    preferred_country_code?: string;
  }
): Promise<Workshop[]> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("workshops")
    .select("*")
    .eq("domain_id", domainId)
    .eq("is_active", true)
    .order("is_featured", { ascending: false });

  if (options?.city) {
    query = query.ilike("city", `%${options.city}%`);
  }
  if (options?.country_code) {
    query = query.eq("country_code", options.country_code.toUpperCase());
  }

  const { data, error } = await query;

  if (error) return [];
  const workshops = (data ?? []) as Workshop[];
  const ranked = await sortWorkshopsWithBoosts(workshops);
  if (options?.city || options?.country_code) {
    return ranked;
  }
  return sortWorkshopsByLocalPreference(
    ranked,
    options?.preferred_city,
    options?.preferred_country_code
  );
}

export async function listWorkshopsByCreator(creatorId: string): Promise<Workshop[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("is_active", true)
    .order("is_featured", { ascending: false });

  if (error) return [];
  return (data ?? []) as Workshop[];
}

export async function listAllWorkshops(filters?: {
  q?: string;
  domain_id?: string;
  category_id?: string;
  difficulty_level?: string;
  format_type?: string;
  offer_type?: string;
  audience?: string[];
  age?: string[];
  language?: string[];
  price_min_cents?: number;
  price_max_cents?: number;
  from_date?: string;
  to_date?: string;
  city?: string;
  country_code?: string;
  preferred_city?: string;
  preferred_country_code?: string;
  limit?: number;
}): Promise<Workshop[]> {
  const supabase = createPlatformClient();

  let dateScopedIds: string[] | null = null;
  const { fromIso, toIsoExclusive } = brusselsDayRangeToUtcIso({
    fromDate: filters?.from_date,
    toDate: filters?.to_date,
  });
  if (fromIso || toIsoExclusive) {
    let sessionQuery = supabase
      .from("workshop_sessions")
      .select("workshop_id")
      .eq("is_cancelled", false);
    if (fromIso) {
      sessionQuery = sessionQuery.gte("starts_at", fromIso);
    }
    if (toIsoExclusive) {
      sessionQuery = sessionQuery.lt("starts_at", toIsoExclusive);
    }
    const { data: sessions, error: sessionError } = await sessionQuery;
    if (sessionError) return [];
    dateScopedIds = [
      ...new Set((sessions ?? []).map((row) => row.workshop_id as string)),
    ];
    if (dateScopedIds.length === 0) return [];
  }

  let query = supabase
    .from("workshops")
    .select("*")
    .eq("is_active", true);

  const term = filters?.q?.trim();
  if (term && term.length >= 2) {
    // Neutralise characters that would break PostgREST `or(...)` filters.
    const like = `%${term.replace(/[%,()]/g, " ")}%`;
    query = query.or(`title.ilike.${like},short_description.ilike.${like}`);
  }
  if (filters?.domain_id) {
    query = query.eq("domain_id", filters.domain_id);
  }
  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id);
  }
  if (filters?.difficulty_level) {
    query = query.eq("difficulty_level", filters.difficulty_level);
  }
  if (filters?.format_type) {
    query = query.eq("format_type", filters.format_type);
  }
  if (filters?.offer_type) {
    query = query.eq("offer_type", filters.offer_type);
  }
  if (filters?.audience?.length) {
    query = query.overlaps("audience_types", filters.audience);
  }
  if (filters?.age?.length) {
    query = query.overlaps("age_groups", filters.age);
  }
  if (filters?.language?.length) {
    query = query.overlaps("languages", filters.language);
  }
  if (typeof filters?.price_min_cents === "number") {
    query = query.gte("price_cents", filters.price_min_cents);
  }
  if (typeof filters?.price_max_cents === "number") {
    query = query.lte("price_cents", filters.price_max_cents);
  }
  if (dateScopedIds) {
    query = query.in("id", dateScopedIds);
  }
  if (filters?.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }
  if (filters?.country_code) {
    query = query.eq("country_code", filters.country_code.toUpperCase());
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query.order("is_featured", { ascending: false });

  if (error) return [];
  const workshops = (data ?? []) as Workshop[];
  const ranked = await sortWorkshopsWithBoosts(workshops);
  if (filters?.city || filters?.country_code) {
    return ranked;
  }
  return sortWorkshopsByLocalPreference(
    ranked,
    filters?.preferred_city,
    filters?.preferred_country_code
  );
}

export async function listWorkshopsByIds(ids: string[]): Promise<Workshop[]> {
  if (!ids.length) return [];

  const uniqueIds = [...new Set(ids)];
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .in("id", uniqueIds)
    .eq("is_active", true);

  if (error || !data) return [];

  const byId = new Map((data as Workshop[]).map((workshop) => [workshop.id, workshop]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((workshop): workshop is Workshop => !!workshop);
}

export async function listUpcomingWorkshops(
  limit = 8,
  options?: {
    preferred_city?: string;
    preferred_country_code?: string;
  }
): Promise<Workshop[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshop_sessions")
    .select("workshop_id")
    .eq("is_cancelled", false)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit * 3);

  if (error || !data) return [];

  const workshopIds = [...new Set((data ?? []).map((row) => row.workshop_id))].slice(
    0,
    limit
  );
  const workshops = await listWorkshopsByIds(workshopIds);
  return sortWorkshopsByLocalPreference(
    workshops,
    options?.preferred_city,
    options?.preferred_country_code
  ).slice(0, limit);
}

export type { WorkshopNextSession };
export type WorkshopDiscoveryItem = Workshop & {
  nextSession: WorkshopNextSession;
};

export type ListDiscoveryWorkshopsFilters = {
  q?: string;
  place?: string;
  domain_id?: string;
  category_id?: string;
  difficulty_level?: string;
  format_type?: string;
  offer_type?: string;
  audience?: string[];
  age?: string[];
  language?: string[];
  price_min_cents?: number;
  price_max_cents?: number;
  /** Inclusive ISO range for session overlap (from agenda helpers). */
  from_iso?: string;
  to_iso?: string;
  country_code?: string;
  preferred_city?: string;
  preferred_country_code?: string;
  /** soon | near | price_asc — default soon */
  sort?: "soon" | "near" | "price_asc";
  limit?: number;
  offset?: number;
};

/**
 * Workshop discovery listing: date-scoped nextSession per workshop,
 * then filter, sort, true totalCount, paginate.
 */
export async function listDiscoveryWorkshops(
  filters?: ListDiscoveryWorkshopsFilters
): Promise<{
  workshops: WorkshopDiscoveryItem[];
  totalCount: number;
  domainIds: string[];
}> {
  const supabase = createPlatformClient();
  const nowIso = new Date().toISOString();
  const range =
    filters?.from_iso && filters?.to_iso
      ? { from: filters.from_iso, to: filters.to_iso }
      : filters?.from_iso
        ? { from: filters.from_iso, to: "9999-12-31T23:59:59.999Z" }
        : filters?.to_iso
          ? { from: "1970-01-01T00:00:00.000Z", to: filters.to_iso }
          : null;

  let sessionQuery = supabase
    .from("workshop_sessions")
    .select("id, workshop_id, starts_at, ends_at, is_cancelled")
    .eq("is_cancelled", false)
    .limit(2000);

  // Soft DB bound: avoid ancient history when no range.
  if (range) {
    sessionQuery = sessionQuery.lte("starts_at", range.to);
  } else {
    const softFrom = new Date(
      Date.now() - 366 * 24 * 60 * 60 * 1000
    ).toISOString();
    sessionQuery = sessionQuery.gte("starts_at", softFrom);
  }

  const { data: sessionRows, error: sessionError } = await sessionQuery;
  if (sessionError || !sessionRows?.length) {
    return { workshops: [], totalCount: 0, domainIds: [] };
  }

  const nextByWorkshop = pickNextSessionByWorkshop(
    sessionRows as Array<{
      id: string;
      workshop_id: string;
      starts_at: string;
      ends_at: string | null;
      is_cancelled?: boolean;
    }>,
    { nowIso, range }
  );

  if (nextByWorkshop.size === 0) {
    return { workshops: [], totalCount: 0, domainIds: [] };
  }

  const workshopIds = [...nextByWorkshop.keys()];
  const workshops = await listWorkshopsByIds(workshopIds);
  const searchTerm = sanitizeAgendaSearchQuery(filters?.q);
  const place = filters?.place?.trim() || null;

  let filtered = workshops.filter((workshop) => {
    if (
      filters?.difficulty_level &&
      workshop.difficulty_level !== filters.difficulty_level
    ) {
      return false;
    }
    if (
      !workshopPassesPlaceAndFormat({
        workshop,
        place,
        formatFilter: filters?.format_type,
      })
    ) {
      return false;
    }
    if (filters?.offer_type && workshop.offer_type !== filters.offer_type) {
      return false;
    }
    if (filters?.audience?.length) {
      const types = workshop.audience_types ?? [];
      if (!filters.audience.some((a) => types.includes(a))) return false;
    }
    if (filters?.age?.length) {
      const ages = workshop.age_groups ?? [];
      if (!filters.age.some((a) => ages.includes(a))) return false;
    }
    if (filters?.language?.length) {
      const langs = workshop.languages ?? [];
      if (!filters.language.some((l) => langs.includes(l))) return false;
    }
    if (
      typeof filters?.price_min_cents === "number" &&
      workshop.price_cents < filters.price_min_cents
    ) {
      return false;
    }
    if (
      typeof filters?.price_max_cents === "number" &&
      workshop.price_cents > filters.price_max_cents
    ) {
      return false;
    }
    if (
      filters?.country_code &&
      workshop.country_code?.toUpperCase() !==
        filters.country_code.toUpperCase()
    ) {
      return false;
    }
    if (searchTerm) {
      const hay = [workshop.title, workshop.short_description, workshop.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  });

  // Hobby chips: domains in place+date (+other) context, before domain/category.
  const domainIds = [
    ...new Set(
      filtered
        .map((w) => w.domain_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (filters?.domain_id) {
    filtered = filtered.filter((w) => w.domain_id === filters.domain_id);
  }
  if (filters?.category_id) {
    filtered = filtered.filter((w) => w.category_id === filters.category_id);
  }

  const items: WorkshopDiscoveryItem[] = filtered
    .map((workshop) => {
      const nextSession = nextByWorkshop.get(workshop.id);
      if (!nextSession) return null;
      return { ...workshop, nextSession };
    })
    .filter((item): item is WorkshopDiscoveryItem => item != null);

  const sort = filters?.sort ?? "soon";
  if (sort === "price_asc") {
    items.sort(
      (a, b) =>
        a.price_cents - b.price_cents ||
        a.nextSession.startsAt.localeCompare(b.nextSession.startsAt)
    );
  } else if (sort === "near") {
    const preferredCity = normalizeLocationValue(
      filters?.preferred_city ?? place
    );
    const preferredCountry = normalizeLocationValue(
      filters?.preferred_country_code
    );
    items.sort((a, b) => {
      const scoreDelta =
        getWorkshopLocalityScore(b, preferredCity, preferredCountry) -
        getWorkshopLocalityScore(a, preferredCity, preferredCountry);
      if (scoreDelta !== 0) return scoreDelta;
      return a.nextSession.startsAt.localeCompare(b.nextSession.startsAt);
    });
  } else {
    items.sort((a, b) =>
      a.nextSession.startsAt.localeCompare(b.nextSession.startsAt)
    );
  }

  const totalCount = items.length;
  const offset = Math.max(0, filters?.offset ?? 0);
  const limit = filters?.limit;
  const page =
    typeof limit === "number" && limit > 0
      ? items.slice(offset, offset + limit)
      : offset > 0
        ? items.slice(offset)
        : items;

  return { workshops: page, totalCount, domainIds };
}
