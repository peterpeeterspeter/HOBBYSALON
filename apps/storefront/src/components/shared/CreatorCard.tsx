import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Creator } from "@/types/platform";

type CreatorCardProps = {
  creator: Creator;
  className?: string;
};

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

export function CreatorCard({ creator, className }: CreatorCardProps) {
  const types = (creator.creator_types ?? []).map(
    (t) => CREATOR_TYPE_LABELS[t] ?? t
  );

  return (
    <Link
      href={`/creator/${creator.slug}`}
      className={cn(
        "block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md",
        className
      )}
    >
      <div className="flex gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--border)]">
          {creator.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.display_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl text-[var(--muted)]">
              {creator.display_name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
            {creator.display_name}
          </h3>
          {creator.business_name && (
            <p className="text-sm text-[var(--muted)] truncate">
              {creator.business_name}
            </p>
          )}
          {types.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {types.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
