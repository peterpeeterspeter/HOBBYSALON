import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
// @ts-expect-error Node's TypeScript script runner requires the extension.
import { resolveSupabaseUrl } from "../src/lib/content/supabase-script-env.ts";
import { selectGraphSuggestions } from "../src/lib/platform/graph-match.ts";

type Args = {
  authorCreatorId: string;
  limit: number | null;
  dryRun: boolean;
};

type ArticleRow = {
  id: string;
  title: string;
  domain_id: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  domain_id: string | null;
  is_featured: boolean;
  updated_at: string;
};

type WorkshopRow = {
  id: string;
  title: string;
  domain_id: string | null;
  is_featured: boolean;
  updated_at: string;
};

type EventRow = {
  id: string;
  title: string;
  is_featured: boolean;
  starts_at: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function parseArgs(argv: string[]): Args {
  const args: Args = {
    authorCreatorId: "c2222222-2222-2222-2222-222222222299",
    limit: null,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--author-creator-id" && argv[i + 1]) {
      args.authorCreatorId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      args.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  if (args.limit !== null && (Number.isNaN(args.limit) || args.limit <= 0)) {
    throw new Error("Invalid --limit value");
  }

  return args;
}

function byFeaturedAndRecent<T extends { is_featured: boolean; updated_at?: string; starts_at?: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const aDate = a.updated_at ?? a.starts_at ?? "";
    const bDate = b.updated_at ?? b.starts_at ?? "";
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = resolveSupabaseUrl(process.env);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey ?? anonKey;

  if (!supabaseUrl || !key) {
    throw new Error("Missing Supabase env vars.");
  }

  if (!serviceKey) {
    console.warn("Warning: using anon key; writes depend on RLS.");
  }

  const supabase = createClient(supabaseUrl, key);

  let articleQuery = supabase
    .from("articles")
    .select("id,title,domain_id")
    .eq("author_creator_id", args.authorCreatorId)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (args.limit !== null) {
    articleQuery = articleQuery.limit(args.limit);
  }

  const { data: articlesData, error: articlesError } = await articleQuery;
  if (articlesError) throw new Error(`Load articles failed: ${articlesError.message}`);

  const articles = (articlesData ?? []) as ArticleRow[];
  const articleIds = articles.map((a) => a.id);
  const domainIds = [...new Set(articles.map((a) => a.domain_id).filter(Boolean))] as string[];

  if (articles.length === 0) {
    console.log("No articles found for auto-linking.");
    return;
  }

  const [productsResult, workshopsResult, eventsResult, eventDomainsResult, existingLinksResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,title,domain_id,is_featured,updated_at")
        .eq("is_active", true)
        .eq("status", "active")
        .in("domain_id", domainIds),
      supabase
        .from("workshops")
        .select("id,title,domain_id,is_featured,updated_at")
        .eq("is_active", true)
        .in("domain_id", domainIds),
      supabase
        .from("events")
        .select("id,title,is_featured,starts_at")
        .eq("is_active", true)
        .gte("ends_at", new Date().toISOString()),
      supabase
        .from("event_domains")
        .select("event_id,domain_id")
        .in("domain_id", domainIds),
      supabase
        .from("entity_links")
        .select("source_entity_id,target_entity_type,target_entity_id")
        .eq("source_entity_type", "article")
        .in("source_entity_id", articleIds)
        .in("target_entity_type", ["product", "workshop", "event"]),
    ]);

  if (productsResult.error) throw new Error(`Load products failed: ${productsResult.error.message}`);
  if (workshopsResult.error)
    throw new Error(`Load workshops failed: ${workshopsResult.error.message}`);
  if (eventsResult.error) throw new Error(`Load events failed: ${eventsResult.error.message}`);
  if (eventDomainsResult.error)
    throw new Error(`Load event domains failed: ${eventDomainsResult.error.message}`);
  if (existingLinksResult.error)
    throw new Error(`Load existing links failed: ${existingLinksResult.error.message}`);

  const productsByDomain = new Map<string, ProductRow[]>();
  for (const row of byFeaturedAndRecent((productsResult.data ?? []) as ProductRow[])) {
    if (!row.domain_id) continue;
    const arr = productsByDomain.get(row.domain_id) ?? [];
    arr.push(row);
    productsByDomain.set(row.domain_id, arr);
  }

  const workshopsByDomain = new Map<string, WorkshopRow[]>();
  for (const row of byFeaturedAndRecent((workshopsResult.data ?? []) as WorkshopRow[])) {
    if (!row.domain_id) continue;
    const arr = workshopsByDomain.get(row.domain_id) ?? [];
    arr.push(row);
    workshopsByDomain.set(row.domain_id, arr);
  }

  const eventsByDomain = new Map<string, EventRow[]>();
  const eventsById = new Map(((eventsResult.data ?? []) as EventRow[]).map((e) => [e.id, e]));
  const eventDomainRows = (eventDomainsResult.data ?? []) as Array<{ event_id: string; domain_id: string }>;
  for (const link of eventDomainRows) {
    const event = eventsById.get(link.event_id);
    if (!event) continue;
    const arr = eventsByDomain.get(link.domain_id) ?? [];
    arr.push(event);
    eventsByDomain.set(link.domain_id, arr);
  }
  for (const [domainId, rows] of eventsByDomain.entries()) {
    eventsByDomain.set(domainId, byFeaturedAndRecent(rows));
  }

  const existing = new Set(
    ((existingLinksResult.data ?? []) as Array<{
      source_entity_id: string;
      target_entity_type: string;
      target_entity_id: string;
    }>).map((r) => `${r.source_entity_id}:${r.target_entity_type}:${r.target_entity_id}`)
  );

  const toInsert: Array<{
    source_entity_type: "article";
    source_entity_id: string;
    target_entity_type: "product" | "workshop" | "event";
    target_entity_id: string;
    relation_type: "suggested_auto";
    weight: number;
    sort_order: number;
  }> = [];

  let skippedNoText = 0;

  for (const article of articles) {
    const sourceText = article.title ?? "";
    if (!sourceText.trim()) {
      skippedNoText += 1;
      continue;
    }

    const domainProducts = article.domain_id
      ? (productsByDomain.get(article.domain_id) ?? [])
      : [];
    const domainWorkshops = article.domain_id
      ? (workshopsByDomain.get(article.domain_id) ?? [])
      : [];
    const domainEvents = article.domain_id
      ? (eventsByDomain.get(article.domain_id) ?? [])
      : [];

    const existingKeys = new Set(
      [...existing]
        .filter((key) => key.startsWith(`${article.id}:`))
        .map((key) => key.slice(article.id.length + 1))
    );

    const selected = selectGraphSuggestions(article.domain_id, sourceText, [
      ...domainProducts.map((product) => ({
        targetType: "product" as const,
        targetId: product.id,
        title: product.title,
        domainId: product.domain_id,
      })),
      ...domainWorkshops.map((workshop) => ({
        targetType: "workshop" as const,
        targetId: workshop.id,
        title: workshop.title,
        domainId: workshop.domain_id,
      })),
      ...domainEvents.map((event) => ({
        targetType: "event" as const,
        targetId: event.id,
        title: event.title,
        domainId: article.domain_id,
      })),
    ], existingKeys);

    selected.forEach(({ candidate, score }, index) => {
      toInsert.push({
        source_entity_type: "article",
        source_entity_id: article.id,
        target_entity_type: candidate.targetType,
        target_entity_id: candidate.targetId,
        relation_type: "suggested_auto",
        weight: score,
        sort_order: index + 1,
      });
      existing.add(`${article.id}:${candidate.targetType}:${candidate.targetId}`);
    });
  }

  console.log(`Articles scanned: ${articles.length}`);
  console.log(`Skipped (no title): ${skippedNoText}`);
  console.log(`Links to insert: ${toInsert.length}`);

  if (args.dryRun || toInsert.length === 0) {
    console.log(args.dryRun ? "Dry-run complete." : "Nothing to insert.");
    return;
  }

  const chunkSize = 500;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error } = await supabase.from("entity_links").insert(chunk);
    if (error) {
      throw new Error(`Insert entity links failed: ${error.message}`);
    }
    inserted += chunk.length;
  }

  console.log(`Inserted links: ${inserted}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
