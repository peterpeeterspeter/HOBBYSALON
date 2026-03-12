import { createPlatformClient } from "../client";
import { listActiveDomains } from "./domains";
import { listFavoritesByUser } from "./favorites";
import { listFeaturedProjects } from "./projects";
import {
  REGISTRATION_ALLOWED_INTEREST_TYPES,
  type RegistrationInterestType,
} from "@/lib/auth/registration-options";
import type { EntityType, Project } from "@/types/platform";

export type RecommendationSource = "personalized" | "cold_start";

export type RecommendedProject = {
  project: Project;
  score: number;
  reasons: string[];
  matchedDomainIds: string[];
};

export type ProjectRecommendationResult = {
  source: RecommendationSource;
  projects: RecommendedProject[];
  latencyMs: number;
  signalCount: number;
};

type FavoriteSignal = {
  entityType: EntityType;
  entityId: string;
  recencyWeight: number;
  isRecentInteraction: boolean;
};

type FavoriteBuckets = Record<EntityType, string[]>;
type RecencyIndex = Record<EntityType, Map<string, number>>;
type DomainScoreCollection = {
  domainScores: Map<string, number>;
  interestTypes: RegistrationInterestType[];
};

const DEFAULT_LIMIT = 6;
const MAX_FAVORITE_SIGNALS = 80;
const RECENT_INTERACTION_DAYS = 30;

const DOMAIN_SIGNAL_BASE: Record<EntityType, number> = {
  domain: 3.6,
  creator: 2.0,
  product: 2.4,
  workshop: 2.5,
  event: 2.0,
  article: 1.6,
  project: 3.0,
};

const LINKED_PROJECT_TYPES: EntityType[] = [
  "domain",
  "creator",
  "product",
  "workshop",
  "event",
  "article",
];

const INTEREST_TYPE_SET = new Set<string>(REGISTRATION_ALLOWED_INTEREST_TYPES);

const INTEREST_DOMAIN_SIGNAL_BASE: Record<RegistrationInterestType, number> = {
  workshop: 1.9,
  supply: 1.7,
  handmade: 1.7,
  event: 1.2,
  article: 1.1,
};

function createBuckets(): FavoriteBuckets {
  return {
    domain: [],
    creator: [],
    product: [],
    workshop: [],
    event: [],
    article: [],
    project: [],
  };
}

function createRecencyIndex(): RecencyIndex {
  return {
    domain: new Map<string, number>(),
    creator: new Map<string, number>(),
    product: new Map<string, number>(),
    workshop: new Map<string, number>(),
    event: new Map<string, number>(),
    article: new Map<string, number>(),
    project: new Map<string, number>(),
  };
}

function parseDaysSince(isoDate: string): number {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return 365;
  const deltaMs = Date.now() - parsed;
  return Math.max(0, deltaMs / (1000 * 60 * 60 * 24));
}

function getRecencyWeight(daysSince: number): number {
  if (daysSince <= 7) return 2.4;
  if (daysSince <= 30) return 1.8;
  if (daysSince <= 90) return 1.3;
  return 1;
}

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function addScore(map: Map<string, number>, key: string, amount: number): void {
  const current = map.get(key) ?? 0;
  map.set(key, current + amount);
}

function toTopIds(scoreMap: Map<string, number>, limit: number): string[] {
  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(12, Math.floor(limit)));
}

function sanitizeRegistrationInterestTypes(values: unknown): RegistrationInterestType[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
        .filter(
          (value): value is RegistrationInterestType =>
            value.length > 0 && INTEREST_TYPE_SET.has(value)
        )
    )
  );
}

async function collectInterestDomainSignals(
  userId: string
): Promise<{ domainScores: Map<string, number>; interestTypes: RegistrationInterestType[] }> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("interest_types")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      domainScores: new Map<string, number>(),
      interestTypes: [],
    };
  }

  const interestTypes = sanitizeRegistrationInterestTypes(
    (data as { interest_types?: unknown }).interest_types
  );
  if (interestTypes.length === 0) {
    return {
      domainScores: new Map<string, number>(),
      interestTypes: [],
    };
  }

  const domainScores = new Map<string, number>();

  if (interestTypes.includes("workshop")) {
    const { data: workshopRows } = await supabase
      .from("workshops")
      .select("domain_id")
      .eq("is_active", true)
      .limit(1200);
    for (const row of (workshopRows ?? []) as Array<{ domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(domainScores, row.domain_id, INTEREST_DOMAIN_SIGNAL_BASE.workshop);
    }
  }

  if (interestTypes.includes("supply")) {
    const { data: supplyRows } = await supabase
      .from("products")
      .select("domain_id")
      .eq("is_active", true)
      .eq("status", "active")
      .eq("product_type", "supply")
      .limit(1600);
    for (const row of (supplyRows ?? []) as Array<{ domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(domainScores, row.domain_id, INTEREST_DOMAIN_SIGNAL_BASE.supply);
    }
  }

  if (interestTypes.includes("handmade")) {
    const { data: handmadeRows } = await supabase
      .from("products")
      .select("domain_id")
      .eq("is_active", true)
      .eq("status", "active")
      .eq("product_type", "handmade")
      .limit(1600);
    for (const row of (handmadeRows ?? []) as Array<{ domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(domainScores, row.domain_id, INTEREST_DOMAIN_SIGNAL_BASE.handmade);
    }
  }

  if (interestTypes.includes("event")) {
    const { data: eventDomains } = await supabase
      .from("event_domains")
      .select("domain_id")
      .limit(1200);
    for (const row of (eventDomains ?? []) as Array<{ domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(domainScores, row.domain_id, INTEREST_DOMAIN_SIGNAL_BASE.event);
    }
  }

  if (interestTypes.includes("article")) {
    const { data: articleRows } = await supabase
      .from("articles")
      .select("domain_id")
      .eq("is_published", true)
      .limit(1200);
    for (const row of (articleRows ?? []) as Array<{ domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(domainScores, row.domain_id, INTEREST_DOMAIN_SIGNAL_BASE.article);
    }

    const { data: articleDomains } = await supabase
      .from("article_domains")
      .select("domain_id")
      .limit(1200);
    for (const row of (articleDomains ?? []) as Array<{ domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(domainScores, row.domain_id, INTEREST_DOMAIN_SIGNAL_BASE.article);
    }
  }

  return { domainScores, interestTypes };
}

function toColdStartRecommendations(
  projects: Project[],
  limit: number,
  domainScores: Map<string, number>,
  domainMapByProject: Map<string, string[]>
): RecommendedProject[] {
  const ranked = projects.map((project) => {
    const domainIds = domainMapByProject.get(project.id) ?? [];
    const domainBoost =
      domainIds.reduce((max, domainId) => {
        const domainScore = domainScores.get(domainId) ?? 0;
        return domainScore > max ? domainScore : max;
      }, 0) || 0;
    const createdAtDays = parseDaysSince(project.created_at);
    const freshnessBoost = createdAtDays <= 60 ? 0.35 : 0;
    const featureBoost = project.is_featured ? 0.6 : 0;
    const score = Number((domainBoost + freshnessBoost + featureBoost).toFixed(3));

    return {
      project,
      score,
      reasons: ["Populair op Hobbysalon"],
      matchedDomainIds: domainIds,
    } satisfies RecommendedProject;
  });

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function fetchActiveProjectsByIds(projectIds: string[]): Promise<Project[]> {
  if (!projectIds.length) return [];

  const supabase = createPlatformClient();
  const uniqueIds = [...new Set(projectIds)].slice(0, 120);
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .in("id", uniqueIds)
    .eq("is_active", true);

  if (error || !data) return [];

  const byId = new Map((data as Project[]).map((project) => [project.id, project]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((project): project is Project => !!project);
}

async function fetchProjectDomainMap(projectIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!projectIds.length) return result;

  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_domains")
    .select("project_id, domain_id, is_primary")
    .in("project_id", projectIds);

  if (error || !data) return result;

  const rows = data as Array<{
    project_id: string;
    domain_id: string;
    is_primary: boolean | null;
  }>;

  const grouped = new Map<string, Array<{ domainId: string; isPrimary: boolean }>>();
  for (const row of rows) {
    const current = grouped.get(row.project_id) ?? [];
    current.push({
      domainId: row.domain_id,
      isPrimary: row.is_primary === true,
    });
    grouped.set(row.project_id, current);
  }

  for (const [projectId, links] of grouped.entries()) {
    const ordered = [...links]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((link) => link.domainId);
    result.set(projectId, ordered);
  }

  return result;
}

async function fetchProjectIdsForDomains(domainIds: string[]): Promise<string[]> {
  if (!domainIds.length) return [];

  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_domains")
    .select("project_id, domain_id, is_primary")
    .in("domain_id", domainIds)
    .order("is_primary", { ascending: false });

  if (error || !data) return [];

  const rows = data as Array<{ project_id: string }>;
  return [...new Set(rows.map((row) => row.project_id))].slice(0, 80);
}

async function collectSignals(userId: string): Promise<{
  signals: FavoriteSignal[];
  buckets: FavoriteBuckets;
  recencyIndex: RecencyIndex;
  recentInteractionCount: number;
}> {
  const favorites = (await listFavoritesByUser(userId)).slice(0, MAX_FAVORITE_SIGNALS);
  const signals: FavoriteSignal[] = [];
  const buckets = createBuckets();
  const recencyIndex = createRecencyIndex();

  for (const favorite of favorites) {
    const daysSince = parseDaysSince(favorite.created_at);
    const recencyWeight = getRecencyWeight(daysSince);
    const isRecentInteraction = daysSince <= RECENT_INTERACTION_DAYS;
    const signal: FavoriteSignal = {
      entityType: favorite.entity_type,
      entityId: favorite.entity_id,
      recencyWeight,
      isRecentInteraction,
    };

    signals.push(signal);
    buckets[signal.entityType].push(signal.entityId);
    recencyIndex[signal.entityType].set(signal.entityId, signal.recencyWeight);
  }

  return {
    signals,
    buckets,
    recencyIndex,
    recentInteractionCount: signals.filter((signal) => signal.isRecentInteraction).length,
  };
}

async function collectDomainScores(
  userId: string,
  buckets: FavoriteBuckets,
  recencyIndex: RecencyIndex
): Promise<DomainScoreCollection> {
  const supabase = createPlatformClient();
  const domainScores = new Map<string, number>();

  for (const [domainId, recency] of recencyIndex.domain.entries()) {
    addScore(domainScores, domainId, DOMAIN_SIGNAL_BASE.domain * recency);
  }

  if (buckets.product.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, domain_id")
      .in("id", buckets.product);
    for (const row of (data ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(
        domainScores,
        row.domain_id,
        DOMAIN_SIGNAL_BASE.product * (recencyIndex.product.get(row.id) ?? 1)
      );
    }
  }

  if (buckets.workshop.length > 0) {
    const { data } = await supabase
      .from("workshops")
      .select("id, domain_id")
      .in("id", buckets.workshop);
    for (const row of (data ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addScore(
        domainScores,
        row.domain_id,
        DOMAIN_SIGNAL_BASE.workshop * (recencyIndex.workshop.get(row.id) ?? 1)
      );
    }
  }

  if (buckets.article.length > 0) {
    const articleDomainMap = new Map<string, Set<string>>();

    const { data: directArticles } = await supabase
      .from("articles")
      .select("id, domain_id")
      .in("id", buckets.article);
    for (const row of (directArticles ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      const current = articleDomainMap.get(row.id) ?? new Set<string>();
      current.add(row.domain_id);
      articleDomainMap.set(row.id, current);
    }

    const { data: articleDomains } = await supabase
      .from("article_domains")
      .select("article_id, domain_id")
      .in("article_id", buckets.article);
    for (const row of (articleDomains ?? []) as Array<{ article_id: string; domain_id: string }>) {
      const current = articleDomainMap.get(row.article_id) ?? new Set<string>();
      current.add(row.domain_id);
      articleDomainMap.set(row.article_id, current);
    }

    for (const [articleId, domainIds] of articleDomainMap.entries()) {
      const recency = recencyIndex.article.get(articleId) ?? 1;
      for (const domainId of domainIds) {
        addScore(domainScores, domainId, DOMAIN_SIGNAL_BASE.article * recency);
      }
    }
  }

  if (buckets.event.length > 0) {
    const { data } = await supabase
      .from("event_domains")
      .select("event_id, domain_id")
      .in("event_id", buckets.event);
    for (const row of (data ?? []) as Array<{ event_id: string; domain_id: string }>) {
      addScore(
        domainScores,
        row.domain_id,
        DOMAIN_SIGNAL_BASE.event * (recencyIndex.event.get(row.event_id) ?? 1)
      );
    }
  }

  if (buckets.project.length > 0) {
    const { data } = await supabase
      .from("project_domains")
      .select("project_id, domain_id")
      .in("project_id", buckets.project);
    for (const row of (data ?? []) as Array<{ project_id: string; domain_id: string }>) {
      addScore(
        domainScores,
        row.domain_id,
        DOMAIN_SIGNAL_BASE.project * (recencyIndex.project.get(row.project_id) ?? 1)
      );
    }
  }

  if (buckets.creator.length > 0) {
    const { data } = await supabase
      .from("creator_domains")
      .select("creator_id, domain_id")
      .in("creator_id", buckets.creator);
    for (const row of (data ?? []) as Array<{ creator_id: string; domain_id: string }>) {
      addScore(
        domainScores,
        row.domain_id,
        DOMAIN_SIGNAL_BASE.creator * (recencyIndex.creator.get(row.creator_id) ?? 1)
      );
    }
  }

  const { data: creatorRows } = await supabase
    .from("creators")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  const creatorId = (creatorRows as Array<{ id: string }> | null)?.[0]?.id;
  if (creatorId) {
    const { data: creatorDomains } = await supabase
      .from("creator_domains")
      .select("domain_id")
      .eq("creator_id", creatorId);
    for (const row of (creatorDomains ?? []) as Array<{ domain_id: string }>) {
      addScore(domainScores, row.domain_id, 1.8);
    }
  }

  const interestSignals = await collectInterestDomainSignals(userId);
  for (const [domainId, score] of interestSignals.domainScores.entries()) {
    addScore(domainScores, domainId, score);
  }

  return {
    domainScores,
    interestTypes: interestSignals.interestTypes,
  };
}

async function collectProjectBoosts(
  buckets: FavoriteBuckets,
  recencyIndex: RecencyIndex
): Promise<Map<string, number>> {
  const supabase = createPlatformClient();
  const boosts = new Map<string, number>();

  for (const [projectId, recency] of recencyIndex.project.entries()) {
    addScore(boosts, projectId, 3.5 * recency);
  }

  for (const sourceType of LINKED_PROJECT_TYPES) {
    const ids = buckets[sourceType];
    if (!ids.length) continue;

    const { data } = await supabase
      .from("entity_links")
      .select("source_entity_id, target_entity_id, weight")
      .eq("source_entity_type", sourceType)
      .eq("target_entity_type", "project")
      .in("source_entity_id", ids);

    for (const row of (data ?? []) as Array<{
      source_entity_id: string;
      target_entity_id: string;
      weight: number | null;
    }>) {
      const recency = recencyIndex[sourceType].get(row.source_entity_id) ?? 1;
      const relationWeight =
        typeof row.weight === "number" && Number.isFinite(row.weight) && row.weight > 0
          ? row.weight
          : 1;
      const sourceWeightBoost = sourceType === "domain" ? 1.2 : 1;
      addScore(boosts, row.target_entity_id, relationWeight * recency * sourceWeightBoost);
    }
  }

  return boosts;
}

async function buildPersonalizedRecommendations(
  userId: string,
  limit: number
): Promise<{ projects: RecommendedProject[]; signalCount: number }> {
  const { signals, buckets, recencyIndex, recentInteractionCount } = await collectSignals(userId);
  const [domainSignalCollection, projectBoosts] = await Promise.all([
    collectDomainScores(userId, buckets, recencyIndex),
    collectProjectBoosts(buckets, recencyIndex),
  ]);
  const domainScores = domainSignalCollection.domainScores;
  const hasInterestSignals = domainSignalCollection.interestTypes.length > 0;
  const hasFavoriteSignals = signals.length > 0;
  const signalCount = recentInteractionCount + domainSignalCollection.interestTypes.length;

  const topDomainIds = toTopIds(domainScores, 6);
  const domainProjectIds = await fetchProjectIdsForDomains(topDomainIds);
  const candidateProjectIds = new Set<string>([...projectBoosts.keys(), ...domainProjectIds]);

  if (!candidateProjectIds.size) {
    return { projects: [], signalCount };
  }

  const projects = await fetchActiveProjectsByIds([...candidateProjectIds]);
  if (!projects.length) {
    return { projects: [], signalCount };
  }

  const domainMap = await fetchProjectDomainMap(projects.map((project) => project.id));
  const scored = projects.map((project) => {
    const projectDomainIds = domainMap.get(project.id) ?? [];
    const domainBoost =
      projectDomainIds.reduce((max, domainId) => {
        const score = domainScores.get(domainId) ?? 0;
        return score > max ? score : max;
      }, 0) || 0;
    const projectBoost = projectBoosts.get(project.id) ?? 0;
    const createdAtDays = parseDaysSince(project.created_at);
    const freshnessBoost = createdAtDays <= 45 ? 0.4 : 0;
    const featuredBoost = project.is_featured ? 0.7 : 0;
    const score = Number((domainBoost + projectBoost + freshnessBoost + featuredBoost).toFixed(3));

    const reasons: string[] = [];
    if (projectBoost > 0.2) reasons.push("Gelinkt aan je favorieten");
    if (domainBoost > 0.2) {
      if (hasFavoriteSignals) {
        reasons.push("Past bij je favoriete domeinen");
      } else if (hasInterestSignals) {
        reasons.push("Past bij je profielinteresses");
      } else {
        reasons.push("Past bij populaire domeinen");
      }
    }
    if (recentInteractionCount > 0 && reasons.length > 0) {
      reasons.push("Gebaseerd op recente activiteit");
    }
    if (reasons.length === 0) {
      reasons.push("Persoonlijke startmix");
    }

    return {
      project,
      score,
      reasons,
      matchedDomainIds: projectDomainIds.filter((domainId) => (domainScores.get(domainId) ?? 0) > 0),
    } satisfies RecommendedProject;
  });

  return {
    projects: scored.sort((a, b) => b.score - a.score).slice(0, limit),
    signalCount,
  };
}

async function collectDomainPopularityScores(activeDomainIds: Set<string>): Promise<Map<string, number>> {
  const supabase = createPlatformClient();
  const scores = new Map<string, number>();

  const addDomainIds = (rows: Array<{ domain_id: string | null }>, weight: number) => {
    for (const row of rows) {
      if (!row.domain_id || !activeDomainIds.has(row.domain_id)) continue;
      addScore(scores, row.domain_id, weight);
    }
  };

  const [
    productsRes,
    workshopsRes,
    projectsRes,
    eventsRes,
    articlesRes,
    articleLinksRes,
    favoriteDomainsRes,
  ] = await Promise.all([
    supabase.from("products").select("domain_id").eq("is_active", true).eq("status", "active"),
    supabase.from("workshops").select("domain_id").eq("is_active", true),
    supabase.from("project_domains").select("domain_id"),
    supabase.from("event_domains").select("domain_id"),
    supabase.from("articles").select("domain_id").eq("is_published", true),
    supabase.from("article_domains").select("domain_id"),
    supabase.from("favorites").select("entity_id").eq("entity_type", "domain"),
  ]);

  addDomainIds(
    (productsRes.data ?? []) as Array<{ domain_id: string | null }>,
    1
  );
  addDomainIds(
    (workshopsRes.data ?? []) as Array<{ domain_id: string | null }>,
    1.4
  );
  addDomainIds(
    (projectsRes.data ?? []) as Array<{ domain_id: string | null }>,
    2.1
  );
  addDomainIds(
    (eventsRes.data ?? []) as Array<{ domain_id: string | null }>,
    1.2
  );
  addDomainIds(
    (articlesRes.data ?? []) as Array<{ domain_id: string | null }>,
    1
  );
  addDomainIds(
    (articleLinksRes.data ?? []) as Array<{ domain_id: string | null }>,
    1
  );

  for (const row of (favoriteDomainsRes.data ?? []) as Array<{ entity_id: string }>) {
    if (!activeDomainIds.has(row.entity_id)) continue;
    addScore(scores, row.entity_id, 3);
  }

  return scores;
}

async function buildColdStartRecommendations(limit: number): Promise<RecommendedProject[]> {
  const domains = await listActiveDomains();
  const domainOrder = new Map(domains.map((domain) => [domain.id, domain.sort_order]));
  const activeDomainIds = new Set(domains.map((domain) => domain.id));
  const domainScores = await collectDomainPopularityScores(activeDomainIds);

  const rankedDomainIds = [...activeDomainIds].sort((a, b) => {
    const scoreDelta = (domainScores.get(b) ?? 0) - (domainScores.get(a) ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    return (domainOrder.get(a) ?? 0) - (domainOrder.get(b) ?? 0);
  });
  const topDomainIds = rankedDomainIds.slice(0, 6);

  const domainProjectIds = await fetchProjectIdsForDomains(topDomainIds);
  const projects =
    domainProjectIds.length > 0
      ? await fetchActiveProjectsByIds(domainProjectIds)
      : await listFeaturedProjects(limit * 2);

  if (!projects.length) return [];

  const domainMap = await fetchProjectDomainMap(projects.map((project) => project.id));
  return toColdStartRecommendations(projects, limit, domainScores, domainMap);
}

function buildDeterministicPersonalizedFallback(
  userId: string,
  projects: Project[],
  limit: number
): RecommendedProject[] {
  return [...projects]
    .sort((a, b) => {
      const aHash = stableHash(`${userId}:${a.id}`);
      const bHash = stableHash(`${userId}:${b.id}`);
      return aHash - bHash;
    })
    .slice(0, limit)
    .map((project) => ({
      project,
      score: 0.1,
      reasons: ["Persoonlijke startmix"],
      matchedDomainIds: [],
    }));
}

export async function getProjectRecommendations(options?: {
  userId?: string | null;
  limit?: number;
}): Promise<ProjectRecommendationResult> {
  const startedAt = Date.now();
  const limit = clampLimit(options?.limit);
  const userId = options?.userId ?? null;

  try {
    if (userId) {
      const personalized = await buildPersonalizedRecommendations(userId, limit);
      if (personalized.projects.length > 0) {
        return {
          source: "personalized",
          projects: personalized.projects,
          signalCount: personalized.signalCount,
          latencyMs: Date.now() - startedAt,
        };
      }

      const featured = await listFeaturedProjects(limit * 2);
      const fallback = buildDeterministicPersonalizedFallback(userId, featured, limit);
      if (fallback.length > 0) {
        return {
          source: "personalized",
          projects: fallback,
          signalCount: personalized.signalCount,
          latencyMs: Date.now() - startedAt,
        };
      }
    }

    const coldStart = await buildColdStartRecommendations(limit);
    if (coldStart.length > 0) {
      return {
        source: "cold_start",
        projects: coldStart,
        signalCount: 0,
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      source: userId ? "personalized" : "cold_start",
      projects: [],
      signalCount: 0,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    let fallbackProjects: Project[] = [];
    try {
      fallbackProjects = await listFeaturedProjects(limit);
    } catch {
      fallbackProjects = [];
    }
    return {
      source: userId ? "personalized" : "cold_start",
      projects: fallbackProjects.map((project) => ({
        project,
        score: 0,
        reasons: ["Populair op Hobbysalon"],
        matchedDomainIds: [],
      })),
      signalCount: 0,
      latencyMs: Date.now() - startedAt,
    };
  }
}
