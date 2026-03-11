import { createPlatformClient } from "../client";
import type { Workshop } from "@/types/platform";

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
  if (options?.city || options?.country_code) {
    return workshops;
  }
  return sortWorkshopsByLocalPreference(
    workshops,
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
  domain_id?: string;
  difficulty_level?: string;
  format_type?: string;
  city?: string;
  country_code?: string;
  preferred_city?: string;
  preferred_country_code?: string;
  limit?: number;
}): Promise<Workshop[]> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("workshops")
    .select("*")
    .eq("is_active", true);

  if (filters?.domain_id) {
    query = query.eq("domain_id", filters.domain_id);
  }
  if (filters?.difficulty_level) {
    query = query.eq("difficulty_level", filters.difficulty_level);
  }
  if (filters?.format_type) {
    query = query.eq("format_type", filters.format_type);
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
  if (filters?.city || filters?.country_code) {
    return workshops;
  }
  return sortWorkshopsByLocalPreference(
    workshops,
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
