import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  href?: string;
  linkText?: string;
  /** Quieter styling for secondary/background sections */
  subtle?: boolean;
  className?: string;
};

function SectionHeader({
  title,
  description,
  href,
  linkText = "Bekijk alles",
  subtle,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-6", className)}>
      <div>
        <h2
          className={cn(
            "text-[var(--foreground)]",
            subtle
              ? "text-base font-semibold text-[var(--muted)]"
              : "text-3xl font-bold font-[family-name:var(--font-heading)]"
          )}
        >
          {title}
        </h2>
        {/* Decorative terracotta underline for main section headers */}
        {!subtle && (
          <span
            className="mt-2 block h-[3px] w-10 rounded-full bg-[var(--accent)]"
            aria-hidden="true"
          />
        )}
        {description && (
          <p
            className={cn(
              subtle
                ? "mt-1 text-xs text-[var(--muted)]/80"
                : "mt-3 text-base leading-relaxed text-[var(--muted)]"
            )}
          >
            {description}
          </p>
        )}
      </div>
      {href && (
        <a
          href={href}
          className="group/link inline-flex items-center gap-1 text-[var(--accent)] font-medium hover:underline whitespace-nowrap shrink-0 min-h-[var(--touch-target-min)] px-1"
        >
          {linkText}
          <ArrowRight
            size={16}
            aria-hidden="true"
            className="transition-transform duration-[var(--transition-fast)] group-hover/link:translate-x-1"
          />
        </a>
      )}
    </div>
  );
}

export { SectionHeader };
export type { SectionHeaderProps };
