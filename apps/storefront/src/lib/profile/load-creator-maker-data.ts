import "server-only";

import type { User } from "@supabase/supabase-js";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { listWorkshopsByCreator } from "@/lib/platform/queries/workshops";
import { listEventsByCreator } from "@/lib/platform/queries/events";
import {
  listProjectSoughtMaterials,
  listProjectsByUserId,
} from "@/lib/platform/queries/projects";
import { listMaterialProductsForSelection } from "@/lib/platform/queries/products";
import { createPlatformClient } from "@/lib/platform/client";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { getCreatorProgressSteps } from "@/lib/dashboard/creator-progress";
import {
  resolveCreatorTab,
  type ArticleEntityLink,
  type CreatorProject,
  type CreatorTab,
  type DashboardArticle,
  type ProjectGalleryImage,
  type ProjectProductLink,
  type ProjectSoughtMaterial,
} from "@/components/dashboard/creator/types";
import type { Creator, Domain } from "@/types/platform";

export type CreatorMakerData = {
  creator: Creator | null;
  registrationContext: Awaited<ReturnType<typeof getUserRegistrationContext>>;
  onboarding: Record<string, unknown> | null;
  accountDisplayName: string;
  domains: Domain[];
  activeTab: CreatorTab;
  selectedDomainIds: Set<string>;
  dashboardArticles: DashboardArticle[];
  articleSuggestionsByArticle: Map<string, ArticleEntityLink[]>;
  articleConfirmedByArticle: Map<string, ArticleEntityLink[]>;
  creatorProjects: CreatorProject[];
  projectImagesByProject: Map<string, ProjectGalleryImage[]>;
  projectLinksByProject: Map<string, ProjectProductLink[]>;
  projectSoughtMaterialsByProject: Map<string, ProjectSoughtMaterial[]>;
  productLabels: Map<string, string>;
  workshopLabels: Map<string, string>;
  eventLabels: Map<string, string>;
  materialProductOptions: Array<{ id: string; label: string }>;
  progressSteps: ReturnType<typeof getCreatorProgressSteps>;
};

export async function loadCreatorMakerData(
  user: User,
  tabParam?: string | null
): Promise<CreatorMakerData> {
  const [creator, registrationContext] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);

  const onboarding =
    user.user_metadata?.account_type === "creator" ? user.user_metadata : null;
  const accountDisplayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : user.email?.split("@")[0] ?? "";
  const domains = await listDomainsBySort();
  const activeTab = resolveCreatorTab(tabParam ?? undefined);

  let selectedDomainIds = new Set<string>();
  let productCount = 0;
  let workshopCount = 0;
  let eventCount = 0;
  let dashboardArticles: DashboardArticle[] = [];
  let articleSuggestionLinks: ArticleEntityLink[] = [];
  let articleConfirmedLinks: ArticleEntityLink[] = [];
  let creatorProjects: CreatorProject[] = [];
  let projectGalleryImages: ProjectGalleryImage[] = [];
  let projectProductLinks: ProjectProductLink[] = [];
  let projectSoughtMaterials: ProjectSoughtMaterial[] = [];
  let productLabels = new Map<string, string>();
  let workshopLabels = new Map<string, string>();
  let eventLabels = new Map<string, string>();
  let materialProductOptions: Array<{ id: string; label: string }> = [];

  if (creator) {
    const supabase = createPlatformClient();
    const [
      domainLinksResult,
      productsResult,
      workshops,
      events,
      articlesResult,
      userProjects,
    ] = await Promise.all([
      supabase
        .from("creator_domains")
        .select("domain_id")
        .eq("creator_id", creator.id),
      supabase
        .from("products")
        .select("id,title,status")
        .eq("creator_id", creator.id)
        .order("updated_at", { ascending: false })
        .limit(100),
      listWorkshopsByCreator(creator.id),
      listEventsByCreator(creator.id),
      supabase
        .from("articles")
        .select(
          "id,title,slug,excerpt,body_markdown,article_type,domain_id,is_published,updated_at"
        )
        .eq("author_creator_id", creator.id)
        .order("updated_at", { ascending: false })
        .limit(100),
      listProjectsByUserId(user.id),
    ]);

    selectedDomainIds = new Set(
      (domainLinksResult.data ?? []).map((row) => row.domain_id as string)
    );

    const products = (productsResult.data ?? []) as Array<{
      id: string;
      title: string;
      status: string;
    }>;
    productCount = products.length;
    productLabels = new Map(
      products.map((product) => [product.id, `${product.title} (${product.status})`])
    );
    workshopCount = workshops.length;
    workshopLabels = new Map(workshops.map((w) => [w.id, w.title]));
    eventCount = events.length;
    eventLabels = new Map(events.map((e) => [e.id, e.title]));

    dashboardArticles = (articlesResult.data ?? []) as DashboardArticle[];

    creatorProjects = userProjects.map((project) => ({
      id: project.id,
      slug: project.slug,
      title: project.title,
      short_description: project.short_description,
      featured_image_url: project.featured_image_url,
    }));

    const projectIds = creatorProjects.map((p) => p.id);
    if (projectIds.length > 0) {
      const [
        projectImagesResult,
        projectProductLinksResult,
        projectSoughtMaterialsResult,
        materialOptionsData,
      ] = await Promise.all([
        supabase
          .from("project_gallery_images")
          .select("id,project_id,image_url,alt_text,sort_order")
          .in("project_id", projectIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("project_product_links")
          .select("id,project_id,product_id,link_type,sort_order")
          .in("project_id", projectIds)
          .order("sort_order", { ascending: true }),
        Promise.all(projectIds.map((pid) => listProjectSoughtMaterials(pid))).then(
          (arrays) => arrays.flat()
        ),
        listMaterialProductsForSelection({ limit: 200 }),
      ]);

      projectGalleryImages = (projectImagesResult.data ?? []) as ProjectGalleryImage[];
      projectProductLinks = (projectProductLinksResult.data ?? []) as ProjectProductLink[];
      projectSoughtMaterials = projectSoughtMaterialsResult as ProjectSoughtMaterial[];
      materialProductOptions = materialOptionsData.map((p) => ({
        id: p.id,
        label: p.title,
      }));
    }

    const articleIds = dashboardArticles.map((article) => article.id);
    if (articleIds.length > 0) {
      const { data: articleLinks } = await supabase
        .from("entity_links")
        .select(
          "id,source_entity_id,target_entity_type,target_entity_id,relation_type,weight,sort_order"
        )
        .eq("source_entity_type", "article")
        .in("source_entity_id", articleIds)
        .in("target_entity_type", ["product", "workshop", "event"])
        .order("sort_order", { ascending: true, nullsFirst: false });

      const allArticleLinks = (articleLinks ?? []) as ArticleEntityLink[];
      articleSuggestionLinks = allArticleLinks.filter(
        (link) => link.relation_type === "suggested_auto"
      );
      articleConfirmedLinks = allArticleLinks.filter(
        (link) => link.relation_type !== "suggested_auto"
      );
    }
  }

  const articleSuggestionsByArticle = new Map<string, ArticleEntityLink[]>();
  const articleConfirmedByArticle = new Map<string, ArticleEntityLink[]>();
  for (const link of articleSuggestionLinks) {
    const existing = articleSuggestionsByArticle.get(link.source_entity_id) ?? [];
    existing.push(link);
    articleSuggestionsByArticle.set(link.source_entity_id, existing);
  }
  for (const link of articleConfirmedLinks) {
    const existing = articleConfirmedByArticle.get(link.source_entity_id) ?? [];
    existing.push(link);
    articleConfirmedByArticle.set(link.source_entity_id, existing);
  }

  const projectImagesByProject = new Map<string, ProjectGalleryImage[]>();
  for (const image of projectGalleryImages) {
    const existing = projectImagesByProject.get(image.project_id) ?? [];
    existing.push(image);
    projectImagesByProject.set(image.project_id, existing);
  }
  const projectLinksByProject = new Map<string, ProjectProductLink[]>();
  for (const link of projectProductLinks) {
    const existing = projectLinksByProject.get(link.project_id) ?? [];
    existing.push(link);
    projectLinksByProject.set(link.project_id, existing);
  }
  const projectSoughtMaterialsByProject = new Map<string, ProjectSoughtMaterial[]>();
  for (const material of projectSoughtMaterials) {
    const existing = projectSoughtMaterialsByProject.get(material.project_id) ?? [];
    existing.push(material);
    projectSoughtMaterialsByProject.set(material.project_id, existing);
  }

  const progressSteps = getCreatorProgressSteps({
    creator,
    domainCount: selectedDomainIds.size,
    productCount,
    workshopCount,
    eventCount,
    articleCount: dashboardArticles.length,
    projectCount: creatorProjects.length,
  });

  return {
    creator,
    registrationContext,
    onboarding,
    accountDisplayName,
    domains,
    activeTab,
    selectedDomainIds,
    dashboardArticles,
    articleSuggestionsByArticle,
    articleConfirmedByArticle,
    creatorProjects,
    projectImagesByProject,
    projectLinksByProject,
    projectSoughtMaterialsByProject,
    productLabels,
    workshopLabels,
    eventLabels,
    materialProductOptions,
    progressSteps,
  };
}
