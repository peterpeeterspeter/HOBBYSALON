/** Offline, read-only audit. No environment files or network clients are loaded. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditArticleMetadataSidecar, createLocalSidecarReader, loadArticleMetadataSidecar,
  type ArticleSource,
} from "../src/lib/content/article-metadata-sidecar";

export function parseSidecarArgs(argv: string[]) {
  const args: Record<string, string> = {};
  if (argv.length === 1 && argv[0] === "--help") return { help: true as const };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!["--bundle-dir", "--article-hashes", "--out"].includes(flag) || args[flag] || !argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("Invalid sidecar arguments");
    args[flag] = argv[i + 1];
  }
  if (!args["--bundle-dir"] || !args["--article-hashes"]) throw new Error("Sidecar audit requires --bundle-dir and --article-hashes");
  return { help: false as const, bundleDir: args["--bundle-dir"], articleHashes: args["--article-hashes"], out: args["--out"] };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseSidecarArgs(argv);
  if (args.help) {
    console.log("Read-only sidecar audit: --bundle-dir PATH --article-hashes PATH [--out PATH]. Hash input is a complete JSON array, or {captured_at, articles:[...]}. --out writes a local detailed review report; stdout contains a summary. No matching or publication is performed.");
    return;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(args.articleHashes, "utf8")); }
  catch { throw new Error("Unable to parse article hash snapshot"); }
  const envelope = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  const articles = Array.isArray(parsed) ? parsed : envelope?.articles;
  if (!Array.isArray(articles) || (envelope?.captured_at !== undefined && typeof envelope.captured_at !== "string")) throw new Error("Invalid article hash snapshot");
  const bundle = await loadArticleMetadataSidecar(createLocalSidecarReader(args.bundleDir));
  const report = auditArticleMetadataSidecar(bundle, { kind: "hash_snapshot", articles: articles as ArticleSource[], capturedAt: envelope?.captured_at as string | undefined });
  if (args.out) {
    const out = resolve(args.out);
    const inputs = [resolve(args.articleHashes), resolve(args.bundleDir, "manifest.json"), ...bundle.verifiedFiles.map(file => resolve(args.bundleDir, file.path))];
    if (inputs.includes(out)) throw new Error("Report output cannot overwrite source input");
    await writeFile(out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  }
  const { inputs: reviewInputs, ...summary } = report;
  console.log(JSON.stringify({ ...summary, reviewInputCount: reviewInputs.length, reportWritten: Boolean(args.out) }));
  if (!report.corpusMatches) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Our errors contain file identifiers/line numbers, never bodies or credentials.
    const message = error instanceof Error && /^(Invalid |Sidecar |Manifest |Malformed |Duplicate |Unable |Report |Private |Article |New |Missing )/.test(error.message) ? error.message : "Sidecar audit failed";
    console.error(message);
    process.exitCode = 1;
  });
}
