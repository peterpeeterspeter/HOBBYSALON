import { createPlatformClient } from "@/lib/platform/client";
import { getEntityConnections } from "@/lib/platform/queries/entity-links";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listWorkshopsByIds } from "@/lib/platform/queries/workshops";
import {
  listProjectProductLinks,
  listProjectSoughtMaterials,
  listProjectSteps,
} from "@/lib/platform/queries/projects";
import type { EntityType } from "@/types/platform";
import type { ProjectRequirementItem } from "./project-requirements";

export type SavedProjectItem = ProjectRequirementItem & {
  detail: string | null;
  href?: string;
};

export type SavedProjectSource = {
  entityType: "article" | "project";
  entityId: string;
  title: string;
  imageUrl: string | null;
  description: string | null;
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

export async function getSavedProjectSource(
  entityType: "article" | "project",
  entityId: string
): Promise<SavedProjectSource | null> {
  const supabase = createPlatformClient();

  if (entityType === "project") {
    const { data: project } = await supabase
      .from("projects")
      .select("id,title,short_description,featured_image_url")
      .eq("id", entityId)
      .eq("is_active", true)
      .maybeSingle();
    if (!project) return null;

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
      items: [
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
    .select("id,title,excerpt,featured_image_url")
    .eq("id", entityId)
    .eq("is_published", true)
    .maybeSingle();
  if (!article) return null;

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
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; slug: string; short_description: string | null }> }),
    listWorkshopsByIds(workshopIds),
    listEventsByIds(eventIds),
  ]);

  const products = orderByIds(productResult.data ?? [], productIds);
  const orderedWorkshops = orderByIds(workshops, workshopIds);
  const orderedEvents = orderByIds(events, eventIds);

  return {
    entityType,
    entityId,
    title: article.title,
    imageUrl: article.featured_image_url,
    description: article.excerpt,
    items: [
      {
        key: "step:read",
        title: "Lees het patroon of artikel",
        detail: "Neem rustig de uitleg door voordat je begint.",
        kind: "step",
      },
      ...products.map((product) => ({
        key: `material:product:${product.id}`,
        title: product.title,
        detail: product.short_description,
        href: `/product/${product.slug}`,
        kind: "material" as const,
      })),
      ...orderedWorkshops.map((workshop) => ({
        key: `workshop:${workshop.id}`,
        title: workshop.title,
        detail: workshop.short_description,
        href: `/workshop/${workshop.slug}`,
        kind: "workshop" as const,
      })),
      ...orderedEvents.map((event) => ({
        key: `event:${event.id}`,
        title: event.title,
        detail: event.short_description,
        href: `/agenda/${event.slug}`,
        kind: "event" as const,
      })),
    ],
  };
}
