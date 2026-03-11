import { createPlatformClient } from "../client";
import type { Event } from "@/types/platform";

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

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []) as Event[];
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
