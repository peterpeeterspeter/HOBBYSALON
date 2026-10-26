import { articleBodySha256, createStorageSidecarReader, loadArticleMetadataSidecar, type ArticleMetadata, type SidecarBundle, type SidecarReadFile, type CatalogQualification } from "./article-metadata-sidecar";
import { planArticleSuggestions, type ArticleSuggestionPlanner, type CatalogArticle, type SidecarMatchEvidence } from "./article-catalog-pipeline";
import type { CatalogCandidate } from "./article-catalog-matcher";

/** Immutable release, pinned to the authenticated Storage export verified on 2026-10-26. */
export const ARTICLE_SIDECAR_RELEASE = {
  bucket: "article-metadata-sidecar",
  prefix: "v1-2026-10-26",
  manifestSha256: "81df45c1eafb4202fd577c8c47e2f966a0317b7131471d4d1fadc529187d5c23",
} as const;

function hasExactEvidence(item: Record<string, unknown>, codepoints: string[]): boolean {
  const span = item.evidence_span as Record<string, unknown> | undefined;
  return !!span && span.unit === "unicode_codepoints" && Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end)
    && Number(span.start) >= 0 && Number(span.end) >= Number(span.start) && Number(span.end) <= codepoints.length
    && codepoints.slice(Number(span.start), Number(span.end)).join("") === item.evidence;
}

function articleContext(metadata: ArticleMetadata, article: CatalogArticle) {
  if (typeof article.is_published !== "boolean") return {state:"invalid_source",requirements:[]} as const;
  if (!article.is_published) return {state:"unpublished",requirements:[]} as const;
  if (typeof article.body_markdown !== "string") return {state:"invalid_source",requirements:[]} as const;
  if (articleBodySha256(article.body_markdown) !== metadata.source_sha256) return {state:"stale",requirements:[]} as const;
  if (!metadata.source.is_published) return {state:"unpublished",requirements:[]} as const;
  if (metadata.quality_routing.automatic_recommendation_blocked) return {state:"blocked",requirements:[]} as const;
  if (metadata.gaps.length || metadata.quality_routing.has_extraction_gaps || metadata.quality_routing.requires_gap_review_before_matching) {
    return {state:"gap_review_required",requirements:[]} as const;
  }
  const codepoints = [...article.body_markdown];
  // Even a valid quote is an article assertion, not verified compatibility.
  const primaryProjects = metadata.projects.filter(project => project.role === "primary");
  const scoped = ["full_tutorial","technique_guide","reference_guide"].includes(metadata.content_kind) && primaryProjects.length <= 1;
  const requirements = scoped ? [...metadata.materials,...metadata.tools].filter(item =>
    ["required","optional"].includes(item.role) && !item.unverified_project_labels?.length
    && (!item.project_labels?.length || (primaryProjects.length === 1 && item.project_labels.every(label => label === primaryProjects[0].label)))) : [];
  if (requirements.some(item => !hasExactEvidence(item,codepoints))) return {state:"invalid_evidence",requirements:[]} as const;
  return {state:"ready_for_review",requirements} as const;
}

/** No stale/gap/block fallback to legacy matching. Returns pending candidates only. */
export function createArticleSidecarPlanner(bundle: SidecarBundle): ArticleSuggestionPlanner {
  const byId = new Map(bundle.articles.map(metadata => [metadata.article_id,metadata]));
  const catalog = bundle.catalogQualifications ? new Map(bundle.catalogQualifications.map(row=>[row.product_id,row])) : undefined;
  const policies = new Map(bundle.productMatchRules?.map(row=>[row.product_id,row]) ?? []);
  const qualified = (candidate: CatalogCandidate, row: CatalogQualification | undefined) => {
    if (!row || !row.candidate_retrieval_eligible || !row.material_match_eligible) return false;
    // Match current semantic catalog fields, not an assumed product-hash serialization.
    const source = row.source;
    return candidate.title === source.title && candidate.productType === source.product_type
      && (candidate.description ?? "") === [source.short_description,source.description].filter(value=>typeof value === "string" && value).join("\n")
      && (source.domain_id ? candidate.domainIds.length === 1 && candidate.domainIds[0] === source.domain_id : candidate.domainIds.length === 0);
  };
  return (article,candidates,keys) => {
    const metadata = byId.get(article.id);
    if (!metadata) return {state:"missing_metadata",suggestions:[]};
    const context = articleContext(metadata,article);
    if (context.state !== "ready_for_review") return {state:context.state,suggestions:[]};
    const source: SidecarMatchEvidence = {
      dataset_version:bundle.datasetVersion,source_sha256:metadata.source_sha256,content_kind:metadata.content_kind,
      automatic_publication_allowed:false,
      requirements:context.requirements.map(item => ({label:item.label,role:item.role,specifications:item.specifications,
        project_labels:[...(item.project_labels ?? [])],evidence:item.evidence})),
    };
    const eligible = catalog ? candidates.filter(candidate=>{
      if (candidate.targetType !== "product") return true;
      const row = catalog.get(candidate.targetId);
      if (!qualified(candidate,row)) return false;
      // The pinned policy describes retrieval preconditions, not verified kit
      // contents or interchangeable yarn. Keep unresolved kits for manual search.
      if (row!.semantic_product_kind === "kit") return false;
      if (row!.semantic_product_kind === "material_destash" && !context.requirements.some(item=>
        /\b(?:rest(?:je|jes|en)?|restgaren(?:s)?|overschot)\b/i.test(item.evidence))) return false;
      if (/\bacrylverf\b/i.test(candidate.title) && !context.requirements.some(item=>
        /\bacrylverf\b/i.test(item.label) && /\bpapier\b/i.test(item.evidence))) return false;
      if (row!.semantic_product_kind === "custom_sticker_supply") {
        const mentions = context.requirements.filter(item=>/\bstickers?\b/i.test(item.label));
        if (!mentions.length || mentions.some(item=>/\b(?:textiel|silicone)\b/i.test(item.evidence+" "+(item.specifications ?? "")))) return false;
      }
      return true;
    }) : candidates;
    const suggestions = planArticleSuggestions(article,eligible,keys,{
      materialTitles:context.requirements.map(item => [item.label,item.specifications].filter(Boolean).join(" ")),
      sidecarEvidence:source,
    }).map(suggestion => {
      const row = catalog?.get(suggestion.row.target_entity_id);
      if (suggestion.row.target_entity_type !== "product" || !row) return suggestion;
      const policy = policies.get(row.product_id);
      return {...suggestion,sidecarEvidence:{...source,catalog:{snapshot_sha256:row.source_sha256,
        semantic_product_kind:row.semantic_product_kind,unknowns:[...row.gaps,...(policy?.compatibility_unknown ?? [])],
        ...(policy ? {candidate_need:policy.candidate_need,never_claim:policy.never_claim} : {})}}};
    });
    return {state:context.state,suggestions};
  };
}

/** Load all declared files before any queue claim. Failed loads can be retried. */
export async function loadArticleSidecarPlanner(read: SidecarReadFile, expectedManifestSha256: string = ARTICLE_SIDECAR_RELEASE.manifestSha256): Promise<ArticleSuggestionPlanner> {
  const bundle = await loadArticleMetadataSidecar(read,{expectedManifestSha256});
  return createArticleSidecarPlanner(bundle);
}

/** Authenticated GET only, no public URLs, redirects or error/body/credential logging. */
export function createPrivateArticleSidecarReader(supabaseUrl: string, key: string, fetcher: typeof fetch = fetch): SidecarReadFile {
  let base: URL;
  try { base = new URL(supabaseUrl); } catch { throw new Error("Invalid sidecar Supabase URL"); }
  if (!key || !/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error("Invalid sidecar Storage configuration");
  return createStorageSidecarReader(async path => {
    const url = new URL(`${base.pathname.replace(/\/$/,"")}/storage/v1/object/${ARTICLE_SIDECAR_RELEASE.bucket}/${path}`,base.origin);
    const response = await fetcher(url,{method:"GET",headers:{apikey:key,Authorization:`Bearer ${key}`},redirect:"error",signal:AbortSignal.timeout(15000)});
    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 64 * 1024 * 1024) {
      await response.body?.cancel(); throw new Error("Private sidecar download failed");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 64 * 1024 * 1024) throw new Error("Private sidecar file too large");
    return {data:{arrayBuffer:async () => bytes},error:null};
  },ARTICLE_SIDECAR_RELEASE.prefix);
}
