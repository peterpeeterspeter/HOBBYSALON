import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolveSupabaseUrl } from "../src/lib/content/supabase-script-env";
import { runArticleMatchingJobs } from "../src/lib/content/article-matching-jobs";
import type { MatchingRpc } from "../src/lib/content/article-matching-jobs";
import type { CatalogRead } from "../src/lib/content/article-catalog-pipeline";

type Args = {help:boolean;maxJobs:number;maxCatalogBatches:number;envFile?:string};
export function parseWorkerArgs(argv: string[]): Args {
  const args: Args = {help:false,maxJobs:5,maxCatalogBatches:4};
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index];
    if (seen.has(name)) throw new Error("Duplicate worker argument");
    seen.add(name);
    if (name === "--help") { args.help = true; continue; }
    if (!["--max-jobs","--max-catalog-batches","--env-file"].includes(name)) throw new Error("Unknown worker argument");
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new Error("Missing worker argument value");
    if (name === "--env-file") args.envFile = path.resolve(value);
    else {
      if (!/^[1-9]\d*$/.test(value) || Number(value) > 20) throw new Error("Invalid worker bound (1..20)");
      if (name === "--max-jobs") args.maxJobs = Number(value);
      else args.maxCatalogBatches = Number(value);
    }
  }
  return args;
}
async function fileEnv(file: string, required = false): Promise<Record<string,string>> {
  try { return parseEnv(await readFile(file,"utf8")); }
  catch (error) {
    if (!required && (error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("Cannot read worker environment file");
  }
}
const TABLES = new Set(["articles","products","workshops","events","event_domains","entity_links"]);
const RPCS = new Set(["graph_claim_matching_jobs","graph_article_fingerprint","graph_propose_article_suggestions","graph_release_matching_job","graph_fanout_matching_job"]);
/** Explicit transport, no SDK/auth fallback, redirects or retries. Never print URLs or bodies. */
export function createWorkerTransport(supabaseUrl: string, key: string): {read:CatalogRead;rpc:MatchingRpc} {
  if (!key) throw new Error("Service-role key required");
  let base: URL;
  try { base = new URL(supabaseUrl); } catch { throw new Error("Invalid worker Supabase URL"); }
  if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error("Invalid worker Supabase URL");
  const request = async (endpoint: string, method: "GET" | "POST", params?: URLSearchParams, args?: Record<string,unknown>): Promise<unknown> => {
    const url = new URL(`${base.pathname.replace(/\/$/,"")}/rest/v1/${endpoint}`,base.origin);
    if (params) url.search = params.toString();
    try {
      const response = await fetch(url, {method,headers:{apikey:key,Authorization:`Bearer ${key}`,
        ...(method === "POST" ? {"Content-Type":"application/json"} : {})},
        ...(method === "POST" ? {body:JSON.stringify(args)} : {}),redirect:"error",signal:AbortSignal.timeout(15000)});
      if (!response.ok) { await response.body?.cancel(); throw new Error("Worker request failed"); }
      return await response.json();
    } catch { throw new Error("Worker request failed"); }
  };
  const read: CatalogRead = async r => {
    // Runtime guard, including when imported by tests: no arbitrary tables/effects.
    if (!TABLES.has(r.table)) throw new Error("Unsupported worker table");
    const params = new URLSearchParams({select:r.columns,order:r.order.map(c=>`${c}.asc`).join(","),offset:String(r.offset),limit:String(r.limit)});
    for (const [column,value] of Object.entries(r.equals ?? {})) params.set(column,`eq.${value}`);
    const rows = await request(r.table,"GET",params);
    if (!Array.isArray(rows) || rows.length > r.limit || rows.some(row=>!row || typeof row!=="object" || Array.isArray(row))) throw new Error("Invalid worker catalog response");
    return rows;
  };
  const rpc: MatchingRpc = async (name,args) => {
    if (!RPCS.has(name)) throw new Error("Unsupported worker RPC");
    return request(`rpc/${name}`,"POST",undefined,args);
  };
  return {read,rpc};
}
export async function main(argv = process.argv.slice(2), environment: Record<string,string | undefined> = process.env): Promise<void> {
  const args = parseWorkerArgs(argv);
  if (args.help) {
    console.log("Single article matching worker run (pending proposals only; never auto-approves). Usage: [--max-jobs N (default 5, max 20)] [--max-catalog-batches N (default 4, max 20)] [--env-file PATH]. Lease: 120 seconds. Requires SUPABASE_SERVICE_ROLE_KEY. Without --env-file, reads storefront .env/.env.local plus process environment. No daemon/scheduling; catalog row count and total run time are not bounded by these job limits.");
    return;
  }
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const files = args.envFile ? await fileEnv(args.envFile,true) : {
    ...await fileEnv(path.resolve(dir,"../.env")),...await fileEnv(path.resolve(dir,"../.env.local")),
  };
  // Local overlay only; never mutate global process.env. An explicit file is isolated
  // from process credentials/URL aliases, preventing accidental cross-project pairing.
  const env = args.envFile ? files : {...files,...environment};
  const url = resolveSupabaseUrl(env);
  const key = env.SUPABASE_SERVICE_ROLE_KEY; // NEVER fall back to an anonymous key.
  if (!url || !key) throw new Error("Worker requires Supabase URL and service-role key");
  const result = await runArticleMatchingJobs({...createWorkerTransport(url,key),maxJobs:args.maxJobs,maxCatalogBatches:args.maxCatalogBatches});
  console.log(JSON.stringify({...result,readScope:"service-role; all eligible catalog owners; existing links both directions; terminal reviews enforced by proposal RPC"}));
  if (result.failed || result.lost) process.exitCode = 1;
}
// Import is inert: only direct entrypoint invocation performs work.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(()=>{console.error("Article matching worker failed; verify arguments, service-role configuration and database RPC availability.");process.exitCode=1;});
}
