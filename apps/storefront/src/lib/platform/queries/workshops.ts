import { createPlatformClient } from "../client";
import type { Workshop } from "@/types/platform";

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

export async function listWorkshopsByDomain(domainId: string): Promise<Workshop[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .eq("domain_id", domainId)
    .eq("is_active", true)
    .order("is_featured", { ascending: false });

  if (error) return [];
  return (data ?? []) as Workshop[];
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

  const { data, error } = await query.order("is_featured", { ascending: false });

  if (error) return [];
  return (data ?? []) as Workshop[];
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

export async function listUpcomingWorkshops(limit = 8): Promise<Workshop[]> {
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
  return listWorkshopsByIds(workshopIds);
}
