import { getWorkshopBySlug } from "@/lib/platform/queries/workshops";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listArticlesByIds } from "@/lib/platform/queries/articles";
import { createPlatformClient } from "@/lib/platform/client";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import type { Workshop, Creator, Domain, Product, Event, Article } from "@/types/platform";

export type WorkshopSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  remaining_spots: number | null;
  booking_status: string;
};

export type WorkshopPageData = {
  workshop: Workshop | null;
  creator: Creator | null;
  domain: Domain | null;
  sessions: WorkshopSession[];
  relatedProducts: Product[];
  relatedEvents: Event[];
  relatedArticles: Article[];
};

export async function getWorkshopPageData(
  slug: string
): Promise<WorkshopPageData> {
  const workshop = await getWorkshopBySlug(slug);
  if (!workshop) {
    return {
      workshop: null,
      creator: null,
      domain: null,
      sessions: [],
      relatedProducts: [],
      relatedEvents: [],
      relatedArticles: [],
    };
  }

  const [creator, domain, sessions, entityLinks] = await Promise.all([
    getCreatorById(workshop.creator_id),
    workshop.domain_id
      ? (async () => {
          const supabase = createPlatformClient();
          const { data } = await supabase
            .from("domains")
            .select("*")
            .eq("id", workshop.domain_id)
            .single();
          return data as Domain | null;
        })()
      : Promise.resolve(null),
    getWorkshopSessions(workshop.id),
    getRelatedEntities("workshop", workshop.id),
  ]);

  const relatedProductIds = entityLinks
    .filter((l) => l.target_entity_type === "product")
    .map((l) => l.target_entity_id);

  const relatedProducts: Product[] = [];
  if (relatedProductIds.length > 0) {
    const supabase = createPlatformClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .in("id", relatedProductIds)
      .eq("is_active", true);
    relatedProducts.push(...((data ?? []) as Product[]));
  }

  const relatedEventIds = entityLinks
    .filter((l) => l.target_entity_type === "event")
    .map((l) => l.target_entity_id);
  const relatedArticleIds = entityLinks
    .filter((l) => l.target_entity_type === "article")
    .map((l) => l.target_entity_id);

  const [relatedEvents, relatedArticles] = await Promise.all([
    listEventsByIds(relatedEventIds),
    listArticlesByIds(relatedArticleIds),
  ]);

  return {
    workshop,
    creator: creator ?? null,
    domain: domain ?? null,
    sessions,
    relatedProducts,
    relatedEvents,
    relatedArticles,
  };
}

async function getWorkshopSessions(
  workshopId: string
): Promise<WorkshopSession[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshop_sessions")
    .select("id, starts_at, ends_at, capacity, remaining_spots, booking_status")
    .eq("workshop_id", workshopId)
    .eq("is_cancelled", false)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as WorkshopSession[];
}
