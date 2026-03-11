import { createPlatformClient } from "../client";
import type { Domain } from "@/types/platform";

export async function getDomainBySlug(slug: string): Promise<Domain | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("domains")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Domain;
}

export async function listActiveDomains(): Promise<Domain[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("domains")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as Domain[];
}

export async function listDomainsBySort(): Promise<Domain[]> {
  return listActiveDomains();
}
