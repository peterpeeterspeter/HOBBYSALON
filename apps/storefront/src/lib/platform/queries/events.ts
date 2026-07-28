import { createPlatformClient } from "../client";
import type { Event } from "@/types/platform";

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function getEventLocalityScore(
  event: Event,
  preferredCity: string | null,
  preferredCountryCode: string | null
): number {
  let score = 0;
  const eventCity = normalizeLocationValue(event.city);
  const eventCountry = normalizeLocationValue(event.country_code);

  if (preferredCity && eventCity) {
    if (eventCity === preferredCity) {
      score += 100;
    } else if (eventCity.includes(preferredCity) || preferredCity.includes(eventCity)) {
      score += 60;
    }
  }

  if (preferredCountryCode && eventCountry === preferredCountryCode) {
    score += 25;
  }

  if (event.is_featured) {
    score += 5;
  }

  return score;
}

export async function getEventById(id: string): Promise<Event | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Event;
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Event;
}

export async function listEvents(filters?: {
  domain_id?: string;
  event_type?: string;
  city?: string;
  country_code?: string;
  preferred_city?: string;
  preferred_country_code?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}): Promise<Event[]> {
  const supabase = createPlatformClient();
  let domainEventIds: string[] | null = null;

  if (filters?.domain_id) {
    const { data: edData, error: domainError } = await supabase
      .from("event_domains")
      .select("event_id")
      .eq("domain_id", filters.domain_id);

    if (domainError) return [];
    domainEventIds = [...new Set((edData ?? []).map((row) => row.event_id))];
    if (domainEventIds.length === 0) return [];
  }

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("starts_at", { ascending: true });

  if (domainEventIds) {
    query = query.in("id", domainEventIds);
  }

  if (filters?.from_date) {
    query = query.gte("starts_at", filters.from_date);
  }
  if (filters?.to_date) {
    query = query.lte("starts_at", filters.to_date);
  }
  if (filters?.event_type) {
    query = query.eq("event_type", filters.event_type);
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

  const { data, error } = await query;
  if (error) return [];

  const events = (data ?? []) as Event[];
  const preferredCity = normalizeLocationValue(filters?.preferred_city);
  const preferredCountryCode = normalizeLocationValue(filters?.preferred_country_code);
  if (!preferredCity && !preferredCountryCode) {
    return events;
  }

  if (filters?.city || filters?.country_code) {
    return events;
  }

  return [...events].sort((a, b) => {
    const scoreDelta =
      getEventLocalityScore(b, preferredCity, preferredCountryCode) -
      getEventLocalityScore(a, preferredCity, preferredCountryCode);
    if (scoreDelta !== 0) return scoreDelta;
    return a.starts_at.localeCompare(b.starts_at);
  });
}

export async function listEventsByIds(ids: string[]): Promise<Event[]> {
  if (!ids.length) return [];

  const uniqueIds = [...new Set(ids)];
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("id", uniqueIds)
    .eq("is_active", true);

  if (error || !data) return [];

  const byId = new Map((data as Event[]).map((event) => [event.id, event]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((event): event is Event => !!event);
}

export async function listEventsByCreator(creatorId: string): Promise<Event[]> {
  const participations = await listCreatorEventParticipations(creatorId);
  return participations.map((row) => row.event);
}

export type CreatorEventParticipation = {
  event: Event;
  /** null when the creator only organizes or is linked via entity_links elsewhere */
  role: string | null;
  source: "organizer" | "participant";
};

export async function listCreatorEventParticipations(
  creatorId: string
): Promise<CreatorEventParticipation[]> {
  const supabase = createPlatformClient();

  const [organizedResult, participationResult] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("organizer_creator_id", creatorId)
      .eq("is_active", true)
      .order("starts_at", { ascending: true }),
    supabase
      .from("event_creators")
      .select("event_id, role")
      .eq("creator_id", creatorId),
  ]);

  const organizedEvents = (organizedResult.data ?? []) as Event[];
  const participationRows = (participationResult.data ?? []) as Array<{
    event_id: string;
    role: string;
  }>;
  const participationIds = [...new Set(participationRows.map((row) => row.event_id))];

  const roleByEventId = new Map<string, string>();
  for (const row of participationRows) {
    const current = roleByEventId.get(row.event_id);
    if (!current || row.role === "vendor") {
      roleByEventId.set(row.event_id, row.role);
    }
  }

  let participationEvents: Event[] = [];
  if (participationIds.length > 0) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("id", participationIds)
      .eq("is_active", true)
      .order("starts_at", { ascending: true });
    if (!error) {
      participationEvents = (data ?? []) as Event[];
    }
  }

  const byId = new Map<string, CreatorEventParticipation>();
  for (const event of organizedEvents) {
    byId.set(event.id, {
      event,
      role: roleByEventId.get(event.id) ?? null,
      source: "organizer",
    });
  }
  for (const event of participationEvents) {
    const existing = byId.get(event.id);
    if (existing) {
      if (!existing.role) {
        existing.role = roleByEventId.get(event.id) ?? null;
      }
      continue;
    }
    byId.set(event.id, {
      event,
      role: roleByEventId.get(event.id) ?? null,
      source: "participant",
    });
  }

  const now = Date.now();
  return Array.from(byId.values()).sort((a, b) => {
    const aUpcoming = new Date(a.event.starts_at).getTime() >= now ? 0 : 1;
    const bUpcoming = new Date(b.event.starts_at).getTime() >= now ? 0 : 1;
    if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
    return a.event.starts_at.localeCompare(b.event.starts_at);
  });
}
