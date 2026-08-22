import type { ProjectRequirementItem } from "@/lib/profile/project-requirements";

type ParsedArticleMaterial = ProjectRequirementItem & { detail: null };

const MATERIAL_SECTION_NAMES = new Set([
  "materialen",
  "materialenlijst",
  "benodigdheden",
  "wat heb je nodig",
]);

function normalizeHeading(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("nl");
}

function materialKey(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseArticleMaterialRequirements(
  markdown: string | null | undefined
): ParsedArticleMaterial[] {
  if (!markdown) return [];

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const materials: ParsedArticleMaterial[] = [];
  let inMaterialsSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      inMaterialsSection = MATERIAL_SECTION_NAMES.has(normalizeHeading(heading[1]));
      continue;
    }
    if (!inMaterialsSection) continue;

    const item = line.match(/^(?:[-*+] |\d+[.)] )(.+)$/)?.[1]?.trim();
    if (!item) {
      if (line) inMaterialsSection = false;
      continue;
    }

    const normalizedItem = item.replace(/^\d+[.)]\s+/, "").trim();
    const key = materialKey(normalizedItem);
    if (!key || materials.some((material) => material.key === `material:article:${key}`)) {
      continue;
    }
    materials.push({
      key: `material:article:${key}`,
      title: normalizedItem,
      kind: "material",
      detail: null,
    });
  }

  return materials;
}