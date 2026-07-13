import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getEligibleResumableProjectRuns } from "./resumable-saved-projects.ts";

test("keeps only resumable runs whose saved source can be started", () => {
  const runs = getEligibleResumableProjectRuns(
    [
      { entityType: "article", entityId: "saved-article", lastActivityAt: "2026-07-13T10:00:00Z" },
      { entityType: "project", entityId: "not-saved", lastActivityAt: "2026-07-13T11:00:00Z" },
      { entityType: "article", entityId: "saved-but-not-startable", lastActivityAt: "2026-07-13T12:00:00Z" },
    ],
    [
      { entityType: "article", id: "saved-article", canStartProject: true },
      { entityType: "article", id: "saved-but-not-startable", canStartProject: false },
      { entityType: "project", id: "saved-completed", canStartProject: true },
    ],
  );

  assert.deepEqual(runs, [
    {
      entityType: "article",
      entityId: "saved-article",
      lastActivityAt: "2026-07-13T10:00:00Z",
    },
  ]);
});
