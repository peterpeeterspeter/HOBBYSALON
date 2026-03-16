import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

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
  domain_id: string | null;
  is_featured: boolean;
  updated_at: string;
};

type WorkshopRow = {
  id: string;
  domain_id: string | null;
  is_featured: boolean;
  updated_at: string;
};

type EventRow = {
  id: string;
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
        .select("id,domain_id,is_featured,updated_at")
        .eq("is_active", true)
        .eq("status", "active")
        .in("domain_id", domainIds),
      supabase
        .from("workshops")
        .select("id,domain_id,is_featured,updated_at")
        .eq("is_active", true)
        .in("domain_id", domainIds),
      supabase
        .from("events")
        .select("id,is_featured,starts_at")
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
    relation_type: "related";
    weight: number;
    sort_order: number;
  }> = [];

  let skippedNoDomain = 0;

  for (const article of articles) {
    if (!article.domain_id) {
      skippedNoDomain += 1;
      continue;
    }

    let sortOrder = 1;

    const products = (productsByDomain.get(article.domain_id) ?? []).slice(0, 2);
    for (const product of products) {
      const keyValue = `${article.id}:product:${product.id}`;
      if (existing.has(keyValue)) continue;
      toInsert.push({
        source_entity_type: "article",
        source_entity_id: article.id,
        target_entity_type: "product",
        target_entity_id: product.id,
        relation_type: "related",
        weight: 80,
        sort_order: sortOrder,
      });
      existing.add(keyValue);
      sortOrder += 1;
    }

    const workshops = (workshopsByDomain.get(article.domain_id) ?? []).slice(0, 2);
    for (const workshop of workshops) {
      const keyValue = `${article.id}:workshop:${workshop.id}`;
      if (existing.has(keyValue)) continue;
      toInsert.push({
        source_entity_type: "article",
        source_entity_id: article.id,
        target_entity_type: "workshop",
        target_entity_id: workshop.id,
        relation_type: "related",
        weight: 70,
        sort_order: sortOrder,
      });
      existing.add(keyValue);
      sortOrder += 1;
    }

    const events = (eventsByDomain.get(article.domain_id) ?? []).slice(0, 1);
    for (const event of events) {
      const keyValue = `${article.id}:event:${event.id}`;
      if (existing.has(keyValue)) continue;
      toInsert.push({
        source_entity_type: "article",
        source_entity_id: article.id,
        target_entity_type: "event",
        target_entity_id: event.id,
        relation_type: "related",
        weight: 60,
        sort_order: sortOrder,
      });
      existing.add(keyValue);
      sortOrder += 1;
    }
  }

  console.log(`Articles scanned: ${articles.length}`);
  console.log(`Skipped (no domain): ${skippedNoDomain}`);
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
