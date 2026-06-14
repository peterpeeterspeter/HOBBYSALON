import "server-only";

import type { VisibilityBoost } from "@/types/platform";
import { createPlatformClient } from "./client";

export const RANKING_WEIGHTS = {
  featured: 8,
  planPremium: 5,
} as const;

export function computeRankingScore(input: {
  baseScore?: number;
  isFeatured?: boolean;
  boostScore?: number;
  planWeight?: number;
}): number {
  let score = input.baseScore ?? 0;
  if (input.isFeatured) score += RANKING_WEIGHTS.featured;
  if (input.boostScore) score += input.boostScore;
  if (input.planWeight) score += input.planWeight;
  return score;
}

export async function getActiveBoostScoreForEntity(
  entityType: VisibilityBoost["entity_type"],
  entityId: string
): Promise<number> {
  const supabase = createPlatformClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("visibility_boosts")
    .select("boost_score, ends_at, starts_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .lte("starts_at", now);

  if (error || !data?.length) return 0;

  return data.reduce((sum, row) => {
    if (row.ends_at && new Date(row.ends_at).getTime() < Date.now()) return sum;
    return sum + (row.boost_score ?? 0);
  }, 0);
}

export async function getActiveBoostScoresForEntities(
  entityType: VisibilityBoost["entity_type"],
  entityIds: string[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (entityIds.length === 0) return scores;

  const supabase = createPlatformClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("visibility_boosts")
    .select("entity_id, boost_score, ends_at, starts_at")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .lte("starts_at", now);

  if (error || !data) return scores;

  for (const row of data) {
    if (row.ends_at && new Date(row.ends_at).getTime() < Date.now()) continue;
    const current = scores.get(row.entity_id) ?? 0;
    scores.set(row.entity_id, current + (row.boost_score ?? 0));
  }
  return scores;
}

export async function createVisibilityBoost(input: {
  entityType: VisibilityBoost["entity_type"];
  entityId: string;
  boostType: VisibilityBoost["boost_type"];
  source: VisibilityBoost["source"];
  boostScore?: number;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("visibility_boosts")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      boost_type: input.boostType,
      source: input.source,
      boost_score: input.boostScore ?? 100,
      ends_at: input.endsAt ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function grantPlanVisibilityBoost(input: {
  entityType: VisibilityBoost["entity_type"];
  entityId: string;
  planCode: string;
  durationDays?: number;
}): Promise<void> {
  const endsAt = input.durationDays
    ? new Date(Date.now() + input.durationDays * 86400000).toISOString()
    : null;

  await createVisibilityBoost({
    entityType: input.entityType,
    entityId: input.entityId,
    boostType: input.planCode.includes("premium") ? "spotlight" : "category_top",
    source: "plan",
    boostScore: input.planCode.includes("premium") ? 100 : 50,
    endsAt,
    metadata: { plan_code: input.planCode },
  });
}
