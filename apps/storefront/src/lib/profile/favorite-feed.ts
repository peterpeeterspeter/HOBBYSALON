import { createPlatformClient } from "@/lib/platform/client";
import { listFavoritesByUser } from "@/lib/platform/queries/favorites";
import type { EntityType } from "@/types/platform";
import { getFavoriteFeedMeta } from "./favorite-feed-meta";

export type FavoriteFeedItem = {
  id: string;
  entityType: EntityType;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  label: string;
  savedAt: string;
  canStartProject: boolean;
};

export async function listFavoriteFeed(userId: string, limit = 24): Promise<FavoriteFeedItem[]> {
  const favorites = (await listFavoritesByUser(userId)).slice(0, Math.max(1, limit));
  const idsByType: Record<EntityType, string[]> = {
    domain: [], creator: [], product: [], workshop: [], event: [], article: [], project: [],
  };
  for (const favorite of favorites) idsByType[favorite.entity_type].push(favorite.entity_id);
  const supabase = createPlatformClient();
  const [domains, creators, products, workshops, events, articles, projects] = await Promise.all([
    idsByType.domain.length ? supabase.from("domains").select("id,slug,name,hero_image_url").in("id", idsByType.domain) : Promise.resolve({ data: [] }),
    idsByType.creator.length ? supabase.from("creators").select("id,slug,display_name,bio,avatar_url").in("id", idsByType.creator) : Promise.resolve({ data: [] }),
    idsByType.product.length ? supabase.from("products").select("id,slug,title,short_description,featured_image_url").in("id", idsByType.product) : Promise.resolve({ data: [] }),
    idsByType.workshop.length ? supabase.from("workshops").select("id,slug,title,short_description,featured_image_url").in("id", idsByType.workshop) : Promise.resolve({ data: [] }),
    idsByType.event.length ? supabase.from("events").select("id,slug,title,short_description,featured_image_url").in("id", idsByType.event) : Promise.resolve({ data: [] }),
    idsByType.article.length ? supabase.from("articles").select("id,slug,title,excerpt,featured_image_url,article_type").in("id", idsByType.article) : Promise.resolve({ data: [] }),
    idsByType.project.length ? supabase.from("projects").select("id,slug,title,short_description,featured_image_url").in("id", idsByType.project) : Promise.resolve({ data: [] }),
  ]);
  const resolved = new Map<string, Omit<FavoriteFeedItem, "savedAt">>();
  for (const item of domains.data ?? []) resolved.set(`domain:${item.id}`, { id:item.id, entityType:"domain", title:item.name, subtitle:null, imageUrl:item.hero_image_url, href:`/${item.slug}`, ...getFavoriteFeedMeta("domain", null) });
  for (const item of creators.data ?? []) resolved.set(`creator:${item.id}`, { id:item.id, entityType:"creator", title:item.display_name, subtitle:item.bio, imageUrl:item.avatar_url, href:`/creator/${item.slug}`, ...getFavoriteFeedMeta("creator", null) });
  for (const item of products.data ?? []) resolved.set(`product:${item.id}`, { id:item.id, entityType:"product", title:item.title, subtitle:item.short_description, imageUrl:item.featured_image_url, href:`/product/${item.slug}`, ...getFavoriteFeedMeta("product", null) });
  for (const item of workshops.data ?? []) resolved.set(`workshop:${item.id}`, { id:item.id, entityType:"workshop", title:item.title, subtitle:item.short_description, imageUrl:item.featured_image_url, href:`/workshop/${item.slug}`, ...getFavoriteFeedMeta("workshop", null) });
  for (const item of events.data ?? []) resolved.set(`event:${item.id}`, { id:item.id, entityType:"event", title:item.title, subtitle:item.short_description, imageUrl:item.featured_image_url, href:`/agenda/${item.slug}`, ...getFavoriteFeedMeta("event", null) });
  for (const item of articles.data ?? []) { const meta=getFavoriteFeedMeta("article",item.article_type); resolved.set(`article:${item.id}`, { id:item.id, entityType:"article", title:item.title, subtitle:item.excerpt, imageUrl:item.featured_image_url, href:`/artikel/${item.slug}`, ...meta }); }
  for (const item of projects.data ?? []) resolved.set(`project:${item.id}`, { id:item.id, entityType:"project", title:item.title, subtitle:item.short_description, imageUrl:item.featured_image_url, href:`/project/${item.slug}`, ...getFavoriteFeedMeta("project", null) });
  return favorites.flatMap((favorite) => { const item=resolved.get(`${favorite.entity_type}:${favorite.entity_id}`); return item ? [{...item,savedAt:favorite.created_at}] : []; });
}
