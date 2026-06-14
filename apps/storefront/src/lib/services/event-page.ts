import { getEventBySlug, listEvents } from "@/lib/platform/queries/events";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { listArticlesByIds } from "@/lib/platform/queries/articles";
import { createPlatformClient } from "@/lib/platform/client";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import {
  getEventCommercialEntitlements,
  type EventEntitlements,
} from "@/lib/platform/commercial-entitlements";
import type {
  Event,
  Creator,
  Domain,
  Product,
  Workshop,
  Article,
} from "@/types/platform";

export type EventPageData = {
  event: Event | null;
  organizer: Creator | null;
  domains: Domain[];
  creators: Creator[];
  workshops: Workshop[];
  relatedProducts: Product[];
  relatedArticles: Article[];
  relatedEvents: Event[];
  eventEntitlements: EventEntitlements | null;
};

export async function getEventPageData(
  slug: string
): Promise<EventPageData> {
  const event = await getEventBySlug(slug);
  if (!event) {
    return {
      event: null,
      organizer: null,
      domains: [],
      creators: [],
      workshops: [],
      relatedProducts: [],
      relatedArticles: [],
      relatedEvents: [],
      eventEntitlements: null,
    };
  }

  const eventEntitlements = await getEventCommercialEntitlements(event.id);

  const supabase = createPlatformClient();

  // Fetch organizer
  const organizer = event.organizer_creator_id
    ? await getCreatorById(event.organizer_creator_id)
    : null;

  // Fetch domains via event_domains
  const { data: edData } = await supabase
    .from("event_domains")
    .select("domain_id")
    .eq("event_id", event.id);
  const domainIds = (edData ?? []).map((r) => r.domain_id);
  let domains: Domain[] = [];
  if (domainIds.length > 0) {
    const { data: domainData } = await supabase
      .from("domains")
      .select("*")
      .in("id", domainIds)
      .eq("is_active", true);
    domains = (domainData ?? []) as Domain[];
  }

  // Fetch creators via event_creators
  const { data: ecData } = await supabase
    .from("event_creators")
    .select("creator_id")
    .eq("event_id", event.id);
  const creatorIds = [...new Set((ecData ?? []).map((r) => r.creator_id))];
  const creators: Creator[] = [];
  for (const cid of creatorIds) {
    const c = await getCreatorById(cid);
    if (c) creators.push(c);
  }

  // Fetch workshops via event_workshops
  const { data: ewData } = await supabase
    .from("event_workshops")
    .select("workshop_id")
    .eq("event_id", event.id);
  const workshopIds = (ewData ?? []).map((r) => r.workshop_id);
  let workshops: Workshop[] = [];
  if (workshopIds.length > 0) {
    const { data: workshopData } = await supabase
      .from("workshops")
      .select("*")
      .in("id", workshopIds)
      .eq("is_active", true);
    workshops = (workshopData ?? []) as Workshop[];
  }

  // Related entities via entity_links
  const entityLinks = await getRelatedEntities("event", event.id);
  const relatedProductIds = entityLinks
    .filter((l) => l.target_entity_type === "product")
    .map((l) => l.target_entity_id);
  const relatedArticleIds = entityLinks
    .filter((l) => l.target_entity_type === "article")
    .map((l) => l.target_entity_id);
  let relatedProducts: Product[] = [];
  if (relatedProductIds.length > 0) {
    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .in("id", relatedProductIds)
      .eq("is_active", true);
    relatedProducts = (productData ?? []) as Product[];
  }
  const relatedArticles = await listArticlesByIds(relatedArticleIds);

  // Other upcoming events — prefer the same domain, fall back to any upcoming.
  const nowIso = new Date().toISOString();
  const upcoming = await listEvents({
    domain_id: domainIds[0],
    from_date: nowIso,
    limit: 7,
  });
  let relatedEvents = upcoming.filter((e) => e.id !== event.id).slice(0, 3);
  if (relatedEvents.length === 0) {
    const anyUpcoming = await listEvents({ from_date: nowIso, limit: 7 });
    relatedEvents = anyUpcoming.filter((e) => e.id !== event.id).slice(0, 3);
  }

  return {
    event,
    organizer: organizer ?? null,
    domains,
    creators,
    workshops,
    relatedProducts,
    relatedArticles,
    relatedEvents,
    eventEntitlements,
  };
}
