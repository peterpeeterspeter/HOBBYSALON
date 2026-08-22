import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProductCategoryOption } from "@/lib/platform/queries/products";

type MaterialsCategoryNavProps = {
  categories: ProductCategoryOption[];
  activeCategoryId?: string;
  hrefForCategory: (categoryId?: string) => string;
  subcategories?: ProductCategoryOption[];
  activeSubId?: string;
  hrefForSub: (subId?: string) => string;
};

export function MaterialsCategoryNav({
  categories,
  activeCategoryId,
  hrefForCategory,
  subcategories = [],
  activeSubId,
  hrefForSub,
}: MaterialsCategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <section className="mb-5" aria-label="Categorieën">
      <nav className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
        <Link
          href={hrefForCategory(undefined)}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap",
            !activeCategoryId
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
          )}
        >
          Alle materialen
        </Link>
        {categories.map((category) => {
          const active = activeCategoryId === category.id;
          return (
            <Link
              key={category.id}
              href={hrefForCategory(active ? undefined : category.id)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
              )}
              aria-current={active ? "true" : undefined}
            >
              {category.name}
            </Link>
          );
        })}
      </nav>

      {activeCategoryId && subcategories.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Subcategorieën">
          {subcategories.map((sub) => {
            const active = activeSubId === sub.id;
            return (
              <Link
                key={sub.id}
                href={hrefForSub(active ? undefined : sub.id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg border px-3 text-[14px] font-semibold",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
                )}
              >
                {sub.name}
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
