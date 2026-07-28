/**
 * Homepage journey: pick the strongest article/project chain via bidirectional entity_links.
 */

import { getEntityConnections } from "@/lib/platform/queries/entity-links";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import {
  listFeaturedProjects,
  listProjectProductLinks,
} from "@/lib/platform/queries/projects";
import { createPlatformClient } from "@/lib/platform/client";
import { isLikelyTestHomeContent } from "@/lib/services/home-router-helpers";
import type { Article, Project } from "@/types/platform";

const MATERIAL_RELATIONS = new Set([
  "required_material",
  "required_tool",
  "optional_material",
  "related_product",
  "recommended_supply",
  "uses_product",
  "needs_product",
]);

const WORKSHOP_RELATIONS = new Set([
  "related_workshop",
  "taught_in",
  "workshop_for",
  "learn_in",
]);

const CREATOR_RELATIONS = new Set([
  "related_creator",
  "made_by",
  "taught_by",
  "created_by",
  "author",
]);

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
  workshopIds: string[];
  creatorIds: string[];
};

function scoreConnections(
  connections: Array<{
    entityType: string;
    entityId: string;
    relationType: string;
  }>
): ScoredParts {
  const materialIds: string[] = [];
  const workshopIds: string[] = [];
  const creatorIds: string[] = [];

  for (const c of connections) {
    const type = c.entityType.toLowerCase();
    const rel = c.relationType.toLowerCase();
    if (type === "product" || MATERIAL_RELATIONS.has(rel)) {
      if (type === "product" && !materialIds.includes(c.entityId)) {
        materialIds.push(c.entityId);
      }
    }
    if (type === "workshop" || WORKSHOP_RELATIONS.has(rel)) {
      if (type === "workshop" && !workshopIds.includes(c.entityId)) {
        workshopIds.push(c.entityId);
      }
    }
    if (type === "creator" || CREATOR_RELATIONS.has(rel)) {
      if (type === "creator" && !creatorIds.includes(c.entityId)) {
        creatorIds.push(c.entityId);
      }
    }
  }

  return { materialIds, workshopIds, creatorIds };
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
}> {
  const supabase = createPlatformClient();
  const materials: HomeJourneyLink[] = [];
  let workshop: HomeJourneyLink | null = null;
  const makers: HomeJourneyLink[] = [];

  if (parts.materialIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, title, slug")
      .in("id", parts.materialIds.slice(0, 6))
      .eq("is_active", true);
    for (const row of data ?? []) {
      const p = row as { id: string; title: string; slug: string };
      materials.push({
        label: p.title,
        href: `/product/${p.slug}`,
      });
    }
  }

  if (parts.workshopIds[0]) {
    const { data } = await supabase
      .from("workshops")
      .select("id, title, slug, city")
      .eq("id", parts.workshopIds[0])
      .eq("is_active", true)
      .maybeSingle();
    if (data) {
      const w = data as {
        title: string;
        slug: string;
        city: string | null;
      };
      workshop = {
        label: w.city?.trim()
          ? `${w.title} in ${w.city.trim()}`
          : w.title,
        href: `/workshop/${w.slug}`,
      };
    }
  }

  if (parts.creatorIds.length > 0) {
    const { data } = await supabase
      .from("creators")
      .select("id, display_name, business_name, slug")
      .in("id", parts.creatorIds.slice(0, 3));
    for (const row of data ?? []) {
      const c = row as {
        display_name: string;
        business_name: string | null;
        slug: string;
      };
      makers.push({
        label: c.business_name?.trim() || c.display_name,
        href: `/creator/${c.slug}`,
      });
    }
  }

  return { materials, workshop, makers };
}

/**
 * Load up to 8 quality candidates, score bidirectional links, return first with ≥2 legs.
 */
export async function resolveHomeJourney(): Promise<HomeJourney | null> {
  const candidates = await loadCandidates();
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const entityType = candidate.kind === "article" ? "article" : "project";
    const entityId = candidate.item.id;

    const connections = await getEntityConnections(entityType, entityId);
    const parts = scoreConnections(connections);

    if (candidate.kind === "project") {
      const productLinks = await listProjectProductLinks(candidate.item.id);
      for (const link of productLinks) {
        if (!parts.materialIds.includes(link.product_id)) {
          parts.materialIds.push(link.product_id);
        }
      }
    }

    if (completeness(parts) < 2) continue;

    const resolved = await resolveLabels(parts);
    // Re-check after resolving (deleted/inactive targets)
    let resolvedCount = 0;
    if (resolved.materials.length > 0) resolvedCount += 1;
    if (resolved.workshop) resolvedCount += 1;
    if (resolved.makers.length > 0) resolvedCount += 1;
    if (resolvedCount < 2) continue;

    if (candidate.kind === "article") {
      return {
        kind: "article",
        title: candidate.item.title,
        href: `/artikel/${candidate.item.slug}`,
        imageUrl: candidate.item.featured_image_url,
        difficultyLevel: candidate.item.difficulty_level,
        materials: resolved.materials.slice(0, 4),
        workshop: resolved.workshop,
        makers: resolved.makers,
      };
    }

    return {
      kind: "project",
      title: candidate.item.title,
      href: `/project/${candidate.item.slug}`,
      imageUrl: candidate.item.featured_image_url,
      difficultyLevel: candidate.item.difficulty_level,
      materials: resolved.materials.slice(0, 4),
      workshop: resolved.workshop,
      makers: resolved.makers,
    };
  }

  return null;
}
