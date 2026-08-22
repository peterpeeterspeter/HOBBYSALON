import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/content/DifficultyBadge";
import { Clock } from "lucide-react";
import {
  formatArticleDisplayTitle,
  getArticleTypeVisitorLabel,
} from "@/lib/content/article-display";
import type { Article } from "@/types/platform";

type ArticleCardProps = {
  article: Article;
  domainName?: string | null;
  className?: string;
};

function ArticleCard({ article, domainName, className }: ArticleCardProps) {
  const typeLabel = getArticleTypeVisitorLabel(article.article_type);
  const displayTitle = formatArticleDisplayTitle(article.title);

  return (
    <Link href={`/artikel/${article.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <AspectImage
          ratio="video"
          src={article.featured_image_url}
          alt={displayTitle}
          fallbackImage="placeholderArticle"
          className="-mx-4 -mt-4 mb-3"
        />
        <div className="flex flex-wrap gap-2">
          <Badge variant="domain">{typeLabel}</Badge>
          {domainName ? <Badge variant="domain">{domainName}</Badge> : null}
          <DifficultyBadge difficulty={article.difficulty_level} />
        </div>
        <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
          {displayTitle}
        </h3>
        {article.reading_time_minutes ? (
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <Clock size={12} aria-hidden="true" />
            {article.reading_time_minutes} min lezen
          </span>
        ) : null}
      </CardShell>
    </Link>
  );
}

export { ArticleCard };
export type { ArticleCardProps };
