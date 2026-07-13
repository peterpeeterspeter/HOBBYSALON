export type DiscoveryFeedItem<TArticle, TSupply, TWorkshop, TEvent> =
  | { type: "article"; item: TArticle }
  | { type: "supply"; item: TSupply }
  | { type: "workshop"; item: TWorkshop }
  | { type: "event"; item: TEvent };

export type DiscoveryFeedInput<TArticle, TSupply, TWorkshop, TEvent> = {
  articles: TArticle[];
  supplies: TSupply[];
  workshops: TWorkshop[];
  events: TEvent[];
};

export function createDiscoveryFeed<TArticle, TSupply, TWorkshop, TEvent>(
  { articles, supplies, workshops, events }: DiscoveryFeedInput<
    TArticle,
    TSupply,
    TWorkshop,
    TEvent
  >,
  limit: number,
): DiscoveryFeedItem<TArticle, TSupply, TWorkshop, TEvent>[] {
  const feed: DiscoveryFeedItem<TArticle, TSupply, TWorkshop, TEvent>[] = [];
  const longestSourceLength = Math.max(
    articles.length,
    supplies.length,
    workshops.length,
    events.length,
  );

  for (let index = 0; index < longestSourceLength && feed.length < limit; index += 1) {
    const article = articles[index];
    if (article !== undefined) feed.push({ type: "article", item: article });
    if (feed.length === limit) break;

    const supply = supplies[index];
    if (supply !== undefined) feed.push({ type: "supply", item: supply });
    if (feed.length === limit) break;

    const workshop = workshops[index];
    if (workshop !== undefined) feed.push({ type: "workshop", item: workshop });
    if (feed.length === limit) break;

    const event = events[index];
    if (event !== undefined) feed.push({ type: "event", item: event });
  }

  return feed;
}
