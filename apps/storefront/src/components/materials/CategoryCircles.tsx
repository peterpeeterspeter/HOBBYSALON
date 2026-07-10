import Link from "next/link";
import type { Domain } from "@/types/platform";

type CategoryCirclesProps = {
  domains: Domain[];
  activeDomain?: string;
  /** Builds the href for selecting a domain (undefined = "Alle"). */
  hrefForDomain: (domainId?: string) => string;
};

/**
 * Visual circular category navigation (warm photography) shown above the
 * materials grid — the senior-friendly, image-first way to browse domains.
 */
export function CategoryCircles({
  domains,
  activeDomain,
  hrefForDomain,
}: CategoryCirclesProps) {
  if (domains.length === 0) return null;

  return (
    <nav
      aria-label="Categorieën"
      className="scrollbar-hide mb-6 flex gap-4 overflow-x-auto pb-1"
    >
      <CategoryCircle label="Alle" href={hrefForDomain(undefined)} active={!activeDomain} />
      {domains.map((d) => (
        <CategoryCircle
          key={d.id}
          label={d.name}
          image={d.hero_image_url ?? d.icon_url}
          href={hrefForDomain(d.id)}
          active={activeDomain === d.id}
        />
      ))}
    </nav>
  );
}

function CategoryCircle({
  label,
  image,
  href,
  active,
}: {
  label: string;
  image?: string | null;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex shrink-0 flex-col items-center gap-2"
      aria-current={active ? "true" : undefined}
    >
      <span
        className={`block h-16 w-16 overflow-hidden rounded-full border-[2.5px] transition-transform group-hover:scale-105 ${
          active ? "border-[var(--accent)]" : "border-transparent"
        }`}
      >
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[var(--section-highlight)] font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--accent)]">
            {label.charAt(0)}
          </span>
        )}
      </span>
      <span
        className={`max-w-[72px] truncate text-center text-xs font-semibold ${
          active ? "text-[var(--accent)]" : "text-[var(--foreground)]"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
