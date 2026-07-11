export type FavoriteEntityType = "domain" | "creator" | "product" | "workshop" | "event" | "article" | "project";

export type FavoriteFeedMeta = { label: string; canStartProject: boolean };

export function getFavoriteFeedMeta(entityType: FavoriteEntityType, articleType: string | null): FavoriteFeedMeta {
  if (entityType === "article") return { label: articleType === "pattern" ? "Patroon" : "Artikel", canStartProject: true };
  if (entityType === "project") return { label: "Project", canStartProject: true };
  if (entityType === "product") return { label: "Materiaal", canStartProject: false };
  if (entityType === "workshop") return { label: "Workshop", canStartProject: false };
  if (entityType === "event") return { label: "Markt of event", canStartProject: false };
  if (entityType === "creator") return { label: "Maker", canStartProject: false };
  return { label: "Hobby", canStartProject: false };
}
