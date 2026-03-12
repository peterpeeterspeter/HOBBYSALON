import { cn } from "@/lib/utils";

type ProgressBarProps = {
  current: number;
  total: number;
  label?: string;
  showCount?: boolean;
  className?: string;
};

function ProgressBar({
  current,
  total,
  label,
  showCount = true,
  className,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {(label || showCount) && (
        <div className="flex items-center justify-between text-sm">
          {label && (
            <span className="font-medium text-[var(--foreground)]">{label}</span>
          )}
          {showCount && (
            <span className="text-[var(--muted)]">
              {current} / {total}
            </span>
          )}
        </div>
      )}
      <div
        className="h-2 w-full rounded-full bg-[var(--border)] overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-[var(--transition-normal)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressBar };
export type { ProgressBarProps };
