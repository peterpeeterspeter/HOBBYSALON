import { Circle } from "lucide-react";
import { getDifficultyMeta } from "@/lib/content/difficulty";

type Props = {
  difficulty: string | null | undefined;
};

export function DifficultyBadge({ difficulty }: Props) {
  const meta = getDifficultyMeta(difficulty);
  if (!meta) return null;

  return (
    <span
      aria-label={`Moeilijkheid: ${meta.label}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-sm font-semibold text-[var(--foreground)]"
    >
      <Circle
        aria-hidden
        fill={`var(--difficulty-${meta.level})`}
        strokeWidth={0}
        size={12}
      />
      {meta.label}
    </span>
  );
}
