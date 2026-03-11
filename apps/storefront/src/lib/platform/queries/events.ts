import { createPlatformClient } from "../client";
import type { Event } from "@/types/platform";

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
}): Promise<Event[]> {
  const supabase = createPlatformClient();

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("starts_at", { ascending: true });

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

  const { data, error } = await query;
  if (error) return [];

  let events = (data ?? []) as Event[];

  if (filters?.domain_id) {
    const { data: edData } = await supabase
      .from("event_domains")
      .select("event_id")
      .eq("domain_id", filters.domain_id);
    const eventIds = new Set((edData ?? []).map((r) => r.event_id));
    events = events.filter((e) => eventIds.has(e.id));
  }

  return events;
}

