import { matchArticleCatalog } from "./article-catalog-matcher";
import type { CatalogCandidate } from "./article-catalog-matcher";
import { isWorkshopListingPubliclyVisible } from "../pricing/workshop-launch-offer";

export type CatalogReadRequest = {
  table: "products" | "workshops" | "events" | "event_domains" | "entity_links" | "articles";
  columns: string;
  equals?: Record<string, string | boolean>;
  order: string[];
  offset: number;
  limit: number;
};
export type CatalogRow = Record<string, unknown>;
// Explicit read capability: dry-run never receives a write-capable client.
export type CatalogRead = (request: CatalogReadRequest) => Promise<CatalogRow[]>;
export type CatalogArticle = {
  id: string;
  title: string;
  excerpt?: string | null;
  body_markdown?: string | null;
  domain_id: string | null;
};
type Options = { pageSize?: number; now?: Date };

async function readAll(read: CatalogRead, request: Omit<CatalogReadRequest, "offset" | "limit">,
  pageSize = 200, maxRows?: number): Promise<CatalogRow[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error("Invalid catalog page size");
  if (maxRows !== undefined && (!Number.isSafeInteger(maxRows) || maxRows < 1)) throw new Error("Invalid article limit");
  const rows: CatalogRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const limit = Math.min(pageSize, maxRows === undefined ? pageSize : maxRows - rows.length);
    const page = await read({ ...request, offset, limit });
    if (!Array.isArray(page) || page.length > limit) throw new Error("Invalid catalog page response");
    rows.push(...page);
    if (page.length < limit || rows.length === maxRows) return rows;
  }
}
const str = (value: unknown): string => typeof value === "string" ? value : "";
const optional = (value: unknown): string | null => typeof value === "string" ? value : null;

export async function loadArticleCatalog(read: CatalogRead, options: Options = {}): Promise<CatalogCandidate[]> {
  const candidates: CatalogCandidate[] = [];
  const pageSize = options.pageSize;
  const now = options.now ?? new Date();
  const products = await readAll(read, { table: "products",
    columns: "id,title,description,short_description,domain_id,product_type,is_active,status",
    equals: {is_active:true,status:"active"}, order:["id"] }, pageSize);
  for (const row of products) {
    if (row.is_active !== true || row.status !== "active" || !str(row.id)) continue;
    candidates.push({targetType:"product",targetId:str(row.id),title:str(row.title),
      description:[str(row.short_description),str(row.description)].filter(Boolean).join("\n"),
      domainIds:str(row.domain_id) ? [str(row.domain_id)] : [],productType:optional(row.product_type)});
  }
  const workshops = await readAll(read, {table:"workshops",
    columns:"id,title,description,short_description,domain_id,is_active,listing_fee_status,listing_expires_at",
    equals:{is_active:true},order:["id"]},pageSize);
  for (const row of workshops) {
    if (!str(row.id) || !isWorkshopListingPubliclyVisible({is_active:row.is_active === true,
      listing_fee_status:optional(row.listing_fee_status),listing_expires_at:optional(row.listing_expires_at),now})) continue;
    candidates.push({targetType:"workshop",targetId:str(row.id),title:str(row.title),
      description:[str(row.short_description),str(row.description)].filter(Boolean).join("\n"),
      domainIds:str(row.domain_id) ? [str(row.domain_id)] : []});
  }
  const events = await readAll(read,{table:"events",
    columns:"id,title,description,short_description,is_active,ends_at",equals:{is_active:true},order:["id"]},pageSize);
  const domains = await readAll(read,{table:"event_domains",columns:"event_id,domain_id",order:["event_id","domain_id"]},pageSize);
  for (const row of events) {
    const endsAt = Date.parse(str(row.ends_at));
    if (row.is_active !== true || !str(row.id) || !Number.isFinite(endsAt) || endsAt <= now.getTime()) continue;
    candidates.push({targetType:"event",targetId:str(row.id),title:str(row.title),
      description:[str(row.short_description),str(row.description)].filter(Boolean).join("\n"),
      domainIds:[...new Set(domains.filter(d=>d.event_id === row.id).map(d=>str(d.domain_id)).filter(Boolean))].sort()});
  }
  return candidates;
}

export async function loadArticleExistingKeys(read: CatalogRead, articleId: string,
  options: Options = {}): Promise<Set<string>> {
  const keys = new Set<string>();
  // All existing relation states suppress new nominations. No deletion or relabelling.
  for (const direction of ["source", "target"] as const) {
    const rows = await readAll(read,{table:"entity_links",
      columns:"id,source_entity_type,source_entity_id,target_entity_type,target_entity_id,relation_type",
      equals:{[`${direction}_entity_type`]:"article",[`${direction}_entity_id`]:articleId},order:["id"]},options.pageSize);
    const other = direction === "source" ? "target" : "source";
    for (const row of rows) {
      const type = str(row[`${other}_entity_type`]); const id = str(row[`${other}_entity_id`]);
      if (["product","workshop","event"].includes(type) && id) keys.add(`${type}:${id}`);
    }
  }
  return keys;
}

export function planArticleSuggestions(article: CatalogArticle, candidates: CatalogCandidate[], existingKeys: ReadonlySet<string>) {
  return matchArticleCatalog({title:article.title,excerpt:article.excerpt,bodyMarkdown:article.body_markdown,
    domainId:article.domain_id,materialTitles:[]},candidates,existingKeys).map((match,index)=>({
      row:{source_entity_type:"article" as const,source_entity_id:article.id,
        target_entity_type:match.candidate.targetType,target_entity_id:match.candidate.targetId,
        relation_type:"suggested_auto" as const,weight:Math.max(1,Math.min(match.score,100)),sort_order:index+1},
      score:match.score,evidence:match.evidence,compatibility:match.compatibility,
      proposedRelation:match.proposedRelation,targetTitle:match.candidate.title,
  }));
}

export async function loadCatalogArticles(read: CatalogRead, options: {authorCreatorId?: string; limit?: number} = {}): Promise<CatalogArticle[]> {
  const rows = await readAll(read,{table:"articles",columns:"id,title,excerpt,body_markdown,domain_id",
    equals:{is_published:true,...(options.authorCreatorId ? {author_creator_id:options.authorCreatorId} : {})},order:["id"]},200,options.limit);
  return rows.slice(0,options.limit ?? rows.length).map(row=>({id:str(row.id),title:str(row.title),
    excerpt:optional(row.excerpt),body_markdown:optional(row.body_markdown),domain_id:optional(row.domain_id)}));
}
