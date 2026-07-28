import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CreatorDirectoryItem } from "@/lib/platform/queries/creators";

type CreatorDiscoveryCardProps = {
  creator: CreatorDirectoryItem;
  className?: string;
};

export function CreatorDiscoveryCard({
  creator,
  className,
}: CreatorDiscoveryCardProps) {
  const city = creator.city?.trim();

  return (
    <Link
      href={`/creator/${creator.slug}`}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]",
        className
      )}
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--section-highlight)]">
        {creator.photoUrl ? (
          <img
            src={creator.photoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            aria-hidden="true"
          >
            <span className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--muted)]/40">
              {(creator.studioName || creator.display_name).charAt(0)}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
          {creator.studioName}
        </h3>
        {creator.specialtyLine ? (
          <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)] line-clamp-2">
            {creator.specialtyLine}
          </p>
        ) : city ? (
          <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
            {city}
          </p>
        ) : null}
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)] line-clamp-2">
          {creator.offerSentence}
        </p>
        <span className="mt-auto pt-3 text-[15px] font-bold text-[var(--accent)]">
          Bekijk maker
        </span>
      </div>
    </Link>
  );
}
