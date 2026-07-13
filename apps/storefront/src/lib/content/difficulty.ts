export const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

type DifficultyMeta = {
  level: DifficultyLevel;
  label: string;
  order: number;
};

const DIFFICULTY_META: Record<DifficultyLevel, DifficultyMeta> = {
  beginner: { level: "beginner", label: "Beginner", order: 1 },
  intermediate: { level: "intermediate", label: "Gevorderd", order: 2 },
  advanced: { level: "advanced", label: "Expert", order: 3 },
};

export function getDifficultyMeta(value: string | null | undefined): DifficultyMeta | null {
  return value && value in DIFFICULTY_META
    ? DIFFICULTY_META[value as DifficultyLevel]
    : null;
}

export function compareDifficulty(
  first: string | null | undefined,
  second: string | null | undefined
): number {
  const difference =
    (getDifficultyMeta(first)?.order ?? 0) - (getDifficultyMeta(second)?.order ?? 0);
  return Math.sign(difference);
}
