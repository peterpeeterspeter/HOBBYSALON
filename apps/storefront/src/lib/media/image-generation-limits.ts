import "server-only";

import { createPlatformClient } from "@/lib/platform/client";

const WINDOW_SECONDS = 3600;
const MAX_PER_WINDOW = 20;

/**
 * Per-user fixed-window rate limiter for paid third-party image generation,
 * backed by user_activity_log. Returns { allowed } or
 * { allowed: false, retryAfterSeconds } when the user exceeded the cap.
 */
export async function checkImageGenerationRateLimit(
  userId: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const supabase = createPlatformClient();
  const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

  const { count, error } = await supabase
    .from("user_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_name", "image_generation")
    .gte("occurred_at", since);

  if (error) {
    // Fail closed on transient DB errors — don't allow unmetered spend.
    return { allowed: false, retryAfterSeconds: 60 };
  }

  if ((count ?? 0) >= MAX_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
  }
  return { allowed: true };
}

export async function recordImageGeneration(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createPlatformClient();
  const { error } = await supabase.from("user_activity_log").insert({
    user_id: userId,
    event_name: "image_generation",
    source: "storefront",
    occurred_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
