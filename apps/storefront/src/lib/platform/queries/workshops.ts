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
