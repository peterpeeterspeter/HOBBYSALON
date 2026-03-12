import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight } from "lucide-react";
import type { Article } from "@/types/platform";

type ArticleFeatureProps = {
  articles: Article[];
  className?: string;
};

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorial",
  guide: "Gids",
  inspiration: "Inspiratie",
  interview: "Interview",
  pattern: "Patroon",
};

/**
 * Magazine-style article layout: 1 large featured article + compact list.
 * Replaces the uniform 3-col grid with editorial hierarchy.
 */
function ArticleFeature({ articles, className }: ArticleFeatureProps) {
  if (articles.length === 0) return null;

  const [featured, ...rest] = articles;

  return (
    <div className={cn("grid gap-6 md:grid-cols-5", className)}>
      {/* Featured article — large card spanning 3 cols */}
      <Link
        href={`/artikel/${featured.slug}`}
        className="block md:col-span-3"
      >
        <CardShell variant="interactive" padding="none" className="h-full">
          <AspectImage
            ratio="video"
            src={featured.featured_image_url}
            alt={featured.title}
            fallbackImage="placeholderArticle"
            className="rounded-b-none"
          />
          <div className="p-5 md:p-6">
            <Badge variant="domain">
              {ARTICLE_TYPE_LABELS[featured.article_type] ?? featured.article_type}
            </Badge>
            <h3 className="mt-2 text-xl md:text-2xl font-bold text-[var(--foreground)] font-[family-name:var(--font-heading)] line-clamp-2">
              {featured.title}
            </h3>
            {featured.excerpt && (
              <p className="mt-2 text-sm text-[var(--muted)] line-clamp-3 leading-relaxed">
                {featured.excerpt}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              {featured.reading_time_minutes && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                  <Clock size={12} aria-hidden="true" />
                  {featured.reading_time_minutes} min lezen
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]">
                Lees meer
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </div>
          </div>
        </CardShell>
      </Link>

      {/* Compact list — 2 cols */}
      <div className="md:col-span-2 flex flex-col gap-4">
        {rest.map((article) => (
          <Link
            key={article.id}
            href={`/artikel/${article.slug}`}
            className="group/article block"
          >
            <CardShell variant="interactive" padding="sm" className="flex gap-3 items-start">
              {/* Small thumbnail */}
              <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                <AspectImage
                  ratio="square"
                  src={article.featured_image_url}
                  alt=""
                  fallbackImage="placeholderArticle"
                  className="!rounded-lg h-full w-full"
                />
              </div>
              {/* Text content */}
              <div className="min-w-0 flex-1">
                <Badge variant="domain" className="text-[10px] mb-1">
                  {ARTICLE_TYPE_LABELS[article.article_type] ?? article.article_type}
                </Badge>
                <h4 className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">
                  {article.title}
                </h4>
                {article.reading_time_minutes && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                    <Clock size={10} aria-hidden="true" />
                    {article.reading_time_minutes} min
                  </span>
                )}
              </div>
            </CardShell>
          </Link>
        ))}
      </div>
    </div>
  );
}

export { ArticleFeature };
export type { ArticleFeatureProps };
