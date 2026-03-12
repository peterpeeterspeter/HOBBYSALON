import { cn } from "@/lib/utils";
import { SearchX } from "lucide-react";
import { Button } from "./button";
import { LANDING_IMAGES } from "./ai-generated-image";
import { LaoZhangImageFallback } from "./laozhang-image-fallback";

type EmptyStateProps = {
  icon?: React.ReactNode;
  /** Use a LaoZhang-generated image instead of icon. Falls back to icon if image missing. */
  image?: keyof typeof LANDING_IMAGES;
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
  image,
  title = "Geen resultaten",
  description = "Probeer andere zoekfilters of bekijk onze aanbevelingen.",
  action,
  className,
}: EmptyStateProps) {
  const imageSrc = image ? LANDING_IMAGES[image] : null;
  const defaultIcon = icon || <SearchX size={40} aria-hidden="true" />;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="mb-4 text-[var(--muted)] w-24 h-24 flex items-center justify-center shrink-0 overflow-hidden rounded-xl">
        {imageSrc ? (
          <LaoZhangImageFallback
            src={imageSrc}
            alt=""
            className="w-full h-full opacity-80 rounded-xl"
            fallback={defaultIcon}
          />
        ) : (
          defaultIcon
        )}
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
