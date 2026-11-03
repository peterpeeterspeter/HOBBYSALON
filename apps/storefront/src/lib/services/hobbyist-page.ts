import "server-only";

import { createPlatformClient } from "@/lib/platform/client";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { getDomainPlaceholderImage, DOMAIN_PLACEHOLDER_IMAGES } from "@/components/ui/ai-generated-image";

export type HobbyTile = {
  slug: string;
  name: string;
  ideas: number;
  /** Craft photo when one exists for this hobby. */
  image: string | null;
};

export type HobbyistPageData = {
  hobbies: HobbyTile[];
  stats: { ideas: number; workshops: number; upcomingEvents: number };
};

/** Live numbers for /voor-hobbyisten. Every count comes from the database. */
export async function getHobbyistPageData(): Promise<HobbyistPageData> {
  const supabase = createPlatformClient();
  const now = new Date().toISOString();
  const [domains, articleFacets, patternFacets, ideas, workshops, events] = await Promise.all([
    listActiveDomains(),
    supabase.rpc("article_hub_facets", { p_patterns: false }),
    supabase.rpc("article_hub_facets", { p_patterns: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("workshops").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})`),
  ]);

  const perDomain = new Map<string, number>();
  for (const result of [articleFacets, patternFacets]) {
    if (result.error || !Array.isArray(result.data)) continue;
    for (const row of result.data as { facet: string; value: string; n: number | string }[]) {
      if (row.facet !== "domain") continue;
      perDomain.set(row.value, (perDomain.get(row.value) ?? 0) + Number(row.n));
    }
  }

  const hobbies = domains
    .map((domain) => ({
      slug: domain.slug,
      name: domain.name,
      ideas: perDomain.get(domain.slug) ?? 0,
      image: DOMAIN_PLACEHOLDER_IMAGES[domain.slug] ? getDomainPlaceholderImage(domain.slug) : null,
    }))
    .filter((hobby) => hobby.ideas > 0);

  return {
    hobbies,
    stats: {
      ideas: ideas.count ?? 0,
      workshops: workshops.count ?? 0,
      upcomingEvents: events.count ?? 0,
    },
  };
}
