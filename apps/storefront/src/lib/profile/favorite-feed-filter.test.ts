import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { filterFavoriteFeed } from "./favorite-feed-filter.ts";
import type { FavoriteFeedItem } from "./favorite-feed";

const items: FavoriteFeedItem[] = [
  { id: "article-1", entityType: "article", title: "Leren haken", subtitle: "Een rustig begin", imageUrl: null, href: "/artikel/leren-haken", label: "Artikel", savedAt: "2026-01-01", canStartProject: true },
  { id: "project-1", entityType: "project", title: "Mijn trui", subtitle: "Wol en breinaalden", imageUrl: null, href: "/project/mijn-trui", label: "Project", savedAt: "2026-01-02", canStartProject: true },
  { id: "workshop-1", entityType: "workshop", title: "Workshop keramiek", subtitle: "Antwerpen", imageUrl: null, href: "/workshop/keramiek", label: "Workshop", savedAt: "2026-01-03", canStartProject: false },
  { id: "product-1", entityType: "product", title: "Merinowol", subtitle: "Zacht materiaal", imageUrl: null, href: "/product/merinowol", label: "Materiaal", savedAt: "2026-01-04", canStartProject: false },
  { id: "creator-1", entityType: "creator", title: "Mieke maakt", subtitle: null, imageUrl: null, href: "/creator/mieke", label: "Maker", savedAt: "2026-01-05", canStartProject: false },
];

test("returns all favorites when no filter is active", () => {
  assert.deepEqual(filterFavoriteFeed(items, { type: "all", search: "" }), items);
});

test("shows only startable articles and projects", () => {
  assert.deepEqual(
    filterFavoriteFeed(items, { type: "startable", search: "" }).map((item) => item.id),
    ["article-1", "project-1"],
  );
});

test("filters workshops and materials separately", () => {
  assert.deepEqual(filterFavoriteFeed(items, { type: "workshops", search: "" }).map((item) => item.id), ["workshop-1"]);
  assert.deepEqual(filterFavoriteFeed(items, { type: "materials", search: "" }).map((item) => item.id), ["product-1"]);
});

test("searches title and subtitle without regard to case or surrounding spaces", () => {
  assert.deepEqual(filterFavoriteFeed(items, { type: "all", search: "  WOL  " }).map((item) => item.id), ["project-1", "product-1"]);
  assert.deepEqual(filterFavoriteFeed(items, { type: "all", search: "antwerpen" }).map((item) => item.id), ["workshop-1"]);
});

test("combines the type filter with the search query", () => {
  assert.deepEqual(filterFavoriteFeed(items, { type: "materials", search: "wol" }).map((item) => item.id), ["product-1"]);
  assert.deepEqual(filterFavoriteFeed(items, { type: "workshops", search: "wol" }), []);
});
