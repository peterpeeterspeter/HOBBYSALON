import { loadArticleCatalog, loadArticleExistingKeys, planArticleSuggestions } from "./article-catalog-pipeline";
import type { CatalogArticle, CatalogRead } from "./article-catalog-pipeline";

/** No environment, SDK, scheduler or network capability: callers explicitly supply both ports. */
export type MatchingRpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type Suggestion = ReturnType<typeof planArticleSuggestions>[number];
export function toArticleProposalPayload(suggestion: Suggestion) {
  return {
    target_entity_type: suggestion.row.target_entity_type,
    target_entity_id: suggestion.row.target_entity_id,
    weight: suggestion.row.weight,
    sort_order: suggestion.row.sort_order,
    proposed_relation: suggestion.proposedRelation,
    score: suggestion.score,
    evidence: [...suggestion.evidence],
    compatibility: suggestion.compatibility,
    matcher_version: "article-catalog-v1" as const,
  };
}
export type ArticleProposalPayload = ReturnType<typeof toArticleProposalPayload>;
export type MatchingJob = {
  job_key: string; kind: "article" | "catalog"; article_id: string | null;
  revision: number; claimed_revision: number; lease_token: string;
  lease_until: string; status: "running"; attempts: number;
};
export type MatchingOutcome = { kind: "article" | "catalog"; outcome: "completed" | "failed" | "deferred" | "lost"; inserted: number };
export type MatchingRunResult = {
  claimed: number; completed: number; failed: number; deferred: number; lost: number; inserted: number;
  outcomes: MatchingOutcome[];
};
export type MatchingWorkerOptions = {
  read: CatalogRead; rpc: MatchingRpc; maxJobs?: number; maxCatalogBatches?: number; pageSize?: number; now?: Date;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function bounded(value: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`Invalid ${label}`);
  return value;
}
function count(value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error("Invalid matching count");
  return value;
}
function claimedJob(response: unknown): MatchingJob | null {
  if (!Array.isArray(response) || response.length > 1) throw new Error("Invalid matching claim");
  if (!response.length) return null;
  const job: unknown = response[0];
  if (!object(job) || typeof job.kind !== "string" || !["article", "catalog"].includes(job.kind) || job.status !== "running"
    || typeof job.lease_token !== "string" || !UUID.test(job.lease_token)
    || typeof job.lease_until !== "string" || !Number.isFinite(Date.parse(job.lease_until))
    || typeof job.revision !== "number" || !Number.isSafeInteger(job.revision) || job.revision < 1
    || typeof job.claimed_revision !== "number" || !Number.isSafeInteger(job.claimed_revision)
    || job.claimed_revision < 1 || job.claimed_revision > job.revision
    || typeof job.attempts !== "number" || !Number.isInteger(job.attempts) || job.attempts < 1 || job.attempts > 5
    || (job.kind === "catalog" ? job.job_key !== "catalog" || job.article_id !== null
      : typeof job.article_id !== "string" || !UUID.test(job.article_id) || job.job_key !== `article:${job.article_id}`)) {
    throw new Error("Invalid matching claim");
  }
  return {...job} as MatchingJob;
}
async function readArticle(read: CatalogRead, id: string): Promise<CatalogArticle> {
  const rows = await read({table:"articles",columns:"id,title,excerpt,body_markdown,domain_id",
    equals:{id},order:["id"],offset:0,limit:1});
  if (!Array.isArray(rows) || rows.length !== 1 || !object(rows[0]) || rows[0].id !== id
    || typeof rows[0].title !== "string"
    || ["excerpt", "body_markdown", "domain_id"].some(key => rows[0][key] !== null && typeof rows[0][key] !== "string")) {
    throw new Error("Article unavailable");
  }
  // Detached primitive snapshot. Never reread content after capturing its fence.
  return {id,title:rows[0].title,excerpt:rows[0].excerpt as string | null,
    body_markdown:rows[0].body_markdown as string | null,domain_id:rows[0].domain_id as string | null};
}
/**
 * Single bounded run, claims one at a time. SQL owns decisions, revision fencing,
 * lease validity and five-attempt exponential backoff. The catalog loader deliberately
 * pages ALL eligible rows across owners; these bounds do not bound total rows/time.
 * No cached article/catalog snapshot spans jobs, and no proposal is auto-approved.
 */
export async function runArticleMatchingJobs(options: MatchingWorkerOptions): Promise<MatchingRunResult> {
  const maxJobs = bounded(options.maxJobs ?? 5, 20, "max jobs");
  const maxCatalogBatches = bounded(options.maxCatalogBatches ?? 4, 20, "max catalog batches");
  const pageSize = bounded(options.pageSize ?? 200, 1000, "catalog page size");
  const result: MatchingRunResult = {claimed:0,completed:0,failed:0,deferred:0,lost:0,inserted:0,outcomes:[]};
  const release = async (job: MatchingJob, requested: "success" | "failure" | "yield"): Promise<MatchingOutcome["outcome"]> => {
    const response = await options.rpc("graph_release_matching_job", {
      p_job_key:job.job_key,p_lease_token:job.lease_token,p_outcome:requested,
    });
    if (!object(response) || typeof response.released !== "boolean"
      || (response.released ? typeof response.status !== "string" || !["pending","complete","failed"].includes(response.status) : response.status !== null)) {
      throw new Error("Invalid matching release");
    }
    if (!response.released) return "lost";
    if (response.status === "failed") return "failed";
    if (response.status === "complete") return "completed";
    return requested === "failure" ? "failed" : "deferred";
  };
  for (let index = 0; index < maxJobs; index++) {
    // Validation before any read/fanout/proposal/finish. Never release untrusted tokens.
    const job = claimedJob(await options.rpc("graph_claim_matching_jobs", {p_limit:1,p_lease_seconds:120}));
    if (!job) break;
    result.claimed++;
    let outcome: MatchingOutcome["outcome"] = "failed";
    let inserted = 0;
    let finishAttempted = false;
    let partial = false;
    try {
      if (job.kind === "catalog") {
        let done = false;
        for (let batch = 0; batch < maxCatalogBatches; batch++) {
          const response = await options.rpc("graph_fanout_matching_job", {
            p_job_key:job.job_key,p_lease_token:job.lease_token,p_batch_size:50,
          });
          if (!object(response) || typeof response.done !== "boolean") throw new Error("Invalid catalog fanout");
          count(response.enqueued, 50);
          done = response.done;
          if (done) break;
        }
        if (done) outcome = "completed"; // Fanout itself clears lease and completes; do NOT finish again.
        else {
          partial = true;
          finishAttempted = true;
          // Healthy progress is a successful yield, not a retry-budget failure.
          outcome = await release(job, "yield");
        }
      } else {
        // Fingerprint BEFORE reading content. Any semantic change during/after read
        // is rejected by the atomic proposal RPC; equivalent fingerprints are safe.
        const fingerprint = await options.rpc("graph_article_fingerprint", {p_article_id:job.article_id});
        if (typeof fingerprint !== "string" || !fingerprint.length) throw new Error("Invalid article fingerprint");
        const article = await readArticle(options.read, job.article_id!);
        const catalog = await loadArticleCatalog(options.read, {pageSize,now:options.now});
        const keys = await loadArticleExistingKeys(options.read, article.id, {pageSize});
        const proposals = planArticleSuggestions(article, catalog, keys).map(toArticleProposalPayload);
        inserted = count(await options.rpc("graph_propose_article_suggestions", {
          p_article_id:article.id,p_fingerprint:fingerprint,p_proposals:proposals,
        }), proposals.length);
        // Count known committed nominations even if a later finish loses its lease.
        finishAttempted = true;
        outcome = await release(job, "success");
      }
    } catch {
      // Never persist/return raw errors: RPC/read exceptions may contain secrets/PII.
      outcome = "failed";
      if (!finishAttempted) {
        try { outcome = await release(job, "failure"); }
        catch { /* Unknown release state: failed, never invented completion/retry. */ }
      }
    }
    result.inserted += inserted;
    result[outcome]++;
    result.outcomes.push({kind:job.kind,outcome,inserted});
    // Partial fanout retains its SQL cursor/backoff. Do not immediately reclaim it.
    if (partial) break;
  }
  return result;
}
