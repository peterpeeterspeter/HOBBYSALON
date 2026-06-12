import { createPlatformClient } from "@/lib/platform/client";
import type {
  Workshop,
  Creator,
  Event,
  Article,
  Product,
} from "@/types/platform";

export type SearchResults = {
  workshops: Workshop[];
  products: Product[];
  creators: Creator[];
  events: Event[];
  articles: Article[];
  total: number;
};

const PER_TYPE_LIMIT = 24;

const EMPTY: SearchResults = {
  workshops: [],
  products: [],
  creators: [],
  events: [],
  articles: [],
  total: 0,
};

/**
 * Unified text search across the content graph. Each entity type is queried
 * independently against its own table (title / name / summary columns) and
 * mapped onto the existing card models. A failing branch degrades to an empty
 * list rather than breaking the whole page.
 */
export async function searchAll(rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY;

  // Neutralise characters that would break PostgREST `or(...)` filters.
  const term = query.replace(/[%,()]/g, " ");
  const like = `%${term}%`;
  const supabase = createPlatformClient();

  const [workshopsRes, productsRes, creatorsRes, eventsRes, articlesRes] =
    await Promise.all([
      supabase
        .from("workshops")
        .select("*")
        .eq("is_active", true)
        .or(`title.ilike.${like},short_description.ilike.${like}`)
        .order("is_featured", { ascending: false })
        .limit(PER_TYPE_LIMIT),
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("status", "active")
        .or(`title.ilike.${like},short_description.ilike.${like}`)
        .limit(PER_TYPE_LIMIT),
      supabase
        .from("creators")
        .select("*")
        .or(`display_name.ilike.${like},bio.ilike.${like}`)
        .limit(PER_TYPE_LIMIT),
      supabase
        .from("events")
        .select("*")
        .or(`title.ilike.${like},short_description.ilike.${like}`)
        .order("starts_at", { ascending: true })
        .limit(PER_TYPE_LIMIT),
      supabase
        .from("articles")
        .select("*")
        .eq("is_published", true)
        .or(`title.ilike.${like},excerpt.ilike.${like}`)
        .limit(PER_TYPE_LIMIT),
    ]);

  const workshops = (workshopsRes.data ?? []) as Workshop[];
  const products = (productsRes.data ?? []) as Product[];
  const creators = (creatorsRes.data ?? []) as Creator[];
  const events = (eventsRes.data ?? []) as Event[];
  const articles = (articlesRes.data ?? []) as Article[];

  return {
    workshops,
    products,
    creators,
    events,
    articles,
    total:
      workshops.length +
      products.length +
      creators.length +
      events.length +
      articles.length,
  };
}
