import { cn } from "@/lib/utils";
import { SearchX } from "lucide-react";
import { Button } from "./button";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
};

function EmptyState({
  icon,
  title = "Geen resultaten",
  description = "Probeer andere zoekfilters of bekijk onze aanbevelingen.",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="mb-4 text-[var(--muted)]">
        {icon || <SearchX size={40} aria-hidden="true" />}
      </div>
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
        {title}
      </h3>
      <p className="text-[var(--muted)] max-w-md mb-6">{description}</p>
      {action && (
        action.href ? (
          <a href={action.href}>
            <Button variant="secondary" size="md">
              {action.label}
            </Button>
          </a>
        ) : (
          <Button variant="secondary" size="md" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
