import type { ResumableProjectRun } from "./resumable-project-runs";

type SavedStartableFavorite = {
  entityType: string;
  id: string;
  canStartProject: boolean;
};

export function getEligibleResumableProjectRuns(
  runs: ResumableProjectRun[],
  savedFavorites: SavedStartableFavorite[],
): ResumableProjectRun[] {
  const savedStartableKeys = new Set(
    savedFavorites
      .filter((item) => item.canStartProject)
      .map((item) => `${item.entityType}:${item.id}`),
  );

  return runs.filter((run) =>
    savedStartableKeys.has(`${run.entityType}:${run.entityId}`),
  );
}
