import { getCreatorById } from "@/lib/platform/queries/creators";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import { listArticlesByIds } from "@/lib/platform/queries/articles";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listProductsByIds } from "@/lib/platform/queries/products";
import { listWorkshopsByIds } from "@/lib/platform/queries/workshops";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import {
  getProjectBySlug,
  listDomainsByProject,
  listProjectSteps,
} from "@/lib/platform/queries/projects";
import type {
  Article,
  Creator,
  Domain,
  Event,
  Product,
  Project,
  ProjectStep,
  Workshop,
} from "@/types/platform";

export type ProjectPageData = {
  project: Project | null;
  domains: Domain[];
  steps: ProjectStep[];
  bundleItems: ProjectBundleItem[];
  relatedProducts: Product[];
  relatedWorkshops: Workshop[];
  relatedEvents: Event[];
  relatedArticles: Article[];
  relatedCreators: Creator[];
};

export type ProjectBundleItem = {
  product_id: string;
  product_slug: string;
  title: string;
  variant_id: string;
  variant_title?: string;
  price_amount: number | null;
  currency_code: string | null;
};

export async function getProjectPageData(slug: string): Promise<ProjectPageData> {
  const project = await getProjectBySlug(slug);

  if (!project) {
    return {
      project: null,
      domains: [],
      steps: [],
      bundleItems: [],
      relatedProducts: [],
      relatedWorkshops: [],
      relatedEvents: [],
      relatedArticles: [],
      relatedCreators: [],
    };
  }

  const [domains, steps, entityLinks] = await Promise.all([
    listDomainsByProject(project.id),
    listProjectSteps(project.id),
    getRelatedEntities("project", project.id),
  ]);

  const productIds = entityLinks
    .filter((link) => link.target_entity_type === "product")
    .map((link) => link.target_entity_id);
  const workshopIds = entityLinks
    .filter((link) => link.target_entity_type === "workshop")
    .map((link) => link.target_entity_id);
  const eventIds = entityLinks
    .filter((link) => link.target_entity_type === "event")
    .map((link) => link.target_entity_id);
  const articleIds = entityLinks
    .filter((link) => link.target_entity_type === "article")
    .map((link) => link.target_entity_id);
  const creatorIds = entityLinks
    .filter((link) => link.target_entity_type === "creator")
    .map((link) => link.target_entity_id);

  const [relatedProducts, relatedWorkshops, relatedEvents, relatedArticles, relatedCreators] =
    await Promise.all([
      listProductsByIds(productIds),
      listWorkshopsByIds(workshopIds),
      listEventsByIds(eventIds),
      listArticlesByIds(articleIds),
      listCreatorsByIds(creatorIds),
    ]);

  const bundleItems = await buildProjectBundleItems(relatedProducts);

  return {
    project,
    domains,
    steps,
    bundleItems,
    relatedProducts,
    relatedWorkshops,
    relatedEvents,
    relatedArticles,
    relatedCreators,
  };
}

async function listCreatorsByIds(ids: string[]): Promise<Creator[]> {
  if (!ids.length) return [];

  const uniqueIds = [...new Set(ids)];
  const creators = await Promise.all(uniqueIds.map((id) => getCreatorById(id)));
  return creators.filter((creator): creator is Creator => !!creator);
}

async function buildProjectBundleItems(
  products: Product[]
): Promise<ProjectBundleItem[]> {
  const candidateProducts = products.filter(
    (product) => product.product_type === "supply" || product.product_type === "workshop_kit"
  );

  const results = await Promise.all(
    candidateProducts.map(async (product) => {
      const medusaProduct = await getMedusaProduct(product.medusa_product_id);
      const firstVariant = medusaProduct?.variants?.[0];
      if (!firstVariant?.id) {
        return null;
      }

      const calculatedPrice = (
        firstVariant as {
          calculated_price?: {
            calculated_amount: number;
            currency_code: string;
          };
        }
      ).calculated_price;

      return {
        product_id: product.id,
        product_slug: product.slug,
        title: product.title,
        variant_id: firstVariant.id,
        variant_title: firstVariant.title,
        price_amount: calculatedPrice?.calculated_amount ?? null,
        currency_code: calculatedPrice?.currency_code ?? null,
      } as ProjectBundleItem;
    })
  );

  return results.filter((item): item is ProjectBundleItem => !!item);
}
