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

export type EventExhibitor = {
  creator: Creator;
  role: string;
  products: Product[];
};

export type EventPageData = {
  event: Event | null;
  organizer: Creator | null;
  domains: Domain[];
  creators: Creator[];
  exhibitors: EventExhibitor[];
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
      exhibitors: [],
      workshops: [],
      relatedProducts: [],
      relatedArticles: [],
      relatedEvents: [],
      eventEntitlements: null,
    };
  }

  const eventEntitlements = await getEventCommercialEntitlements(event.id);

  const supabase = createPlatformClient();

  const organizer = event.organizer_creator_id
    ? await getCreatorById(event.organizer_creator_id)
    : null;

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

  const { data: ecData } = await supabase
    .from("event_creators")
    .select("creator_id, role")
    .eq("event_id", event.id);

  const rosterRows = (ecData ?? []) as Array<{
    creator_id: string;
    role: string;
  }>;
  const creatorIds = [...new Set(rosterRows.map((row) => row.creator_id))];
  const creatorsById = new Map<string, Creator>();
  await Promise.all(
    creatorIds.map(async (creatorId) => {
      const creator = await getCreatorById(creatorId);
      if (creator) creatorsById.set(creatorId, creator);
    })
  );
  const creators = Array.from(creatorsById.values());

  let exhibitorProducts: Product[] = [];
  if (creatorIds.length > 0) {
    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .in("creator_id", creatorIds)
      .eq("is_active", true)
      .eq("status", "active")
      .order("is_featured", { ascending: false });
    exhibitorProducts = (productData ?? []) as Product[];
  }

  const productsByCreator = new Map<string, Product[]>();
  for (const product of exhibitorProducts) {
    if (!product.creator_id) continue;
    const list = productsByCreator.get(product.creator_id) ?? [];
    list.push(product);
    productsByCreator.set(product.creator_id, list);
  }

  const preferredRoleOrder = ["vendor", "workshop_host", "speaker", "organizer"];
  const roleByCreator = new Map<string, string>();
  for (const row of rosterRows) {
    const current = roleByCreator.get(row.creator_id);
    if (!current) {
      roleByCreator.set(row.creator_id, row.role);
      continue;
    }
    if (
      preferredRoleOrder.indexOf(row.role) < preferredRoleOrder.indexOf(current)
    ) {
      roleByCreator.set(row.creator_id, row.role);
    }
  }

  const exhibitors: EventExhibitor[] = creators
    .map((creator) => ({
      creator,
      role: roleByCreator.get(creator.id) ?? "vendor",
      products: productsByCreator.get(creator.id) ?? [],
    }))
    .sort((a, b) => a.creator.display_name.localeCompare(b.creator.display_name, "nl"));

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

  const entityLinks = await getRelatedEntities("event", event.id);
  const relatedProductIds = entityLinks
    .filter((l) => l.target_entity_type === "product")
    .map((l) => l.target_entity_id);
  const relatedArticleIds = entityLinks
    .filter((l) => l.target_entity_type === "article")
    .map((l) => l.target_entity_id);

  const exhibitorProductIds = new Set(exhibitorProducts.map((p) => p.id));
  let linkedProducts: Product[] = [];
  if (relatedProductIds.length > 0) {
    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .in("id", relatedProductIds)
      .eq("is_active", true);
    linkedProducts = ((productData ?? []) as Product[]).filter(
      (product) => !exhibitorProductIds.has(product.id)
    );
  }

  const relatedProducts = [...exhibitorProducts, ...linkedProducts];
  const relatedArticles = await listArticlesByIds(relatedArticleIds);

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
    exhibitors,
    workshops,
    relatedProducts,
    relatedArticles,
    relatedEvents,
    eventEntitlements,
  };
}
