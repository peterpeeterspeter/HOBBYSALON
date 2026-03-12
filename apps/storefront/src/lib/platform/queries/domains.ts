import { createPlatformClient } from "../client";
import { unstable_cache } from "next/cache";
import type { Domain } from "@/types/platform";

export type DomainNavLink = {
  id: string;
  slug: string;
  name: string;
};

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
  return listActiveDomainsCached();
}

const listActiveDomainsCached = unstable_cache(
  async (): Promise<Domain[]> => {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("domains")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as Domain[];
  },
  ["domains-active-v1"],
  {
    revalidate: 60 * 30,
    tags: ["domains"],
  }
);

export async function listDomainsBySort(): Promise<Domain[]> {
  return listActiveDomains();
}

export async function listDomainNavLinks(limit = 24): Promise<DomainNavLink[]> {
  return listDomainNavLinksCached(limit);
}

const listDomainNavLinksCached = unstable_cache(
  async (limit: number): Promise<DomainNavLink[]> => {
    const supabase = createPlatformClient();
    const { data, error } = await supabase
      .from("domains")
      .select("id,slug,name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(Math.max(1, Math.min(limit, 50)));

    if (error || !data) return [];

    return data as DomainNavLink[];
  },
  ["domains-nav-links-v1"],
  {
    revalidate: 60 * 30,
    tags: ["domains"],
  }
);
