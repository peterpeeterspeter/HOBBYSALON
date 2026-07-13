import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getMaterialCupboardEntries } from "./material-cupboard.ts";

test("derives currently confirmed material keys per source and deduplicates cupboard entries deterministically", () => {
  const entries = getMaterialCupboardEntries(
    [
      {
        entityType: "article",
        entityId: "article-a",
        items: [
          { key: "material:product:wool", title: "Zachte wol", kind: "material" as const },
          { key: "material:product:needle", title: "Breinaalden", kind: "material" as const },
          { key: "step:read", title: "Lees", kind: "step" as const },
        ],
      },
      {
        entityType: "project",
        entityId: "project-b",
        items: [
          { key: "material:product:wool", title: "Zachte wol", kind: "material" as const },
          { key: "material:sought:buttons", title: "Houten knopen", kind: "material" as const },
        ],
      },
    ],
    [
      { eventName: "project_item_completed", entityType: "project", entityId: "project-b", occurredAt: "2026-07-13T10:00:00Z", itemKey: "material:product:wool" },
      { eventName: "project_item_completed", entityType: "project", entityId: "project-b", occurredAt: "2026-07-13T10:30:00Z", itemKey: "material:sought:buttons" },
      { eventName: "project_item_completed", entityType: "article", entityId: "article-a", occurredAt: "2026-07-13T09:00:00Z", itemKey: "material:product:needle" },
      { eventName: "project_item_completed", entityType: "article", entityId: "article-a", occurredAt: "2026-07-13T11:00:00Z", itemKey: "material:product:wool" },
      { eventName: "project_item_reopened", entityType: "article", entityId: "article-a", occurredAt: "2026-07-13T12:00:00Z", itemKey: "material:product:needle" },
      { eventName: "project_item_completed", entityType: "article", entityId: "article-a", occurredAt: "2026-07-13T13:00:00Z", itemKey: "step:read" },
      { eventName: "project_item_completed", entityType: "article", entityId: "not-saved", occurredAt: "2026-07-13T14:00:00Z", itemKey: "material:product:other" },
    ]
  );

  assert.deepEqual(entries, [
    {
      key: "material:sought:buttons",
      title: "Houten knopen",
      activeProjectCount: 1,
    },
    {
      key: "material:product:wool",
      title: "Zachte wol",
      activeProjectCount: 2,
    },
  ]);
});
