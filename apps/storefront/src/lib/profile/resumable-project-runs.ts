export type ProjectActivityEvent = {
  eventName: string;
  entityType: string | null;
  entityId: string | null;
  occurredAt: string;
};

export type ResumableProjectRun = {
  entityType: "article" | "project";
  entityId: string;
  lastActivityAt: string;
};

const PROJECT_EVENT_NAMES = new Set([
  "project_started",
  "project_item_completed",
  "project_item_reopened",
  "project_completed",
  "project_note_updated",
]);

function isStartableType(value: string | null): value is "article" | "project" {
  return value === "article" || value === "project";
}

export function getResumableProjectRuns(
  events: ProjectActivityEvent[]
): ResumableProjectRun[] {
  const bySource = new Map<string, {
    entityType: "article" | "project";
    entityId: string;
    started: boolean;
    completed: boolean;
    lastActivityAt: string;
  }>();

  for (const event of events) {
    if (!PROJECT_EVENT_NAMES.has(event.eventName) || !isStartableType(event.entityType) || !event.entityId) {
      continue;
    }

    const key = `${event.entityType}:${event.entityId}`;
    const run = bySource.get(key) ?? {
      entityType: event.entityType,
      entityId: event.entityId,
      started: false,
      completed: false,
      lastActivityAt: event.occurredAt,
    };

    if (event.eventName === "project_started") run.started = true;
    if (event.eventName === "project_completed") run.completed = true;
    if (event.occurredAt > run.lastActivityAt) run.lastActivityAt = event.occurredAt;
    bySource.set(key, run);
  }

  return [...bySource.values()]
    .filter((run) => run.started && !run.completed)
    .map(({ entityType, entityId, lastActivityAt }) => ({ entityType, entityId, lastActivityAt }))
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}
