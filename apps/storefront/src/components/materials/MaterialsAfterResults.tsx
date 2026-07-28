import Link from "next/link";
import { ArticleCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import type { Article, Workshop } from "@/types/platform";

type MaterialsAfterResultsProps = {
  workshops: Workshop[];
  articles: Article[];
  workshopsHref?: string;
};

/**
 * Graph / discovery cross-sell — only after the first product row.
 */
export function MaterialsAfterResults({
  workshops,
  articles,
  workshopsHref = "/workshops",
}: MaterialsAfterResultsProps) {
  if (workshops.length === 0 && articles.length === 0) return null;

  return (
    <div className="mt-12 flex flex-col gap-10">
      {workshops.length > 0 ? (
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--section-highlight)] p-5 sm:p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Nog leren?
          </h2>
          <p className="mt-2 text-[15px] text-[var(--muted)]">
            Bekijk workshops die bij deze materialen passen.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {workshops.map((workshop) => (
              <Link
                key={workshop.id}
                href={`/workshop/${workshop.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] font-semibold hover:border-[var(--accent)]"
              >
                {workshop.featured_image_url ? (
                  <img
                    src={workshop.featured_image_url}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                    loading="lazy"
                  />
                ) : null}
                <span className="max-w-[220px] truncate">{workshop.title}</span>
              </Link>
            ))}
          </div>
          <Link
            href={workshopsHref}
            className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4"
          >
            Alle workshops
          </Link>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section>
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Projectinspiratie
          </h2>
          <GridLayout cols={3} gap="md">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </GridLayout>
        </section>
      ) : null}
    </div>
  );
}
