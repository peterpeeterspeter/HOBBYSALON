"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import type { EntityType } from "@/types/platform";

const ALLOWED_ENTITY_TYPES = new Set<EntityType>([
  "domain",
  "creator",
  "product",
  "workshop",
  "event",
  "article",
  "project",
]);

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const user = await getAuthUser();
  const nextPath = formData.get("next_path")?.toString() || "/";
  const entityType = formData.get("entity_type")?.toString() as EntityType;
  const entityId = formData.get("entity_id")?.toString();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!entityId || !ALLOWED_ENTITY_TYPES.has(entityType)) {
    redirect(`${nextPath}?error=${encodeURIComponent("Ongeldige favoriet.")}`);
  }

  const supabase = createPlatformClient();
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from("favorites")
      .delete()
      .eq("id", existing[0].id)
      .eq("user_id", user.id);
  } else {
    await supabase.from("favorites").insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
    });
  }

  revalidatePath(nextPath);
  revalidatePath("/favorites");
  redirect(nextPath);
}
