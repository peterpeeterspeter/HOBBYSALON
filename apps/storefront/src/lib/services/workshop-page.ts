import { getWorkshopBySlug } from "@/lib/platform/queries/workshops";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listArticlesByIds } from "@/lib/platform/queries/articles";
import { listProductsByIds } from "@/lib/platform/queries/products";
import { createPlatformClient } from "@/lib/platform/client";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import {
  getCreatorCommercialEntitlements,
  type CommercialEntitlements,
} from "@/lib/platform/commercial-entitlements";
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
  requiredProducts: Product[];
  optionalProducts: Product[];
  relatedEvents: Event[];
  relatedArticles: Article[];
  entitlements: CommercialEntitlements | null;
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
      requiredProducts: [],
      optionalProducts: [],
      relatedEvents: [],
      relatedArticles: [],
      entitlements: null,
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

  const requiredRows = await getWorkshopRequiredProducts(workshop.id);
  const requiredProductIds = requiredRows.map((row) => row.product_id);

  const [requiredProductsRaw, linkedProducts] = await Promise.all([
    listProductsByIds(requiredProductIds),
    listProductsByIds(relatedProductIds),
  ]);

  const productsById = new Map(
    requiredProductsRaw.map((product) => [product.id, product])
  );

  const requiredProducts = requiredRows
    .filter((row) => row.is_required)
    .map((row) => productsById.get(row.product_id))
    .filter((product): product is Product => !!product);

  const optionalProductsFromRequiredRows = requiredRows
    .filter((row) => !row.is_required)
    .map((row) => productsById.get(row.product_id))
    .filter((product): product is Product => !!product);

  const alreadyIncluded = new Set([
    ...requiredProducts.map((product) => product.id),
    ...optionalProductsFromRequiredRows.map((product) => product.id),
  ]);

  const optionalLinkedProducts = linkedProducts.filter(
    (product) => !alreadyIncluded.has(product.id)
  );

  const optionalProducts = [
    ...optionalProductsFromRequiredRows,
    ...optionalLinkedProducts,
  ];

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

  const entitlements = creator
    ? await getCreatorCommercialEntitlements(creator.id, creator.creator_types)
    : null;

  return {
    workshop,
    creator: creator ?? null,
    domain: domain ?? null,
    sessions,
    requiredProducts,
    optionalProducts,
    relatedEvents,
    relatedArticles,
    entitlements,
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

type WorkshopRequiredProductRow = {
  product_id: string;
  is_required: boolean;
  sort_order: number;
};

async function getWorkshopRequiredProducts(
  workshopId: string
): Promise<WorkshopRequiredProductRow[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("workshop_required_products")
    .select("product_id, is_required, sort_order")
    .eq("workshop_id", workshopId)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as WorkshopRequiredProductRow[];
}
