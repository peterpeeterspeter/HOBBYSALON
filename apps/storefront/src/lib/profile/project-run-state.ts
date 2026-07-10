export type ProjectRunEvent = {
  eventName: string;
  occurredAt: string;
  itemKey: string | null;
};

export type ProjectRunState = {
  status: "not_started" | "in_progress" | "completed";
  completedItemKeys: Set<string>;
  progressPercent: number;
  completedAt: string | null;
};

export function getProjectRunState(
  events: ProjectRunEvent[],
  itemKeys: string[]
): ProjectRunState {
  const completedItemKeys = new Set<string>();
  let started = false;
  let completedAt: string | null = null;

  for (const event of [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    if (event.eventName === "project_started") started = true;
    if (event.eventName === "project_item_completed" && event.itemKey) {
      completedItemKeys.add(event.itemKey);
    }
    if (event.eventName === "project_item_reopened" && event.itemKey) {
      completedItemKeys.delete(event.itemKey);
    }
    if (event.eventName === "project_completed") completedAt = event.occurredAt;
  }

  const total = itemKeys.length;
  const completedCount = itemKeys.filter((key) => completedItemKeys.has(key)).length;
  const progressPercent = completedAt
    ? 100
    : total === 0
      ? started
        ? 0
        : 0
      : Math.round((completedCount / total) * 100);

  return {
    status: completedAt ? "completed" : started ? "in_progress" : "not_started",
    completedItemKeys,
    progressPercent,
    completedAt,
  };
}
