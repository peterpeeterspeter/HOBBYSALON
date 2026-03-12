import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Creator } from "@/types/platform";

type CreatorSpotlightProps = {
  creators: Creator[];
  className?: string;
};

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

/**
 * Horizontal scrolling creator showcase with larger avatars.
 * Replaces the identical card grid for creators with a more personal,
 * social-media-style row of profile spotlights.
 */
function CreatorSpotlight({ creators, className }: CreatorSpotlightProps) {
  return (
    <div
      className={cn(
        "flex gap-6 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory",
        className
      )}
      role="list"
    >
      {creators.map((creator) => {
        const types = (creator.creator_types ?? []).map(
          (t) => CREATOR_TYPE_LABELS[t] ?? t
        );

        return (
          <Link
            key={creator.id}
            href={`/creator/${creator.slug}`}
            className="group/creator flex flex-col items-center gap-3 shrink-0 snap-start w-[160px] md:w-[180px] text-center"
            role="listitem"
          >
            {/* Avatar with hover ring */}
            <div className="relative">
              <div className="rounded-full p-0.5 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] opacity-0 group-hover/creator:opacity-100 transition-opacity duration-[var(--transition-normal)]">
                <div className="rounded-full bg-[var(--background)] p-0.5">
                  <Avatar
                    src={creator.avatar_url}
                    alt={creator.display_name}
                    size="xl"
                  />
                </div>
              </div>
              {/* Default state (no gradient ring) */}
              <div className="absolute inset-0 group-hover/creator:opacity-0 transition-opacity duration-[var(--transition-normal)]">
                <Avatar
                  src={creator.avatar_url}
                  alt={creator.display_name}
                  size="xl"
                />
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 w-full">
              <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                {creator.display_name}
              </p>
              {creator.business_name && (
                <p className="text-xs text-[var(--muted)] truncate">
                  {creator.business_name}
                </p>
              )}
              {types.length > 0 && (
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  {types.slice(0, 2).map((t) => (
                    <Badge key={t} variant="format" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export { CreatorSpotlight };
export type { CreatorSpotlightProps };
