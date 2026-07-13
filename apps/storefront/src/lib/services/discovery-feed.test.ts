import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { createDiscoveryFeed } from "./discovery-feed.ts";

type Item = { id: string };

const item = (id: string): Item => ({ id });

test("interleaves each discovery type in the fixed article, supply, workshop, event order", () => {
  const feed = createDiscoveryFeed(
    {
      articles: [item("article-1"), item("article-2")],
      supplies: [item("supply-1"), item("supply-2")],
      workshops: [item("workshop-1"), item("workshop-2")],
      events: [item("event-1"), item("event-2")],
    },
    8,
  );

  assert.deepEqual(
    feed.map(({ type, item }) => `${type}:${item.id}`),
    [
      "article:article-1",
      "supply:supply-1",
      "workshop:workshop-1",
      "event:event-1",
      "article:article-2",
      "supply:supply-2",
      "workshop:workshop-2",
      "event:event-2",
    ],
  );
});

test("skips missing types while preserving the rotation and requested limit", () => {
  const feed = createDiscoveryFeed(
    {
      articles: [item("article-1"), item("article-2")],
      supplies: [],
      workshops: [item("workshop-1"), item("workshop-2")],
      events: [item("event-1")],
    },
    4,
  );

  assert.deepEqual(
    feed.map(({ type, item }) => `${type}:${item.id}`),
    ["article:article-1", "workshop:workshop-1", "event:event-1", "article:article-2"],
  );
});
