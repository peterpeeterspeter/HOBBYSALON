import type { FavoriteFeedItem } from "./favorite-feed";

export type FavoriteFeedFilterType = "all" | "startable" | "workshops" | "materials";

export type FavoriteFeedFilters = {
  type: FavoriteFeedFilterType;
  search: string;
};

export function filterFavoriteFeed(
  items: FavoriteFeedItem[],
  { type, search }: FavoriteFeedFilters,
): FavoriteFeedItem[] {
  const query = search.trim().toLocaleLowerCase("nl-BE");

  return items.filter((item) => {
    const matchesType =
      type === "all" ||
      (type === "startable" && item.canStartProject) ||
      (type === "workshops" && item.entityType === "workshop") ||
      (type === "materials" && item.entityType === "product");
    const matchesSearch =
      !query ||
      item.title.toLocaleLowerCase("nl-BE").includes(query) ||
      item.subtitle?.toLocaleLowerCase("nl-BE").includes(query);

    return matchesType && matchesSearch;
  });
}
