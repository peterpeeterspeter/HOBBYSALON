import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

function CreatorCard({ creator, className }: CreatorCardProps) {
  const types = (creator.creator_types ?? []).map(
    (t) => CREATOR_TYPE_LABELS[t] ?? t
  );

  return (
    <Link href={`/creator/${creator.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <div className="flex gap-4">
          <Avatar
            src={creator.avatar_url}
            alt={creator.display_name}
            size="lg"
          />
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
                  <Badge key={t} variant="format">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardShell>
    </Link>
  );
}

export { CreatorCard };
export type { CreatorCardProps };
