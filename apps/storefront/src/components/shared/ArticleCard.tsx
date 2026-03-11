import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Article } from "@/types/platform";

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorial",
  guide: "Gids",
  inspiration: "Inspiratie",
  interview: "Interview",
  pattern: "Patroon",
};

type ArticleCardProps = {
  article: Article;
  className?: string;
};

export function ArticleCard({ article, className }: ArticleCardProps) {
  const typeLabel = ARTICLE_TYPE_LABELS[article.article_type] ?? article.article_type;

  return (
    <Link
      href={`/artikel/${article.slug}`}
      className={cn(
        "block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md",
        className
      )}
    >
      <div className="aspect-video mb-3 overflow-hidden rounded-md bg-[var(--border)]">
        {article.featured_image_url ? (
          <img
            src={article.featured_image_url}
            alt={article.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted)] text-sm">
            {typeLabel}
          </div>
        )}
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        {typeLabel}
      </span>
      <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
          {article.excerpt}
        </p>
      )}
      {article.reading_time_minutes && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {article.reading_time_minutes} min lezen
        </p>
      )}
    </Link>
  );
}
