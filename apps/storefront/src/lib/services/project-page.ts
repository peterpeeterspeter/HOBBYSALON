import { getCreatorById } from "@/lib/platform/queries/creators";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import { listArticlesByIds } from "@/lib/platform/queries/articles";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listProductsByIds } from "@/lib/platform/queries/products";
import { listWorkshopsByIds } from "@/lib/platform/queries/workshops";
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
  relatedProducts: Product[];
  relatedWorkshops: Workshop[];
  relatedEvents: Event[];
  relatedArticles: Article[];
  relatedCreators: Creator[];
};

export async function getProjectPageData(slug: string): Promise<ProjectPageData> {
  const project = await getProjectBySlug(slug);

  if (!project) {
    return {
      project: null,
      domains: [],
      steps: [],
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

  return {
    project,
    domains,
    steps,
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
