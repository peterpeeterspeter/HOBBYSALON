import { createPlatformClient } from "../client";
import type { Event } from "@/types/platform";
import {
  eventIsUpcomingOrOngoing,
  eventMatchesPlace,
  eventOverlapsRange,
  sanitizeAgendaSearchQuery,
} from "@/lib/agenda/agenda-helpers";

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function escapeIlikeTerm(value: string): string {
  return value.replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim();
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

export type ListEventsFilters = {
  domain_id?: string;
  event_type?: string;
  city?: string;
  country_code?: string;
  preferred_city?: string;
  preferred_country_code?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
};

export type ListAgendaEventsFilters = {
  domain_id?: string;
  event_type?: string;
  /** Place filter (city / location_name). Prefer over legacy `city`. */
  near?: string;
  city?: string;
  country_code?: string;
  preferred_city?: string;
  preferred_country_code?: string;
  /** Inclusive range start (ISO). Overlap-aware with ends_at. */
  from_date?: string;
  /** Inclusive range end (ISO). Overlap-aware with ends_at. */
  to_date?: string;
  q?: string;
  /** Default true: hide past events (ends_at ?? starts_at < now). */
  upcoming_only?: boolean;
  limit?: number;
  offset?: number;
};

async function resolveDomainEventIds(
  domainId: string | undefined
): Promise<string[] | null | "empty"> {
  if (!domainId) return null;
  const supabase = createPlatformClient();
  const { data: edData, error: domainError } = await supabase
    .from("event_domains")
    .select("event_id")
    .eq("domain_id", domainId);

  if (domainError) return "empty";
  const ids = [...new Set((edData ?? []).map((row) => row.event_id))];
  return ids.length === 0 ? "empty" : ids;
}

/**
 * Agenda listing with true total count, sanitized search, place match,
 * overlap-aware date ranges, and upcoming-only by default.
 */
export async function listAgendaEvents(
  filters?: ListAgendaEventsFilters
): Promise<{ events: Event[]; totalCount: number }> {
  const domainEventIds = await resolveDomainEventIds(filters?.domain_id);
  if (domainEventIds === "empty") {
    return { events: [], totalCount: 0 };
  }

  const supabase = createPlatformClient();
  const upcomingOnly = filters?.upcoming_only !== false;
  const nowIso = new Date().toISOString();
  const searchTerm = sanitizeAgendaSearchQuery(filters?.q);
  const place = (filters?.near ?? filters?.city)?.trim() || null;

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("starts_at", { ascending: true })
    .limit(500);

  if (domainEventIds) {
    query = query.in("id", domainEventIds);
  }
  if (filters?.event_type) {
    query = query.eq("event_type", filters.event_type);
  }
  if (filters?.country_code) {
    query = query.eq("country_code", filters.country_code.toUpperCase());
  }
  // Soft window: avoid loading ancient history; refine upcoming/overlap in JS.
  if (upcomingOnly) {
    const softFrom = new Date(
      Date.now() - 366 * 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("starts_at", softFrom);
  }
  if (filters?.to_date) {
    query = query.lte("starts_at", filters.to_date);
  }

  const { data, error } = await query;
  if (error) return { events: [], totalCount: 0 };

  let events = (data ?? []) as Event[];

  if (upcomingOnly) {
    events = events.filter((event) => eventIsUpcomingOrOngoing(event, nowIso));
  }

  if (filters?.from_date || filters?.to_date) {
    const rangeFrom = filters.from_date ?? "1970-01-01T00:00:00.000Z";
    const rangeTo = filters.to_date ?? "9999-12-31T23:59:59.999Z";
    events = events.filter((event) =>
      eventOverlapsRange(event, rangeFrom, rangeTo)
    );
  }

  if (place) {
    events = events.filter((event) => eventMatchesPlace(event, place));
  }

  if (searchTerm) {
    const needle = searchTerm.toLowerCase();
    events = events.filter((event) => {
      const hay = [
        event.title,
        event.short_description,
        event.location_name,
        event.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const preferredCity = normalizeLocationValue(filters?.preferred_city);
  const preferredCountryCode = normalizeLocationValue(
    filters?.preferred_country_code
  );
  const hasHardPlace = Boolean(place || filters?.country_code);
  if ((preferredCity || preferredCountryCode) && !hasHardPlace) {
    events = [...events].sort((a, b) => {
      const scoreDelta =
        getEventLocalityScore(b, preferredCity, preferredCountryCode) -
        getEventLocalityScore(a, preferredCity, preferredCountryCode);
      if (scoreDelta !== 0) return scoreDelta;
      return a.starts_at.localeCompare(b.starts_at);
    });
  }

  const totalCount = events.length;
  const offset = Math.max(0, filters?.offset ?? 0);
  const limit = filters?.limit;
  const page =
    typeof limit === "number" && limit > 0
      ? events.slice(offset, offset + limit)
      : offset > 0
        ? events.slice(offset)
        : events;

  return { events: page, totalCount };
}

export async function listEvents(filters?: ListEventsFilters): Promise<Event[]> {
  const domainEventIds = await resolveDomainEventIds(filters?.domain_id);
  if (domainEventIds === "empty") return [];

  const supabase = createPlatformClient();

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("starts_at", { ascending: true });

  if (domainEventIds) {
    query = query.in("id", domainEventIds);
  }

  // Soft DB bounds; refine with overlap / upcoming semantics in JS.
  if (filters?.from_date && filters?.to_date) {
    // Multi-day events may have started before the window.
    const softFrom = new Date(
      new Date(filters.from_date).getTime() - 60 * 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("starts_at", softFrom).lte("starts_at", filters.to_date);
  } else if (filters?.from_date) {
    // Upcoming: include events that may still be ongoing (started up to ~1 year ago).
    const softFrom = new Date(
      new Date(filters.from_date).getTime() - 366 * 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("starts_at", softFrom);
  } else if (filters?.to_date) {
    query = query.lte("starts_at", filters.to_date);
  }
  if (filters?.event_type) {
    query = query.eq("event_type", filters.event_type);
  }
  if (filters?.city) {
    const like = `%${escapeIlikeTerm(filters.city)}%`;
    query = query.ilike("city", like);
  }
  if (filters?.country_code) {
    query = query.eq("country_code", filters.country_code.toUpperCase());
  }

  // Fetch extra when refining in JS so limit still roughly applies after filter.
  if (filters?.limit) {
    query = query.limit(Math.max(filters.limit * 3, filters.limit));
  }

  const { data, error } = await query;
  if (error) return [];

  let events = (data ?? []) as Event[];

  if (filters?.from_date && filters?.to_date) {
    events = events.filter((event) =>
      eventOverlapsRange(event, filters.from_date!, filters.to_date!)
    );
  } else if (filters?.from_date) {
    events = events.filter((event) =>
      eventIsUpcomingOrOngoing(event, filters.from_date!)
    );
  }

  if (filters?.limit && events.length > filters.limit) {
    events = events.slice(0, filters.limit);
  }

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
