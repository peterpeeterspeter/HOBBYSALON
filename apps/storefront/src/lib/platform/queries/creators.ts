import { createPlatformClient } from "../client";
import type { Creator } from "@/types/platform";

export type ListCreatorsFilters = {
  domainId?: string;
  creatorType?: string;
  q?: string;
};

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

export async function getCreatorByUserId(userId: string): Promise<Creator | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("user_id", userId)
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

export async function listAllCreators(
  filters?: ListCreatorsFilters
): Promise<Creator[]> {
  const supabase = createPlatformClient();
  const normalizedType = filters?.creatorType?.trim().toLowerCase() ?? "";
  const normalizedQuery = filters?.q?.trim().toLowerCase() ?? "";
  let domainCreatorIds: string[] | null = null;

  if (filters?.domainId) {
    const { data: links, error: linksError } = await supabase
      .from("creator_domains")
      .select("creator_id")
      .eq("domain_id", filters.domainId);

    if (linksError) {
      return [];
    }

    domainCreatorIds = [...new Set((links ?? []).map((row) => row.creator_id))];
    if (domainCreatorIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("creators")
    .select("*")
    .order("is_featured", { ascending: false });

  if (domainCreatorIds) {
    query = query.in("id", domainCreatorIds);
  }

  if (normalizedType) {
    query = query.contains("creator_types", [normalizedType]);
  }

  const { data, error } = await query;
  if (error) return [];

  const creators = (data ?? []) as Creator[];
  const searchedCreators = normalizedQuery
    ? creators.filter((creator) => {
        const haystack = [
          creator.display_name,
          creator.business_name ?? "",
          creator.bio ?? "",
          creator.city ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : creators;

  return searchedCreators.sort((a, b) => {
    const featuredDelta = Number(b.is_featured) - Number(a.is_featured);
    if (featuredDelta !== 0) return featuredDelta;
    return a.display_name.localeCompare(b.display_name);
  });
}

export type CreatorWithStats = Creator & {
  workshop_count: number;
  primary_domain_name: string | null;
};

/**
 * Enriches a small set of creators (e.g. the homepage spotlight) with two graph
 * signals shown in the design: a primary hobby domain and an active-workshop
 * count. Uses batched `in (...)` queries — no per-creator round-trips.
 */
export async function enrichCreatorsWithStats(
  creators: Creator[]
): Promise<CreatorWithStats[]> {
  if (creators.length === 0) return [];
  const supabase = createPlatformClient();
  const ids = creators.map((c) => c.id);

  const [{ data: workshopRows }, { data: domainLinks }] = await Promise.all([
    supabase
      .from("workshops")
      .select("creator_id")
      .in("creator_id", ids)
      .eq("is_active", true),
    supabase.from("creator_domains").select("creator_id, domain_id").in("creator_id", ids),
  ]);

  const workshopCount = new Map<string, number>();
  (workshopRows ?? []).forEach((row: { creator_id: string }) => {
    workshopCount.set(row.creator_id, (workshopCount.get(row.creator_id) ?? 0) + 1);
  });

  const domainIds = [
    ...new Set((domainLinks ?? []).map((l: { domain_id: string }) => l.domain_id)),
  ];
  const domainNameById = new Map<string, string>();
  if (domainIds.length > 0) {
    const { data: domains } = await supabase
      .from("domains")
      .select("id, name")
      .in("id", domainIds);
    (domains ?? []).forEach((d: { id: string; name: string }) =>
      domainNameById.set(d.id, d.name)
    );
  }

  const primaryDomain = new Map<string, string>();
  (domainLinks ?? []).forEach((l: { creator_id: string; domain_id: string }) => {
    if (primaryDomain.has(l.creator_id)) return;
    const name = domainNameById.get(l.domain_id);
    if (name) primaryDomain.set(l.creator_id, name);
  });

  return creators.map((creator) => ({
    ...creator,
    workshop_count: workshopCount.get(creator.id) ?? 0,
    primary_domain_name: primaryDomain.get(creator.id) ?? null,
  }));
}
