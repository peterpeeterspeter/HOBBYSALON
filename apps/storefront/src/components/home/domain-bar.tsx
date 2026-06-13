import Link from "next/link";
import { getDomainPlaceholderImage } from "@/components/ui/ai-generated-image";

type Domain = {
  id: string;
  slug: string;
  name: string;
  hero_image_url?: string | null;
};

type DomainBarProps = {
  domains: Domain[];
  /** Optional heading rendered above the pill row (e.g. "Kies je creatieve hobby"). */
  title?: string;
};

function DomainBar({ domains, title }: DomainBarProps) {
  if (!domains.length) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-6xl px-4 py-3">
        {title && (
          <h2 className="mb-2.5 font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h2>
        )}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide snap-x">
          {domains.map((domain) => (
          <Link
            key={domain.id}
            href={`/${domain.slug}`}
            className="group/pill inline-flex shrink-0 snap-start items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--card))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] min-h-[40px]"
          >
            <img
              src={domain.hero_image_url ?? getDomainPlaceholderImage(domain.slug)}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full object-cover"
              loading="lazy"
            />
            <span>{domain.name}</span>
          </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export { DomainBar };
export type { DomainBarProps };
