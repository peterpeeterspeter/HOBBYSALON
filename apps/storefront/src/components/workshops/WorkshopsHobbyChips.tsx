import Link from "next/link";
import { cn } from "@/lib/utils";
import { getDomainPlaceholderImage } from "@/components/ui/ai-generated-image";
import type { Domain } from "@/types/platform";
import type { WorkshopCategory } from "@/lib/platform/workshop-taxonomy";

type WorkshopsHobbyChipsProps = {
  domains: Domain[];
  activeDomainId?: string;
  hrefForDomain: (domainId?: string) => string;
  categories?: WorkshopCategory[];
  activeCategoryId?: string;
  hrefForCategory: (categoryId?: string) => string;
  visibleCount?: number;
};

export function WorkshopsHobbyChips({
  domains,
  activeDomainId,
  hrefForDomain,
  categories = [],
  activeCategoryId,
  hrefForCategory,
  visibleCount = 8,
}: WorkshopsHobbyChipsProps) {
  if (domains.length === 0) return null;

  const primary = domains.slice(0, visibleCount);
  const rest = domains.slice(visibleCount);

  return (
    <section className="mt-6" aria-label="Hobby's">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
        Populaire hobby&apos;s
      </h2>
      <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scroll-smooth sm:-mx-6 sm:px-6 [scrollbar-width:thin]">
        {primary.map((domain) => {
          const active = activeDomainId === domain.id;
          const thumb =
            domain.hero_image_url?.trim() ||
            getDomainPlaceholderImage(domain.slug);
          return (
            <Link
              key={domain.id}
              href={hrefForDomain(active ? undefined : domain.id)}
              className={cn(
                "group relative h-28 w-36 shrink-0 snap-start overflow-hidden rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 sm:h-32 sm:w-40",
                active ? "ring-2 ring-[var(--accent)] ring-offset-2" : null
              )}
              aria-current={active ? "true" : undefined}
            >
              <img
                src={thumb}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                loading="lazy"
              />
              <span
                className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/75 via-[var(--foreground)]/20 to-transparent"
                aria-hidden
              />
              <span className="absolute inset-x-0 bottom-0 p-2.5 font-[family-name:var(--font-heading)] text-sm font-bold text-white sm:text-base">
                {domain.name}
              </span>
            </Link>
          );
        })}

        {rest.length > 0 ? (
          <details className="relative shrink-0 snap-start self-center">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold text-[var(--foreground)] hover:border-[var(--accent)] [&::-webkit-details-marker]:hidden">
              Meer hobby&apos;s
            </summary>
            <div className="absolute left-0 z-20 mt-2 flex max-h-72 w-[min(100vw-2rem,18rem)] flex-col gap-1 overflow-y-auto rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)]">
              {rest.map((domain) => {
                const active = activeDomainId === domain.id;
                return (
                  <Link
                    key={domain.id}
                    href={hrefForDomain(active ? undefined : domain.id)}
                    className={cn(
                      "min-h-11 rounded-lg px-3 py-2 text-[15px] font-semibold",
                      active
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--foreground)] hover:bg-[var(--section-highlight)]"
                    )}
                  >
                    {domain.name}
                  </Link>
                );
              })}
            </div>
          </details>
        ) : null}
      </div>

      {activeDomainId && categories.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Subcategorieën">
          {categories.map((category) => {
            const active = activeCategoryId === category.id;
            return (
              <Link
                key={category.id}
                href={hrefForCategory(active ? undefined : category.id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg border px-3 text-[14px] font-semibold",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]"
                )}
              >
                {category.name}
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
