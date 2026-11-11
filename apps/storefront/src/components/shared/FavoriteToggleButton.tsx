import { toggleFavoriteAction } from "@/app/actions/favorites";
import type { EntityType } from "@/types/platform";

type FavoriteToggleButtonProps = {
  entityType: EntityType;
  entityId: string;
  isFavorited: boolean;
  nextPath: string;
  /** Override default button labels when the surrounding copy needs a clearer CTA. */
  saveLabel?: string;
  removeLabel?: string;
  className?: string;
};

export function FavoriteToggleButton({
  entityType,
  entityId,
  isFavorited,
  nextPath,
  saveLabel = "Bewaar voor later",
  removeLabel = "Niet meer bewaren",
  className = "inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]",
}: FavoriteToggleButtonProps) {
  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <input type="hidden" name="next_path" value={nextPath} />
      <button type="submit" className={className}>
        {isFavorited ? removeLabel : saveLabel}
      </button>
    </form>
  );
}
