/**
 * Copy public filter facets from the pinned private sidecar into articles.
 * Writes only content_kind, crafts, techniques, themes, audience and the
 * sync stamp. A row is written only when the sidecar hash matches the
 * current body, so stale metadata never reaches the public pages.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  articleBodySha256, createLocalSidecarReader, createStorageSidecarReader, loadArticleMetadataSidecar,
} from "../src/lib/content/article-metadata-sidecar";
import { ARTICLE_SIDECAR_RELEASE } from "../src/lib/content/article-sidecar-matching";
import { facetsFromMetadata } from "../src/lib/content/article-facets";

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

  // --bundle-dir reads a local copy of the release. The pinned manifest
  // hash is still enforced, so only the exact release is accepted.
  const dirIdx = argv.indexOf("--bundle-dir");
  const bucket = client.storage.from(ARTICLE_SIDECAR_RELEASE.bucket);
  const bundle = await loadArticleMetadataSidecar(
    dirIdx >= 0
      ? createLocalSidecarReader(path.resolve(argv[dirIdx + 1]))
      : createStorageSidecarReader((p) => bucket.download(p), ARTICLE_SIDECAR_RELEASE.prefix),
    { expectedManifestSha256: ARTICLE_SIDECAR_RELEASE.manifestSha256 },
  );
  const byId = new Map(bundle.articles.map((m) => [m.article_id, m]));

  const stats = { sidecar: byId.size, written: 0, stale: 0, missing: 0, failed: 0 };
  for (let from = 0; ; from += 500) {
    const { data, error } = await client.from("articles").select("id, body_markdown").range(from, from + 499);
    if (error) throw new Error("Article read failed");
    if (!data?.length) break;
    for (const row of data as { id: string; body_markdown: string | null }[]) {
      const meta = byId.get(row.id);
      if (!meta) { stats.missing++; continue; }
      if (typeof row.body_markdown !== "string" || articleBodySha256(row.body_markdown) !== meta.source_sha256) { stats.stale++; continue; }
      if (dryRun) { stats.written++; continue; }
      const { error: updateError } = await client.from("articles").update({
        ...facetsFromMetadata(meta),
        facets_source_sha256: meta.source_sha256,
        facets_synced_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (updateError) stats.failed++; else stats.written++;
    }
  }
  console.log(JSON.stringify({ dryRun, datasetVersion: bundle.datasetVersion, ...stats }));
  if (stats.failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : "Sync failed"); process.exitCode = 1; });
}
