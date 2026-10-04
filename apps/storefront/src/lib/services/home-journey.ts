/**
 * Homepage journey: pick the strongest article/project chain via bidirectional entity_links.
 */

import { getEntityConnections } from "@/lib/platform/queries/entity-links";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import {
  listFeaturedProjects,
  listProjectProductLinks,
} from "@/lib/platform/queries/projects";
import { listProductsByIds } from "@/lib/platform/queries/products";
import { listWorkshopsByIds } from "@/lib/platform/queries/workshops";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { isLikelyTestHomeContent } from "@/lib/services/home-router-helpers";
import type { Article, Project } from "@/types/platform";

// Only an outbound explicit requirement supplies tie-break evidence; inbound
// associations remain useful public context, never a reverse requirement.
const EXPLICIT_MATERIAL_RELATIONS = new Set(["required_material", "required_tool"]);

export type HomeJourneyCandidate =
  | { kind: "article"; item: Article }
  | { kind: "project"; item: Project };

export type HomeJourneyLink = {
  label: string;
  href?: string;
};

export type HomeJourney = {
  kind: "article" | "project";
  title: string;
  href: string;
  imageUrl: string | null;
  difficultyLevel: string | null;
  materials: HomeJourneyLink[];
  workshop: HomeJourneyLink | null;
  makers: HomeJourneyLink[];
};

function isLikelyTestTitle(title: string, slug: string): boolean {
  return isLikelyTestHomeContent(title, slug);
}

async function loadCandidates(): Promise<HomeJourneyCandidate[]> {
  const [articles, projects] = await Promise.all([
    listLatestArticles(8),
    listFeaturedProjects(8),
  ]);

  const articleCandidates: HomeJourneyCandidate[] = articles
    .filter(
      (a) =>
        Boolean(a.featured_image_url?.trim()) &&
        !isLikelyTestTitle(a.title, a.slug)
    )
    .slice(0, 6)
    .map((item) => ({ kind: "article" as const, item }));

  const projectCandidates: HomeJourneyCandidate[] = projects
    .filter(
      (p) =>
        Boolean(p.featured_image_url?.trim()) &&
        !isLikelyTestTitle(p.title, p.slug)
    )
    .slice(0, 6)
    .map((item) => ({ kind: "project" as const, item }));

  // Interleave featured projects with articles for variety, cap 8
  const merged: HomeJourneyCandidate[] = [];
  const max = Math.max(articleCandidates.length, projectCandidates.length);
  for (let i = 0; i < max && merged.length < 8; i++) {
    if (projectCandidates[i]) merged.push(projectCandidates[i]!);
    if (merged.length >= 8) break;
    if (articleCandidates[i]) merged.push(articleCandidates[i]!);
  }
  return merged;
}

type ScoredParts = {
  materialIds: string[];
  explicitMaterialIds: string[];
  workshopIds: string[];
  creatorIds: string[];
};

function scoreConnections(
  connections: Array<{
    entityType: string;
    entityId: string;
    relationType: string;
    direction?: "outbound" | "inbound";
  }>
): ScoredParts {
  const materialIds: string[] = [];
  const explicitMaterialIds: string[] = [];
  const workshopIds: string[] = [];
  const creatorIds: string[] = [];

  for (const c of connections) {
    const type = c.entityType.toLowerCase();
    const rel = c.relationType.toLowerCase();
    // Defense in depth: pending matches must never create a public leg.
    if (rel === "suggested_auto" || !c.entityId.trim()) continue;
    if (type === "product") {
      if (!materialIds.includes(c.entityId)) materialIds.push(c.entityId);
      if (c.direction === "outbound" && EXPLICIT_MATERIAL_RELATIONS.has(rel)
        && !explicitMaterialIds.includes(c.entityId)) explicitMaterialIds.push(c.entityId);
    }
    if (type === "workshop" && !workshopIds.includes(c.entityId)) workshopIds.push(c.entityId);
    if (type === "creator" && !creatorIds.includes(c.entityId)) creatorIds.push(c.entityId);
  }

  return { materialIds, explicitMaterialIds, workshopIds, creatorIds };
}

function completeness(parts: ScoredParts): number {
  let n = 0;
  if (parts.materialIds.length > 0) n += 1;
  if (parts.workshopIds.length > 0) n += 1;
  if (parts.creatorIds.length > 0) n += 1;
  return n;
}

async function resolveLabels(parts: ScoredParts): Promise<{
  materials: HomeJourneyLink[];
  workshop: HomeJourneyLink | null;
  makers: HomeJourneyLink[];
  hasExplicitMaterial: boolean;
}> {
  const materials: HomeJourneyLink[] = [];
  let workshop: HomeJourneyLink | null = null;
  const makers: HomeJourneyLink[] = [];
  let hasExplicitMaterial = false;

  // Public getters apply target eligibility before any display cap.
  // Their ID-based reads preserve graph order and avoid full catalog queries.
  if (parts.materialIds.length > 0) {
    const products = await listProductsByIds(parts.materialIds);
    // Missing/ineligible targets supply no tie-breaking evidence.
    hasExplicitMaterial = products.some(p => parts.explicitMaterialIds.includes(p.id));
    for (const p of products.slice(0, 6)) {
      materials.push({
        label: p.title,
        href: `/product/${p.slug}`,
      });
    }
  }

  if (parts.workshopIds.length > 0) {
    const workshops = await listWorkshopsByIds(parts.workshopIds);
    const w = workshops[0];
    if (w) {
      workshop = {
        label: w.city?.trim()
          ? `${w.title} in ${w.city.trim()}`
          : w.title,
        href: `/workshop/${w.slug}`,
      };
    }
  }

  if (parts.creatorIds.length > 0) {
    const creators = await Promise.all(parts.creatorIds.map(getCreatorById));
    for (const c of creators) {
      if (!c) continue;
      makers.push({
        label: c.business_name?.trim() || c.display_name,
        href: `/creator/${c.slug}`,
      });
      if (makers.length === 3) break;
    }
  }

  return { materials, workshop, makers, hasExplicitMaterial };
}

/**
 * Rank at most eight editorial candidates by resolved public legs, then by
 * explicit material evidence. Equal quality preserves original interleave.
 * Shared-cache-safe: no account/behavior signals or new boost calculations.
 */
export async function resolveHomeJourney(): Promise<HomeJourney | null> {
  const candidates = await loadCandidates();
  if (candidates.length === 0) return null;

  let best: HomeJourney | null = null;
  let bestLegs = 0;
  let bestExplicit = false;
  for (const candidate of candidates) {
    let parts: ScoredParts;
    try {
      const connections = await getEntityConnections(candidate.kind, candidate.item.id);
      parts = scoreConnections(connections);
      if (candidate.kind === "project") {
        const productLinks = await listProjectProductLinks(candidate.item.id);
        const productIds = productLinks.map(link => link.product_id).filter(id => id.trim());
        parts.explicitMaterialIds = [...new Set([...productIds, ...parts.explicitMaterialIds])];
      }
      // Explicit project associations/roles precede general topic context.
      parts.materialIds = [...new Set([...parts.explicitMaterialIds, ...parts.materialIds])];
    } catch {
      // An incomplete source cannot rank but must not erase other candidates.
      continue;
    }
    if (completeness(parts) < 2) continue;

    // Preserve the existing hydration rejection contract; homepage's service
    // owns unexpected-error fallback. Returned query errors empty one leg.
    const resolved = await resolveLabels(parts);
    let resolvedCount = 0;
    if (resolved.materials.length > 0) resolvedCount += 1;
    if (resolved.workshop) resolvedCount += 1;
    if (resolved.makers.length > 0) resolvedCount += 1;
    if (resolvedCount < 2) continue;
    if (resolvedCount < bestLegs || (resolvedCount === bestLegs
      && (!resolved.hasExplicitMaterial || bestExplicit))) continue;

    bestLegs = resolvedCount;
    bestExplicit = resolved.hasExplicitMaterial;
    best = {
      kind: candidate.kind,
      title: candidate.item.title,
      href: `/${candidate.kind === "article" ? "artikel" : "project"}/${candidate.item.slug}`,
      imageUrl: candidate.item.featured_image_url,
      difficultyLevel: candidate.item.difficulty_level,
      materials: resolved.materials.slice(0, 4),
      workshop: resolved.workshop,
      makers: resolved.makers,
    };
  }
  return best;
}
