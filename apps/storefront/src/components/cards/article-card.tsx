import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import type { Article } from "@/types/platform";

type ArticleCardProps = {
  article: Article;
  className?: string;
};

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorial",
  guide: "Gids",
  inspiration: "Inspiratie",
  interview: "Interview",
  pattern: "Patroon",
};

function ArticleCard({ article, className }: ArticleCardProps) {
  const typeLabel =
    ARTICLE_TYPE_LABELS[article.article_type] ?? article.article_type;

  return (
    <Link href={`/artikel/${article.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <AspectImage
          ratio="video"
          src={article.featured_image_url}
          alt={article.title}
          fallbackImage="placeholderArticle"
          className="-mx-4 -mt-4 mb-3"
        />
        <Badge variant="domain">{typeLabel}</Badge>
        <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
            {article.excerpt}
          </p>
        )}
        {article.reading_time_minutes && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <Clock size={12} aria-hidden="true" />
            {article.reading_time_minutes} min lezen
          </span>
        )}
      </CardShell>
    </Link>
  );
}

export { ArticleCard };
export type { ArticleCardProps };
