import type { ProjectRequirementItem } from "./project-requirements";

export type MaterialCupboardSource = {
  entityType: "article" | "project";
  entityId: string;
  items: ProjectRequirementItem[];
};

export type MaterialCupboardEvent = {
  eventName: string;
  entityType: string | null;
  entityId: string | null;
  occurredAt: string;
  itemKey: string | null;
};

export type MaterialCupboardEntry = {
  key: string;
  title: string;
  activeProjectCount: number;
};

function sourceKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function getMaterialCupboardEntries(
  sources: MaterialCupboardSource[],
  events: MaterialCupboardEvent[]
): MaterialCupboardEntry[] {
  const materialsBySource = new Map(
    sources.map((source) => [
      sourceKey(source.entityType, source.entityId),
      new Map(
        source.items
          .filter((item) => item.kind === "material")
          .map((item) => [item.key, item])
      ),
    ])
  );
  const confirmedKeysBySource = new Map<string, Set<string>>();

  for (const event of [...events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))) {
    if (
      (event.eventName !== "project_item_completed" && event.eventName !== "project_item_reopened") ||
      !event.entityType ||
      !event.entityId ||
      !event.itemKey
    ) {
      continue;
    }

    const key = sourceKey(event.entityType, event.entityId);
    const materials = materialsBySource.get(key);
    if (!materials?.has(event.itemKey)) continue;

    const confirmedKeys = confirmedKeysBySource.get(key) ?? new Set<string>();
    if (event.eventName === "project_item_completed") {
      confirmedKeys.add(event.itemKey);
    } else {
      confirmedKeys.delete(event.itemKey);
    }
    confirmedKeysBySource.set(key, confirmedKeys);
  }

  const entriesByKey = new Map<string, MaterialCupboardEntry>();
  for (const [key, confirmedKeys] of confirmedKeysBySource) {
    const materials = materialsBySource.get(key);
    if (!materials) continue;

    for (const materialKey of confirmedKeys) {
      const material = materials.get(materialKey);
      if (!material) continue;
      const entry = entriesByKey.get(materialKey) ?? {
        key: materialKey,
        title: material.title,
        activeProjectCount: 0,
      };
      entry.activeProjectCount += 1;
      entriesByKey.set(materialKey, entry);
    }
  }

  return [...entriesByKey.values()].sort(
    (left, right) => left.title.localeCompare(right.title, "nl") || left.key.localeCompare(right.key)
  );
}
