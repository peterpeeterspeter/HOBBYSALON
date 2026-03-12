import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  href?: string;
  linkText?: string;
  className?: string;
};

function SectionHeader({
  title,
  description,
  href,
  linkText = "Bekijk alles",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-6", className)}>
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">{title}</h2>
        {description && (
          <p className="mt-1 text-[var(--muted)]">{description}</p>
        )}
      </div>
      {href && (
        <a
          href={href}
          className="inline-flex items-center gap-1 text-[var(--accent)] font-medium hover:underline whitespace-nowrap shrink-0 min-h-[var(--touch-target-min)] px-1"
        >
          {linkText}
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export { SectionHeader };
export type { SectionHeaderProps };
