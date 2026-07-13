import "server-only";

import { createPlatformClient } from "@/lib/platform/client";
import { listFavoriteFeed } from "./favorite-feed";
import { getResumableProjectRuns, type ResumableProjectRun } from "./resumable-project-runs";
import { getEligibleResumableProjectRuns } from "./resumable-saved-projects";
import { getSavedProjectSource, type SavedProjectSource } from "./saved-project-source";

export type ResumableSavedProject = ResumableProjectRun & {
  source: SavedProjectSource;
};

export async function resolveResumableSavedProjects(
  events: Parameters<typeof getResumableProjectRuns>[0],
  savedFavorites: Awaited<ReturnType<typeof listFavoriteFeed>>,
): Promise<ResumableSavedProject[]> {
  const resumableRuns = getEligibleResumableProjectRuns(
    getResumableProjectRuns(events),
    savedFavorites,
  );

  return (
    await Promise.all(
      resumableRuns.map(async (run) => {
        const source = await getSavedProjectSource(run.entityType, run.entityId);
        return source ? { ...run, source } : null;
      }),
    )
  ).filter((item): item is ResumableSavedProject => item !== null);
}

export async function listResumableSavedProjects(
  userId: string,
): Promise<ResumableSavedProject[]> {
  const supabase = createPlatformClient();
  const [activityResult, savedFavorites] = await Promise.all([
    supabase
      .from("user_activity_log")
      .select("event_name,entity_type,entity_id,occurred_at")
      .eq("user_id", userId)
      .in("event_name", [
        "project_started",
        "project_item_completed",
        "project_item_reopened",
        "project_completed",
        "project_note_updated",
      ]),
    listFavoriteFeed(userId, 80),
  ] as const);

  return resolveResumableSavedProjects(
    (activityResult.data ?? []).map((event) => ({
      eventName: event.event_name,
      entityType: event.entity_type,
      entityId: event.entity_id,
      occurredAt: event.occurred_at,
    })),
    savedFavorites,
  );
}
