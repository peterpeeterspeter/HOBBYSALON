import { createPlatformClient } from "../client";
import {
  getFavoriteProfileSummary,
  listFavoritesByUser,
  type FavoriteProfileSummary,
} from "./favorites";
import type { EntityType } from "@/types/platform";

type SupportedEntityType = EntityType | "bundle" | "order" | "cart";

type ActivityEventName =
  | "project_view"
  | "home_recommendations_viewed"
  | "bundle_add"
  | "add_to_cart"
  | "checkout_started"
  | "checkout_completed"
  | "workshop_booking_request_submitted"
  | "newsletter_signup";

type UserActivityRow = {
  id: string;
  user_id: string;
  event_name: string;
  entity_type: string | null;
  entity_id: string | null;
  path: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

type FavoriteBuckets = Record<EntityType, string[]>;

type DomainCounter = {
  signalCount: number;
  completionCount: number;
};

type BadgeRule = {
  key: string;
  name: string;
  description: string;
  target: number;
  progress: (context: BadgeContext) => number;
};

type BadgeContext = {
  favoritesSummary: FavoriteProfileSummary;
  eventCounts: Record<string, number>;
  completionCount: number;
  activityCount: number;
};

export type HobbyPassportDomainProgress = {
  domainId: string;
  domainSlug: string;
  domainName: string;
  signalCount: number;
  completionCount: number;
  progressPercent: number;
};

export type HobbyPassportBadge = {
  id: string;
  badgeKey: string;
  badgeName: string;
  badgeDescription: string;
  level: number;
  progressValue: number;
  progressTarget: number;
  unlockedAt: string | null;
};

export type HobbyPassportActivity = {
  id: string;
  eventName: string;
  entityType: string | null;
  entityId: string | null;
  occurredAt: string;
  path: string | null;
};

export type HobbyPassportData = {
  userId: string;
  profile: {
    points: number;
    completedActivities: number;
    favoriteCount: number;
    lastActivityAt: string | null;
  };
  favoritesSummary: FavoriteProfileSummary;
  domainProgress: HobbyPassportDomainProgress[];
  badges: HobbyPassportBadge[];
  recentActivities: HobbyPassportActivity[];
};

const ACTIVITY_POINT_WEIGHTS: Record<string, number> = {
  project_view: 2,
  home_recommendations_viewed: 1,
  bundle_add: 6,
  add_to_cart: 4,
  checkout_started: 5,
  checkout_completed: 30,
  workshop_booking_request_submitted: 24,
  newsletter_signup: 3,
};

const COMPLETION_EVENTS = new Set<string>([
  "checkout_completed",
  "workshop_booking_request_submitted",
]);

const FAVORITE_SIGNAL_WEIGHTS: Record<EntityType, number> = {
  domain: 3,
  creator: 2,
  product: 2,
  workshop: 2,
  event: 1,
  article: 1,
  project: 3,
};

const BADGE_RULES: BadgeRule[] = [
  {
    key: "first_steps",
    name: "Eerste stappen",
    description: "Bekijk minstens 3 projecten.",
    target: 3,
    progress: (context) => context.eventCounts.project_view ?? 0,
  },
  {
    key: "curator",
    name: "Curator",
    description: "Bewaar minstens 5 favorieten.",
    target: 5,
    progress: (context) => context.favoritesSummary.total,
  },
  {
    key: "bundle_builder",
    name: "Bundelbouwer",
    description: "Voeg minstens 2 bundels toe aan je winkelwagen.",
    target: 2,
    progress: (context) => context.eventCounts.bundle_add ?? 0,
  },
  {
    key: "maker_checkout",
    name: "Maker Checkout",
    description: "Plaats je eerste bestelling.",
    target: 1,
    progress: (context) => context.eventCounts.checkout_completed ?? 0,
  },
  {
    key: "community_joiner",
    name: "Community deelnemer",
    description: "Verstuur een workshop-aanvraag.",
    target: 1,
    progress: (context) => context.eventCounts.workshop_booking_request_submitted ?? 0,
  },
  {
    key: "momentum",
    name: "Momentum",
    description: "Verzamel 20 activiteiten in je paspoort.",
    target: 20,
    progress: (context) => context.activityCount,
  },
];

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function createFavoriteBuckets(): FavoriteBuckets {
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

function addToCounter(
  domainCounters: Map<string, DomainCounter>,
  domainId: string,
  points: number,
  completionIncrement = 0
): void {
  const existing = domainCounters.get(domainId) ?? {
    signalCount: 0,
    completionCount: 0,
  };
  existing.signalCount += points;
  existing.completionCount += completionIncrement;
  domainCounters.set(domainId, existing);
}

function toEventCounts(activities: UserActivityRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const activity of activities) {
    counts[activity.event_name] = (counts[activity.event_name] ?? 0) + 1;
  }
  return counts;
}

async function ensureUserProfileRow(userId: string): Promise<void> {
  const supabase = createPlatformClient();
  await supabase.from("user_hobby_profiles").upsert(
    {
      user_id: userId,
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    }
  );
}

async function listUserActivities(
  userId: string,
  limit = 150
): Promise<UserActivityRow[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("user_activity_log")
    .select("id,user_id,event_name,entity_type,entity_id,path,metadata,occurred_at")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as UserActivityRow[];
}

async function mapFavoriteSignalsToDomains(
  userId: string
): Promise<Map<string, DomainCounter>> {
  const supabase = createPlatformClient();
  const favorites = await listFavoritesByUser(userId);
  const buckets = createFavoriteBuckets();
  const counters = new Map<string, DomainCounter>();

  for (const favorite of favorites) {
    if (!isUuidLike(favorite.entity_id)) continue;
    buckets[favorite.entity_type].push(favorite.entity_id);
  }

  for (const domainId of buckets.domain) {
    addToCounter(counters, domainId, FAVORITE_SIGNAL_WEIGHTS.domain);
  }

  if (buckets.product.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, domain_id")
      .in("id", buckets.product);
    for (const row of (data ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addToCounter(counters, row.domain_id, FAVORITE_SIGNAL_WEIGHTS.product);
    }
  }

  if (buckets.workshop.length > 0) {
    const { data } = await supabase
      .from("workshops")
      .select("id, domain_id")
      .in("id", buckets.workshop);
    for (const row of (data ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addToCounter(counters, row.domain_id, FAVORITE_SIGNAL_WEIGHTS.workshop);
    }
  }

  if (buckets.event.length > 0) {
    const { data } = await supabase
      .from("event_domains")
      .select("event_id, domain_id")
      .in("event_id", buckets.event);
    for (const row of (data ?? []) as Array<{ event_id: string; domain_id: string }>) {
      addToCounter(counters, row.domain_id, FAVORITE_SIGNAL_WEIGHTS.event);
    }
  }

  if (buckets.article.length > 0) {
    const articleDomainIds = new Map<string, Set<string>>();
    const { data: directArticleRows } = await supabase
      .from("articles")
      .select("id, domain_id")
      .in("id", buckets.article);
    for (const row of (directArticleRows ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      const current = articleDomainIds.get(row.id) ?? new Set<string>();
      current.add(row.domain_id);
      articleDomainIds.set(row.id, current);
    }
    const { data: linkedArticleRows } = await supabase
      .from("article_domains")
      .select("article_id, domain_id")
      .in("article_id", buckets.article);
    for (const row of (linkedArticleRows ?? []) as Array<{ article_id: string; domain_id: string }>) {
      const current = articleDomainIds.get(row.article_id) ?? new Set<string>();
      current.add(row.domain_id);
      articleDomainIds.set(row.article_id, current);
    }
    for (const domainIds of articleDomainIds.values()) {
      for (const domainId of domainIds) {
        addToCounter(counters, domainId, FAVORITE_SIGNAL_WEIGHTS.article);
      }
    }
  }

  if (buckets.project.length > 0) {
    const { data } = await supabase
      .from("project_domains")
      .select("project_id, domain_id")
      .in("project_id", buckets.project);
    for (const row of (data ?? []) as Array<{ project_id: string; domain_id: string }>) {
      addToCounter(counters, row.domain_id, FAVORITE_SIGNAL_WEIGHTS.project);
    }
  }

  if (buckets.creator.length > 0) {
    const { data } = await supabase
      .from("creator_domains")
      .select("creator_id, domain_id")
      .in("creator_id", buckets.creator);
    for (const row of (data ?? []) as Array<{ creator_id: string; domain_id: string }>) {
      addToCounter(counters, row.domain_id, FAVORITE_SIGNAL_WEIGHTS.creator);
    }
  }

  return counters;
}

async function mapActivitySignalsToDomains(
  activities: UserActivityRow[]
): Promise<Map<string, DomainCounter>> {
  const supabase = createPlatformClient();
  const counters = new Map<string, DomainCounter>();
  const idsByType: Record<EntityType, string[]> = {
    domain: [],
    creator: [],
    product: [],
    workshop: [],
    event: [],
    article: [],
    project: [],
  };

  for (const activity of activities) {
    const type = activity.entity_type as EntityType | null;
    const entityId = activity.entity_id;
    if (!type || !entityId) continue;
    if (!(type in idsByType)) continue;
    if (!isUuidLike(entityId)) continue;
    idsByType[type].push(entityId);
  }

  for (const domainId of idsByType.domain) {
    addToCounter(counters, domainId, 1, 0);
  }

  if (idsByType.product.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, domain_id")
      .in("id", [...new Set(idsByType.product)]);
    for (const row of (data ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addToCounter(counters, row.domain_id, 1, 0);
    }
  }

  if (idsByType.workshop.length > 0) {
    const { data } = await supabase
      .from("workshops")
      .select("id, domain_id")
      .in("id", [...new Set(idsByType.workshop)]);
    for (const row of (data ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      addToCounter(counters, row.domain_id, 1, 0);
    }
  }

  if (idsByType.project.length > 0) {
    const { data } = await supabase
      .from("project_domains")
      .select("project_id, domain_id")
      .in("project_id", [...new Set(idsByType.project)]);
    for (const row of (data ?? []) as Array<{ project_id: string; domain_id: string }>) {
      addToCounter(counters, row.domain_id, 1, 0);
    }
  }

  if (idsByType.creator.length > 0) {
    const { data } = await supabase
      .from("creator_domains")
      .select("creator_id, domain_id")
      .in("creator_id", [...new Set(idsByType.creator)]);
    for (const row of (data ?? []) as Array<{ creator_id: string; domain_id: string }>) {
      addToCounter(counters, row.domain_id, 1, 0);
    }
  }

  if (idsByType.event.length > 0) {
    const { data } = await supabase
      .from("event_domains")
      .select("event_id, domain_id")
      .in("event_id", [...new Set(idsByType.event)]);
    for (const row of (data ?? []) as Array<{ event_id: string; domain_id: string }>) {
      addToCounter(counters, row.domain_id, 1, 0);
    }
  }

  if (idsByType.article.length > 0) {
    const uniqueArticleIds = [...new Set(idsByType.article)];
    const articleDomains = new Map<string, Set<string>>();
    const { data: directRows } = await supabase
      .from("articles")
      .select("id, domain_id")
      .in("id", uniqueArticleIds);
    for (const row of (directRows ?? []) as Array<{ id: string; domain_id: string | null }>) {
      if (!row.domain_id) continue;
      const current = articleDomains.get(row.id) ?? new Set<string>();
      current.add(row.domain_id);
      articleDomains.set(row.id, current);
    }
    const { data: linkRows } = await supabase
      .from("article_domains")
      .select("article_id, domain_id")
      .in("article_id", uniqueArticleIds);
    for (const row of (linkRows ?? []) as Array<{ article_id: string; domain_id: string }>) {
      const current = articleDomains.get(row.article_id) ?? new Set<string>();
      current.add(row.domain_id);
      articleDomains.set(row.article_id, current);
    }
    for (const domains of articleDomains.values()) {
      for (const domainId of domains) {
        addToCounter(counters, domainId, 1, 0);
      }
    }
  }

  for (const activity of activities) {
    if (!COMPLETION_EVENTS.has(activity.event_name)) continue;
    const entityType = activity.entity_type as EntityType | null;
    const entityId = activity.entity_id;
    if (!entityType || !entityId || !isUuidLike(entityId)) continue;

    if (entityType === "domain") {
      addToCounter(counters, entityId, 0, 1);
      continue;
    }

    if (entityType === "workshop") {
      const { data } = await supabase
        .from("workshops")
        .select("domain_id")
        .eq("id", entityId)
        .limit(1);
      const domainId = (data as Array<{ domain_id: string | null }> | null)?.[0]?.domain_id;
      if (domainId) addToCounter(counters, domainId, 0, 1);
      continue;
    }

    if (entityType === "product") {
      const { data } = await supabase
        .from("products")
        .select("domain_id")
        .eq("id", entityId)
        .limit(1);
      const domainId = (data as Array<{ domain_id: string | null }> | null)?.[0]?.domain_id;
      if (domainId) addToCounter(counters, domainId, 0, 1);
      continue;
    }

    if (entityType === "project") {
      const { data } = await supabase
        .from("project_domains")
        .select("domain_id")
        .eq("project_id", entityId);
      for (const row of (data ?? []) as Array<{ domain_id: string }>) {
        addToCounter(counters, row.domain_id, 0, 1);
      }
    }
  }

  return counters;
}

async function syncUserBadges(
  userId: string,
  context: BadgeContext
): Promise<HobbyPassportBadge[]> {
  const supabase = createPlatformClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("user_badges")
    .select("id,badge_key,unlocked_at")
    .eq("user_id", userId);
  if (existingError) return [];

  const existingByKey = new Map(
    ((existingRows ?? []) as Array<{ id: string; badge_key: string; unlocked_at: string | null }>).map(
      (row) => [row.badge_key, row]
    )
  );
  const nowIso = new Date().toISOString();
  const upserts = BADGE_RULES.map((rule) => {
    const progressValue = Math.max(0, Math.floor(rule.progress(context)));
    const unlocked = progressValue >= rule.target;
    const existing = existingByKey.get(rule.key);
    return {
      user_id: userId,
      badge_key: rule.key,
      badge_name: rule.name,
      badge_description: rule.description,
      level: 1,
      progress_value: progressValue,
      progress_target: rule.target,
      unlocked_at: unlocked ? existing?.unlocked_at ?? nowIso : null,
      metadata: {
        source: "hobby_passport_v1",
      },
    };
  });

  const { error: upsertError } = await supabase
    .from("user_badges")
    .upsert(upserts, { onConflict: "user_id,badge_key" });
  if (upsertError) return [];

  const { data } = await supabase
    .from("user_badges")
    .select(
      "id,badge_key,badge_name,badge_description,level,progress_value,progress_target,unlocked_at"
    )
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false, nullsFirst: false })
    .order("badge_key", { ascending: true });

  if (!data) return [];

  return (data as Array<{
    id: string;
    badge_key: string;
    badge_name: string;
    badge_description: string;
    level: number;
    progress_value: number;
    progress_target: number;
    unlocked_at: string | null;
  }>).map((badge) => ({
    id: badge.id,
    badgeKey: badge.badge_key,
    badgeName: badge.badge_name,
    badgeDescription: badge.badge_description,
    level: badge.level,
    progressValue: badge.progress_value,
    progressTarget: badge.progress_target,
    unlockedAt: badge.unlocked_at,
  }));
}

async function upsertProfileMetrics(
  userId: string,
  profile: {
    points: number;
    completedActivities: number;
    favoriteCount: number;
    preferredDomains: string[];
    lastActivityAt: string | null;
  }
): Promise<void> {
  const supabase = createPlatformClient();
  await supabase.from("user_hobby_profiles").upsert(
    {
      user_id: userId,
      points_total: profile.points,
      completed_activity_count: profile.completedActivities,
      favorite_count: profile.favoriteCount,
      preferred_domain_ids: profile.preferredDomains,
      last_activity_at: profile.lastActivityAt,
    },
    { onConflict: "user_id" }
  );
}

export async function getHobbyPassportData(userId: string): Promise<HobbyPassportData> {
  await ensureUserProfileRow(userId);

  const [favoritesSummary, activities, favoriteDomainCounters] = await Promise.all([
    getFavoriteProfileSummary(userId),
    listUserActivities(userId, 200),
    mapFavoriteSignalsToDomains(userId),
  ]);
  const activityDomainCounters = await mapActivitySignalsToDomains(activities);

  const eventCounts = toEventCounts(activities);
  const completedActivities = activities.filter((activity) =>
    COMPLETION_EVENTS.has(activity.event_name)
  ).length;
  const points = activities.reduce((sum, activity) => {
    return sum + (ACTIVITY_POINT_WEIGHTS[activity.event_name] ?? 1);
  }, 0);

  const supabase = createPlatformClient();
  const { data: domainRows } = await supabase
    .from("domains")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const domainProgress: HobbyPassportDomainProgress[] = (
    (domainRows ?? []) as Array<{ id: string; slug: string; name: string }>
  )
    .map((domain) => {
      const favoriteCounter = favoriteDomainCounters.get(domain.id);
      const activityCounter = activityDomainCounters.get(domain.id);
      const signalCount =
        (favoriteCounter?.signalCount ?? 0) + (activityCounter?.signalCount ?? 0);
      const completionCount =
        (favoriteCounter?.completionCount ?? 0) + (activityCounter?.completionCount ?? 0);
      const progressPercent = Math.min(100, signalCount * 8 + completionCount * 24);
      return {
        domainId: domain.id,
        domainSlug: domain.slug,
        domainName: domain.name,
        signalCount,
        completionCount,
        progressPercent,
      };
    })
    .filter((domain) => domain.signalCount > 0 || domain.completionCount > 0)
    .sort((a, b) => b.progressPercent - a.progressPercent)
    .slice(0, 8);

  const preferredDomainIds = domainProgress
    .filter((domain) => domain.progressPercent >= 20)
    .map((domain) => domain.domainId)
    .slice(0, 5);

  const lastActivityAt = activities[0]?.occurred_at ?? null;
  await upsertProfileMetrics(userId, {
    points,
    completedActivities,
    favoriteCount: favoritesSummary.total,
    preferredDomains: preferredDomainIds,
    lastActivityAt,
  });

  const badges = await syncUserBadges(userId, {
    favoritesSummary,
    eventCounts,
    completionCount: completedActivities,
    activityCount: activities.length,
  });

  const recentActivities: HobbyPassportActivity[] = activities.slice(0, 12).map((activity) => ({
    id: activity.id,
    eventName: activity.event_name,
    entityType: activity.entity_type,
    entityId: activity.entity_id,
    occurredAt: activity.occurred_at,
    path: activity.path,
  }));

  return {
    userId,
    profile: {
      points,
      completedActivities,
      favoriteCount: favoritesSummary.total,
      lastActivityAt,
    },
    favoritesSummary,
    domainProgress,
    badges,
    recentActivities,
  };
}

function extractPrimaryEntity(payload: Record<string, unknown>): {
  entityType: SupportedEntityType | null;
  entityId: string | null;
} {
  const mappings: Array<{ key: string; type: SupportedEntityType }> = [
    { key: "project_id", type: "project" },
    { key: "bundle_id", type: "bundle" },
    { key: "variant_id", type: "product" },
    { key: "workshop_id", type: "workshop" },
    { key: "order_id", type: "order" },
  ];

  for (const mapping of mappings) {
    const raw = payload[mapping.key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    return { entityType: mapping.type, entityId: value };
  }

  return { entityType: null, entityId: null };
}

export async function recordPassportActivityFromEvent(
  userId: string,
  eventName: string,
  payload: Record<string, unknown>
): Promise<void> {
  const allowedEvent = eventName as ActivityEventName;
  const knownEvents = new Set<ActivityEventName>([
    "project_view",
    "home_recommendations_viewed",
    "bundle_add",
    "add_to_cart",
    "checkout_started",
    "checkout_completed",
    "workshop_booking_request_submitted",
    "newsletter_signup",
  ]);
  if (!knownEvents.has(allowedEvent)) {
    return;
  }

  const supabase = createPlatformClient();
  const entity = extractPrimaryEntity(payload);

  await supabase.from("user_activity_log").insert({
    user_id: userId,
    event_name: eventName,
    source: "storefront",
    path: typeof payload.path === "string" ? payload.path : null,
    entity_type: entity.entityType,
    entity_id: entity.entityId,
    metadata: payload,
    occurred_at: new Date().toISOString(),
  });

  await getHobbyPassportData(userId);
}
