export type ContentHubFilterItem = {
  id: string;
  title: string;
  searchText: string;
  articleType: string;
  domainSlug: string | null;
  domainSlugs: string[];
  difficultyLevel: string | null;
};

export type ContentHubFilters = {
  type: string;
  domain: string;
  difficulty: string;
  search: string;
};

export function filterContentHubItems<T extends ContentHubFilterItem>(
  items: T[],
  filters: ContentHubFilters
): T[] {
  const query = filters.search.trim().toLocaleLowerCase("nl-BE");
  return items.filter((item) => {
    if (filters.type !== "all" && item.articleType !== filters.type) return false;
    if (filters.domain !== "all") {
      const slugs =
        item.domainSlugs.length > 0
          ? item.domainSlugs
          : item.domainSlug
            ? [item.domainSlug]
            : [];
      if (!slugs.includes(filters.domain)) return false;
    }
    if (filters.difficulty !== "all" && item.difficultyLevel !== filters.difficulty) {
      return false;
    }
    if (!query) return true;
    const haystack = (item.searchText || item.title).toLocaleLowerCase("nl-BE");
    return haystack.includes(query);
  });
}
