import { createPlatformClient } from "@/lib/platform/client";
import { listProjectProductLinks, listProjectSoughtMaterials, listProjectSteps } from "@/lib/platform/queries/projects";
import type { EntityType } from "@/types/platform";

export type SavedProjectItem = { key: string; title: string; detail: string | null; kind: "step" | "material" | "help" };
export type SavedProjectSource = { entityType: "article" | "project"; entityId: string; title: string; imageUrl: string | null; description: string | null; items: SavedProjectItem[] };

export function isStartableFavoriteType(type: EntityType): type is "article" | "project" { return type === "article" || type === "project"; }

export async function getSavedProjectSource(entityType: "article" | "project", entityId: string): Promise<SavedProjectSource | null> {
  const supabase = createPlatformClient();
  if (entityType === "project") {
    const { data: project } = await supabase.from("projects").select("id,title,short_description,featured_image_url").eq("id", entityId).eq("is_active", true).maybeSingle();
    if (!project) return null;
    const [steps, productLinks, sought] = await Promise.all([listProjectSteps(entityId), listProjectProductLinks(entityId), listProjectSoughtMaterials(entityId)]);
    const productIds = productLinks.map((item) => item.product_id);
    const { data: products } = productIds.length ? await supabase.from("products").select("id,title").in("id", productIds) : { data: [] as Array<{id:string;title:string}> };
    const productById = new Map((products ?? []).map((item) => [item.id, item.title]));
    return { entityType, entityId, title: project.title, imageUrl: project.featured_image_url, description: project.short_description, items: [
      ...steps.map((step) => ({key:`step:${step.id}`,title:step.title,detail:step.instruction,kind:"step" as const})),
      ...productLinks.map((link) => ({key:`material:product:${link.product_id}`,title:productById.get(link.product_id) ?? "Materiaal",detail:null,kind:"material" as const})),
      ...sought.map((item) => ({key:`material:sought:${item.id}`,title:item.title,detail:item.notes,kind:"material" as const})),
    ] };
  }
  const { data: article } = await supabase.from("articles").select("id,title,excerpt,featured_image_url,body_markdown").eq("id", entityId).eq("is_published", true).maybeSingle();
  if (!article) return null;
  const { data: links } = await supabase.from("entity_links").select("target_entity_type,target_entity_id").eq("source_entity_type","article").eq("source_entity_id",entityId).in("target_entity_type",["product","workshop","event"]);
  const productIds=(links??[]).filter((l)=>l.target_entity_type==="product").map((l)=>l.target_entity_id);
  const workshopIds=(links??[]).filter((l)=>l.target_entity_type==="workshop").map((l)=>l.target_entity_id);
  const eventIds=(links??[]).filter((l)=>l.target_entity_type==="event").map((l)=>l.target_entity_id);
  const [products,workshops,events]=await Promise.all([
    productIds.length ? supabase.from("products").select("id,title").in("id",productIds) : Promise.resolve({data:[]}),
    workshopIds.length ? supabase.from("workshops").select("id,title").in("id",workshopIds) : Promise.resolve({data:[]}),
    eventIds.length ? supabase.from("events").select("id,title").in("id",eventIds) : Promise.resolve({data:[]}),
  ]);
  return { entityType, entityId, title:article.title, imageUrl:article.featured_image_url, description:article.excerpt, items:[
    {key:"step:read",title:"Lees het patroon of artikel",detail:"Neem rustig de uitleg door voordat je begint.",kind:"step"},
    ...((products.data??[]) as Array<{id:string;title:string}>).map((item)=>({key:`material:product:${item.id}`,title:item.title,detail:null,kind:"material" as const})),
    ...((workshops.data??[]) as Array<{id:string;title:string}>).map((item)=>({key:`help:workshop:${item.id}`,title:item.title,detail:"Workshop die bij dit idee past",kind:"help" as const})),
    ...((events.data??[]) as Array<{id:string;title:string}>).map((item)=>({key:`help:event:${item.id}`,title:item.title,detail:"Event of markt ter inspiratie",kind:"help" as const})),
  ] };
}
