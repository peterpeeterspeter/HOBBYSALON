import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CreatorDirectoryItem } from "@/lib/platform/queries/creators";

type CreatorDiscoveryCardProps = {
  creator: CreatorDirectoryItem;
  className?: string;
};

/** Portrait-forward maker tile (less product-card chrome). */
export function CreatorDiscoveryCard({
  creator,
  className,
}: CreatorDiscoveryCardProps) {
  const city = creator.city?.trim();

  return (
    <Link
      href={`/creator/${creator.slug}`}
      className={cn("group block", className)}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]">
        {creator.photoUrl ? (
          <img
            src={creator.photoUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden>
            <span className="font-[family-name:var(--font-heading)] text-4xl font-bold text-[var(--muted)]/35">
              {(creator.studioName || creator.display_name).charAt(0)}
            </span>
          </div>
        )}
      </div>
      <h3 className="mt-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
        {creator.studioName}
      </h3>
      {creator.specialtyLine ? (
        <p className="mt-1 text-[15px] font-semibold text-[var(--muted)] line-clamp-2">
          {creator.specialtyLine}
        </p>
      ) : city ? (
        <p className="mt-1 text-[15px] font-semibold text-[var(--muted)]">{city}</p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] line-clamp-2">
        {creator.offerSentence}
      </p>
      <span className="mt-2 inline-flex text-[15px] font-bold text-[var(--accent)]">
        Bekijk maker
      </span>
    </Link>
  );
}
