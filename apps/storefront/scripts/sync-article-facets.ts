/**
 * Copy public filter facets from public.article_metadata into articles.
 * Writes only content_kind, crafts, techniques, themes, audience and the
 * sync stamp. A row is written only when the stored hash matches the
 * current body, so stale metadata never reaches the public pages. Rows
 * without fresh metadata lose old facets.
 *
 * Usage: [--dry-run] [--env-file PATH]. Run `sync:article-metadata` first,
 * or use it alone: it calls this step at the end.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { articleBodySha256, checkArticleMetadataRow } from "../src/lib/content/article-metadata-sidecar";
import { listStoredArticleMetadata } from "../src/lib/content/article-metadata-store";
import { canonicalizeCorpus, facetsFromMetadata } from "../src/lib/content/article-facets";

async function env(file?: string): Promise<Record<string, string | undefined>> {
  if (!file) return process.env;
  return { ...process.env, ...(parseEnv(await readFile(file, "utf8")) as Record<string, string>) };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const fileIdx = argv.indexOf("--env-file");
  const vars = await env(fileIdx >= 0 ? path.resolve(argv[fileIdx + 1]) : undefined);
  const url = vars.NEXT_PUBLIC_SUPABASE_URL, key = vars.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const stored = (await listStoredArticleMetadata(client))
    .map(checkArticleMetadataRow)
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const byId = new Map(stored.map((m) => [m.article_id, m]));
  // Merge plural and inflection variants over the whole corpus first.
  const canonical = canonicalizeCorpus(stored.map(facetsFromMetadata));
  const facetsById = new Map(stored.map((m, i) => [m.article_id, canonical[i]]));

  const stats = { stored: byId.size, written: 0, stale: 0, missing: 0, cleared: 0, failed: 0 };
  const EMPTY = { content_kind: null, crafts: [], techniques: [], themes: [], audience: [], facets_source_sha256: null, facets_synced_at: null };
  for (let from = 0; ; from += 500) {
    const { data, error } = await client
      .from("articles")
      .select("id, body_markdown, facets_source_sha256")
      .order("id")
      .range(from, from + 499);
    if (error) throw new Error("Article read failed");
    if (!data?.length) break;
    for (const row of data as { id: string; body_markdown: string | null; facets_source_sha256: string | null }[]) {
      const meta = byId.get(row.id);
      const fresh = !!meta && typeof row.body_markdown === "string" && articleBodySha256(row.body_markdown) === meta.source_sha256;
      if (!fresh) {
        if (meta) stats.stale++; else stats.missing++;
        // Old facets from an earlier sync no longer describe this text.
        if (row.facets_source_sha256 && !dryRun) {
          const { error: clearError } = await client.from("articles").update(EMPTY).eq("id", row.id);
          if (clearError) stats.failed++; else stats.cleared++;
        }
        continue;
      }
      if (dryRun) { stats.written++; continue; }
      const { error: updateError } = await client.from("articles").update({
        ...facetsById.get(row.id)!,
        facets_source_sha256: meta!.source_sha256,
        facets_synced_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (updateError) stats.failed++; else stats.written++;
    }
    if (data.length < 500) break;
  }
  console.log(JSON.stringify({ step: "facets", dryRun, ...stats }));
  if (stats.failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : "Sync failed"); process.exitCode = 1; });
}
