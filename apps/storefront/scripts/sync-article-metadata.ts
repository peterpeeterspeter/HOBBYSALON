/**
 * Import article metadata into public.article_metadata, then refresh the
 * filter facets.
 *
 * The bucket file may be republished in place, so this command does not
 * trust it as a whole. Each row must pass the fixed safety contract and
 * its source_sha256 must match the article's current text. Rows that fail
 * are skipped and counted; a stored row is never replaced by a failing one.
 * Stored rows whose article text has changed since are deleted.
 *
 * Usage: [--file PATH] [--dry-run] [--no-facets] [--env-file PATH]
 * Without --file it reads <prefix>/article_metadata.jsonl from the private
 * bucket.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { articleBodySha256, checkArticleMetadataRow } from "../src/lib/content/article-metadata-sidecar";
import { ARTICLE_SIDECAR_RELEASE } from "../src/lib/content/article-sidecar-matching";
import { main as syncFacets } from "./sync-article-facets";

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const envFile = arg(argv, "--env-file");
  const vars: Record<string, string | undefined> = envFile
    ? { ...process.env, ...(parseEnv(await readFile(path.resolve(envFile), "utf8")) as Record<string, string>) }
    : process.env;
  const url = vars.NEXT_PUBLIC_SUPABASE_URL, key = vars.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, { auth: { persistSession: false } });

  let bytes: Uint8Array;
  const file = arg(argv, "--file");
  if (file) {
    bytes = await readFile(path.resolve(file));
  } else {
    const { data, error } = await client.storage
      .from(ARTICLE_SIDECAR_RELEASE.bucket)
      .download(`${ARTICLE_SIDECAR_RELEASE.prefix}/article_metadata.jsonl`);
    if (error || !data) throw new Error("Private sidecar download failed");
    bytes = new Uint8Array(await data.arrayBuffer());
  }
  const fileSha = createHash("sha256").update(bytes).digest("hex");
  const lines = new TextDecoder("utf-8", { fatal: true }).decode(bytes).split(/\r?\n/).filter((l) => l.trim());

  const stats = { lines: lines.length, invalid: 0, duplicate: 0, orphan: 0, stale: 0, imported: 0, removedStale: 0, failed: 0 };
  const candidates = new Map<string, ReturnType<typeof checkArticleMetadataRow> & object>();
  for (const line of lines) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { stats.invalid++; continue; }
    const row = checkArticleMetadataRow(value);
    if (!row) { stats.invalid++; continue; }
    if (candidates.has(row.article_id)) { stats.duplicate++; continue; }
    candidates.set(row.article_id, row);
  }

  // Current article text decides what is fresh.
  const bodySha = new Map<string, string | null>();
  for (let from = 0; ; from += 500) {
    const { data, error } = await client.from("articles").select("id, body_markdown").order("id").range(from, from + 499);
    if (error) throw new Error("Article read failed");
    if (!data?.length) break;
    for (const r of data as { id: string; body_markdown: string | null }[]) {
      bodySha.set(r.id, typeof r.body_markdown === "string" ? articleBodySha256(r.body_markdown) : null);
    }
    if (data.length < 500) break;
  }

  const upserts: Record<string, unknown>[] = [];
  for (const [id, row] of candidates) {
    if (!bodySha.has(id)) { stats.orphan++; continue; }
    if (bodySha.get(id) !== row.source_sha256) { stats.stale++; continue; }
    upserts.push({
      article_id: id,
      metadata: row,
      source_sha256: row.source_sha256,
      metadata_version: String(row.metadata_version),
      source_file_sha256: fileSha,
      imported_at: new Date().toISOString(),
    });
  }

  // Stored rows that no longer match the current text.
  const staleStored: string[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await client.from("article_metadata").select("article_id, source_sha256").order("article_id").range(from, from + 499);
    if (error) throw new Error("Stored metadata read failed");
    if (!data?.length) break;
    for (const r of data as { article_id: string; source_sha256: string }[]) {
      if (bodySha.get(r.article_id) !== r.source_sha256 && !upserts.some((u) => u.article_id === r.article_id)) {
        staleStored.push(r.article_id);
      }
    }
    if (data.length < 500) break;
  }

  if (dryRun) {
    stats.imported = upserts.length;
    stats.removedStale = staleStored.length;
  } else {
    for (let i = 0; i < upserts.length; i += 200) {
      const batch = upserts.slice(i, i + 200);
      const { error } = await client.from("article_metadata").upsert(batch, { onConflict: "article_id" });
      if (error) stats.failed += batch.length; else stats.imported += batch.length;
    }
    for (let i = 0; i < staleStored.length; i += 200) {
      const batch = staleStored.slice(i, i + 200);
      const { error } = await client.from("article_metadata").delete().in("article_id", batch);
      if (error) stats.failed += batch.length; else stats.removedStale += batch.length;
    }
  }
  console.log(JSON.stringify({ step: "metadata", dryRun, sourceFileSha256: fileSha, ...stats }));
  if (stats.failed) { process.exitCode = 1; return; }

  if (!argv.includes("--no-facets")) {
    await syncFacets([...(dryRun ? ["--dry-run"] : []), ...(envFile ? ["--env-file", envFile] : [])]);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : "Metadata sync failed"); process.exitCode = 1; });
}
