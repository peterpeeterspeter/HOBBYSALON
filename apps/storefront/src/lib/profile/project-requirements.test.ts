import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { groupProjectRequirements } from "./project-requirements.ts";

test("groups requirements into materials, offers, workshops, events and steps", () => {
  const grouped = groupProjectRequirements([
    { key: "material:list:1", kind: "material", title: "Katoengaren" },
    { key: "offer:product:9", kind: "offer", title: "Extra garen" },
    { key: "workshop:2", kind: "workshop", title: "Haakworkshop" },
    { key: "event:3", kind: "event", title: "Creatieve markt" },
    { key: "step:read", kind: "step", title: "Lees eerst" },
  ]);

  assert.deepEqual(grouped.materials.map((item) => item.title), ["Katoengaren"]);
  assert.deepEqual(grouped.offers.map((item) => item.title), ["Extra garen"]);
  assert.deepEqual(grouped.workshops.map((item) => item.title), ["Haakworkshop"]);
  assert.deepEqual(grouped.events.map((item) => item.title), ["Creatieve markt"]);
  assert.deepEqual(grouped.steps.map((item) => item.title), ["Lees eerst"]);
});
