import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getLatestProjectNote, readProjectNote } from "./project-notes.ts";

test("returns the newest valid personal note from project note events", () => {
  const note = getLatestProjectNote([
    { eventName: "project_note_updated", occurredAt: "2026-07-10T10:00:00Z", metadata: { note: "Eerste versie" } },
    { eventName: "project_item_completed", occurredAt: "2026-07-10T10:01:00Z", metadata: { item_key: "step:1" } },
    { eventName: "project_note_updated", occurredAt: "2026-07-10T10:02:00Z", metadata: { note: "Nieuwe versie" } },
  ]);

  assert.equal(note, "Nieuwe versie");
});

test("trims a short note and rejects an empty or overly long note", () => {
  assert.equal(readProjectNote("  Wol bestellen  "), "Wol bestellen");
  assert.throws(() => readProjectNote("   "), /Schrijf een korte notitie/);
  assert.throws(() => readProjectNote("x".repeat(501)), /maximaal 500 tekens/);
});
