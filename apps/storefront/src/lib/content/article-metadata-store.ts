/**
 * Read side of the article_metadata table. Takes a Supabase client so the
 * server, scripts and workers share one paging rule.
 */
type Client = {
  from(table: string): {
    select(columns: string): {
      order(column: string): {
        range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
};

const PAGE = 500;

/** Every stored metadata object, ordered by article id for stable paging. */
export async function listStoredArticleMetadata(client: Client): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("article_metadata")
      .select("metadata")
      .order("article_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Article metadata read failed");
    if (!data?.length) break;
    for (const row of data as { metadata: unknown }[]) rows.push(row.metadata);
    if (data.length < PAGE) break;
  }
  return rows;
}
