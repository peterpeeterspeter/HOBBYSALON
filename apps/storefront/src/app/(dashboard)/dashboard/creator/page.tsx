import { getAuthUser } from "@/lib/auth/session";
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
import { CreatorDashboardTabs } from "@/components/dashboard/creator/CreatorDashboardTabs";
import { CreatorDashboardHeader } from "@/components/dashboard/creator/CreatorDashboardHeader";
import { CreatorProfileTab } from "@/components/dashboard/creator/CreatorProfileTab";
import { CreatorArticlesTab } from "@/components/dashboard/creator/CreatorArticlesTab";
import { CreatorPortfolioTab } from "@/components/dashboard/creator/CreatorPortfolioTab";
import {
  resolveCreatorTab,
  type ArticleEntityLink,
  type CreatorProject,
  type DashboardArticle,
  type ProjectGalleryImage,
  type ProjectProductLink,
  type ProjectSoughtMaterial,
} from "@/components/dashboard/creator/types";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; tab?: string }>;
};

export default async function DashboardCreatorPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const creator = user ? await getCreatorByUserId(user.id) : null;
  const registrationContext = user
    ? await getUserRegistrationContext(user.id)
    : null;
  const hasMerchantRole = registrationContext?.roles.includes("merchant") ?? false;
  const onboarding =
    user?.user_metadata?.account_type === "creator" ? user.user_metadata : null;
  const accountDisplayName =
    typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : user?.email?.split("@")[0] ?? "";
  const domains = await listDomainsBySort();
  const { success, error, tab: tabParam } = await searchParams;
  const activeTab = resolveCreatorTab(tabParam);

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

  if (creator && user) {
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
  for (const m of projectSoughtMaterials) {
    const existing = projectSoughtMaterialsByProject.get(m.project_id) ?? [];
    existing.push(m);
    projectSoughtMaterialsByProject.set(m.project_id, existing);
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

  return (
    <section className="space-y-6">
      <CreatorDashboardHeader
        creatorSlug={creator?.slug ?? null}
        progressSteps={progressSteps}
      />

      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <CreatorDashboardTabs
        activeTab={activeTab}
        preserveQuery={{ success, error }}
      >
          {activeTab === "profiel" && (
            <CreatorProfileTab
              creator={creator}
              onboarding={onboarding}
              accountDisplayName={accountDisplayName}
              registrationCity={registrationContext?.preference?.city ?? null}
              registrationCountryCode={registrationContext?.preference?.countryCode ?? null}
              domains={domains}
              selectedDomainIds={selectedDomainIds}
              hasMerchantRole={hasMerchantRole}
            />
          )}

          {activeTab === "artikels" && creator && (
            <CreatorArticlesTab
              domains={domains}
              articles={dashboardArticles}
              articleSuggestionsByArticle={articleSuggestionsByArticle}
              articleConfirmedByArticle={articleConfirmedByArticle}
              productLabels={productLabels}
              workshopLabels={workshopLabels}
              eventLabels={eventLabels}
            />
          )}

          {activeTab === "artikels" && !creator && (
            <p className="text-sm text-[var(--muted)]">
              Sla eerst je profiel op in het tabblad Profiel voordat je artikels kunt schrijven.
            </p>
          )}

          {activeTab === "portfolio" && creator && (
            <CreatorPortfolioTab
              projects={creatorProjects}
              projectImagesByProject={projectImagesByProject}
              projectLinksByProject={projectLinksByProject}
              projectSoughtMaterialsByProject={projectSoughtMaterialsByProject}
              materialProductOptions={materialProductOptions}
              ownProductLabels={productLabels}
            />
          )}

          {activeTab === "portfolio" && !creator && (
            <p className="text-sm text-[var(--muted)]">
              Sla eerst je profiel op in het tabblad Profiel voordat je je portfolio kunt beheren.
            </p>
          )}
      </CreatorDashboardTabs>
    </section>
  );
}
