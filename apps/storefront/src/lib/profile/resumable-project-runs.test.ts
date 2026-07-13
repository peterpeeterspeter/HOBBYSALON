import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getResumableProjectRuns } from "./resumable-project-runs.ts";

test("returns only started article and project runs that have not been completed", () => {
  const runs = getResumableProjectRuns([
    { eventName: "project_started", entityType: "article", entityId: "article-open", occurredAt: "2026-07-10T09:00:00Z" },
    { eventName: "project_item_completed", entityType: "article", entityId: "article-open", occurredAt: "2026-07-10T10:00:00Z" },
    { eventName: "project_started", entityType: "project", entityId: "project-done", occurredAt: "2026-07-10T11:00:00Z" },
    { eventName: "project_completed", entityType: "project", entityId: "project-done", occurredAt: "2026-07-10T12:00:00Z" },
    { eventName: "project_started", entityType: "product", entityId: "not-startable", occurredAt: "2026-07-10T13:00:00Z" },
    { eventName: "project_item_reopened", entityType: "article", entityId: "without-start", occurredAt: "2026-07-10T14:00:00Z" },
  ]);

  assert.deepEqual(runs, [
    {
      entityType: "article",
      entityId: "article-open",
      lastActivityAt: "2026-07-10T10:00:00Z",
    },
  ]);
});

test("sorts resumable runs by their newest project activity", () => {
  const runs = getResumableProjectRuns([
    { eventName: "project_started", entityType: "article", entityId: "older", occurredAt: "2026-07-10T09:00:00Z" },
    { eventName: "project_started", entityType: "project", entityId: "newer", occurredAt: "2026-07-10T10:00:00Z" },
    { eventName: "project_note_updated", entityType: "article", entityId: "older", occurredAt: "2026-07-10T11:00:00Z" },
    { eventName: "project_item_completed", entityType: "project", entityId: "newer", occurredAt: "2026-07-10T12:00:00Z" },
  ]);

  assert.deepEqual(runs, [
    { entityType: "project", entityId: "newer", lastActivityAt: "2026-07-10T12:00:00Z" },
    { entityType: "article", entityId: "older", lastActivityAt: "2026-07-10T11:00:00Z" },
  ]);
});
