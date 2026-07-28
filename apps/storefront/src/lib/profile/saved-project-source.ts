import { createPlatformClient } from "@/lib/platform/client";
import { getEntityConnections } from "@/lib/platform/queries/entity-links";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listWorkshopsByIds } from "@/lib/platform/queries/workshops";
import {
  listProjectProductLinks,
  listProjectSoughtMaterials,
  listProjectSteps,
} from "@/lib/platform/queries/projects";
import {
  mergeMaterialsWithProducts,
  parseArticleMaterials,
} from "@/lib/content/parse-article-materials";
import type { EntityType } from "@/types/platform";
import type { ProjectRequirementItem } from "./project-requirements";

export type SavedProjectItem = ProjectRequirementItem & {
  detail: string | null;
  href?: string;
  linkLabel?: string;
};

export type SavedProjectSource = {
  entityType: "article" | "project";
  entityId: string;
  title: string;
  imageUrl: string | null;
  description: string | null;
  sourceHref: string | null;
  sourceCtaLabel: string;
  items: SavedProjectItem[];
};

export function isStartableFavoriteType(
  type: EntityType
): type is "article" | "project" {
  return type === "article" || type === "project";
}

function orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is T => item != null);
}

function articleSourceCtaLabel(articleType: string | null | undefined): string {
  if (articleType === "pattern") {
    return "Bekijk het originele patroon";
  }
  return "Lees het originele artikel";
}

export async function getSavedProjectSource(
  entityType: "article" | "project",
  entityId: string
): Promise<SavedProjectSource | null> {
  const supabase = createPlatformClient();

  if (entityType === "project") {
    const { data: project } = await supabase
      .from("projects")
      .select("id,slug,title,short_description,featured_image_url")
      .eq("id", entityId)
      .eq("is_active", true)
      .maybeSingle();
    if (!project) return null;

    const sourceHref = project.slug ? `/project/${project.slug}` : null;
    const sourceCtaLabel = "Bekijk het project";

    const [steps, productLinks, sought] = await Promise.all([
      listProjectSteps(entityId),
      listProjectProductLinks(entityId),
      listProjectSoughtMaterials(entityId),
    ]);
    const productIds = productLinks.map((item) => item.product_id);
    const { data: products } = productIds.length
      ? await supabase.from("products").select("id,title,slug").in("id", productIds)
      : { data: [] as Array<{ id: string; title: string; slug: string }> };
    const productById = new Map((products ?? []).map((item) => [item.id, item]));

    return {
      entityType,
      entityId,
      title: project.title,
      imageUrl: project.featured_image_url,
      description: project.short_description,
      sourceHref,
      sourceCtaLabel,
      items: [
        ...(sourceHref
          ? [
              {
                key: "step:read",
                title: "Bekijk het project",
                detail: "Neem rustig de uitleg door voordat je begint.",
                href: sourceHref,
                linkLabel: sourceCtaLabel,
                kind: "step" as const,
              },
            ]
          : []),
        ...steps.map((step) => ({
          key: `step:${step.id}`,
          title: step.title,
          detail: step.instruction,
          kind: "step" as const,
        })),
        ...productLinks.map((link) => {
          const product = productById.get(link.product_id);
          return {
            key: `material:product:${link.product_id}`,
            title: product?.title ?? "Materiaal",
            detail: null,
            href: product ? `/product/${product.slug}` : undefined,
            linkLabel: product ? "Bekijk" : undefined,
            kind: "material" as const,
          };
        }),
        ...sought.map((item) => ({
          key: `material:sought:${item.id}`,
          title: item.title,
          detail: item.notes,
          kind: "material" as const,
        })),
      ],
    };
  }

  const { data: article } = await supabase
    .from("articles")
    .select("id,slug,title,excerpt,featured_image_url,body_markdown,article_type")
    .eq("id", entityId)
    .eq("is_published", true)
    .maybeSingle();
  if (!article) return null;

  const sourceHref = article.slug ? `/artikel/${article.slug}` : null;
  const sourceCtaLabel = articleSourceCtaLabel(article.article_type);

  const connections = await getEntityConnections("article", entityId);
  const productIds = connections
    .filter((connection) => connection.entityType === "product")
    .map((connection) => connection.entityId);
  const workshopIds = connections
    .filter((connection) => connection.entityType === "workshop")
    .map((connection) => connection.entityId);
  const eventIds = connections
    .filter((connection) => connection.entityType === "event")
    .map((connection) => connection.entityId);

  const [productResult, workshops, events] = await Promise.all([
    productIds.length
      ? supabase
          .from("products")
          .select("id,title,slug,short_description")
          .in("id", [...new Set(productIds)])
          .eq("is_active", true)
          .eq("status", "active")
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            title: string;
            slug: string;
            short_description: string | null;
          }>,
        }),
    listWorkshopsByIds(workshopIds),
    listEventsByIds(eventIds),
  ]);

  const products = orderByIds(productResult.data ?? [], productIds);
  const orderedWorkshops = orderByIds(workshops, workshopIds);
  const orderedEvents = orderByIds(events, eventIds);

  const checklist = parseArticleMaterials(article.body_markdown);
  const { materials, offers } = mergeMaterialsWithProducts(checklist, products);

  return {
    entityType,
    entityId,
    title: article.title,
    imageUrl: article.featured_image_url,
    description: article.excerpt,
    sourceHref,
    sourceCtaLabel,
    items: [
      {
        key: "step:read",
        title:
          article.article_type === "pattern"
            ? "Lees het patroon"
            : "Lees het artikel",
        detail: "Neem rustig de uitleg door voordat je begint.",
        href: sourceHref ?? undefined,
        linkLabel: sourceCtaLabel,
        kind: "step",
      },
      ...materials,
      ...offers,
      ...orderedWorkshops.map((workshop) => ({
        key: `workshop:${workshop.id}`,
        title: workshop.title,
        detail: workshop.short_description,
        href: `/workshop/${workshop.slug}`,
        linkLabel: "Bekijk aanbod",
        kind: "workshop" as const,
      })),
      ...orderedEvents.map((event) => ({
        key: `event:${event.id}`,
        title: event.title,
        detail: event.short_description,
        href: `/agenda/${event.slug}`,
        linkLabel: "Bekijk aanbod",
        kind: "event" as const,
      })),
    ],
  };
}
