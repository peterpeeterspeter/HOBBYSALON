import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { filterDiscoveryFeed } from "./discovery-feed-filters.ts";

type FeedItem = {
  id: string;
  type: "article" | "supply" | "workshop" | "event";
};

const feed: FeedItem[] = [
  { id: "article-1", type: "article" },
  { id: "supply-1", type: "supply" },
  { id: "workshop-1", type: "workshop" },
  { id: "event-1", type: "event" },
];

test("returns the mixed feed for Alles and only the chosen discovery category", () => {
  assert.deepEqual(filterDiscoveryFeed(feed, "all").map(({ id }) => id), [
    "article-1",
    "supply-1",
    "workshop-1",
    "event-1",
  ]);
  assert.deepEqual(filterDiscoveryFeed(feed, "articles").map(({ id }) => id), ["article-1"]);
  assert.deepEqual(filterDiscoveryFeed(feed, "materials").map(({ id }) => id), ["supply-1"]);
  assert.deepEqual(filterDiscoveryFeed(feed, "workshops").map(({ id }) => id), ["workshop-1"]);
  assert.deepEqual(filterDiscoveryFeed(feed, "events").map(({ id }) => id), ["event-1"]);
});
