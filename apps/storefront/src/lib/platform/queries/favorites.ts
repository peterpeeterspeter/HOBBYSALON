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
