/**
 * Read-only semantic sidecar boundary. This module prepares review input only:
 * it never proposes, approves, publishes, or maps semantic concept IDs to entities.
 * A manifest proves internal byte consistency, not authenticity, unless its hash
 * is pinned independently by the caller.
 */
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export const SIDECAR_VERSION = "hobbysalon-semantic-v1";
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type ObjectValue = Record<string, unknown>;
export type SidecarReadFile = (path: string) => Promise<Uint8Array>;
export type EvidenceItem = ObjectValue & { label: string; evidence: string };
export type Requirement = EvidenceItem & {
  role: "required" | "optional" | "alternative" | "example";
  specifications: string | null;
  project_labels?: string[];
  unverified_project_labels?: string[];
};
export type ArticleMetadata = ObjectValue & {
  article_id: string;
  source_sha256: string;
  summary: string;
  content_kind: string;
  crafts: EvidenceItem[];
  techniques: EvidenceItem[];
  themes: EvidenceItem[];
  audience: EvidenceItem[];
  projects: (EvidenceItem & { role: "primary" | "variation" | "example" })[];
  materials: Requirement[];
  tools: Requirement[];
  gaps: string[];
  source: ObjectValue & { is_published: boolean };
  quality_routing: ObjectValue & {
    automatic_recommendation_blocked: boolean;
    automatic_publication_allowed: false;
    has_extraction_gaps: boolean;
    requires_gap_review_before_matching: boolean;
    reasons: string[];
  };
};
export type SidecarBundle = {
  datasetVersion: string;
  createdAt: string;
  manifestSha256: string;
  manifestTrust: "independently_pinned_digest" | "consistency_only_unpinned_manifest";
  verifiedFiles: { path: string; bytes: number; sha256: string }[];
  articles: ArticleMetadata[];
  catalogQualifications?: CatalogQualification[];
  productMatchRules?: ProductMatchRule[];
};
export type CatalogQualification = {
  product_id: string;
  source_sha256: string;
  candidate_retrieval_eligible: boolean;
  material_match_eligible: boolean;
  automatic_compatibility_confirmed: false;
  semantic_product_kind: string;
  source: ObjectValue;
  gaps: string[];
};
export type ProductMatchRule = {
  product_id: string; candidate_need: string; compatibility_unknown: string[]; never_claim: string;
};

function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}
function safePath(path: string): string {
  ensure(typeof path === "string" && /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*(?:\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)*$/.test(path), "Invalid sidecar file path");
  return path;
}
export function articleBodySha256(body: unknown): string {
  ensure(typeof body === "string", "Article body must be an exact string; null is not an empty body");
  return createHash("sha256").update(body, "utf8").digest("hex");
}
function bytesSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function parseJson(bytes: Uint8Array, label: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error(`Invalid JSON or UTF-8 in ${label}`); }
}

/** Local reads stay inside the real bundle root, including through symlinks. */
export function createLocalSidecarReader(directory: string): SidecarReadFile {
  return async path => {
    safePath(path);
    const root = await realpath(directory);
    const target = await realpath(resolve(root, path));
    const rel = relative(root, target);
    ensure(rel !== "" && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel), "Sidecar path escapes bundle root");
    return readFile(target);
  };
}

/**
 * Pass only a private bucket's download capability, e.g.
 * path => client.storage.from('article-metadata-sidecar').download(path).
 * No SDK client, credentials, public/signed URLs, upload or RPC port is accepted.
 */
export function createStorageSidecarReader(
  download: (path: string) => Promise<{ data: { arrayBuffer(): Promise<ArrayBuffer> } | null; error: unknown }>,
  prefix = "v1-2026-10-26",
): SidecarReadFile {
  const directory = safePath(prefix.replace(/\/$/, ""));
  return async path => {
    safePath(path);
    try {
      const result = await download(`${directory}/${path}`);
      ensure(!result.error && result.data, "Private sidecar download failed");
      return new Uint8Array(await result.data.arrayBuffer());
    } catch { throw new Error("Private sidecar download failed"); }
  };
}

/** Fixed safety contract is deliberately independent of the bundle's schema. */
function validateMetadata(value: unknown, line: number): ArticleMetadata {
  const fail = () => { throw new Error(`Invalid sidecar metadata safety contract at line ${line}`); };
  if (!object(value)) return fail();
  const v = value;
  if (typeof v.article_id !== "string" || !UUID.test(v.article_id) || typeof v.source_sha256 !== "string" || !SHA256.test(v.source_sha256)) return fail();
  if (v.metadata_version !== SIDECAR_VERSION || v.claim_scope !== "article_asserted_not_externally_verified" || typeof v.summary !== "string") return fail();
  if (!["full_tutorial", "pattern_overview", "technique_guide", "inspiration_roundup", "reference_guide", "interview", "other"].includes(String(v.content_kind))) return fail();
  if (!object(v.source) || typeof v.source.is_published !== "boolean") return fail();
  if (!object(v.difficulty) || !["explicit", "inferred", "unknown"].includes(String(v.difficulty.basis)) || !(v.difficulty.value === null || typeof v.difficulty.value === "string") || !(v.difficulty.evidence === null || typeof v.difficulty.evidence === "string")) return fail();
  const evidence = (item: unknown): item is EvidenceItem => {
    if (!object(item) || typeof item.label !== "string" || !item.label.trim() || typeof item.evidence !== "string" || !item.evidence.trim()) return false;
    if (item.evidence_span !== undefined) {
      const span = item.evidence_span;
      if (!object(span) || !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || Number(span.start) < 0 || Number(span.end) < Number(span.start) || span.unit !== "unicode_codepoints") return false;
    }
    return true;
  };
  for (const key of ["crafts", "techniques", "themes", "audience", "projects", "materials", "tools"]) {
    const rows = v[key];
    if (!Array.isArray(rows) || !rows.every(evidence)) return fail();
    for (const item of rows) {
      if (key === "projects" && !["primary", "variation", "example"].includes(String(item.role))) return fail();
      if (key === "materials" || key === "tools") {
        if (!["required", "optional", "alternative", "example"].includes(String(item.role)) || !(item.specifications === null || typeof item.specifications === "string")) return fail();
        for (const field of ["project_labels", "unverified_project_labels"]) if (item[field] !== undefined && !strings(item[field])) return fail();
      }
    }
  }
  for (const [key, fields] of [["constraints", ["kind", "value", "evidence"]], ["safety", ["note", "evidence"]], ["inferences", ["claim", "basis"]]] as const) {
    if (!Array.isArray(v[key]) || !(v[key] as unknown[]).every(item => object(item) && fields.every(field => typeof item[field] === "string"))) return fail();
  }
  if (!(v.constraints as ObjectValue[]).every(item => ["dimension", "quantity", "duration", "compatibility", "other"].includes(String(item.kind)))) return fail();
  if (!strings(v.gaps)) return fail();
  const quality = v.quality_routing;
  if (!object(quality) || quality.automatic_publication_allowed !== false || !strings(quality.reasons)) return fail();
  for (const key of ["automatic_recommendation_blocked", "has_extraction_gaps", "requires_gap_review_before_matching"]) if (typeof quality[key] !== "boolean") return fail();
  if (v.automatic_publication_allowed !== undefined && v.automatic_publication_allowed !== false) return fail();
  return v as ArticleMetadata;
}

/** All manifest-declared files are read back and byte/hash checked, without a row cap. */
export async function loadArticleMetadataSidecar(
  read: SidecarReadFile,
  options: { expectedManifestSha256?: string } = {},
): Promise<SidecarBundle> {
  const manifestBytes = await read("manifest.json");
  const manifestSha256 = bytesSha256(manifestBytes);
  if (options.expectedManifestSha256 !== undefined) {
    ensure(SHA256.test(options.expectedManifestSha256) && options.expectedManifestSha256 === manifestSha256, "Manifest digest mismatch");
  }
  const manifest = parseJson(manifestBytes, "manifest.json");
  ensure(object(manifest) && manifest.dataset_version === SIDECAR_VERSION && manifest.automatic_publication_allowed === false, "Invalid sidecar manifest safety contract");
  ensure(typeof manifest.created_at === "string" && Number.isFinite(Date.parse(manifest.created_at)) && Number.isSafeInteger(manifest.article_count) && Number(manifest.article_count) >= 0 && object(manifest.files), "Invalid sidecar manifest");
  const files = manifest.files;
  ensure(Object.hasOwn(files, "article_metadata.jsonl") && Object.hasOwn(files, "article_metadata.schema.json"), "Manifest must declare metadata and schema");
  const verifiedFiles: SidecarBundle["verifiedFiles"] = [];
  let metadataBytes: Uint8Array | undefined;
  let schemaBytes: Uint8Array | undefined;
  let catalogBytes: Uint8Array | undefined;
  let policyBytes: Uint8Array | undefined;
  for (const [path, spec] of Object.entries(files)) {
    safePath(path);
    ensure(path !== "manifest.json" && object(spec) && typeof spec.sha256 === "string" && SHA256.test(spec.sha256) && Number.isSafeInteger(spec.bytes) && Number(spec.bytes) >= 0, "Invalid sidecar manifest file entry");
    let bytes: Uint8Array;
    try { bytes = await read(path); } catch { throw new Error(`Unable to read declared sidecar file: ${path}`); }
    ensure(bytes.byteLength === spec.bytes && bytesSha256(bytes) === spec.sha256, `Sidecar integrity mismatch: ${path}`);
    verifiedFiles.push({ path, bytes: bytes.byteLength, sha256: spec.sha256 });
    if (path === "article_metadata.jsonl") metadataBytes = bytes;
    if (path === "article_metadata.schema.json") schemaBytes = bytes;
    if (path === "catalog_qualification.jsonl") catalogBytes = bytes;
    if (path === "product_match_policy.json") policyBytes = bytes;
  }
  const schema = parseJson(schemaBytes!, "article_metadata.schema.json");
  ensure(object(schema) && schema.type === "object" && object(schema.properties) && strings(schema.required) && ["article_id", "source_sha256", "materials", "tools", "projects", "gaps"].every(key => (schema.required as string[]).includes(key)), "Invalid metadata schema contract");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(metadataBytes); }
  catch { throw new Error("Invalid UTF-8 in article_metadata.jsonl"); }
  // Permit a single trailing newline; embedded blank lines are malformed records.
  const lines = text.replace(/\r?\n$/, "").split(/\r?\n/);
  const articles: ArticleMetadata[] = [];
  const ids = new Set<string>();
  for (const [index, line] of lines.entries()) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new Error(`Malformed metadata JSON at line ${index + 1}`); }
    const row = validateMetadata(value, index + 1);
    ensure(!ids.has(row.article_id), `Duplicate sidecar article ID at line ${index + 1}`);
    ids.add(row.article_id);
    articles.push(row);
  }
  ensure(articles.length === manifest.article_count, "Manifest article count mismatch");
  let catalogQualifications: CatalogQualification[] | undefined;
  if (catalogBytes) {
    const text = new TextDecoder("utf-8",{fatal:true}).decode(catalogBytes);
    catalogQualifications = text.trimEnd().split(/\r?\n/).map((line,index) => {
      let row: unknown;
      try { row = JSON.parse(line); } catch { throw new Error(`Invalid catalog qualification at line ${index+1}`); }
      ensure(object(row) && typeof row.product_id === "string" && UUID.test(row.product_id)
        && typeof row.source_sha256 === "string" && SHA256.test(row.source_sha256)
        && typeof row.candidate_retrieval_eligible === "boolean" && typeof row.material_match_eligible === "boolean"
        && row.automatic_compatibility_confirmed === false && typeof row.semantic_product_kind === "string"
        && object(row.source) && strings(row.gaps),"Invalid catalog qualification safety contract");
      return row as CatalogQualification;
    });
    ensure(new Set(catalogQualifications.map(row=>row.product_id)).size === catalogQualifications.length,"Duplicate catalog qualification ID");
  }
  let productMatchRules: ProductMatchRule[] | undefined;
  if (policyBytes) {
    const policy = parseJson(policyBytes,"product_match_policy.json");
    ensure(object(policy) && policy.mode === "candidate_retrieval_only_no_automatic_links" && Array.isArray(policy.rules),"Invalid product match policy");
    productMatchRules = policy.rules.map((row: unknown) => {
      ensure(object(row) && typeof row.product_id === "string" && UUID.test(row.product_id) && typeof row.candidate_need === "string"
        && strings(row.compatibility_unknown) && typeof row.never_claim === "string","Invalid product match policy rule");
      return row as ProductMatchRule;
    });
  }
  return {
    datasetVersion: SIDECAR_VERSION, createdAt: manifest.created_at, manifestSha256,
    manifestTrust: options.expectedManifestSha256 ? "independently_pinned_digest" : "consistency_only_unpinned_manifest",
    verifiedFiles, articles, catalogQualifications, productMatchRules,
  };
}

export type ArticleSource = {
  article_id: string;
  is_published: boolean;
  body_markdown?: unknown;
  source_sha256?: unknown;
  graph_fingerprint?: unknown;
};
export type SidecarSource = {
  kind: "exact_bodies" | "hash_snapshot";
  articles: ArticleSource[];
  /** Actual read/capture time, never inferred from the bundle or file mtime. */
  capturedAt?: string;
};
export type ReviewState = "ready_for_review" | "blocked" | "gap_review_required" | "missing_source" | "missing_metadata" | "stale" | "invalid_source" | "unpublished";
export type SidecarReviewInput = {
  articleId: string;
  state: ReviewState;
  reasons: string[];
  sourceSha256: string | null;
  graphFingerprint: string | null;
  verificationBasis: SidecarSource["kind"];
  automaticPublicationAllowed: false;
  automaticMatchingAllowed: false;
  conceptIdsAreEntityIds: false;
  metadata: ArticleMetadata | null;
};

/**
 * Full set comparison against a caller-supplied complete read. Hash snapshots
 * establish freshness only at capture time; re-read exact bodies before matching.
 * The existing graph fingerprint is passed through solely as distinct context.
 */
export function auditArticleMetadataSidecar(bundle: SidecarBundle, source: SidecarSource) {
  ensure(source.kind === "exact_bodies" || source.kind === "hash_snapshot", "Invalid article verification basis");
  ensure(Array.isArray(source.articles), "Article source must be a complete array");
  ensure(source.capturedAt === undefined || Number.isFinite(Date.parse(source.capturedAt)), "Invalid article snapshot capture time");
  const live = new Map<string, ArticleSource>();
  for (const row of source.articles) {
    ensure(object(row) && typeof row.article_id === "string" && UUID.test(row.article_id), "Invalid source article ID");
    ensure(!live.has(row.article_id), "Duplicate source article ID");
    live.set(row.article_id, row);
  }
  const metadataById = new Map(bundle.articles.map(row => [row.article_id, row]));
  const ids = new Set([...metadataById.keys(), ...live.keys()]);
  const inputs: SidecarReviewInput[] = [];
  for (const articleId of ids) {
    const metadata = metadataById.get(articleId) ?? null;
    const current = live.get(articleId);
    const reasons: string[] = [];
    let state: ReviewState = "ready_for_review";
    let sourceSha256: string | null = null;
    if (!current) { state = "missing_source"; reasons.push("Article absent from complete source corpus"); }
    else if (typeof current.is_published !== "boolean") { state = "invalid_source"; reasons.push("Current publication state missing or invalid"); }
    else {
      if (source.kind === "exact_bodies") {
        if (typeof current.body_markdown === "string") sourceSha256 = articleBodySha256(current.body_markdown);
      } else if (typeof current.source_sha256 === "string" && SHA256.test(current.source_sha256)) sourceSha256 = current.source_sha256;
      if (!sourceSha256) { state = "invalid_source"; reasons.push(source.kind === "exact_bodies" ? "Body must be an exact UTF-8 string" : "Missing or invalid source SHA-256 snapshot value"); }
      else if (!metadata) { state = "missing_metadata"; reasons.push("New source article requires metadata extraction"); }
      else if (metadata.source_sha256 !== sourceSha256 || metadata.source.is_published !== current.is_published) { state = "stale"; reasons.push("Article body hash or publication state changed since extraction"); }
      else if (!current.is_published) { state = "unpublished"; reasons.push("Source article is unpublished"); }
      if (metadata?.quality_routing.automatic_recommendation_blocked) {
        reasons.push("Explicit recommendation block", ...metadata.quality_routing.reasons);
        if (state === "ready_for_review") state = "blocked";
      }
      if (metadata && (metadata.gaps.length > 0 || metadata.quality_routing.has_extraction_gaps || metadata.quality_routing.requires_gap_review_before_matching)) {
        reasons.push("Extraction gaps require human review before matching", ...metadata.gaps);
        if (state === "ready_for_review") state = "gap_review_required";
      }
    }
    inputs.push({ articleId, state, reasons, sourceSha256,
      graphFingerprint: typeof current?.graph_fingerprint === "string" ? current.graph_fingerprint : null,
      verificationBasis: source.kind, automaticPublicationAllowed: false, automaticMatchingAllowed: false,
      conceptIdsAreEntityIds: false, metadata,
    });
  }
  const counts = Object.fromEntries((["ready_for_review", "blocked", "gap_review_required", "missing_source", "missing_metadata", "stale", "invalid_source", "unpublished"] as ReviewState[]).map(state => [state, inputs.filter(row => row.state === state).length]));
  const corpusMatches = inputs.every(row => !["missing_source", "missing_metadata", "stale", "invalid_source"].includes(row.state));
  return {
    mode: "read_only_review_input" as const,
    automaticPublicationAllowed: false as const,
    automaticMatchingAllowed: false as const,
    corpusMatches, metadataCount: bundle.articles.length, sourceCount: source.articles.length,
    verificationBasis: source.kind, sourceCapturedAt: source.capturedAt ?? null,
    freshnessLimitation: source.kind === "hash_snapshot"
      ? "Snapshot-only comparison. Capture time is supplied by the caller, or unknown. Re-read exact current bodies before any matching."
      : "Exact bodies supplied by the caller were hashed as UTF-8 without normalization; later changes require a new read.",
    graphFingerprintIsBodySha256: false as const,
    manifestSha256: bundle.manifestSha256, manifestTrust: bundle.manifestTrust,
    verifiedFiles: bundle.verifiedFiles, counts, inputs,
  };
}
