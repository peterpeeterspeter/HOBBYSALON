import { cn } from "@/lib/utils";

type StepIndicatorProps = {
  current: number;
  total: number;
  className?: string;
};

function StepIndicator({ current, total, className }: StepIndicatorProps) {
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Stap ${current} van ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isCompleted = stepNum < current;

        return (
          <div
            key={stepNum}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors duration-[var(--transition-fast)]",
              isCompleted && "bg-[var(--accent)]",
              isActive && "bg-[var(--accent)]/60",
              !isCompleted && !isActive && "bg-[var(--border)]"
            )}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export { StepIndicator };
export type { StepIndicatorProps };
