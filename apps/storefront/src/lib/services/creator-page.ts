import { getCreatorBySlug } from "@/lib/platform/queries/creators";
import { listProductsByCreator } from "@/lib/platform/queries/products";
import {
  getWorkshopById,
  listWorkshopsByCreator,
} from "@/lib/platform/queries/workshops";
import {
  listProjectGalleryImages,
  listProjectProductLinks,
  listProjectsByCreator,
} from "@/lib/platform/queries/projects";
import { listEventsByCreator, listEventsByIds } from "@/lib/platform/queries/events";
import {
  listArticlesByAuthor,
  listArticlesByIds,
} from "@/lib/platform/queries/articles";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import type {
  Creator,
  Product,
  Project,
  Domain,
  Workshop,
  Event,
  Article,
} from "@/types/platform";

export type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

export type CreatorPageData = {
  creator: Creator | null;
  products: ProductWithPrice[];
  domains: Domain[];
  projects: CreatorProjectTeaser[];
  relatedWorkshops: Workshop[];
  relatedEvents: Event[];
  relatedArticles: Article[];
};

export type CreatorProjectTeaser = {
  project: Project;
  galleryPreviewUrl: string | null;
  linkedProductCount: number;
};

export async function getCreatorPageData(slug: string): Promise<CreatorPageData> {
  const creator = await getCreatorBySlug(slug);
  if (!creator) {
    return {
      creator: null,
      products: [],
      domains: [],
      projects: [],
      relatedWorkshops: [],
      relatedEvents: [],
      relatedArticles: [],
    };
  }

  const [
    products,
    entityLinks,
    creatorDomains,
    ownProjects,
    ownWorkshops,
    ownEvents,
    ownArticles,
  ] =
    await Promise.all([
      listProductsByCreator(creator.id),
      getRelatedEntities("creator", creator.id),
      getCreatorDomains(creator.id),
      listProjectsByCreator(creator.id),
      listWorkshopsByCreator(creator.id),
      listEventsByCreator(creator.id),
      listArticlesByAuthor(creator.id),
    ]);

  const relatedWorkshopIds = entityLinks
    .filter((l) => l.target_entity_type === "workshop")
    .map((l) => l.target_entity_id);
  const relatedEventIds = entityLinks
    .filter((l) => l.target_entity_type === "event")
    .map((l) => l.target_entity_id);
  const relatedArticleIds = entityLinks
    .filter((l) => l.target_entity_type === "article")
    .map((l) => l.target_entity_id);

  const productsWithPrices = await Promise.all(
    products.map(async (p) => {
      const medusa = await getMedusaProduct(p.medusa_product_id);
      const price = medusa?.calculated_price
        ? {
            amount: medusa.calculated_price.calculated_amount,
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;
      return { ...p, price };
    })
  );

  const [linkedWorkshops, linkedEvents, linkedArticles, projects] = await Promise.all([
    relatedWorkshopIds.length > 0
      ? (
          await Promise.all(relatedWorkshopIds.map((id) => getWorkshopById(id)))
        ).filter((workshop): workshop is Workshop => workshop != null)
      : [],
    listEventsByIds(relatedEventIds),
    listArticlesByIds(relatedArticleIds),
    buildCreatorProjects(ownProjects),
  ]);

  return {
    creator,
    products: productsWithPrices,
    domains: creatorDomains,
    projects,
    relatedWorkshops: mergeById<Workshop>(ownWorkshops, linkedWorkshops),
    relatedEvents: mergeById<Event>(ownEvents, linkedEvents),
    relatedArticles: mergeById<Article>(ownArticles, linkedArticles),
  };
}

async function getCreatorDomains(creatorId: string): Promise<Domain[]> {
  const { createPlatformClient } = await import("@/lib/platform/client");
  const supabase = createPlatformClient();
  const { data: links } = await supabase
    .from("creator_domains")
    .select("domain_id")
    .eq("creator_id", creatorId);
  if (!links?.length) return [];

  const domainIds = links.map((l) => l.domain_id);
  const { data: domains } = await supabase
    .from("domains")
    .select("*")
    .in("id", domainIds)
    .eq("is_active", true);
  return (domains ?? []) as Domain[];
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of primary) byId.set(row.id, row);
  for (const row of secondary) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
}

async function buildCreatorProjects(projects: Project[]): Promise<CreatorProjectTeaser[]> {
  const rows = await Promise.all(
    projects.map(async (project) => {
      const [galleryImages, productLinks] = await Promise.all([
        listProjectGalleryImages(project.id),
        listProjectProductLinks(project.id),
      ]);
      return {
        project,
        galleryPreviewUrl: galleryImages[0]?.image_url ?? project.featured_image_url,
        linkedProductCount: productLinks.length,
      } satisfies CreatorProjectTeaser;
    })
  );

  return rows;
}
