import { createPlatformClient } from "../client";
import { listFavoritesByUser } from "./favorites";
import type {
  LearningPath,
  LearningPathStep,
  LearningPathStepEntityType,
} from "@/types/platform";

export type LearningPathWithStepCount = LearningPath & {
  step_count: number;
};

export type LearningPathStepTarget = {
  title: string;
  href: string;
  entityType: LearningPathStepEntityType;
};

export type LearningPathStepWithState = LearningPathStep & {
  target: LearningPathStepTarget | null;
  is_completed: boolean;
  completed_at: string | null;
};

type ActivityRow = {
  entity_type: string | null;
  entity_id: string | null;
  occurred_at: string;
};

const STEP_ENTITY_TYPES: LearningPathStepEntityType[] = [
  "article",
  "workshop",
  "product",
  "project",
];

function isStepEntityType(value: string): value is LearningPathStepEntityType {
  return STEP_ENTITY_TYPES.includes(value as LearningPathStepEntityType);
}

export async function listLearningPathsByDomain(
  domainId: string,
  options?: { limit?: number }
): Promise<LearningPathWithStepCount[]> {
  const supabase = createPlatformClient();
  let query = supabase
    .from("learning_paths")
    .select("*")
    .eq("domain_id", domainId)
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const paths = data as LearningPath[];
  if (!paths.length) return [];

  const { data: stepRows } = await supabase
    .from("learning_path_steps")
    .select("learning_path_id")
    .in(
      "learning_path_id",
      paths.map((path) => path.id)
    );

  const stepCountByPathId = new Map<string, number>();
  for (const row of (stepRows ?? []) as Array<{ learning_path_id: string }>) {
    stepCountByPathId.set(
      row.learning_path_id,
      (stepCountByPathId.get(row.learning_path_id) ?? 0) + 1
    );
  }

  return paths.map((path) => ({
    ...path,
    step_count: stepCountByPathId.get(path.id) ?? 0,
  }));
}

export async function getLearningPathByDomainAndSlug(
  domainId: string,
  pathSlug: string
): Promise<LearningPath | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("learning_paths")
    .select("*")
    .eq("domain_id", domainId)
    .eq("slug", pathSlug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as LearningPath;
}

export async function listLearningPathSteps(
  learningPathId: string
): Promise<LearningPathStep[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("learning_path_steps")
    .select("*")
    .eq("learning_path_id", learningPathId)
    .order("step_order", { ascending: true });

  if (error || !data) return [];

  const rawSteps = data as Array<Record<string, unknown>>;
  return rawSteps
    .map((row) => {
      const relatedType = row.related_entity_type;
      if (typeof relatedType !== "string" || !isStepEntityType(relatedType)) {
        return null;
      }
      return {
        ...(row as unknown as LearningPathStep),
        related_entity_type: relatedType,
      };
    })
    .filter((step): step is LearningPathStep => !!step);
}

export async function listLearningPathStepsByPathIds(
  learningPathIds: string[]
): Promise<LearningPathStep[]> {
  if (!learningPathIds.length) return [];

  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("learning_path_steps")
    .select("*")
    .in("learning_path_id", [...new Set(learningPathIds)])
    .order("learning_path_id", { ascending: true })
    .order("step_order", { ascending: true });

  if (error || !data) return [];

  const rawSteps = data as Array<Record<string, unknown>>;
  return rawSteps
    .map((row) => {
      const relatedType = row.related_entity_type;
      if (typeof relatedType !== "string" || !isStepEntityType(relatedType)) {
        return null;
      }
      return {
        ...(row as unknown as LearningPathStep),
        related_entity_type: relatedType,
      };
    })
    .filter((step): step is LearningPathStep => !!step);
}

export async function resolveLearningPathStepTargets(
  steps: LearningPathStep[]
): Promise<Map<string, LearningPathStepTarget>> {
  const supabase = createPlatformClient();
  const byStepId = new Map<string, LearningPathStepTarget>();
  const idsByType: Record<LearningPathStepEntityType, string[]> = {
    article: [],
    workshop: [],
    product: [],
    project: [],
  };

  for (const step of steps) {
    idsByType[step.related_entity_type].push(step.related_entity_id);
  }

  const [articlesRes, workshopsRes, productsRes, projectsRes] = await Promise.all([
    idsByType.article.length > 0
      ? supabase
          .from("articles")
          .select("id, slug, title")
          .in("id", [...new Set(idsByType.article)])
      : Promise.resolve({ data: [] }),
    idsByType.workshop.length > 0
      ? supabase
          .from("workshops")
          .select("id, slug, title")
          .in("id", [...new Set(idsByType.workshop)])
      : Promise.resolve({ data: [] }),
    idsByType.product.length > 0
      ? supabase
          .from("products")
          .select("id, slug, title")
          .in("id", [...new Set(idsByType.product)])
      : Promise.resolve({ data: [] }),
    idsByType.project.length > 0
      ? supabase
          .from("projects")
          .select("id, slug, title")
          .in("id", [...new Set(idsByType.project)])
      : Promise.resolve({ data: [] }),
  ]);

  const targetByEntityKey = new Map<string, LearningPathStepTarget>();

  for (const row of (articlesRes.data ?? []) as Array<{ id: string; slug: string; title: string }>) {
    targetByEntityKey.set(`article:${row.id}`, {
      title: row.title,
      href: `/artikel/${row.slug}`,
      entityType: "article",
    });
  }
  for (const row of (workshopsRes.data ?? []) as Array<{ id: string; slug: string; title: string }>) {
    targetByEntityKey.set(`workshop:${row.id}`, {
      title: row.title,
      href: `/workshop/${row.slug}`,
      entityType: "workshop",
    });
  }
  for (const row of (productsRes.data ?? []) as Array<{ id: string; slug: string; title: string }>) {
    targetByEntityKey.set(`product:${row.id}`, {
      title: row.title,
      href: `/product/${row.slug}`,
      entityType: "product",
    });
  }
  for (const row of (projectsRes.data ?? []) as Array<{ id: string; slug: string; title: string }>) {
    targetByEntityKey.set(`project:${row.id}`, {
      title: row.title,
      href: `/project/${row.slug}`,
      entityType: "project",
    });
  }

  for (const step of steps) {
    const key = `${step.related_entity_type}:${step.related_entity_id}`;
    const target = targetByEntityKey.get(key);
    if (!target) continue;
    byStepId.set(step.id, target);
  }

  return byStepId;
}

export async function getLearningPathCompletionMap(
  userId: string | null | undefined,
  steps: LearningPathStep[]
): Promise<Map<string, string>> {
  const completedAtByStepId = new Map<string, string>();
  if (!userId || !steps.length) {
    return completedAtByStepId;
  }

  const supabase = createPlatformClient();
  const idsByType: Record<LearningPathStepEntityType, string[]> = {
    article: [],
    workshop: [],
    product: [],
    project: [],
  };

  for (const step of steps) {
    idsByType[step.related_entity_type].push(step.related_entity_id);
  }

  const favorites = await listFavoritesByUser(userId);
  const favoriteAtByEntityKey = new Map<string, string>();
  for (const favorite of favorites) {
    if (!isStepEntityType(favorite.entity_type)) continue;
    favoriteAtByEntityKey.set(
      `${favorite.entity_type}:${favorite.entity_id}`,
      favorite.created_at
    );
  }

  const activityRowsByEntityKey = new Map<string, string>();
  const activityQueries = STEP_ENTITY_TYPES.map(async (type) => {
    const ids = [...new Set(idsByType[type])];
    if (ids.length === 0) return [] as ActivityRow[];

    const { data, error } = await supabase
      .from("user_activity_log")
      .select("entity_type, entity_id, occurred_at")
      .eq("user_id", userId)
      .eq("entity_type", type)
      .in("entity_id", ids)
      .order("occurred_at", { ascending: false })
      .limit(400);

    if (error || !data) return [] as ActivityRow[];
    return data as ActivityRow[];
  });

  const activityGroups = await Promise.all(activityQueries);
  for (const activityRows of activityGroups) {
    for (const row of activityRows) {
      if (!row.entity_type || !row.entity_id) continue;
      const key = `${row.entity_type}:${row.entity_id}`;
      if (!activityRowsByEntityKey.has(key)) {
        activityRowsByEntityKey.set(key, row.occurred_at);
      }
    }
  }

  for (const step of steps) {
    const key = `${step.related_entity_type}:${step.related_entity_id}`;
    const completedAt =
      activityRowsByEntityKey.get(key) ?? favoriteAtByEntityKey.get(key) ?? null;
    if (!completedAt) continue;
    completedAtByStepId.set(step.id, completedAt);
  }

  return completedAtByStepId;
}
