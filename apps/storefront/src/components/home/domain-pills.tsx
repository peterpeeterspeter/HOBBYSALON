import Link from "next/link";
import { cn } from "@/lib/utils";
import { getDomainPlaceholderImage } from "@/components/ui/ai-generated-image";

type Domain = {
  id: string;
  slug: string;
  name: string;
  short_description?: string | null;
  hero_image_url?: string | null;
};

type DomainPillsProps = {
  domains: Domain[];
  className?: string;
};

/**
 * Horizontal scrolling domain pills with thumbnail preview.
 * Replaces the grid of identical cards for the "Populaire domeinen" section.
 * Each pill shows a circular image + domain name for quick scanning.
 */
function DomainPills({ domains, className }: DomainPillsProps) {
  return (
    <div
      className={cn(
        "flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory",
        className
      )}
      role="list"
    >
      {domains.map((domain) => (
        <Link
          key={domain.id}
          href={`/${domain.slug}`}
          className="group/pill flex flex-col items-center gap-3 shrink-0 snap-start min-w-[120px] max-w-[140px]"
          role="listitem"
        >
          {/* Circular thumbnail */}
          <div className="relative h-20 w-20 md:h-24 md:w-24 overflow-hidden rounded-full border-2 border-[var(--border)] transition-all duration-[var(--transition-normal)] group-hover/pill:border-[var(--accent)] group-hover/pill:shadow-[var(--shadow-lg)] group-hover/pill:scale-105 motion-reduce:group-hover/pill:scale-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={domain.hero_image_url ?? getDomainPlaceholderImage(domain.slug)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          {/* Label */}
          <span className="text-sm font-medium text-[var(--foreground)] text-center group-hover/pill:text-[var(--accent)] transition-colors">
            {domain.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

export { DomainPills };
export type { DomainPillsProps };
