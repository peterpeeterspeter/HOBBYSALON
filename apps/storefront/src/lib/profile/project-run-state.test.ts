import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getProjectRunState, isProjectReadyToComplete } from "./project-run-state.ts";

test("keeps a saved project active until it is completed", () => {
  const state = getProjectRunState(
    [
      { eventName: "project_started", occurredAt: "2026-07-10T10:00:00Z", itemKey: null },
      { eventName: "project_item_completed", occurredAt: "2026-07-10T10:01:00Z", itemKey: "material:wool" },
    ],
    ["material:wool", "step:1"]
  );

  assert.equal(state.status, "in_progress");
  assert.equal(state.completedItemKeys.has("material:wool"), true);
  assert.equal(state.progressPercent, 50);
});

test("marks a saved project as finished after completion", () => {
  const state = getProjectRunState(
    [
      { eventName: "project_started", occurredAt: "2026-07-10T10:00:00Z", itemKey: null },
      { eventName: "project_completed", occurredAt: "2026-07-10T12:00:00Z", itemKey: null },
    ],
    []
  );

  assert.equal(state.status, "completed");
  assert.equal(state.completedAt, "2026-07-10T12:00:00Z");
  assert.equal(state.progressPercent, 100);
});

test("only allows completion after required materials and steps are confirmed", () => {
  assert.equal(
    isProjectReadyToComplete(new Set(["material:yarn"]), ["material:yarn", "step:read"]),
    false
  );
  assert.equal(
    isProjectReadyToComplete(
      new Set(["material:yarn", "step:read"]),
      ["material:yarn", "step:read"]
    ),
    true
  );
});
