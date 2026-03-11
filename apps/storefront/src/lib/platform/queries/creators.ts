import { createPlatformClient } from "../client";
import type { Creator } from "@/types/platform";

export async function getCreatorBySlug(slug: string): Promise<Creator | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Creator;
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Creator;
}

export async function listCreatorsByDomain(domainId: string): Promise<Creator[]> {
  const supabase = createPlatformClient();
  const { data: links, error: linksError } = await supabase
    .from("creator_domains")
    .select("creator_id")
    .eq("domain_id", domainId);

  if (linksError || !links?.length) return [];

  const ids = links.map((l) => l.creator_id);
  const { data: creators, error } = await supabase
    .from("creators")
    .select("*")
    .in("id", ids);

  if (error) return [];
  return (creators ?? []) as Creator[];
}

export async function listFeaturedCreators(limit = 12): Promise<Creator[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("is_featured", true)
    .limit(limit);

  if (error) return [];
  return (data ?? []) as Creator[];
}

export async function listAllCreators(): Promise<Creator[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("display_name", { ascending: true });

  if (error) return [];
  return (data ?? []) as Creator[];
}
