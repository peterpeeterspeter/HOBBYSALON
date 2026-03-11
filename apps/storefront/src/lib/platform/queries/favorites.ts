import { createPlatformClient } from "../client";
import type { EntityType } from "@/types/platform";

export type Favorite = {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  created_at: string;
};

export async function isFavorite(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1);

  return !!data?.length;
}

export async function listFavoritesByUser(userId: string): Promise<Favorite[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as Favorite[];
}

export type FavoriteProfileSummary = {
  total: number;
  byType: Record<EntityType, number>;
};

function createFavoriteTypeCounter(): Record<EntityType, number> {
  return {
    domain: 0,
    creator: 0,
    product: 0,
    workshop: 0,
    event: 0,
    article: 0,
    project: 0,
  };
}

export async function getFavoriteProfileSummary(
  userId: string
): Promise<FavoriteProfileSummary> {
  const favorites = await listFavoritesByUser(userId);
  const byType = createFavoriteTypeCounter();

  for (const favorite of favorites) {
    byType[favorite.entity_type] += 1;
  }

  return {
    total: favorites.length,
    byType,
  };
}
