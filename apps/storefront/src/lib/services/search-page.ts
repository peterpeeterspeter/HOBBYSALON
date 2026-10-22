import { createPlatformClient } from "@/lib/platform/client";
import { mergeLocalThenFill } from "@/lib/markets/discovery-preference";
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

export type SearchAllOptions = {
  /** Soft preference: fetch local physical rows first, then fill. */
  preferredCountryCode?: string | null;
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

function normalizePreferred(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Unified text search across the content graph. Each entity type is queried
 * independently against its own table (title / name / summary columns) and
 * mapped onto the existing card models. A failing branch degrades to an empty
 * list rather than breaking the whole page.
 *
 * Used by header search, homepage search, and /zoeken.
 * Listing-page heroes (/workshops, /materials, …) filter only that catalog.
 *
 * When preferredCountryCode is set, each location-aware type fetches local
 * rows before PER_TYPE_LIMIT, then fills with other matches. Articles stay
 * the Belgian publication set (no new country filter / canonical).
 * Products are not labeled as NL-deliverable (sales_country_codes = changeset C).
 */
export async function searchAll(
  rawQuery: string,
  options?: SearchAllOptions
): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY;

  // Neutralise characters that would break PostgREST `or(...)` filters.
  const term = query.replace(/[%,()]/g, " ").replace(/"/g, "").trim();
  if (term.length < 2) return EMPTY;
  // Quote values so spaces in multi-word queries stay inside one filter value.
  const like = `"%${term}%"`;
  const supabase = createPlatformClient();
  const preferred = normalizePreferred(options?.preferredCountryCode);

  const workshopLocal = preferred
    ? supabase
        .from("workshops")
        .select("*")
        .eq("is_active", true)
        .eq("country_code", preferred)
        .neq("format_type", "online")
        .neq("format_type", "hybrid")
        .or(
          `title.ilike.${like},short_description.ilike.${like},description.ilike.${like}`
        )
        .order("is_featured", { ascending: false })
        .limit(PER_TYPE_LIMIT)
    : null;

  const creatorLocal = preferred
    ? supabase
        .from("creators")
        .select("*")
        .eq("is_active", true)
        .eq("country_code", preferred)
        .or(
          `display_name.ilike.${like},business_name.ilike.${like},bio.ilike.${like}`
        )
        .limit(PER_TYPE_LIMIT)
    : null;

  const eventLocal = preferred
    ? supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .eq("country_code", preferred)
        .neq("event_type", "online")
        .or(
          `title.ilike.${like},short_description.ilike.${like},description.ilike.${like}`
        )
        .order("starts_at", { ascending: true })
        .limit(PER_TYPE_LIMIT)
    : null;

  const [
    workshopsLocalRes,
    workshopsRes,
    productsRes,
    creatorsLocalRes,
    creatorsRes,
    eventsLocalRes,
    eventsRes,
    articlesRes,
  ] = await Promise.all([
    workshopLocal ?? Promise.resolve({ data: null, error: null }),
    supabase
      .from("workshops")
      .select("*")
      .eq("is_active", true)
      .or(
        `title.ilike.${like},short_description.ilike.${like},description.ilike.${like}`
      )
      .order("is_featured", { ascending: false })
      .limit(PER_TYPE_LIMIT),
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq("status", "active")
      .or(
        `title.ilike.${like},short_description.ilike.${like},description.ilike.${like}`
      )
      .limit(PER_TYPE_LIMIT),
    creatorLocal ?? Promise.resolve({ data: null, error: null }),
    supabase
      .from("creators")
      .select("*")
      .eq("is_active", true)
      .or(
        `display_name.ilike.${like},business_name.ilike.${like},bio.ilike.${like}`
      )
      .limit(PER_TYPE_LIMIT),
    eventLocal ?? Promise.resolve({ data: null, error: null }),
    supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .or(
        `title.ilike.${like},short_description.ilike.${like},description.ilike.${like}`
      )
      .order("starts_at", { ascending: true })
      .limit(PER_TYPE_LIMIT),
    supabase
      .from("articles")
      .select("*")
      .eq("is_published", true)
      .or(`title.ilike.${like},excerpt.ilike.${like}`)
      .limit(PER_TYPE_LIMIT),
  ]);

  if (workshopsRes.error) {
    console.error("searchAll workshops failed", workshopsRes.error.message);
  }
  if (productsRes.error) {
    console.error("searchAll products failed", productsRes.error.message);
  }
  if (creatorsRes.error) {
    console.error("searchAll creators failed", creatorsRes.error.message);
  }
  if (eventsRes.error) {
    console.error("searchAll events failed", eventsRes.error.message);
  }
  if (articlesRes.error) {
    console.error("searchAll articles failed", articlesRes.error.message);
  }

  const workshopsFiller = (workshopsRes.data ?? []) as Workshop[];
  const creatorsFiller = (creatorsRes.data ?? []) as Creator[];
  const eventsFiller = (eventsRes.data ?? []) as Event[];
  const products = (productsRes.data ?? []) as Product[];
  const articles = (articlesRes.data ?? []) as Article[];

  const workshops = preferred
    ? mergeLocalThenFill(
        (workshopsLocalRes.data ?? []) as Workshop[],
        workshopsFiller,
        PER_TYPE_LIMIT
      )
    : workshopsFiller;

  const creators = preferred
    ? mergeLocalThenFill(
        (creatorsLocalRes.data ?? []) as Creator[],
        creatorsFiller,
        PER_TYPE_LIMIT
      )
    : creatorsFiller;

  const events = preferred
    ? mergeLocalThenFill(
        (eventsLocalRes.data ?? []) as Event[],
        eventsFiller,
        PER_TYPE_LIMIT
      )
    : eventsFiller;

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
