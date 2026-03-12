import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Expert",
};

const DIFFICULTY_MAP: Record<string, "beginner" | "intermediate" | "advanced"> = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
};

type DifficultyIndicatorProps = {
  level: string;
  className?: string;
};

function DifficultyIndicator({ level, className }: DifficultyIndicatorProps) {
  const label = DIFFICULTY_LABELS[level] ?? level;
  const difficulty = DIFFICULTY_MAP[level] ?? "beginner";

  return (
    <Badge difficulty={difficulty} className={cn(className)}>
      {label}
    </Badge>
  );
}

export { DifficultyIndicator, DIFFICULTY_LABELS };
export type { DifficultyIndicatorProps };
