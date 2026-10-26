import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolveSupabaseUrl } from "../src/lib/content/supabase-script-env";
import { loadArticleCatalog, loadArticleExistingKeys, loadCatalogArticles, planArticleSuggestions, type CatalogRead } from "../src/lib/content/article-catalog-pipeline";
import { createPrivateArticleSidecarReader, loadArticleSidecarPlanner, ARTICLE_SIDECAR_RELEASE } from "../src/lib/content/article-sidecar-matching";

// Read-only by design. The dashboard save action may insert pending nominations;
// this tool has no write flag, SDK client, automatic approval or delete path.
type Args = { authorCreatorId?: string; limit?: number; envFile?: string; help: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseArgs(argv: string[]): Args {
  const args: Args = {help:false};
  const seen = new Set<string>();
  for (let index=0; index<argv.length; index++) {
    const arg=argv[index];
    if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
    seen.add(arg);
    if (arg==="--help") { args.help=true; continue; }
    if (arg==="--dry-run") continue;
    if (!["--author-creator-id","--limit","--env-file"].includes(arg)) throw new Error(`Unknown argument: ${arg}`);
    const value=argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value: ${arg}`);
    if (arg==="--author-creator-id") {
      if (!UUID.test(value)) throw new Error("Invalid --author-creator-id");
      args.authorCreatorId=value;
    } else if (arg==="--limit") {
      if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("Invalid --limit value");
      args.limit=Number(value);
    } else args.envFile=path.resolve(value);
  }
  return args;
}
async function readEnvFile(file: string): Promise<Record<string,string | undefined>> {
  try {
    const entries = Object.entries(parseEnv(await readFile(file,"utf8")));
    if (entries.some(([,value])=>typeof value !== "string")) throw new Error("Invalid environment value");
    return Object.fromEntries(entries) as Record<string,string>;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("Cannot read environment file");
  }
}
export async function main(argv = process.argv.slice(2), manifestSha256: string = ARTICLE_SIDECAR_RELEASE.manifestSha256): Promise<void> {
  const args=parseArgs(argv);
  if (args.help) {
    console.log("Read-only article sidecar matcher. Usage: [--dry-run] [--limit N] [--author-creator-id UUID] [--env-file PATH]. Requires a service-role key to download the pinned private sidecar and read review memory. No database writes; output is a JSON review report, not confirmed links.");
    return;
  }
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const fileEnv=args.envFile ? await readEnvFile(args.envFile) : {
    ...await readEnvFile(path.resolve(dir,"../.env")),...await readEnvFile(path.resolve(dir,"../.env.local")),
  };
  const env={...fileEnv,...process.env};
  const supabaseUrl=resolveSupabaseUrl(env);
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) throw new Error("Missing Supabase environment variables");
  let base: URL;
  try { base=new URL(supabaseUrl); } catch { throw new Error("Invalid Supabase URL"); }
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("Invalid Supabase URL");
  const read: CatalogRead=async request=>{
    const url=new URL(`${base.pathname.replace(/\/$/,"")}/rest/v1/${request.table}`,base.origin);
    url.searchParams.set("select",request.columns);
    for(const [column,value] of Object.entries(request.equals ?? {})) url.searchParams.set(column,`eq.${value}`);
    url.searchParams.set("order",request.order.map(column=>`${column}.asc`).join(","));
    url.searchParams.set("offset",String(request.offset)); url.searchParams.set("limit",String(request.limit));
    let response: Response;
    try {
      response=await fetch(url,{method:"GET",headers:{apikey:key,Authorization:`Bearer ${key}`},redirect:"error",signal:AbortSignal.timeout(15000)});
    } catch { throw new Error(`Catalog request failed (${request.table})`); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Catalog read failed (${request.table}, HTTP ${response.status})`);
    }
    let data: unknown;
    try { data=await response.json(); } catch { throw new Error(`Invalid catalog response (${request.table})`); }
    if (!Array.isArray(data) || data.some(row=>!row || typeof row!=="object" || Array.isArray(row))) throw new Error(`Invalid catalog response (${request.table})`);
    return data;
  };
  const plan = await loadArticleSidecarPlanner(createPrivateArticleSidecarReader(supabaseUrl,key),manifestSha256);
  const articles=await loadCatalogArticles(read,{authorCreatorId:args.authorCreatorId,limit:args.limit});
  const catalog=articles.length ? await loadArticleCatalog(read) : [];
  const proposals: ReturnType<typeof planArticleSuggestions>=[];
  const sidecarStates: Record<string,number> = {};
  for (const article of articles) {
    const keys=await loadArticleExistingKeys(read,article.id,{includeReviews:true});
    const result = await plan(article,catalog,keys);
    sidecarStates[result.state] = (sidecarStates[result.state] ?? 0) + 1;
    proposals.push(...result.suggestions);
  }
  console.log(JSON.stringify({mode:"dry-run",writes:0,articlesScanned:articles.length,catalogCandidates:catalog.length,
    visibility:"service-role read; pinned private sidecar; eligible catalog and complete review decisions",sidecarStates,
    proposals,notice:"Voorstellen ter menselijke bevestiging; tekstuele overeenkomst is geen geverifieerde compatibiliteit of vereist materiaal."},null,2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(()=>{console.error("Article sidecar dry-run failed; verify configuration and pinned private release.");process.exitCode=1;});
}
