import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolveSupabaseUrl } from "../src/lib/content/supabase-script-env";
import { loadArticleCatalog, loadArticleExistingKeys, loadCatalogArticles, planArticleSuggestions } from "../src/lib/content/article-catalog-pipeline";
import type { CatalogRead } from "../src/lib/content/article-catalog-pipeline";

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
  try { return parseEnv(await readFile(file,"utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("Cannot read environment file");
  }
}
async function main(): Promise<void> {
  const args=parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Read-only article catalog matcher. Usage: [--dry-run] [--limit N] [--author-creator-id UUID] [--env-file PATH]. No database writes; output is a JSON review report, not confirmed links.");
    return;
  }
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const fileEnv=args.envFile ? await readEnvFile(args.envFile) : {
    ...await readEnvFile(path.resolve(dir,"../.env")),...await readEnvFile(path.resolve(dir,"../.env.local")),
  };
  const env={...fileEnv,...process.env};
  const supabaseUrl=resolveSupabaseUrl(env);
  const key=env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  const articles=await loadCatalogArticles(read,{authorCreatorId:args.authorCreatorId,limit:args.limit});
  const catalog=articles.length ? await loadArticleCatalog(read) : [];
  const proposals: ReturnType<typeof planArticleSuggestions>=[];
  for (const article of articles) {
    const keys=await loadArticleExistingKeys(read,article.id);
    proposals.push(...planArticleSuggestions(article,catalog,keys));
  }
  console.log(JSON.stringify({mode:"dry-run",writes:0,articlesScanned:articles.length,catalogCandidates:catalog.length,
    visibility:env.SUPABASE_SERVICE_ROLE_KEY ? "service-role read; eligible catalog" : "anonymous read; coverage depends on RLS",
    proposals,notice:"Voorstellen ter menselijke bevestiging; tekstuele overeenkomst is geen geverifieerde compatibiliteit of vereist materiaal."},null,2));
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "Dry-run failed");process.exitCode=1;});
