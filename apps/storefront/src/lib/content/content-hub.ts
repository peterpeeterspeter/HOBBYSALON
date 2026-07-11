export type ContentHubFilterItem = {
  id: string;
  title: string;
  articleType: string;
  domainSlug: string | null;
};

export type ContentHubFilters = {
  type: string;
  domain: string;
  search: string;
};

export function filterContentHubItems<T extends ContentHubFilterItem>(
  items: T[],
  filters: ContentHubFilters
): T[] {
  const query = filters.search.trim().toLocaleLowerCase("nl-BE");
  return items.filter((item) => {
    if (filters.type !== "all" && item.articleType !== filters.type) return false;
    if (filters.domain !== "all" && item.domainSlug !== filters.domain) return false;
    return !query || item.title.toLocaleLowerCase("nl-BE").includes(query);
  });
}
