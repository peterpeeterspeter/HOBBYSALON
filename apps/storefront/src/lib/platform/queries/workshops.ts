import { createPlatformClient } from "../client";
import type { Workshop } from "@/types/platform";
import {
  computeRankingScore,
  getActiveBoostScoresForEntities,
} from "../ranking";
import { brusselsDayRangeToUtcIso } from "../workshop-taxonomy";

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
