export const DISCOVERY_FEED_FILTERS = [
  "all",
  "articles",
  "materials",
  "workshops",
  "events",
] as const;

export type DiscoveryFeedFilter = (typeof DISCOVERY_FEED_FILTERS)[number];

type DiscoveryFeedItemWithType = {
  type: "article" | "supply" | "workshop" | "event";
};

const FILTER_TYPES: Record<Exclude<DiscoveryFeedFilter, "all">, DiscoveryFeedItemWithType["type"]> = {
  articles: "article",
  materials: "supply",
  workshops: "workshop",
  events: "event",
};

export function filterDiscoveryFeed<T extends DiscoveryFeedItemWithType>(
  feed: T[],
  filter: DiscoveryFeedFilter,
): T[] {
  if (filter === "all") return feed;

  return feed.filter((item) => item.type === FILTER_TYPES[filter]);
}
